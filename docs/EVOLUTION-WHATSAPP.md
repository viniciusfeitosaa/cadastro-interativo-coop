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
EVOLUTION_INSTANCE=CoopVitta - Prod Lais
# Opcional — encaminhamento do menu para a equipe:
WHATSAPP_MENU_ADMIN_NUMBER=5585XXXXXXXXX
WHATSAPP_MENU_FINANCE_NUMBER=5585XXXXXXXXX
WHATSAPP_MENU_DUDAS_NUMBER=5585XXXXXXXXX
```

Endpoint usado: `POST /message/sendText/{instance}` com header `apikey` (não Bearer).

### Fluxos ativos

| Fluxo | Status |
|-------|--------|
| Esqueci senha (associado com telefone) | Ativo via Evolution |
| Bot atendimento (instância **CoopVitta - Prod Lais**) | Ativo — webhook `MESSAGES_UPSERT` / `SEND_MESSAGE` → `POST /api/whatsapp/evolution` |

### Bot — fluxo do menu

1. Dentro do expediente (seg–sex 08:00–17:00, `America/Fortaleza`): boas-vindas + “já é cooperado?”
2. Fora do expediente: aviso de horário; digite `menu` no próximo dia útil
3. Cooperado **sim** → áreas 1 Administrativo / 2 Financeiro / 3 Dúvidas → ack + aviso à equipe (se `WHATSAPP_MENU_*`)
4. Cooperado **não** → quer cadastrar? **sim** → link `https://app.coopvitta.cloud/cadastro` · **não** → pede dúvida e encaminha para Dúvidas
5. Comandos do usuário: `menu` (recomeça / reativa o robô) · `sair` (encerra)
6. Após escolher área (ou enviar dúvida), o robô **para de responder** nessa conversa (estado `routed`) para não marcar como vista nem atrapalhar o atendimento
7. Equipe: `pausar` / `retomar` (comandos processados mesmo logo após o robô falar; mensagem apagada para o cliente). Na **primeira** pausa o cliente recebe **uma** dica (“digite *menu*”); nas mensagens seguintes do cliente o robô fica em silêncio. Webhook também escuta `SEND_MESSAGE`. Usuário: `menu` reativa
8. Aviso à equipe (se `WHATSAPP_MENU_*`): inclui nome do WhatsApp, telefone formatado e link `wa.me`

Webhook (só na instância Lais):

```bash
# URL: https://app.coopvitta.cloud/api/whatsapp/evolution
# events: MESSAGES_UPSERT · SEND_MESSAGE · MESSAGES_UPDATE · enabled: true
```

A instância antiga `coopvitta-prod` permanece com webhook **desligado**.

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
| Média | Bot menu atendimento (Prod Lais) | Ativo (webhook + fluxo cooperado/cadastro) |
| Média | Cadastro aprovado / rejeitado | Pendente |
| Média | Convite DocuSeal | Pendente |
| Baixa | Cloud API Meta | Avaliar depois |

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
