# 03 — Fundação e setup

**Status:** ✅ Concluída  
**Última atualização:** 2026-05-28

## O que foi feito nesta etapa

- Monorepo com `frontend/`, `backend/`, `landing/`
- TypeScript em front e back
- Prisma + PostgreSQL com **39 migrations** (`backend/prisma/migrations/`)
- Docker Compose (`docker-compose.yml`, `docker-compose.postgres.yml`)
- `.env.example` documentado (DB local Docker ou remoto Supabase/RDS)
- Scripts Windows: `rodar-frontend.ps1`, `rodar-backend.ps1`, `npm-install.ps1`
- Testes Jest no backend (3 suites, 12 testes — utils de upload/geo/imagem)

## Como subir localmente

```bash
# Backend
cd backend && npm install && cp ../.env.example .env
# Ajustar DATABASE_URL, JWT_*, etc.
npm run prisma:generate && npm run prisma:migrate
npm run dev   # ts-node-dev, porta PORT (default 3001)

# Frontend
cd frontend && npm install
npm run dev   # Vite, tipicamente :5173
```

## Prisma — comandos úteis

| Comando | Uso |
|---------|-----|
| `npm run prisma:migrate` | Dev: criar/aplicar migration |
| `npm run prisma:migrate:deploy` | Produção |
| `npm run prisma:seed` | Seed inicial |
| `npm run prisma:import` | Import CSV (corpo clínico) |
| `npm run deploy:build` | install + generate + migrate + build |

## Modelo de dados — entidades principais

Ver `schema.prisma`: `Tenant`, `Medico`, `UsuarioMaster`, `Escala`, `Equipe`, `Subgrupo`, `EscalaPlantao`, `RegistroPonto`, `Vaga`, `ConfigPontoEletronico`, `Auditoria`, etc.

## Arquivos-chave

| Arquivo | Função |
|---------|--------|
| `backend/src/server.ts` | Bootstrap do servidor |
| `backend/src/config/env.ts` | Validação de env |
| `backend/src/config/database.ts` | Cliente Prisma |
| `Dockerfile` | Build container |
| `SETUP_RAPIDO.md` | Guia rápido legado |

## Pendências desta etapa

- [ ] Alinhar `README.md` / `CHECKLIST_PROJETO.md` com realidade (usar `contexto/` como fonte)
