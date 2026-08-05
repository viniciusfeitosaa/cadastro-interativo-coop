#!/usr/bin/env bash
# Instala Evolution API na VPS COOPVITTA e prepara instância coopvitta-prod
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

INSTANCE_NAME="${EVOLUTION_INSTANCE:-coopvitta-prod}"
APP_ENV="/opt/coopvitta/coopvitta-app/.env"

if [[ ! -f .env ]]; then
  API_KEY="$(openssl rand -hex 24)"
  PG_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  cat > .env <<EOF
AUTHENTICATION_API_KEY=${API_KEY}
POSTGRES_DATABASE=evolution
POSTGRES_USERNAME=evolution
POSTGRES_PASSWORD=${PG_PASS}
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:${PG_PASS}@evolution-postgres:5432/evolution
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_LABELS=true
DATABASE_SAVE_DATA_HISTORIC=true
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://evolution-redis:6379/0
CACHE_REDIS_PREFIX_KEY=coopvitta_evolution
CONFIG_SESSION_PHONE_CLIENT=COOPVITTA
CONFIG_SESSION_PHONE_NAME=Chrome
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true
EVOLUTION_INSTANCE=${INSTANCE_NAME}
EOF
  chmod 600 .env
  echo "Criado .env com chaves geradas."
fi

# shellcheck disable=SC1091
source .env

echo "==> Subindo Evolution API..."
docker compose pull
docker compose up -d

echo "==> Aguardando API..."
for i in $(seq 1 60); do
  if docker run --rm --network evolution_evolution-internal curlimages/curl:8.5.0 -sf "http://evolution-api:8080" &>/dev/null; then
    echo "Evolution API respondendo."
    break
  fi
  sleep 3
  if [[ "$i" -eq 60 ]]; then
    echo "Timeout — veja: docker compose logs evolution-api"
    exit 1
  fi
done

API_KEY="${AUTHENTICATION_API_KEY}"

create_instance() {
  docker run --rm --network evolution_evolution-internal curlimages/curl:8.5.0 -sf -X POST \
    "http://evolution-api:8080/instance/create" \
    -H "apikey: ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"instanceName\":\"${INSTANCE_NAME}\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}" \
    || true
}

echo "==> Criando instância ${INSTANCE_NAME} (se ainda não existir)..."
create_instance

echo "==> Estado da conexão:"
docker run --rm --network evolution_evolution-internal curlimages/curl:8.5.0 -s \
  "http://evolution-api:8080/instance/connectionState/${INSTANCE_NAME}" \
  -H "apikey: ${API_KEY}" || true
echo ""

echo "==> QR Code (base64) — escaneie com o WhatsApp profissional:"
docker run --rm --network evolution_evolution-internal curlimages/curl:8.5.0 -s \
  "http://evolution-api:8080/instance/connect/${INSTANCE_NAME}" \
  -H "apikey: ${API_KEY}" | head -c 400
echo ""
echo "(Resposta completa acima — se houver pairingCode ou base64, use no manager ou gere PNG localmente)"

# Sincronizar variáveis no backend COOPVITTA
if [[ -f "$APP_ENV" ]]; then
  upsert_env() {
    local key="$1" val="$2"
    if grep -q "^${key}=" "$APP_ENV" 2>/dev/null; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$APP_ENV"
    else
      echo "${key}=${val}" >> "$APP_ENV"
    fi
  }
  upsert_env EVOLUTION_API_URL "http://evolution-api:8080"
  upsert_env EVOLUTION_API_KEY "${API_KEY}"
  upsert_env EVOLUTION_INSTANCE "${INSTANCE_NAME}"
  echo ""
  echo "Variáveis EVOLUTION_* atualizadas em ${APP_ENV}"
  echo "Reinicie o backend: cd /opt/coopvitta/coopvitta-app && docker compose -f docker-compose.yml -f docker-compose.postgres.yml -f docker-compose.vps.yml up -d backend"
fi

echo ""
echo "=== Evolution API instalada ==="
echo "Container: evolution-api (rede proxy-network)"
echo "Instância: ${INSTANCE_NAME}"
echo ""
echo "Interface web (Evolution Manager):"
echo "  Container: evolution-manager (rede proxy-network)"
echo "  NPM: wa.coopvitta.cloud → evolution-manager:80 (restringir IP admin)"
echo "  NPM: wa-api.coopvitta.cloud → evolution-api:8080 (restringir IP admin)"
echo "  No login do manager: API URL = https://wa-api.coopvitta.cloud | apikey = AUTHENTICATION_API_KEY"
echo "  Defina SERVER_URL=https://wa-api.coopvitta.cloud no .env se usar webhooks"
echo ""
echo "Teste envio (após conectar QR):"
echo "  curl -X POST http://127.0.0.1:8080/message/sendText/${INSTANCE_NAME} \\"
echo "    -H 'apikey: ${API_KEY}' -H 'Content-Type: application/json' \\"
echo "    -d '{\"number\":\"5511999999999\",\"text\":\"Teste COOPVITTA\"}'"
echo "  (só funciona com NPM/porta exposta ou via rede Docker)"
