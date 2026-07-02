# 06 — Escalas e plantões

**Status:** ✅ Implementado (evolução contínua)  
**Última atualização:** 2026-05-28

## Modelo

| Modelo | Descrição |
|--------|-----------|
| `Escala` | Escala de trabalho |
| `EscalaMedico` | Médicos na escala |
| `EscalaPlantao` | Plantão agendado |
| `EscalaSubgrupo` / `EscalaEquipe` | Vínculos organizacionais |
| `TipoPlantao` | Tipos configuráveis |
| `ValorPlantao` / `AdicionalPlantaoData` | Valores por dia/equipe |
| `SolicitacaoTrocaPlantao` | Fluxo de troca entre médicos |

Migrations recentes (2026-04): troca de plantão — status, contrapartida, broadcast equipe, tipo ceder.

## Backend

- Rotas admin: CRUD escalas, plantões, médicos na escala
- Rotas ponto: trocas (`solicitar-troca-plantao`, aceitar/recusar, listagens)
- `tipo-plantao.service.ts`
- Utils: `plantao-horario.ts`

## Frontend

| Página | Função |
|--------|--------|
| `Escalas.tsx` | Gestão (lazy-loaded) |
| `MeuCalendarioPlantoes.tsx` | Visão médico |
| `ValoresPlantao.tsx` | Configuração de valores |
| `ModuloEscalaMaster.tsx` | Ferramentas master (só `MASTER`) |

## Regras importantes

- Valores plantão: unique por equipe/dia — migrations corrigiram índices legados (`20260331130000`, `20260331140000`)
- Troca de plantão: estados persistidos em `SolicitacaoTrocaPlantao` (ver migration `troca_plantao_status`)

## Pendências

- [ ] Consolidar doc de estados da troca de plantão (enum/status) em tabela neste arquivo quando estabilizar
