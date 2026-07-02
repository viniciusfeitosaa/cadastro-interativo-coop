#!/usr/bin/env bash
# Primeira configuração: Capacitor + iOS + Android com WebView remota (CAPACITOR_SERVER_URL no frontend/.env).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm não encontrado no PATH. O Capacitor precisa de Node.js 18 ou superior neste Mac."
  echo ""
  echo "Opções comuns no macOS:"
  echo "  1) Homebrew:  brew install node"
  echo "  2) Instalador oficial (LTS): https://nodejs.org/"
  echo ""
  echo "Depois feche e reabra o Terminal (ou execute: rehash) e confira:  node -v && npm -v"
  exit 1
fi

if [[ ! -f .env ]] && [[ -z "${CAPACITOR_SERVER_URL:-}" ]]; then
  echo "Crie frontend/.env com CAPACITOR_SERVER_URL=https://sejavivasaude.com.br/app/login (HTTPS) ou exporte a variável."
  exit 1
fi

npm install
npm run build
npm run mobile:config

if [[ ! -d ios ]]; then
  npx cap add ios
fi
if [[ ! -d android ]]; then
  npx cap add android
fi

npx cap sync
echo ""
echo "Pronto. Xcode: npm run mobile:open:ios  |  Android Studio: npm run mobile:open:android"
