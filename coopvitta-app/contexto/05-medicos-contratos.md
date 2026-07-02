# 05 — Médicos e contratos

**Status:** ✅ Implementado  
**Última atualização:** 2026-05-28

## Médicos

### Backend

- `medico.service.ts`, rotas em `admin.routes.ts` e `medico.routes.ts`
- CRUD médicos (MASTER com módulo `MEDICOS`)
- Status: `StatusCadastroMedico` (pendente, ativo, rejeitado)
- Convite: `POST /api/admin/medicos/:id/invite`
- Documentos de perfil: `MedicoDocumento`, tipos em `DocumentoPerfilTipo`

### Frontend

- `pages/Medicos.tsx` — listagem/gestão
- `pages/Perfil.tsx` — perfil do usuário logado
- `pages/AcceptInvite.tsx` — ativação de conta

## Contratos ativos

Vinculam subgrupos e equipes ao contrato institucional.

| Entidade | Relação |
|----------|---------|
| `ContratoAtivo` | Contrato principal |
| `ContratoSubgrupo` | N:N contrato ↔ subgrupo |
| `ContratoEquipe` | N:N contrato ↔ equipe |

### Rotas admin (exemplos)

- `GET/POST/PUT/DELETE /api/admin/contratos-ativos`
- Sub-recursos `/contratos-ativos/:id/subgrupos` e `/equipes`

### Frontend

- `pages/ContratosAtivos.tsx`

## Subgrupos e equipes

- `grupo-equipe.service.ts`, `grupo-equipe.controller.ts`
- `pages/SubgruposEquipes.tsx`
- Associação médico ↔ equipe/subgrupo: `EquipeMedico`, `SubgrupoMedico`

## Multi-tenant

- `Tenant` no schema; médicos e masters associados ao tenant
- `MasterEscopoContext` no front — escopo de visualização para MASTER

## Pendências

- [ ] Documentar regras de negócio de aprovação de cadastro pendente (se houver UI específica)
