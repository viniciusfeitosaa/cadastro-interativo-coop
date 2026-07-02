# 11 — Frontend e UX

**Status:** ✅ Implementado  
**Última atualização:** 2026-05-28

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

**Só MASTER:** `/avaliacao`, `/modulo-escala-master`

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
