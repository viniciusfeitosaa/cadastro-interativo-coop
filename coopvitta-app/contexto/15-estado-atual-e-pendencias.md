# 15 — Estado atual e pendências

**Snapshot:** 2026-08-26  
**Branch:** `sync/appvs-existing-modules` (base `main`)

> Este arquivo deve ser o **primeiro** atualizado após entregas relevantes.

## Resumo executivo

O **Viva Saúde** é um sistema **maduro em produção/desenvolvimento avançado**, não um MVP em fase de setup. Auth, escalas, ponto, vagas, documentos, relatórios, mobile e deploy estão implementados.

## Módulos — status

| Módulo | Backend | Frontend | Notas |
|--------|---------|----------|-------|
| Auth / cadastro | ✅ | ✅ | 3 fluxos de login; CPF/CRM no cadastro (sync AppVS) |
| Dashboard | ✅ | ✅ | Sync AppVS (sem fila de justificativas) |
| Médicos | ✅ | ✅ | Ficha completa + WhatsApp (sync AppVS) |
| Contratos | ✅ | ✅ | |
| Escalas / plantões | ✅ | ✅ | Panel tipos + `useModuloNivel` compat |
| Valores plantão/ponto | ✅ | ✅ | Margem de lucro (sync AppVS) |
| Ponto eletrônico | ✅ | ✅ | Geo, foto, histórico |
| Vagas | ✅ | ✅ | Wizard de anúncio |
| Documentos | ✅ | ✅ | DocuSeal opcional |
| Relatórios | ✅ | ✅ | Somente-escala no financeiro; procedimentos Coop (sem e-mail) |
| Configurações / módulos | ✅ | ✅ | Matriz boolean + **Perfis staff** OFF/VER/EDITAR |
| Avaliação (master) | ✅ | ✅ | `MasterOnly` + Gcoop (preservado) |
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

- Branch: `sync/appvs-existing-modules`
- Alterações locais do sync AppVS (não commitadas neste passo)

## Pendências prioritárias

1. **Portar módulos novos do AppVS** (próxima rodada): Conteúdos, E-mail, Justificativas de ponto, Push
2. **Atendimentos** — definir escopo e implementar (hoje só placeholder)
3. **Sincronizar README/CHECKLIST** ou marcar como arquivados apontando para `contexto/`
4. **Harness** — manter esta pasta após cada feature (ver `16-como-atualizar.md`)

## Pendências menores

- Documentar estados finitos de `SolicitacaoTrocaPlantao` em `06-escalas-plantoes.md`
- Processo de publicação App Store / Play Store em `12-mobile-capacitor.md`
- Tabela de endpoints de vagas em `08-vagas.md`

## Histórico de entregas recentes (referência)

| Data (aprox.) | Entrega |
|---------------|---------|
| 2026-08-26 | Menu: ocultos Envio de Documentos e Somente escala (rotas mantidas) |
| 2026-08-26 | Módulo Perfis e equipe (staff OFF/VER/EDITAR) portado do AppVS |
| 2026-08-26 | Sync AppVS→Coop dos módulos já existentes (sem Conteúdos/E-mail/Justificativas/Push/Staff) |
| 2026-08-26 | Menu master restaurado (Escalas/Relatórios/Admin) + matriz módulos no DB local |
| 2026-04 | Trocas de plantão (várias migrations) |
| 2026-03 | Módulo vagas, valores plantão, perf indexes ponto |
| 2026 | Relatório procedimentos + import Excel |
| 2026 | Remoção vídeo animado na login |

*Adicione linhas aqui ao fechar tarefas.*
