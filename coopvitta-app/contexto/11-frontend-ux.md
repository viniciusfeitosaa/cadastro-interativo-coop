# 11 — Frontend e UX

**Status:** ✅ Implementado  
**Última atualização:** 2026-08-26

## Stack

- React 18 + TypeScript + **Vite**
- Tailwind CSS (`postcss.config.js`)
- React Router v6 (`App.tsx`)
- TanStack React Query
- React Hook Form + Zod
- Leaflet / react-leaflet (mapas de ponto)

## Estrutura

```
frontend/src/
├── pages/          # Uma página por rota principal
├── components/     # UI reutilizável + Layout/
├── context/        # Auth, MasterEscopo, Notification
├── services/       # api.ts, auth, medico, admin, ponto
├── hooks/
└── utils/
```

## Layouts

| Layout | Uso |
|--------|-----|
| `LandingLayout` | Home, sobre, contato, privacidade |
| `LandingV2Layout` | `/landing-v2` |
| `AppShell` | Área autenticada (menu lateral, header) |
| `ProtectedRoute` | Exige login |

## Rotas autenticadas (resumo)

Ver `App.tsx` — dashboard, médicos, escalas, ponto, vagas, relatórios, contratos, valores, documentos, perfil.

**Placeholder:** `/atendimentos` → `FeaturePlaceholder`

**Só MASTER:** `/avaliacao`

**Ocultos do menu (rota mantida):** `/relatorios-procedimentos`, `/envio-documentos`, `/modulo-escala-master` (este último redundante com Valores Plantão + filtro `somente_escala`)

## Padrões UX

- `ErrorBoundary.tsx`, `GlobalToasts.tsx`, `NotificationBell.tsx`
- Loading global em `App.tsx` (`PageLoadingScreen`)
- Design tokens: classes `viva-*` (ex.: `bg-viva-50`, `border-viva-600`)
- `basename` do Router respeita `import.meta.env.BASE_URL` (deploy em subpath)

## Build e deploy front

- `netlify.toml`, `nginx.conf`, `public/_redirects`
- Script `merge-landing.js` — integração landing no build
- `check-env.js` — validação de env no build

## Pendências UI

- [ ] Implementar módulo Atendimentos (hoje placeholder)
- [ ] Manter paridade mobile (ver etapa 12)

## Changelog

### 2026-08-26 — Menu: ocultar Envio de Documentos e Somente escala
- Removidos do menu Administração; rotas `/envio-documentos` e `/modulo-escala-master` permanecem
- Decisão: “Somente escala” era só atalho de `ValoresPlantao`; o conceito útil segue em Valores + Relatório financeiro

### 2026-08-26 — Perfis e equipe (staff)
- Schema `NivelAcessoModulo` + `PerfilAcesso` + FK em `UsuarioMaster`
- UI `/perfis-equipe` (só admin pleno); menu Administração
- Middleware `requireAdminPleno` / `requireModuleWrite(ESCALAS)`
- Arquivos: `frontend/src/pages/PerfisEquipe.tsx`, `backend/src/services/perfil-acesso.service.ts`, `usuario-staff.service.ts`

### 2026-08-26 — Sync AppVS (módulos existentes)
- Overlay AppVS `8b866b4` em Médicos, ValoresPlantao (+ margem), Relatórios, Dashboard, Escalas, Subgrupos, Cadastro, ValoresPonto
- Backend: detalhe do médico, download docs perfil, relatório plantões somente-escala, upload-path persistente
- Preservado: Avaliação/Gcoop/Onvio, CadastroCoop, matriz boolean de módulos
- Não portado: Conteúdos, E-mail, Justificativas, Push, Perfis staff
- Arquivos-chave: `frontend/src/pages/Medicos.tsx`, `ValoresPlantao.tsx`, `backend/src/services/relatorio-plantoes-somente-escala.service.ts`

### 2026-08-26 — Menu master com módulos completos
- `AppShell` do MASTER voltou a listar Escalas, Relatórios e Administração (estava só Corpo Clínico)
- Arquivos: `frontend/src/components/Layout/AppShell.tsx`
- Decisão: alinhar ao AppVS, só com rotas que já existem no COOPVITTA (sem e-mail/push/conteúdos)
