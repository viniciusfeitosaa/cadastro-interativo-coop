#!/usr/bin/env bash
# Instala e sobe OpenObserve na VPS COOPVITTA
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  PASS="$(openssl rand -base64 24)"
  cat > .env <<EOF
ZO_ROOT_USER_EMAIL=admin@coopvitta.cloud
ZO_ROOT_USER_PASSWORD=${PASS}
OPENOBSERVE_ORG=default
EOF
  chmod 600 .env
  echo "Criado .env com senha aleatória. Guarde as credenciais:"
  echo "  Email: admin@coopvitta.cloud"
  echo "  Senha: ${PASS}"
fi

bash scripts/render-otel-config.sh

echo "==> Subindo OpenObserve..."
docker compose pull
docker compose up -d

echo "==> Aguardando OpenObserve..."
for i in $(seq 1 45); do
  if docker run --rm --network openobserve_observability curlimages/curl:8.5.0 -sf http://openobserve:5080/healthz &>/dev/null; then
    echo "OpenObserve healthy."
    break
  fi
  sleep 2
  if [[ "$i" -eq 45 ]]; then
    echo "Timeout — veja: docker compose logs openobserve"
    exit 1
  fi
done

docker compose up -d otel-collector

echo ""
echo "=== OpenObserve instalado ==="
echo "Container: openobserve (rede proxy-network)"
echo ""
echo "Próximo passo — NPM (painel :81):"
echo "  1. DNS A: obs.coopvitta.cloud → IP da VPS"
echo "  2. Proxy Host: obs.coopvitta.cloud → openobserve:5080 (HTTP)"
echo "  3. SSL Let's Encrypt + Force SSL"
echo ""
echo "Login UI: email/senha do .env (ZO_ROOT_USER_*)"
echo "Streams: docker-logs | nginx-routes | host-metrics | docker-metrics"
