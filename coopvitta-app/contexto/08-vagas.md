# 08 — Vagas

**Status:** ✅ Implementado  
**Última atualização:** 2026-05-28

## Escopo

Módulo de **vagas** para médicos manifestarem interesse.

## Modelo

- `Vaga` — anúncio da vaga
- `VagaInteresse` — interesse do médico (`StatusInteresseVaga`: PENDENTE, ACEITO, RECUSADO)

Migrations: `modulo_vagas`, `create_vagas`, `vaga_interesses` (mar/2026).

## Backend

- `vaga.service.ts`
- Rotas em `medico.routes.ts` e `admin.routes.ts` (listar, criar, interesses — ver grep `vaga` nos routes)

## Frontend

- `pages/Vagas.tsx`
- `components/vagas/AnunciarVagaWizard.tsx` — wizard de criação

## Módulo

- `ModuloSistema.VAGAS` — habilitado por padrão para médico na matriz (`modulos.const.ts`)

## Pendências

- [ ] Documentar endpoints exatos em tabela (opcional — código em `vaga.service.ts`)
