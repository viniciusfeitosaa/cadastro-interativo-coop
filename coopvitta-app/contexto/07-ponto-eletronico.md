# 07 — Ponto eletrônico

**Status:** ✅ Implementado  
**Última atualização:** 2026-05-28

## Funcionalidades

- Check-in / check-out (com foto ou `checkin-sem-foto`)
- Geolocalização e endereço configuráveis (`ConfigPontoEletronico`)
- Horário e tolerância de ponto
- Valores por dia (`valores_ponto_por_dia` migration)
- Histórico do médico e painel do dia
- Repasse/registro congelado (`repasse-registro-ponto.service.ts`)
- Índices de performance (`perf_ponto_indexes`, check-in médico)

## Modelos Prisma

- `ConfigPontoEletronico` — regras por escala/equipe
- `RegistroPonto` — registros (`OrigemRegistroPonto.APP_MEDICO`)
- `escalaId` opcional em registro (migration `registro_ponto_escala_optional`)

## API (`/api/ponto`)

Arquivo: `ponto.routes.ts` + `ponto.controller.ts` + `ponto.service.ts`

Exemplos:

- `POST /checkin`, `POST /checkout`, `POST /checkin-sem-foto`
- `GET /meu-dia`, `GET /historico`, `GET /can-checkin`
- Troca de plantão (ver também etapa 06)
- `GET /registros/:id/foto-checkin` — download autenticado

## Utils e testes

- `ponto-geo-config.util.ts` (+ testes Jest)
- `ponto.const.ts` — constantes de negócio

## Frontend

| Arquivo | Função |
|---------|--------|
| `PontoEletronico.tsx` | Tela principal |
| `HistoricoPontos.tsx` | Histórico |
| `ValoresPonto.tsx` | Valores admin |
| `RelatoriosPontoEletronico.tsx` | Relatórios |
| `PontoLocationMap.tsx` | Mapa Leaflet |
| `PontoEnderecoMapaBlock.tsx` | Endereço no mapa |

## Admin

- `GET/PUT /api/admin/config-ponto`
- `GET /api/admin/registros-ponto` (módulo `RELATORIOS`)

## Pendências

- [ ] Nenhuma crítica conhecida — validar regras de geo em produção por tenant
