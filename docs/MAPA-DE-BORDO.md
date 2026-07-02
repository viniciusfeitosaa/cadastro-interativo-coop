# Mapa de Bordo — COOPVITTA

> Última atualização: 2026-06-29

## Histórico de evolução

Itens concluídos (mais recentes no topo):

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

## 🗺️ Mapa de Bordo (Backlog Técnico e Próximos Passos)

Esta seção lista o que está planejado ou pendente. À medida que os itens são concluídos, eles são movidos pelo agente para o histórico de evolução acima.

- [ ] 🟥 **Alta Prioridade**: Rebrand completo da landing (`landing/*.html`) — **obsoleto** (landing removida; app na raiz)
- [ ] 🟥 **Alta Prioridade**: Push dos commits locais do `coopvitta-app` (rebrand + auditoria) para repositório remoto correto
- [ ] 🟨 **Média Prioridade**: DNS opcional `obs.coopvitta.cloud` — monitor já em `https://app.coopvitta.cloud/obs/`
- [ ] 🟨 **Média Prioridade**: Redirecionar `cadastro.coopvitta.cloud` → `app.coopvitta.cloud/cadastro`
- [ ] 🟨 **Média Prioridade**: JWT em produção ainda `JWT_EXPIRES_IN=24h` no `.env` — validar refresh token no frontend antes de reduzir para 15m
- [ ] 🟨 **Média Prioridade**: Ativar `FIELD_ENCRYPTION_KEY` no `.env` se campos sensíveis forem criptografados em repouso (CPF hoje em texto para índice único)
- [ ] 🟨 **Média Prioridade**: Atualizar `iOS Info.plist` e strings nativas restantes para COOPVITTA
- [ ] 🟨 **Média Prioridade**: Restringir painel NPM (porta 81) ao IP do administrador — `NPM_ADMIN_IP=seu.ip sudo bash scripts/apply-server-rules.sh`
- [ ] 🟩 **Baixa Prioridade**: Otimizar imagens estáticas da landing (hero, ícones PWA)
- [ ] 🟩 **Baixa Prioridade**: Proxy NPM para `coopvitta.cloud` / `www` se domínio raiz for usado
- [ ] ⚠️ **Débito Técnico Mapeado**: `coopvitta-app` (AppVS fork) e `cadastro-interativo-coop` com código divergente — definir fonte única de verdade e fluxo de deploy
- [ ] ⚠️ **Débito Técnico Mapeado**: `express.json` limitado a 10mb enquanto multer aceita 25 MiB/arquivo — documentar ou alinhar limites
- [ ] ⚠️ **Débito Técnico Mapeado**: Magic bytes ausentes em upload de documentos de perfil (ver `docs/SECURITY-AUDIT-PLAYBOOK.md`)
