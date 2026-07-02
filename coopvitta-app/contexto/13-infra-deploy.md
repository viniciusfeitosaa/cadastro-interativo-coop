# 13 — Infraestrutura e deploy

**Status:** ✅ Configurado  
**Última atualização:** 2026-05-28

## Docker

- `docker-compose.yml` — app (frontend + backend + nginx)
- `docker-compose.postgres.yml` — Postgres na mesma VPS (rede interna)
- `DOCKER.md` — guia detalhado
- `Dockerfile` — build da aplicação

## CI/CD (GitHub Actions)

| Workflow | Arquivo |
|----------|---------|
| CI | `.github/workflows/ci.yml` |
| Deploy VPS | `.github/workflows/deploy-vps.yml` |

## Scripts operacionais

| Script | Função |
|--------|--------|
| `scripts/deploy-vps.sh` | Deploy na VPS |
| `scripts/backup-postgres.sh` | Backup `.dump` |
| `DEPLOY_VPS_CI.txt` | Notas de deploy |

## Produção

- Domínio referenciado: `sejavivasaude.com.br` (CORS em `app.ts`)
- Backend atrás de proxy: `trust proxy: 1`
- `deploy:build` no backend: migrate + build para release

## Banco

- Opção A: Postgres no Docker na VPS (recomendado no `.env.example`)
- Opção B: Supabase/RDS remoto
- Migração Neon→Supabase: script `prisma/migrate-neon-to-supabase.ts`

## Landing

- `landing/` pode ser servido separado ou merged no front (`merge-landing.js`)

## Pendências

- [ ] Registrar URL exata de staging se existir
- [ ] Checklist pós-deploy (smoke tests) — pode linkar `docs/SECURITY-*`
