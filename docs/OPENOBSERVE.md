# OpenObserve — observabilidade VPS COOPVITTA

Stack em `/opt/coopvitta/infra/openobserve/` (logs, métricas, rotas HTTP).

## Componentes

| Container | Função |
|-----------|--------|
| `openobserve` | UI + armazenamento (logs/métricas/traces) |
| `openobserve-otel-collector` | Coleta Docker logs, métricas host/containers, access logs NPM |

## Streams (dados)

| Stream | Conteúdo |
|--------|----------|
| `docker-logs` | stdout/stderr de todos os containers |
| `nginx-routes` | Access logs do NPM (`proxy-host-*_access.log`) — método, path, status, IP |
| `host-metrics` | CPU, memória, disco, rede da VPS |
| `docker-metrics` | CPU/memória por container |

## Instalação

```bash
cd /opt/coopvitta/infra/openobserve
bash scripts/install.sh
```

Credenciais em `.env` (`ZO_ROOT_USER_EMAIL` / `ZO_ROOT_USER_PASSWORD`).

## Acesso HTTPS

**URL atual (sem DNS extra):** [https://app.coopvitta.cloud/obs/](https://app.coopvitta.cloud/obs/)

## Credenciais

Arquivo: `/opt/coopvitta/infra/openobserve/.env`

**Não use** `openobserve reset -c root` sem recriar o usuário no SQLite — pode corromper `user_record`/`org_users` e causar logout imediato após login. Se isso ocorrer:

```bash
cd /opt/coopvitta/infra/openobserve
docker compose stop openobserve otel-collector
docker run --rm -v openobserve_openobserve_data:/data alpine sh -c '
  apk add --no-cache sqlite >/dev/null
  sqlite3 /data/db/metadata.sqlite "DELETE FROM meta WHERE module IN ('"'"'user_record'"'"', '"'"'org_users'"'"');"
  rm -f /data/db/metadata.sqlite-wal /data/db/metadata.sqlite-shm
'
docker compose up -d openobserve otel-collector
```

### Subdomínio dedicado (opcional)

`obs.coopvitta.cloud` retorna **NXDOMAIN** até criar o registro DNS:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `obs` | `187.127.35.253` |

DNS atual de `coopvitta.cloud`: Hostinger (`orbit.dns-parking.com`). Adicione o registro no painel onde gerencia o domínio.

Depois, no NPM: Proxy Host `obs.coopvitta.cloud` → `openobserve:5080` (e remova `ZO_BASE_URI` se quiser UI na raiz do subdomínio).

## Acesso via NPM (legado)

## Rotas da aplicação

- Logs HTTP do backend: `REQUEST_LOG_MS=200` no `.env` do `coopvitta-app` (requisições lentas → stdout → stream `docker-logs`)
- Rotas públicas (login, cadastro, API): stream `nginx-routes` com `host`, `path`, `method`, `status`

## Comandos úteis

```bash
cd /opt/coopvitta/infra/openobserve
docker compose ps
docker compose logs -f openobserve
docker compose logs -f otel-collector
bash scripts/render-otel-config.sh   # após mudar senha no .env
docker compose up -d
```

## Próximos passos (opcional)

- Dashboards e alertas na UI OpenObserve
- Traces OTLP no backend Node (`@opentelemetry/sdk-node`)
- Restringir `obs.coopvitta.cloud` por IP no NPM
