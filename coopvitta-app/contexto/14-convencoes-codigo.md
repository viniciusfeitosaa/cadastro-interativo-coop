# 14 — Convenções de código

**Status:** ✅ Em uso  
**Última atualização:** 2026-05-28

## Backend

| Regra | Detalhe |
|-------|---------|
| Linguagem | TypeScript strict em `src/` |
| Nomenclatura | `*.controller.ts`, `*.service.ts`, `*.routes.ts` |
| Validação | `validation.middleware.ts` + express-validator |
| IDs | UUID — `validateUUIDParam` / `validateUUIDQuery` |
| Erros Prisma | `prisma-column-error.ts` para mensagens amigáveis |
| Testes | Jest em `*.test.ts` junto aos utils |
| Lint | `npm run lint` (ESLint) |

## Frontend

| Regra | Detalhe |
|-------|---------|
| Páginas | `pages/Nome.tsx` — PascalCase |
| Serviços | Um arquivo por domínio (`admin.service.ts`) |
| API base | `services/api.ts` — baseURL via env Vite |
| Lazy load | Rotas pesadas (ex.: `Escalas`) com `React.lazy` |
| Forms | react-hook-form + zod resolvers |

## Git / commits

- Mensagens em português aceitas no histórico
- Evitar commitar `.env`, `uploads/`, `node_modules/`

## Ao adicionar feature

1. Migration Prisma se mudar schema
2. Service → controller → routes
3. Service front + página + rota em `App.tsx`
4. Módulo em `ModuloSistema` se precisar controle de acesso
5. **Atualizar `contexto/`** (etapa + estado atual)

## Skills Cursor (opcional)

Em `.cursor/skills/` — IHC, GSD, frontend-design, cybersecurity.  
Não substituem `contexto/` — são playbooks genéricos.
