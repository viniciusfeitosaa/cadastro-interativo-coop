#!/usr/bin/env bash
# Hardening inicial da VPS COOPVITTA (187.127.35.253)
# Executar como root: sudo bash scripts/harden-vps.sh
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-coopvitta}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
BASE_DIR="/opt/coopvitta"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Execute como root: sudo bash $0"
  exit 1
fi

echo "==> Atualizando pacotes do sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl gnupg git ufw fail2ban htop unzip unattended-upgrades

echo "==> Configurando atualizações automáticas de segurança..."
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

echo "==> Criando swap (${SWAP_SIZE})..."
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l "${SWAP_SIZE}" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Configurando usuário de deploy (${DEPLOY_USER})..."
if ! id "${DEPLOY_USER}" &>/dev/null; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
fi
usermod -aG sudo,docker "${DEPLOY_USER}" 2>/dev/null || usermod -aG sudo "${DEPLOY_USER}"

echo "==> Endurecendo SSH..."
install -d -m 0755 /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-coopvitta-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers ${DEPLOY_USER}
X11Forwarding no
AllowTcpForwarding no
EOF

sshd -t
systemctl reload ssh

echo "==> Configurando fail2ban (SSH)..."
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
port     = ssh
filter   = sshd
maxretry = 3
bantime  = 24h
EOF
systemctl enable --now fail2ban

echo "==> Configurando UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp comment 'HTTP (NPM)'
ufw allow 443/tcp comment 'HTTPS (NPM)'
ufw allow 81/tcp comment 'NPM painel'
ufw allow 587/tcp comment 'SMTP submission (Maddy)'
ufw --force enable

echo "==> Ajustes de kernel (rede)..."
cat > /etc/sysctl.d/99-coopvitta-security.conf <<'EOF'
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.tcp_syncookies = 1
EOF
sysctl --system >/dev/null

echo "==> Criando estrutura base em ${BASE_DIR}..."
mkdir -p "${BASE_DIR}"/{infra/nginx-proxy-manager/{data,letsencrypt},infra/maddy/certs}
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${BASE_DIR}"

echo ""
echo "Hardening concluído."
echo ""
echo "IMPORTANTE:"
echo "  1. Confirme que ${DEPLOY_USER} tem chave SSH em ~/.ssh/authorized_keys ANTES de fechar esta sessão."
echo "  2. Root SSH foi desabilitado (PermitRootLogin no)."
echo "  3. Faça logout/login para o grupo docker valer: newgrp docker"
echo "  4. UFW ativo — portas abertas: 22, 80, 443, 81, 587"
echo "  5. Swap: $(swapon --show | tail -1 || echo 'verificar manualmente')"
echo ""
echo "Próximo passo: seguir docs/SETUP-VPS-COOPVITTA.md a partir da seção 5 (rede Docker)."
