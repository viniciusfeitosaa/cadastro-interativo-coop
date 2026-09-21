# Formulários públicos (Fase 1 SAMU) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motor genérico de formulários públicos + inscrição SAMU (`/f/samu-prova`) com admin de respostas (módulo `FORMULARIOS`).

**Architecture:** Prisma models `Formulario` / `FormularioCampo` / `FormularioResposta` / `FormularioRespostaValor`; API pública sem JWT em `/api/public/formularios`; admin em `/api/admin/formularios` com `requireModuleAccess(FORMULARIOS)`; SPA pública `/f/:slug` e área autenticada `/formularios`. Seed cria o formulário SAMU no tenant principal.

**Tech Stack:** Nest-less Express + Prisma + React/Vite + multer + express-rate-limit (padrão atual do `coopvitta-app`).

**Spec:** `docs/superpowers/specs/2026-09-21-formularios-publicos-samu-design.md`

## Global Constraints

- Identificação Fase 1: LEVE (nome + telefone); sem CPF.
- Link público: `{FRONTEND}/f/samu-prova` (slug `samu-prova`).
- Campos SAMU: nomeCompleto, telefone, profissao (Técnico|Condutor), curriculo (PDF).
- Acesso admin: MASTER e staff com nível VER/EDITAR no módulo `FORMULARIOS`.
- Ficheiros em `uploads/formularios/` via `toStoredUploadPath`.
- YAGNI: sem builder visual, sem gráficos, sem e-mail de notificação nesta fase.

## File map

| Path | Responsibility |
|------|----------------|
| `backend/prisma/schema.prisma` | Enums + models |
| `backend/prisma/migrations/20260921120000_formularios/` | Migration + seed SQL do SAMU (ou seed TS) |
| `backend/src/services/formulario.service.ts` | CRUD admin + submit público |
| `backend/src/controllers/formulario.controller.ts` | HTTP handlers |
| `backend/src/routes/formulario-public.routes.ts` | GET/POST públicos |
| `backend/src/routes/formulario-admin.routes.ts` | Rotas admin (montadas em admin.routes) |
| `backend/src/middleware/upload.middleware.ts` | `uploadFormularioResposta` |
| `backend/src/app.ts` | Mount `/api/public/formularios` |
| `frontend/src/constants/modulos.ts` | `FORMULARIOS` |
| `frontend/src/services/formulario.service.ts` | Client API |
| `frontend/src/pages/FormularioPublico.tsx` | Página `/f/:slug` |
| `frontend/src/pages/Formularios.tsx` | Lista admin |
| `frontend/src/pages/FormularioRespostas.tsx` | Respostas de um form |
| `frontend/src/App.tsx` + `AppShell.tsx` | Rotas + menu |

---

### Task 1: Schema Prisma + migration + módulo FORMULARIOS

**Files:**
- Modify: `coopvitta-app/backend/prisma/schema.prisma`
- Create: `coopvitta-app/backend/prisma/migrations/20260921120000_formularios/migration.sql`
- Modify: `coopvitta-app/frontend/src/constants/modulos.ts`
- Modify: any backend lists of `ModuloSistema` that need exhaustive switches (acesso-modulo already uses `Object.values`)

**Produces:** Enums `FormularioCampoTipo`, `FormularioIdentificacaoModo`, `FormularioRespostaStatus`; models; `ModuloSistema.FORMULARIOS`.

- [ ] **Step 1: Add enums and models to schema.prisma**

Add to `ModuloSistema` enum: `FORMULARIOS`.

Add:

