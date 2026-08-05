#!/usr/bin/env bash
# Exibe QR Code da instância Evolution para pareamento WhatsApp
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source .env
INSTANCE="${EVOLUTION_INSTANCE:-coopvitta-prod}"
MODE="file"
OUT="/tmp/coopvitta-evolution-qr.png"

if [[ "${1:-}" == "--terminal" ]]; then
  MODE="terminal"
elif [[ -n "${1:-}" ]]; then
  OUT="$1"
fi

RESP="$(docker run --rm --network evolution_evolution-internal curlimages/curl:8.5.0 -s \
  "http://evolution-api:8080/instance/connect/${INSTANCE}" \
  -H "apikey: ${AUTHENTICATION_API_KEY}")"

python3 - <<'PY' "$RESP" "$OUT"
import json, sys, base64, re
data = json.loads(sys.argv[1])
b64 = data.get("base64") or ""
if b64.startswith("data:image"):
    b64 = re.sub(r"^data:image/[^;]+;base64,", "", b64)
if not b64:
    print("QR não disponível. Estado:", data)
    sys.exit(1)
with open(sys.argv[2], "wb") as f:
    f.write(base64.b64decode(b64))
print(sys.argv[2])
PY

if [[ "$MODE" == "terminal" ]]; then
  docker run --rm -v "${OUT}:${OUT}" python:3.12-slim bash -c 'pip install -q pillow >/dev/null && python3 <<PY
from PIL import Image
path = "'"${OUT}"'"
img = Image.open(path).convert("L")
img = img.resize((45, 45), Image.Resampling.NEAREST)
for y in range(img.height):
    line = ""
    for x in range(img.width):
        line += " █"[img.getpixel((x,y)) > 128]
    print(line)
PY' 2>/dev/null
  echo ""
  echo "Se o ASCII não escanear bem, use o link HTTPS abaixo."
fi

docker cp "${OUT}" coopvitta-frontend:/usr/share/nginx/html/evolution-qr.png 2>/dev/null || true

echo ""
echo "QR salvo em: ${OUT}"
echo ""
echo "Abra no navegador (funciona por SSH):"
echo "  https://app.coopvitta.cloud/evolution-qr.png"
echo ""
echo "WhatsApp → Aparelhos conectados → Conectar aparelho → escanear"
echo ""
echo "Após parear, remova o QR público:"
echo "  docker exec coopvitta-frontend rm -f /usr/share/nginx/html/evolution-qr.png"
