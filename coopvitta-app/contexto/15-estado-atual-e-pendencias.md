# 15 — Estado atual e pendências

**Snapshot:** 2026-05-28  
**Branch:** `main` (sync com `origin/main`)

> Este arquivo deve ser o **primeiro** atualizado após entregas relevantes.

## Resumo executivo

O **Viva Saúde** é um sistema **maduro em produção/desenvolvimento avançado**, não um MVP em fase de setup. Auth, escalas, ponto, vagas, documentos, relatórios, mobile e deploy estão implementados.

## Módulos — status

| Módulo | Backend | Frontend | Notas |
|--------|---------|----------|-------|
| Auth / cadastro | ✅ | ✅ | 3 fluxos de login |
| Dashboard | ✅ | ✅ | |
| Médicos | ✅ | ✅ | Convites, status cadastro |
| Contratos | ✅ | ✅ | |
| Escalas / plantões | ✅ | ✅ | Trocas de plantão |
| Valores plantão/ponto | ✅ | ✅ | |
| Ponto eletrônico | ✅ | ✅ | Geo, foto, histórico |
| Vagas | ✅ | ✅ | Wizard de anúncio |
| Documentos | ✅ | ✅ | DocuSeal opcional |
| Relatórios | ✅ | ✅ | Procedimentos + ponto |
| Configurações / módulos | ✅ | ✅ | Matriz de acesso |
| Avaliação (master) | ✅ | ✅ | `MasterOnly` |
| Atendimentos | — | ⏳ Placeholder | `FeaturePlaceholder` |
| Landing | ✅ | ✅ | + pasta `landing/` |

## Qualidade

| Item | Status |
|------|--------|
| Testes backend Jest | ✅ 12 testes passando |
| Migrations Prisma | ✅ 39 pastas |
| CI GitHub Actions | ✅ `ci.yml`, `deploy-vps.yml` |
| Docs raiz README/CHECKLIST | ⚠️ Desatualizados |
| Obsidian COFRE - MEMORIA (vinic) | ✅ Junction `memoria total\Viva-Saude` |

## Git local (agente/cloud)

- Alteração não commitada observada: `backend/package-lock.json`
- Último commit: remoção animação vídeo login

## Pendências prioritárias

1. **Atendimentos** — definir escopo e implementar (hoje só placeholder)
2. **Sincronizar README/CHECKLIST** ou marcar como arquivados apontando para `contexto/`
3. **Harness** — manter esta pasta após cada feature (ver `16-como-atualizar.md`)

## Pendências menores

- Documentar estados finitos de `SolicitacaoTrocaPlantao` em `06-escalas-plantoes.md`
- Processo de publicação App Store / Play Store em `12-mobile-capacitor.md`
- Tabela de endpoints de vagas em `08-vagas.md`

## Histórico de entregas recentes (referência)

| Data (aprox.) | Entrega |
|---------------|---------|
| 2026-04 | Trocas de plantão (várias migrations) |
| 2026-03 | Módulo vagas, valores plantão, perf indexes ponto |
| 2026 | Relatório procedimentos + import Excel |
| 2026 | Remoção vídeo animado na login |

*Adicione linhas aqui ao fechar tarefas.*