```prisma
enum FormularioCampoTipo {
  TEXTO
  TELEFONE
  ESCOLHA_UNICA
  FICHEIRO
}

enum FormularioIdentificacaoModo {
  ANONIMO
  LEVE
  FORTE
}

enum FormularioRespostaStatus {
  NOVA
  EM_ANALISE
  PRE_SELECIONADA
  REJEITADA
  ARQUIVADA
}

model Formulario {
  id                 String                      @id @default(uuid())
  tenantId           String                      @map("tenant_id")
  titulo             String                      @db.VarChar(255)
  descricao          String?                     @db.Text
  slug               String                      @db.VarChar(80)
  publico            Boolean                     @default(true)
  ativo              Boolean                     @default(true)
  identificacaoModo  FormularioIdentificacaoModo @default(LEVE) @map("identificacao_modo")
  criadoPorId        String?                     @map("criado_por_id") @db.VarChar(36)
  createdAt          DateTime                    @default(now()) @map("created_at")
  updatedAt          DateTime                    @updatedAt @map("updated_at")

  tenant   Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  campos   FormularioCampo[]
  respostas FormularioResposta[]

  @@map("formularios")
  @@unique([tenantId, slug])
  @@index([tenantId])
  @@index([slug])
}

model FormularioCampo {
  id           String              @id @default(uuid())
  formularioId String              @map("formulario_id")
  chave        String              @db.VarChar(80)
  label        String              @db.VarChar(255)
  tipo         FormularioCampoTipo
  obrigatorio  Boolean             @default(true)
  ordem        Int                 @default(0)
  opcoesJson   Json?               @map("opcoes_json")
  validacaoJson Json?              @map("validacao_json")
  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")

  formulario Formulario @relation(fields: [formularioId], references: [id], onDelete: Cascade)
  valores    FormularioRespostaValor[]

  @@map("formulario_campos")
  @@unique([formularioId, chave])
  @@index([formularioId])
}

model FormularioResposta {
  id                String                   @id @default(uuid())
  tenantId          String                   @map("tenant_id")
  formularioId      String                   @map("formulario_id")
  status            FormularioRespostaStatus @default(NOVA)
  remetenteNome     String                   @map("remetente_nome") @db.VarChar(255)
  remetenteTelefone String                   @map("remetente_telefone") @db.VarChar(40)
  ipHash            String?                  @map("ip_hash") @db.VarChar(64)
  userAgent         String?                  @map("user_agent") @db.VarChar(500)
  createdAt         DateTime                 @default(now()) @map("created_at")
  updatedAt         DateTime                 @updatedAt @map("updated_at")

  tenant     Tenant                    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  formulario Formulario                @relation(fields: [formularioId], references: [id], onDelete: Cascade)
  valores    FormularioRespostaValor[]

  @@map("formulario_respostas")
  @@index([tenantId])
  @@index([formularioId, createdAt])
  @@index([status])
}

model FormularioRespostaValor {
  id             String  @id @default(uuid())
  respostaId     String  @map("resposta_id")
  campoId        String  @map("campo_id")
  valorTexto     String? @map("valor_texto") @db.Text
  valorJson      Json?   @map("valor_json")
  nomeArquivo    String? @map("nome_arquivo") @db.VarChar(255)
  caminhoArquivo String? @map("caminho_arquivo") @db.Text
  mimeType       String? @map("mime_type") @db.VarChar(120)
  tamanhoBytes   Int?    @map("tamanho_bytes")

  resposta FormularioResposta @relation(fields: [respostaId], references: [id], onDelete: Cascade)
  campo    FormularioCampo    @relation(fields: [campoId], references: [id], onDelete: Cascade)

  @@map("formulario_resposta_valores")
  @@unique([respostaId, campoId])
  @@index([respostaId])
}
```

Also add `formularios Formulario[]` and `formularioRespostas FormularioResposta[]` on `Tenant`.

- [ ] **Step 2: Write migration.sql** creating enums, tables, indexes; `ALTER TYPE "ModuloSistema" ADD VALUE 'FORMULARIOS';`

- [ ] **Step 3: Update frontend `modulos.ts`** with `FORMULARIOS: 'Formulários'`.

- [ ] **Step 4: Commit** `feat(formularios): schema e módulo FORMULARIOS`

---

### Task 2: Seed formulário SAMU

**Files:**
- Create: `coopvitta-app/backend/src/services/formulario-seed.service.ts` (idempotent upsert by slug)
- Call from migration SQL insert OR from `docker-entrypoint` / one-shot in service on first admin list — prefer **SQL seed in migration** using first tenant id, OR TS function invoked once after migrate in entrypoint.

**Recommended:** migration SQL that inserts into formularios/campos for every existing tenant (loop via DO block) OR single known tenant. Safer: **TS seed** `ensureFormularioSamuForTenant(tenantId)` called from `listFormulariosService` if missing (lazy) + script.

