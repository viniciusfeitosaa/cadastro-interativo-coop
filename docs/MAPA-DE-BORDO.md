# Mapa de Bordo — COOPVITTA

> Última atualização: 2026-06-28

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

## 🗺️ Mapa de Bordo (Backlog Técnico e Próximos Passos)

Esta seção lista o que está planejado ou pendente. À medida que os itens são concluídos, eles são movidos pelo agente para o histórico de evolução acima.

- [ ] 🟥 **Alta Prioridade**: Rebrand completo da landing (`landing/*.html`) — ainda exibe "Viva Saúde" e `sejavivasaude.com.br`
- [ ] 🟥 **Alta Prioridade**: Push dos commits locais do `coopvitta-app` (rebrand + auditoria) para repositório remoto correto
- [ ] 🟨 **Média Prioridade**: Redirecionar `cadastro.coopvitta.cloud` → `app.coopvitta.cloud/app/cadastro` (formulário externo obsoleto)
- [ ] 🟨 **Média Prioridade**: Atualizar `iOS Info.plist` e strings nativas restantes para COOPVITTA
- [ ] 🟨 **Média Prioridade**: Configurar tratamento global de erros e logs de segurança no backend (rate limit + auditoria centralizada)
- [ ] 🟩 **Baixa Prioridade**: Otimizar imagens estáticas da landing (hero, ícones PWA)
- [ ] 🟩 **Baixa Prioridade**: Proxy NPM para `coopvitta.cloud` / `www` se domínio raiz for usado
- [ ] ⚠️ **Débito Técnico Mapeado**: `coopvitta-app` (AppVS fork) e `cadastro-interativo-coop` com código divergente — definir fonte única de verdade e fluxo de deploy
- [ ] ⚠️ **Débito Técnico Mapeado**: `express.json` limitado a 10mb enquanto multer aceita 25 MiB/arquivo — documentar ou alinhar limites
- [ ] ⚠️ **Débito Técnico Mapeado**: Magic bytes ausentes em upload de documentos de perfil (ver `docs/SECURITY-AUDIT-PLAYBOOK.md`)
