# Roteiro de casos de teste (segurança) — AppVS

Roteiro prático para validar conformidade com `SECURITY.md` e `docs/SECURITY-AUDIT-PLAYBOOK.md`, com foco nas áreas recentes (adicionais por data, ponto, relatórios, uploads).

**Ambiente:** homologação/staging ou `localhost` com dados de teste. Não executar testes destrutivos em produção sem autorização.

**Pré-requisitos:** dois usuários quando indicado — **Master** com módulos `VALORES_PLANTAO` / `ESCALAS` / `RELATÓRIOS` conforme o caso; **Médico** com ponto ativo.

**Base URL:** substitua `{{API}}` (ex.: `http://localhost:3001/api`).

**Headers comuns:**

```http
Authorization: Bearer {{JWT}}
Content-Type: application/json
```

---

## 1. Autenticação e autorização (fail closed)

| # | Caso | Passos | Resultado esperado |
|---|------|--------|-------------------|
| 1.1 | Sem token | `GET {{API}}/admin/adicionais-plantao?contratoAtivoId=<uuid>` | **401** |
| 1.2 | Token inválido | Mesmo endpoint com `Bearer xyz` | **401** |
| 1.3 | Médico em rota só Master | Login como **Médico** → `PUT {{API}}/admin/adicionais-plantao` com body válido | **403** |
| 1.4 | Master sem módulo | Conta Master sem `VALORES_PLANTAO` → `PUT` / `DELETE` em `/admin/adicionais-plantao` | **403** |
| 1.5 | Leitura com módulo alternativo | Master com só **ESCALAS** (sem VALORES_PLANTAO) → `GET /admin/adicionais-plantao?...` | **200** (lista vazia ou dados) — rota usa `requireAnyModuleAccess([VALORES_PLANTAO, ESCALAS])` |

---

## 2. Validação de entrada (400)

**GET** `GET {{API}}/admin/adicionais-plantao`

| # | Query | Esperado |
|---|--------|----------|
| 2.1 | Omitir `contratoAtivoId` | **400** + `errors` |
| 2.2 | `contratoAtivoId=not-a-uuid` | **400** |
| 2.3 | `dataInicio` inválida (não ISO8601) | **400** |

**PUT** `PUT {{API}}/admin/adicionais-plantao`

| # | Body (JSON) | Esperado |
|---|-------------|----------|
| 2.4 | `{}` | **400** |
| 2.5 | `contratoAtivoId` inválido | **400** |
| 2.6 | `data` não ISO8601 | **400** |
| 2.7 | `gradeId` vazio ou > 20 caracteres | **400** |
| 2.8 | `percentual` negativo ou > 300 | **400** |

**DELETE** `DELETE {{API}}/admin/adicionais-plantao?contratoAtivoId=...&data=...&gradeId=...`

| # | Query | Esperado |
|---|--------|----------|
| 2.9 | Faltar um dos parâmetros obrigatórios | **400** |
| 2.10 | UUID inválido em `contratoAtivoId` | **400** |

---

## 3. Isolamento por tenant (IDOR lógico)

| # | Caso | Passos | Esperado |
|---|------|--------|----------|
| 3.1 | Contrato de outro tenant | Se em staging existir outro tenant: usar `contratoAtivoId` de contrato que **não** pertence ao tenant do JWT | **404** ou **403** — nunca retornar dados do outro tenant |
| 3.2 | Foto check-in (médico) | Médico A tenta `GET /api/ponto/registros/{idRegistroDeB}/foto-checkin` | **403/404** |
| 3.3 | Foto check-in (admin) | Master solicita foto de registro válido do próprio tenant | **200** / imagem; ID inexistente → **404** |

---

## 4. Atomicidade e consistência (adicionais + auditoria)

| # | Caso | Passos | Esperado |
|---|------|--------|----------|
| 4.1 | Upsert feliz | `PUT` com contrato/data/grade válidos e percentual dentro do limite | **200**; registro em `adicionais_plantao_data`; log de auditoria coerente (sem escrita “órfã”) |
| 4.2 | Remoção | `DELETE` com mesmos critérios | **200**; linha removida ou idempotente conforme implementação |

*Opcional — concorrência:* dois `PUT` idênticos em paralelo (curl `&` ou script) devem terminar em estado consistente (um registro, percentual final definido).

---

## 5. Ponto eletrônico e upload

| # | Caso | Esperado |
|---|------|----------|
| 5.1 | Check-in sem auth | **401** |
| 5.2 | Arquivo com `Content-Type: image/jpeg` mas conteúdo não-imagem | Rejeição na validação de **magic bytes** |
| 5.3 | Arquivo > limite configurado | Rejeição antes de persistir uso indevido do disco |

---

## 6. UI / fluxos funcionais (smoke)