- [ ] **Step 1: Implement `ensureSamuFormulario(tenantId: string)`** creating titulo/slug/campos if not exists.

- [ ] **Step 2: Commit** `feat(formularios): seed SAMU por tenant`

---

### Task 3: Upload middleware + serviço público/admin

**Files:**
- Modify: `upload.middleware.ts` — `uploadFormularioResposta` (dir `uploads/formularios`, 15 MiB, single `curriculo` + text fields)
- Create: `formulario.service.ts`
- Create: `formulario.controller.ts`

**Produces:**

```ts
getFormularioPublicoBySlug(slug: string): Promise<PublicFormDto>
submitFormularioPublico(slug: string, fields: Record<string,string>, file: Express.Multer.File | undefined, meta: { ip?: string; ua?: string }): Promise<{ ok: true }>
listFormularios(tenantId: string)
getFormularioAdmin(tenantId, id)
patchFormulario(tenantId, id, { ativo?: boolean; descricao?: string })
listRespostas(tenantId, formularioId, filters)
getResposta(tenantId, formularioId, respostaId)
patchRespostaStatus(tenantId, formularioId, respostaId, status)
getRespostaFicheiroDownload(tenantId, formularioId, respostaId, campoId)
```

- [ ] **Step 1: Implement service methods** (submit valida campos obrigatórios; grava valores; PDF só `application/pdf`).

- [ ] **Step 2: Controllers** map errors to status codes.

- [ ] **Step 3: Commit** `feat(formularios): serviço e upload de respostas`

---

### Task 4: Rotas API

**Files:**
- Create: `formulario-public.routes.ts`
- Modify: `admin.routes.ts` (or create `formulario-admin.routes.ts` mounted under admin)
- Modify: `app.ts` — `app.use('/api/public/formularios', formularioPublicRoutes)`

**Public:**
- `GET /:slug`
- `POST /:slug/respostas` + rate limit 20/15min/IP + multer

**Admin:**
- `GET /formularios`
- `GET /formularios/:id`
- `PATCH /formularios/:id` (EDITAR)
- `GET /formularios/:id/respostas`
- `GET /formularios/:id/respostas/:respostaId`
- `PATCH /formularios/:id/respostas/:respostaId` (EDITAR)
- `GET /formularios/:id/respostas/:respostaId/ficheiros/:campoId/download`

- [ ] **Step 1: Wire routes + rate limit**

- [ ] **Step 2: Commit** `feat(formularios): rotas públicas e admin`

---

### Task 5: Frontend público `/f/:slug`

**Files:**
- Create: `frontend/src/pages/FormularioPublico.tsx`
- Create: `frontend/src/services/formulario-public.service.ts` (axios sem token ou `fetch`)
- Modify: `App.tsx` — rota fora de `ProtectedRoute`: `/f/:slug`

- [ ] **Step 1: Página** carrega schema, form, multipart submit, sucesso.

- [ ] **Step 2: Commit** `feat(formularios): página pública SAMU`

---

### Task 6: Frontend admin

**Files:**
- Create: `pages/Formularios.tsx`, `pages/FormularioRespostas.tsx`
- Create: `services/formulario.service.ts` (admin api)
- Modify: `App.tsx`, `AppShell.tsx` (menu + map path→módulo)
- Modify: `PerfisEquipe` / matriz se lista módulos hardcoded

- [ ] **Step 1: Lista + detalhe respostas + download + status**

- [ ] **Step 2: Commit** `feat(formularios): UI admin`

---

### Task 7: Deploy VPS

- Sync `/opt/coopvitta/coopvitta-app`, rebuild backend+frontend, migrate, smoke test `GET /api/public/formularios/samu-prova` e página `/f/samu-prova`.

- [ ] **Step 1: Deploy + verificar**

- [ ] **Step 2: Atualizar Mapa de Bordo** (mover item para histórico quando aceite)

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Models + enums | 1 |
| Seed SAMU | 2 |
| API pública + rate limit + PDF | 3–4 |
| API admin + download + status | 3–4 |
| UI `/f/samu-prova` | 5 |
| UI `/formularios` | 6 |
| Deploy | 7 |
| Builder / CPF / e-mail | Fora (Fase 2+) |

## Placeholder scan

Nenhum TBD/TODO residual no plano.
