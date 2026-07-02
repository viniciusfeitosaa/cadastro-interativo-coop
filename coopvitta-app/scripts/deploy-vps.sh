#!/usr/bin/env bash
# Deploy na VPS: atualiza o código (git) e reconstrói os containers.
# Uso na VPS: a partir da raiz do repositório — ./scripts/deploy-vps.sh
# Ou: DEPLOY_PATH=/caminho/para/AppVS ./scripts/deploy-vps.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${DEPLOY_PATH:-$REPO_ROOT}"

echo "[deploy] Diretório: $(pwd)"
echo "[deploy] Branch: ${DEPLOY_BRANCH:-main}"

BRANCH="${DEPLOY_BRANCH:-main}"

if [ ! -d .git ]; then
  echo "[deploy] Erro: não é um repositório git (falta .git)." >&2
  exit 1
fi

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
# O servidor deve refletir exatamente o remoto; alterações locais em ficheiros
# versionados (ex.: edições manuais na VPS) impedem `git pull` e quebram o deploy.
# Ficheiros ignorados (.env, volumes, etc.) não são afetados.
git reset --hard "origin/${BRANCH}"

if [ ! -f .env ]; then
  echo "[deploy] Aviso: ficheiro .env não encontrado. Crie a partir de .env.example na VPS." >&2
fi

echo "[deploy] Docker compose build + up..."
docker compose -f docker-compose.yml -f docker-compose.postgres.yml -f docker-compose.vps.yml up -d --build

echo "[deploy] Estado dos serviços:"
docker compose ps

echo "[deploy] Concluído."
