#!/usr/bin/env bash
# Diagnóstico rápido da VPS COOPVITTA (sem precisar de root para a maioria dos checks)
set -uo pipefail

ok()   { printf '  \033[32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m[WARN]\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m[FAIL]\033[0m %s\n' "$*"; }

echo "=== VPS COOPVITTA — Status ==="
echo "Hostname: $(hostname)"
echo "IP público: $(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo 'N/A')"
echo "Usuário: $(whoami)"
echo ""

echo "Recursos:"
free -h | sed 's/^/  /'
if swapon --show 2>/dev/null | grep -q .; then
  ok "Swap ativo"
else
  warn "Swap não configurado (recomendado 2 GB)"
fi
echo ""

echo "Permissões:"
groups | grep -q sudo && ok "Usuário no grupo sudo" || warn "Sem sudo — necessário para deploy"
groups | grep -q docker && ok "Usuário no grupo docker" || warn "Sem acesso ao Docker"
test -d /opt/coopvitta && ok "/opt/coopvitta existe" || warn "/opt/coopvitta não criado"
echo ""

echo "Segurança:"
if command -v ufw >/dev/null && sudo ufw status 2>/dev/null | grep -q "Status: active"; then
  ok "UFW ativo"
else
  warn "UFW inativo ou sem permissão"
fi
if ss -tln 2>/dev/null | grep -qE '0\.0\.0\.0:(3001|8082|5432) '; then
  warn "Portas internas expostas em 0.0.0.0 (3001/8082/5432) — rode scripts/apply-server-rules.sh"
else
  ok "Portas 3001/8082/5432 não publicadas em 0.0.0.0"
fi
systemctl is-active fail2ban &>/dev/null && ok "fail2ban ativo" || warn "fail2ban inativo"
grep -q "PermitRootLogin no" /etc/ssh/sshd_config.d/*.conf 2>/dev/null && ok "Root SSH desabilitado" || warn "PermitRootLogin ainda permite root"
test -s ~/.ssh/authorized_keys 2>/dev/null && ok "Chave SSH configurada" || warn "Nenhuma chave SSH em ~/.ssh/authorized_keys"
echo ""

echo "Docker:"
if docker ps &>/dev/null; then
  ok "Docker acessível"
  docker ps --format '  {{.Names}}: {{.Status}}' 2>/dev/null | head -10
else
  warn "Docker sem acesso ($(docker ps 2>&1 | tail -1))"
fi
docker network ls 2>/dev/null | grep -q proxy-network && ok "Rede proxy-network existe" || warn "Rede proxy-network não criada"
echo ""

echo "Projetos:"
for dir in /opt/coopvitta/infra /opt/coopvitta/coopvitta-app /opt/coopvitta/cadastro-interativo-coop /opt/coopvitta/docuseal; do
  test -d "$dir" && ok "$dir" || warn "$dir ausente"
done
test -d ~/cadastro-interativo-coop && ok "~/cadastro-interativo-coop (clone local)" || true