| # | Área | Verificação rápida |
|---|------|-------------------|
| 6.1 | Valores Plantão | Só contratos **escala + ponto**; subgrupo após contrato |
| 6.2 | Valores Ponto | Só contratos **sem** escala+ponto; UI em etapas salva sem erro |
| 6.3 | Escalas | “Adicional” no bloco MT/SN persiste e exibe badge |
| 6.4 | Relatórios | Coluna valor reflete `valorHora` da escala (incl. adicional) ou fallback |
| 6.5 | Dashboard | Chips de equipes batem com escalas + `minhasEquipes` |

---

## 7. Registro de evidências

Para auditoria interna, anotar: data, ambiente, usuário (papel), IDs usados (UUID mascarados se necessário), status HTTP e trecho da resposta (sem tokens).

---

## 8. Módulo Vagas (`/api/medico/vagas`)

**Pré-requisitos:** dois médicos **A** e **B** no mesmo tenant, ambos com módulo **VAGAS**; **A** publica uma vaga ativa; **B** demonstra interesse (fica `PENDENTE`). Base: `{{API}}/medico/vagas`.

### 8.1 Autenticação e autorização

| # | Caso | Passos | Esperado |
|---|------|--------|----------|
| 8.1.1 | Sem token | `GET {{API}}/medico/vagas` | **401** |
| 8.1.2 | Token inválido | Mesmo `GET` com `Bearer xyz` | **401** |
| 8.1.3 | Master em rota só médico | Login **Master** → `GET {{API}}/medico/vagas` | **403** |
| 8.1.4 | Médico sem módulo VAGAS | JWT de médico sem `VAGAS` → `GET {{API}}/medico/vagas` | **403** |

### 8.2 Validação de entrada (400)

| # | Endpoint | Passos | Esperado |
|---|----------|--------|----------|
| 8.2.1 | Candidatos | `GET .../vagas/not-a-uuid/candidatos` | **400** (`errors` / UUID inválido) |
| 8.2.2 | PATCH status | `PATCH .../vagas/{vagaId}/candidatos/{id}` com `{}` ou `status: "X"` | **400** |
| 8.2.3 | POST publicar | `POST .../vagas` com body incompleto ou `confirmacaoResponsavel: false` | **400** |

### 8.3 IDOR / publicador / tenant

| # | Caso | Passos | Esperado |
|---|------|--------|----------|
| 8.3.1 | Candidatos sem ser publicador | **B** chama `GET .../vagas/{idVagaDeA}/candidatos` | **404** (nunca lista candidatos de vaga alheia) |
| 8.3.2 | PATCH status sem ser publicador | **B** chama `PATCH .../vagas/{idVagaDeA}/candidatos/{idB}` com `{"status":"ACEITO"}` | **404** |
| 8.3.3 | Excluir vaga alheia | **B** → `DELETE .../vagas/{idVagaDeA}` | **404** |
| 8.3.4 | Outro tenant (se disponível em staging) | JWT tenant T1 + `vagaId` de tenant T2 | **404** / sem vazamento de dados |

### 8.4 Conflitos e idempotência

| # | Caso | Passos | Esperado |
|---|------|--------|----------|
| 8.4.1 | Interesse duplicado | **B** → `POST .../vagas/{id}/interesse` duas vezes | Segunda: **409** |
| 8.4.2 | Interesse na própria vaga | **A** → `POST .../vagas/{própriaVaga}/interesse` | **400** |
| 8.4.3 | PATCH após já respondido | **A** aceita **B**; repetir mesmo `PATCH` com `ACEITO` ou `RECUSADO` | **400** (“já respondido”) |

### 8.5 Concorrência (playbook §1)

| # | Caso | Passos | Esperado |
|---|------|--------|----------|
| 8.5.1 | Dois PATCH simultâneos | Dois `PATCH` paralelos (curl `&` ou script) no mesmo interesse `PENDENTE`, um `ACEITO` e outro `RECUSADO` | Um **200**; o outro **400** ou **409**; estado final do interesse coerente (um único status final) |

### 8.6 Rate limit (mutações)

| # | Caso | Passos | Esperado |
|---|------|--------|----------|
| 8.6.1 | Rajada em POST interesse | \>45 `POST .../interesse` no mesmo IP em \<1 min (após autenticação) | **429** com mensagem de vagas (além do limite global em `/api`) |

*Nota:* ajuste o limite em `vagasMutationLimiter` (`medico.routes.ts`) se o número exato mudar.

---

## Referências

- `SECURITY.md` — princípios e checklist de PR
- `docs/SECURITY-AUDIT-PLAYBOOK.md` — race, upload, IDOR, secrets
- Rotas: `backend/src/routes/admin.routes.ts` (`/adicionais-plantao`)
- Rotas: `backend/src/routes/medico.routes.ts` (`/vagas`)
