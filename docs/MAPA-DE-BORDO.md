# Mapa de Bordo — COOPVITTA

> Última atualização: 2026-08-05

## Histórico de evolução

Itens concluídos (mais recentes no topo):

- [x] **2026-08-05** — **Importação em lote na Avaliação**: colar lista (Excel/TSV) → pré-visualização → `PENDENTE_ANALISE` via `POST /admin/cadastros-pendentes/import-lote` (UI em `/avaliacao`, sem documentos/e-mail).
- [x] **2026-07-30** — **APH opcional** no wizard de pré-cadastro público (demais anexos continuam obrigatórios).
- [x] **2026-07-21** — **Gcoop mapeamento + CPF já filiado**: `Serviço Social` → ASSISTENTE SOCIAL/CRESS; 400 com CPF já existente/filiado marca `SINCRONIZADO`; mensagens de erro da API mais legíveis.
- [x] **2026-07-20** — **Gcoop POST sem OOM**: serialização de documentos sem `number[]`; heap 768 MB / container 1 GB; timeout POST 120 s; volume Docker `coopvitta_uploads` para não perder anexos em rebuild.
- [x] **2026-07-13** — **Gcoop produção**: URL `https://coopvitta-api.evoluti.net.br` (sem `/coopvitta_ws`); `DadosIniciais` 200 após liberação de role Evoluti; credenciais iguais à homolog.
- [x] **2026-07-13** — **UX Avaliação / Associados / e-mails**: filtros e modal em Avaliação; “Ver dados” em Médicos; e-mail pós-aprovação alinhado ao portal Gcoop; sem segundo e-mail de boas-vindas no pré-cadastro.
- [x] **2026-07-07** — **Gcoop em produção (homolog)**: código deployado na VPS, `GCOOP_*` no `.env`, migration aplicada, `DadosIniciais` OK a partir do container backend; pendente teste E2E cadastro → aprovação → POST.
- [x] **2026-07-07** — **Integração Gcoop (código)**: client HTTP Basic, `dadosGcoopJson`, GetPreCadastro no cadastro, POST na aprovação, fallback `PENDENTE_SYNC`, reenvio admin/cron — ver `coopvitta-app/docs/GCOOP-INTEGRACAO.md`.
- [x] **2026-07-07** — **DocuSeal e-mail COOPVITTA**: conta admin, segunda parte e reply-to → `rtenfermagem@coopvitta.org` (antes `contato@coopvitta.org`).
- [x] **2026-07-07** — **Evolution Manager**: acesso via `https://app.coopvitta.cloud/manager` + API em `/evolution-api` (NPM/SSL).

