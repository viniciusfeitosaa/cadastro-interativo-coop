# 02 — Arquitetura

**Status:** ✅ Implementada  
**Última atualização:** 2026-05-28

## Diagrama lógico

```
[Browser / App Capacitor]
        │
        ▼
   Frontend (Vite + React)
   porta dev: 5173 / prod: Nginx
        │  HTTPS + JWT (Authorization)
        ▼
   Backend (Express + TS)
   /api/auth | /api/medico | /api/admin | /api/ponto
        │
        ▼
   PostgreSQL (Prisma ORM)
   39+ migrations em backend/prisma/migrations/
```

## Monorepo

| Pasta | Responsabilidade |
|-------|------------------|
| `frontend/` | SPA React, Capacitor (android/, ios/) |
| `backend/` | API REST, Prisma, serviços |
| `landing/` | HTML/CSS estático (também mergeável no front) |
| `docker/` | Configs auxiliares |
| `scripts/` | Deploy VPS, backup Postgres, Capacitor |
| `contexto/` | **Harness IA** (esta pasta) |

## API — prefixos

| Prefixo | Arquivo de rotas | Consumidor típico |
|---------|------------------|-------------------|
| `/api/auth` | `auth.routes.ts` | Login, cadastro, reset senha |
| `/api/medico` | `medico.routes.ts` | Área do médico logado |
| `/api/admin` | `admin.routes.ts` | MASTER (gestão) |
| `/api/ponto` | `ponto.routes.ts` | Ponto e trocas de plantão |

Health: `GET /health`

## Camadas backend

```
routes → controllers → services → Prisma (database.ts)
         ↑ middleware: auth, validation, upload
```

## Camadas frontend

```
pages → components → services (api.ts + *.service.ts)
       → context (Auth, MasterEscopo, Notification)
       → hooks / utils
```

## Integrações externas (via env)

- E-mail (reset, convites, cadastro)
- DocuSeal (`docuseal.service.ts`) — assinatura/documentos quando configurado
- WhatsApp util (`whatsapp.util.ts`) — notificações opcionais

Ver `.env.example` para variáveis completas.

## Segurança transversal

- Helmet, CORS com allowlist, rate limit em `/api`
- `trust proxy` para deploy atrás de Nginx/Render
- Arquivos em `uploads/` servidos só por rotas autenticadas
