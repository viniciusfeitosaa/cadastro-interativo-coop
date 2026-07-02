#!/usr/bin/env bash
# Gera otel-collector-config.yaml a partir do template + .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Crie .env a partir de .env.example"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${ZO_ROOT_USER_EMAIL:?Defina ZO_ROOT_USER_EMAIL no .env}"
: "${ZO_ROOT_USER_PASSWORD:?Defina ZO_ROOT_USER_PASSWORD no .env}"

OPENOBSERVE_ORG="${OPENOBSERVE_ORG:-default}"
export OPENOBSERVE_ORG
export OPENOBSERVE_AUTH_BASIC
OPENOBSERVE_AUTH_BASIC="$(printf '%s:%s' "$ZO_ROOT_USER_EMAIL" "$ZO_ROOT_USER_PASSWORD" | base64 -w0)"

envsubst '${OPENOBSERVE_ORG} ${OPENOBSERVE_AUTH_BASIC}' \
  < otel-collector-config.yaml.template \
  > otel-collector-config.yaml

chmod 644 otel-collector-config.yaml
echo "OK: otel-collector-config.yaml gerado."