- [x] **2026-06-28** — **Cadastro 413 (upload)**: `client_max_body_size 320m` no nginx frontend + NPM; cadastro com documentos passa pelo proxy.
- [x] **2026-06-28** — **Rotas SPA sem /app/**: redirects nginx para `/esqueci-senha`, `/redefinir-senha`, `/ativar-conta/*`.
- [x] **2026-06-28** — **Links de e-mail**: `FRONTEND_APP_URL=https://app.coopvitta.cloud/app` em convites e redefinição de senha.
- [x] **2026-06-28** — **Healthchecks Docker**: IPv4 (`127.0.0.1`) — containers `coopvitta-backend` e `coopvitta-frontend` healthy.
- [x] **2026-06-28** — **Landing no build**: removido `SKIP_LANDING_MERGE=1` do Dockerfile; raiz serve site estático.
- [x] **2026-06-28** — **Cadastro integrado**: wizard COOPVITTA em `/app/cadastro` (commit restaurado no coopvitta-app).
- [x] **2026-06-28** — **SSH GitHub**: chave VPS configurada; push para `cadastro-interativo-coop`.
- [x] **2026-06-28** — **DocuSeal download 500**: `SECRET_KEY_BASE` sincronizado; downloads OK.
- [x] **2026-06-28** — **mail.coopvitta.cloud HTTP**: proxy NPM desativado (SMTP permanece no Maddy).

- [x] **2026-06-29** — **Camadas de segurança backend**: Redis + rate limit 100/min (auth), timeouts HTTP/DB, sanitização body, fila BullMQ e-mails, JWT default 15m.
- [x] **2026-06-29** — **502 API pós-deploy**: nginx frontend com `resolver 127.0.0.11` + `proxy_pass` dinâmico — evita IP em cache após restart do backend.
- [x] **2026-06-29** — **Governança e resiliência**: Helmet+CSP+HSTS, log scrubbing, circuit breaker (APIs externas), shutdown gracioso, BCrypt≥12, util AES-256-GCM opcional, auditoria sanitizada.
- [x] **2026-06-29** — **SPA na raiz**: sem landing; login em `https://app.coopvitta.cloud/`; API em `/api`; redirects legado `/app/*`.
- [x] **2026-06-30** — **OpenObserve**: stack em `/opt/coopvitta/infra/openobserve` — logs Docker, métricas host/containers, rotas NPM.
- [x] **2026-07-06** — **Evolution API (WhatsApp)**: stack em `/opt/coopvitta/infra/evolution` — PoC Baileys; integração esqueci-senha via `EVOLUTION_*`.

## 🗺️ Mapa de Bordo (Backlog Técnico e Próximos Passos)

Esta seção lista o que está planejado ou pendente. À medida que os itens são concluídos, eles são movidos pelo agente para o histórico de evolução acima.

- [ ] 🟥 **Alta Prioridade**: Cadastros com anexos perdidos (antes do volume `coopvitta_uploads`, ~20/07) — reenviar documentos ou fluxo admin de reupload; sem binário o Gcoop/“Ver dados” ficam incompletos
- [ ] 🟨 **Média Prioridade**: Bot WhatsApp (menu 1/2/3) — código em `whatsapp-menu.service.ts` desligado; reativar webhook Evolution + números `WHATSAPP_MENU_*` quando quiser atendimento
- [ ] 🟨 **Média Prioridade**: Parear/validar WhatsApp Evolution em `https://wa.coopvitta.cloud/manager` e testar esqueci-senha por WhatsApp
- [ ] 🟨 **Média Prioridade**: Redirecionar `cadastro.coopvitta.cloud` → `app.coopvitta.cloud/cadastro`
- [ ] 🟨 **Média Prioridade**: JWT em produção ainda `JWT_EXPIRES_IN=24h` no `.env` — validar refresh token no frontend antes de reduzir para 15m
- [ ] 🟨 **Média Prioridade**: Ativar `FIELD_ENCRYPTION_KEY` no `.env` se campos sensíveis forem criptografados em repouso (CPF hoje em texto para índice único)
- [ ] 🟨 **Média Prioridade**: Atualizar `iOS Info.plist` e strings nativas restantes para COOPVITTA
- [ ] 🟨 **Média Prioridade**: Restringir painel NPM (porta 81) ao IP do administrador — `NPM_ADMIN_IP=seu.ip sudo bash scripts/apply-server-rules.sh`
- [ ] 🟩 **Baixa Prioridade**: APH obrigatório só para quem atua em UPA (desistido por ora; reabrir se produto pedir)
- [ ] 🟩 **Baixa Prioridade**: Otimizar imagens estáticas da landing (hero, ícones PWA)
- [ ] 🟩 **Baixa Prioridade**: Proxy NPM para `coopvitta.cloud` / `www` se domínio raiz for usado
- [ ] ⚠️ **Débito Técnico Mapeado**: `web/`+`server/` (cadastro legado) vs cadastro integrado em `coopvitta-app/frontend` — desativar stack legada quando não houver uso
- [ ] ⚠️ **Débito Técnico Mapeado**: `express.json` limitado a 10mb enquanto multer aceita 25 MiB/arquivo — documentar ou alinhar limites
- [ ] ⚠️ **Débito Técnico Mapeado**: Magic bytes ausentes em upload de documentos de perfil (ver `docs/SECURITY-AUDIT-PLAYBOOK.md`)
- [ ] ⚠️ **Débito Técnico Mapeado**: Import lote na Avaliação cria pendentes sem anexos — aprovação/Gcoop pode ir sem CNH/comprovante/carteira se não reenviar docs
