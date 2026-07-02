# 10 — Relatórios

**Status:** ✅ Implementado (procedimentos + ponto)  
**Última atualização:** 2026-05-28

## Relatórios de procedimentos

- `relatorio-procedimentos.service.ts`
- Admin: `GET/PUT /api/admin/relatorios/procedimentos/:mesRef`
- Import Excel (rota POST — ver `admin.routes.ts`)
- Frontend: `RelatoriosProcedimentos.tsx`
- Branch remota histórica: `cursor/relatorio-procedimentos-excel-import-ui`

## Relatórios de ponto

- Listagem admin de registros (`listRegistrosPontoAdminController`)
- Export/visualização no front: `RelatoriosPontoEletronico.tsx`
- Hub: `Relatorios.tsx`

## Dependências front

- `jspdf`, `jspdf-autotable` — PDF
- `xlsx` — Excel

## Módulo de acesso

- `ModuloSistema.RELATORIOS` — necessário para rotas admin de registros

## Pendências

- [ ] `/atendimentos` ainda não tem relatórios — módulo ATENDIMENTOS é placeholder no UI
