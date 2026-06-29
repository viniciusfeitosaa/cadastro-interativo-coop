#!/usr/bin/env bash
# Regras de segurança da VPS COOPVITTA (SETUP-VPS-COOPVITTA.md §3.5)
# Executar: sudo bash scripts/apply-server-rules.sh
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-coopvitta}"
NPM_ADMIN_IP="${NPM_ADMIN_IP:-}"  # ex.: NPM_ADMIN_IP=203.0.113.10 sudo bash ...

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Execute como root: sudo bash $0"
  exit 1
fi

echo "==> UFW: garantir política base..."
ufw --force default deny incoming
ufw --force default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp comment 'HTTP (NPM)'
ufw allow 443/tcp comment 'HTTPS (NPM)'
ufw allow 587/tcp comment 'SMTP submission (Maddy)'

# Painel NPM — restringir por IP se NPM_ADMIN_IP definido
if [[ -n "${NPM_ADMIN_IP}" ]]; then
  ufw delete allow 81/tcp 2>/dev/null || true
  ufw allow from "${NPM_ADMIN_IP}" to any port 81 proto tcp comment 'NPM painel (IP admin)'
  echo "    Porta 81 liberada apenas para ${NPM_ADMIN_IP}"
else
  ufw allow 81/tcp comment 'NPM painel (restrinja com NPM_ADMIN_IP=...)'
  echo "    AVISO: porta 81 aberta para todos. Use NPM_ADMIN_IP=seu.ip sudo bash $0"
fi

echo "==> UFW: negar portas internas (defesa em profundidade)..."
for rule in "3001/tcp:Backend app" "8082/tcp:Frontend app" "5432/tcp:PostgreSQL" "3080/tcp:Cadastro legado"; do
  port="${rule%%:*}"
  label="${rule#*:}"
  ufw deny "${port}" comment "${label} — não expor publicamente" 2>/dev/null || true
done

ufw --force enable

echo "==> fail2ban: recarregar..."
systemctl is-active fail2ban &>/dev/null && fail2ban-client reload || systemctl enable --now fail2ban

echo "==> Docker: republicar app com portas em 127.0.0.1..."
APP_DIR="/opt/coopvitta/coopvitta-app"
if [[ -d "${APP_DIR}" ]] && id "${DEPLOY_USER}" &>/dev/null; then
  sudo -u "${DEPLOY_USER}" bash -c "
    cd '${APP_DIR}' &&
    docker compose -f docker-compose.yml -f docker-compose.postgres.yml -f docker-compose.vps.yml up -d --remove-orphans
  "
fi

echo ""
echo "Regras aplicadas."
echo "Verifique portas expostas: ss -tlnp | grep -E '0.0.0.0:(3001|8082|5432|3080)' || echo 'OK — portas internas não em 0.0.0.0'"
ufw status numbered | head -25
