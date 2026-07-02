#!/usr/bin/env bash
# Backup lógico do Postgres Docker (AppVS). Agendar na VPS com cron.
# Uso: ./scripts/backup-postgres.sh
# Opcional: BACKUP_DIR=/caminho CONTAINER=app-medico-postgres POSTGRES_USER=appmedico POSTGRES_DB=appmedico

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Carrega POSTGRES_* do .env do AppVS se ainda não estiver no ambiente
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

CONTAINER="${CONTAINER:-app-medico-postgres}"
POSTGRES_USER="${POSTGRES_USER:-appmedico}"
POSTGRES_DB="${POSTGRES_DB:-appmedico}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/appvs-postgres}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/${POSTGRES_DB}-${STAMP}.dump"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Erro: container '$CONTAINER' não existe. Suba o stack com docker-compose.postgres.yml" >&2
  exit 1
fi

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "Erro: defina POSTGRES_PASSWORD no .env ou no ambiente." >&2
  exit 1
fi

# Formato custom (-Fc) comprimível e fácil de pg_restore
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "/tmp/backup.dump"

docker cp "$CONTAINER:/tmp/backup.dump" "$OUT"
docker exec "$CONTAINER" rm -f /tmp/backup.dump

echo "Backup: $OUT"
echo "Tamanho: $(du -h "$OUT" | cut -f1)"
echo "Restore (exemplo): docker cp $OUT $CONTAINER:/tmp/r.dump && docker exec -it $CONTAINER pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists /tmp/r.dump"
