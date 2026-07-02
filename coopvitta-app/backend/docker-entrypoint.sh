#!/bin/sh
set -e

# Comandos one-shot (ex.: docker compose run backend npx prisma db seed)
# Sem isto, o Docker passava "npx ..." ao script e o servidor iniciava na mesma.
if [ "$#" -gt 0 ]; then
  case "$1" in
    npx|node|sh)
      exec "$@"
      ;;
  esac
fi

echo "🚀 Iniciando aplicação..."

if [ "${SKIP_PRISMA_MIGRATE:-}" = "1" ]; then
  echo "⚠️  SKIP_PRISMA_MIGRATE=1 — a saltar migrate deploy (não usar em produção salvo exceção)."
else
  echo "📦 Executando migrações do Prisma..."
  if ! npx prisma migrate deploy; then
    echo "❌ prisma migrate deploy falhou — o servidor não será iniciado (schema e BD desalinhados)."
    echo "   Confirme DATABASE_URL, rede à BD e a pasta prisma/migrations na imagem."
    exit 1
  fi
  echo "✅ Migrações concluídas!"
fi

echo "🌐 Iniciando servidor..."
exec node dist/server.js
