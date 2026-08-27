# Integração Onvio — status e pré-requisitos

## Objetivo de produto

Botão no COOPVITTA que, a partir dos dados de um associado, cria/preenche automaticamente um novo cadastro na área Onvio **partner-registration** (Client Center).

## Status atual (2026-08-12)

| Item | Situação |
|------|----------|
| API pública partner-registration | **Não documentada** na Onvio BR Accounting API |
| OAuth `client_id` / `client_secret` | **Pendente** — pedido em `docs/ONVIO-PEDIDO-CREDENCIAIS.md` |
| Integration key | Guardada só no `.env` da VPS como `ONVIO_INTEGRATION_KEY` (não versionar). Se vazou em canal aberto, pedir **rotação** |
| Módulo no app | Scaffold pronto (`backend/src/services/onvio/`). Sync API retorna **503** até `ONVIO_PARTNER_CREATE_PATH` + OAuth |
| UI Associados | Modal “Ver dados”: Abrir Onvio + Copiar dados + Sincronizar via API |
| Spike de auth | `backend/scripts/onvio-spike-auth.cjs` |

## APIs públicas documentadas

Fonte: [Onvio BR Accounting API](https://developerportal.thomsonreuters.com/onvio-br-accounting-api)

| Recurso | Função |
|---------|--------|
| OAuth 2.0 | Authorization code + refresh token |
| `IntegrationResource` | Info / conectividade da integração |
| `ClientInfoResource` | **Listar** clientes acessíveis |
| `InvoiceIntegrationResource` | Lote de arquivos (NF-e, NFS-e, baixas, etc.) |

Nenhum desses recursos cria cadastro em *partner-registration*.

## Variáveis de ambiente

Definir **apenas** no `.env` da VPS (nunca no Git / frontend):

| Variável | Descrição |
|----------|-----------|
| `ONVIO_CLIENT_ID` | OAuth client_id (quando chegar do Onvio) |
| `ONVIO_CLIENT_SECRET` | OAuth client_secret |
| `ONVIO_INTEGRATION_KEY` | Chave de integração (`x-integration-key` — confirmar com Onvio) |
| `ONVIO_API_BASE_URL` | Base da API (quando confirmada) |
| `ONVIO_AUTH_URL` / `ONVIO_TOKEN_URL` | Endpoints OAuth (quando Onvio informar) |
| `ONVIO_AUDIENCE` | Audience OAuth (doc: `409f91f6-dc17-44c8-a5d8-e0a1bafd8b67`) |
| `ONVIO_REDIRECT_URI` | `https://app.coopvitta.cloud/api/integrations/onvio/callback` |
| `ONVIO_REFRESH_TOKEN` | Após fluxo OAuth |
| `ONVIO_PARTNER_CREATE_PATH` | Path REST confirmado pelo Onvio para criar partner-registration |
| `ONVIO_PARTNER_REGISTRATION_URL` | Deep link UI Client Center |

Placeholders: `backend/.env.example`.

## Rotas

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/integrations/onvio/callback` | Público (OAuth redirect) |
| GET | `/api/admin/onvio/status` | Admin MEDICOS |
| GET | `/api/admin/medicos/:id/onvio` | Admin MEDICOS — prep + clipboard |
| POST | `/api/admin/medicos/:id/onvio/sync` | Admin MEDICOS — 503 até path+OAuth |

## Critério para sync API “de verdade”

1. Onvio confirma endpoint REST (ou Swagger) de criação partner-registration **e**
2. `ONVIO_CLIENT_ID` + `ONVIO_CLIENT_SECRET` + `ONVIO_TOKEN_URL` + `ONVIO_API_BASE_URL` + `ONVIO_PARTNER_CREATE_PATH` no `.env`

## Spike de autenticação

```bash
cd /opt/coopvitta/coopvitta-app/backend && node scripts/onvio-spike-auth.cjs
```

Sem OAuth, sai com código 2 e instruções (esperado até o e-mail ser respondido).

## Segurança

- Não commitar secrets nem `.onvio-oauth-tokens.json`.
- Não engenheirar / scrapar a UI do Client Center.
