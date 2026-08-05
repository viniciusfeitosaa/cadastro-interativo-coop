#!/usr/bin/env bash
# Gera código de pareamento WhatsApp (8 letras) — ideal para acesso só por SSH
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source .env

INSTANCE="${EVOLUTION_INSTANCE:-coopvitta-prod}"
# Número E.164 sem + (DDI+DDD+número). Ex.: 5511999999999
NUMBER="${1:-${WHATSAPP_PAIRING_NUMBER:-}}"

if [[ -z "$NUMBER" ]]; then
  echo "Uso: bash scripts/show-pairing-code.sh 5511999999999"
  echo "  (número do WhatsApp profissional, só dígitos, com DDI 55)"
  exit 1
fi

API_KEY="${AUTHENTICATION_API_KEY}"
NET="evolution_evolution-internal"

state="$(docker run --rm --network "$NET" curlimages/curl:8.5.0 -s \
  "http://evolution-api:8080/instance/connectionState/${INSTANCE}" \
  -H "apikey: ${API_KEY}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('instance',{}).get('state',''))" 2>/dev/null || true)"

if [[ "$state" == "connecting" || "$state" == "open" ]]; then
  echo "==> Reiniciando sessão (estado: ${state:-desconhecido})..."
  docker run --rm --network "$NET" curlimages/curl:8.5.0 -s -X DELETE \
    "http://evolution-api:8080/instance/logout/${INSTANCE}" \
    -H "apikey: ${API_KEY}" >/dev/null || true
  sleep 2
fi

echo "==> Gerando código para o número ${NUMBER} ..."
RESP="$(docker run --rm --network "$NET" curlimages/curl:8.5.0 -s \
  "http://evolution-api:8080/instance/connect/${INSTANCE}?number=${NUMBER}" \
  -H "apikey: ${API_KEY}")"

CODE="$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pairingCode') or '')" 2>/dev/null || true)"

if [[ -z "$CODE" ]]; then
  echo "Não foi possível obter pairingCode. Resposta da API:"
  echo "$RESP"
  exit 1
fi

echo ""
echo "============================================"
echo "  CÓDIGO DE PAREAMENTO:  ${CODE}"
echo "  Número: ${NUMBER}"
echo "============================================"
echo ""
echo "No celular (WhatsApp desse número):"
echo "  1. Aparelhos conectados"
echo "  2. Conectar aparelho"
echo "  3. Conectar com número de telefone"
echo "  4. Digite o código acima (válido ~1 minuto)"
echo ""
echo "Se expirar, rode de novo:"
echo "  bash scripts/show-pairing-code.sh ${NUMBER}"
