# Integração Gcoop — Pré-cadastro de cooperados

## Visão geral

Fluxo implementado:

1. **Cadastro público** (`POST /auth/register`): persiste `dadosGcoopJson` (snapshot do wizard) e consulta `GetPreCadastro` no Gcoop. Se o CPF já existir lá, bloqueia com HTTP 409.
2. **Aprovação** (`POST /admin/cadastros-pendentes/:id/aprovar`): aprova localmente (status `ATIVO`) e envia `POST` ao Gcoop.
3. **Falha Gcoop** (5xx, timeout, rede): cadastro permanece aprovado localmente com `gcoopSyncStatus = PENDENTE_SYNC`.
4. **Reenvio**: painel **Avaliação** (secção “Sincronização Gcoop pendente”) ou cron `GCOOP_SYNC_INTERVAL_MINUTES`.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `GCOOP_API_BASE_URL` | Homolog: `https://gcoop-hm.evoluti.net.br/coopvitta_ws` — Produção: `https://coopvitta-api.evoluti.net.br` (sem `/coopvitta_ws`) |
| `GCOOP_API_USER` | HTTP Basic (homolog: `usrPreCadastro`) |
| `GCOOP_API_PASSWORD` | Senha Basic — **não commitar**; definir só no `.env` da VPS |

O backend gera automaticamente `Authorization: Basic <base64>` a partir de `user:password` (UTF-8). Exemplo de header válido em homologação (não commitar credenciais no Git):

```http
Authorization: Basic dXNyUHJlQ2FkYXN0cm86JjU4NUlqbiMlKTg5KSY=
```

Gerar: `echo -n 'usrPreCadastro:SUA_SENHA' | base64 -w0`
| `GCOOP_API_TIMEOUT_MS` | Timeout das chamadas (default: `HTTP_EXTERNAL_TIMEOUT_MS`) |
| `GCOOP_SYNC_INTERVAL_MINUTES` | Reenvio automático (default 30; `0` desliga) |
| `GCOOP_AREA_COOPERADO_URL` | Portal do cooperado (default: `https://coopvitta-area-cooperado.evoluti.net.br`) |

## Acesso do cooperado vs. app COOPVITTA

- O webservice `ImportPreCadastro` **não possui campo de senha** — apenas dados cadastrais e documentos.
- O cooperado acessa o Gcoop em **https://coopvitta-area-cooperado.evoluti.net.br/** (configurável via `GCOOP_AREA_COOPERADO_URL`).
- A senha de login no Gcoop é gerida **pelo próprio portal Gcoop** (ex.: “Esqueci minha senha” na primeira entrada). Não é possível definir senha Gcoop neste formulário de pré-cadastro até confirmação da Evoluti sobre outro endpoint.
- O app **app.coopvitta.cloud** é a plataforma interna COOPVITTA (escalas, gestão etc.) — fluxo separado do pré-cadastro público.

Se as três primeiras não estiverem definidas, a integração fica desligada (cadastro e aprovação seguem só no app local).

## Endpoints Gcoop utilizados

| Método | Rota |
|--------|------|
| GET | `/Api/ImportPreCadastro/PreCadastro/DadosIniciais` |
| GET | `/Api/ImportPreCadastro/PreCadastro/Cidades?_idUF={id}` |
| GET | `/Api/ImportPreCadastro/PreCadastro/GetPreCadastro?_cpf={cpf}` |
| POST | `/Api/ImportPreCadastro/PreCadastro/Post` |

## Formato real do POST (homologação validada)

A documentação inicial mencionava array `Documentos[]` e campo `TipoSanguineo` string. Na homologação, o formato que **funciona** é:

| Campo | Formato |
|-------|---------|
| Documentos | Campos planos na raiz: `CNH`, `ComprovanteEndereco`, `CarteiraConselho` (arrays de bytes) |
| `Naturalidade` | Sigla UF (ex.: `"CE"`) — **não** o nome da cidade |
| `CidadeNaturalidade` | ID numérico (via `Cidades?_idUF=CE`) |
| `ID_TipoSanguineo` | Apenas o ID (7=O+, 8=O−, etc.) — **não** enviar `TipoSanguineo` string |
| `ID_Pais` | Ex.: `105` = Brasileira (`ListaNacionalidade`) |

Script de teste automatizado (container backend):

```bash
docker exec coopvitta-backend node /app/scripts/test-gcoop-post.cjs
docker exec coopvitta-backend node /app/scripts/test-gcoop-post.cjs 66221271827
```

## Documentos enviados ao Gcoop

IDs confirmados em homologação (`ListaDocumentos`):

| ID | Nome Gcoop | Wizard / tipo no app |
|----|------------|----------------------|
| 18 | CNH | `rgCnh` → `RG_CPF_OU_CNH` |
| 7 | Comprovante de Endereco | `comprovanteResidencia` → `COMPROVANTE_ENDERECO` |
| 5 | Carteira do Conselho | `carteiraConselho` → `CEDULA_IDENTIDADE_CRM` |

De-para automático por palavras-chave no nome do documento (fallback se IDs mudarem em produção).

Arquivos convertidos para `number[]` (bytes). Campo `Foto` sempre `null`.

## Regras de negócio

- `PossuiCursoCooperativismo`: sempre `false`
- `ID_RacaCor`: fallback **ID 6 — “Não Informado”** em homologação
- CTPS: `null`
- Datas: `YYYY-MM-DD`
- CPF duplicado no Gcoop no cadastro: mensagem *"CPF já possui pré-cadastro em análise no Gcoop..."*

## API admin (reenvio)

- `GET /admin/gcoop/sync-pendentes`
- `POST /admin/gcoop/sync-pendentes/:medicoId/retry`
- `POST /admin/gcoop/sync-pendentes/retry-all`

## Migration

```bash
cd backend && npx prisma migrate deploy
```

## Homologação / testes

- Usar CPFs fictícios válidos (dígitos verificadores corretos).
- Homolog: `https://gcoop-hm.evoluti.net.br/coopvitta_ws` (sem barra final).
- Produção (VPS): `https://coopvitta-api.evoluti.net.br` (sem `/coopvitta_ws`).
- `Cidades?_idUF=` usa **sigla UF** (ex.: `CE`), não ID numérico.
- Em produção, conferir novamente IDs em `ListaDocumentos` (podem diferir de homolog).

## Arquivos principais

- `backend/src/services/gcoop/` — client, mapper, sync
- `backend/src/services/cadastro-pendente.service.ts` — hook na aprovação
- `backend/src/services/auth.service.ts` — cadastro + GetPreCadastro
- `frontend/src/features/cadastro-coop/utils/mapRegisterPayload.ts` — `dadosGcoop` no register
