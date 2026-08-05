# Evolution API — WhatsApp COOPVITTA

Stack self-hosted para envio de WhatsApp a partir do **coopvitta-app** (hoje: *Esqueci minha senha* para associados com telefone cadastrado).

Documentação oficial: [docs.evolutionfoundation.com.br/evolution-api](https://docs.evolutionfoundation.com.br/evolution-api)

## Modo atual: Baileys (QR Code)

- Número vinculado via **WhatsApp Web** (escaneie QR após o install)
- **Não é API oficial Meta** — use número de teste ou aceite risco de banimento em automação pesada
- Migração futura: [WhatsApp Cloud API](https://docs.evolutionfoundation.com.br/evolution-api/integrations/cloudapi.md)

## Componentes na VPS

| Container | Função |
|-----------|--------|
| `evolution-api` | API REST + **Manager embutido** em `/manager` (porta 8080, rede `proxy-network`) |
| `evolution-postgres` | Banco dedicado (sessões, mensagens) |
| `evolution-redis` | Cache |

> **Nota:** a imagem `evoapicloud/evolution-manager` separada está com bug de nginx (`must-revalidate`). A v2.3.7 já serve o Manager em `http://evolution-api:8080/manager`.

Pasta em produção: `/opt/coopvitta/infra/evolution/`

## Instalação

```bash
cd /opt/coopvitta/infra/evolution
bash scripts/install.sh
```

O script:
1. Gera `.env` com `AUTHENTICATION_API_KEY` e senha do Postgres
2. Sobe os containers (API + **Evolution Manager** + Postgres + Redis)
3. Cria instância `coopvitta-prod`
4. Mostra estado / QR para pareamento
5. Grava `EVOLUTION_*` em `/opt/coopvitta/coopvitta-app/.env`

Depois, reinicie o backend:

```bash
cd /opt/coopvitta/coopvitta-app
docker compose -f docker-compose.yml -f docker-compose.postgres.yml -f docker-compose.vps.yml up -d --build backend
```

## Interface web (Evolution Manager)

Painel em **`/manager`** na própria Evolution API — parear WhatsApp, ver status, testar envio.

### NPM (produção)

| DNS | Proxy Host → container |
|-----|------------------------|
| `wa.coopvitta.cloud` | `evolution-api:8080` |

**URL:** `https://wa.coopvitta.cloud/manager` (após DNS + SSL no NPM)

**Login no manager:**
- API URL: `https://wa.coopvitta.cloud`
- API Key: `AUTHENTICATION_API_KEY` em `infra/evolution/.env`

No `.env` da Evolution:

```env
SERVER_URL=https://wa.coopvitta.cloud
CORS_ORIGIN=https://wa.coopvitta.cloud
```

### DNS obrigatório

Registro **A** no painel do domínio:

```
wa.coopvitta.cloud  →  187.127.35.253
```

Sem esse DNS o manager não abre no navegador. HTTP já responde na VPS (testado); falta só o registro e depois SSL no NPM (porta 81).

### Subir / atualizar stack

```bash
cd /opt/coopvitta/infra/evolution
docker compose up -d
docker compose restart evolution-api
```

Scripts SSH (`show-qr.sh`, `show-pairing-code.sh`) continuam como fallback.

## Parear WhatsApp (recomendado por SSH — sem imagem)

Use **código de 8 letras** em vez do QR:

```bash
cd /opt/coopvitta/infra/evolution
bash scripts/show-pairing-code.sh 5511999999999
```

Substitua pelo número do WhatsApp profissional (DDI 55 + DDD + número, **só dígitos**).

No celular:
1. WhatsApp → **Aparelhos conectados**
2. **Conectar aparelho** → **Conectar com número de telefone**
3. Digite o código exibido no terminal (expira em ~1 min — gere de novo se precisar)

## Parear via QR (alternativa)

Se tiver navegador no celular/PC (não precisa ser na VPS):

```bash
bash scripts/show-qr.sh
# Abra: https://app.coopvitta.cloud/evolution-qr.png
```

Ou QR no terminal: `bash scripts/show-qr.sh --terminal`

## Integração COOPVITTA (backend)

Variáveis em `coopvitta-app/.env`:

```env
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<AUTHENTICATION_API_KEY do evolution/.env>
EVOLUTION_INSTANCE=coopvitta-prod
```

Endpoint usado: `POST /message/sendText/{instance}` com header `apikey` (não Bearer).

Fluxo ativo: **esqueci senha** — se o associado tem `telefone` válido e Evolution configurado, envia link de redefinição por WhatsApp (senão e-mail).

## HTTPS (NPM)

Ver seção **Interface web** acima. Resumo:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `wa` | IP da VPS |
| A | `wa-api` | IP da VPS |

- `wa.coopvitta.cloud` → `evolution-manager:80`
- `wa-api.coopvitta.cloud` → `evolution-api:8080`

Restringir ambos por IP no NPM.

## Casos de uso planejados

| Prioridade | Fluxo | Status |
|------------|-------|--------|
| Alta | Esqueci senha | Implementado no backend |
| Média | Cadastro aprovado / rejeitado | Pendente |
| Média | Convite DocuSeal | Pendente |
| Baixa | Webhook mensagens recebidas | Pendente |

## Comandos úteis

```bash
cd /opt/coopvitta/infra/evolution
docker compose ps
docker compose logs -f evolution-api
docker compose restart evolution-api
```

## LGPD e uso institucional

- Obter consentimento para contato por WhatsApp no cadastro
- Não enviar dados clínicos sensíveis por WhatsApp
- Para canal oficial da cooperativa, planejar **WhatsApp Cloud API (Meta)**

## Próximos passos

- [ ] Subir `evolution-manager` e configurar NPM (`wa` + `wa-api`)
- [ ] Parear número profissional (manager ou QR)
- [ ] Testar esqueci-senha com associado de teste
- [ ] Notificação de aprovação de cadastro
- [ ] Avaliar migração Cloud API
