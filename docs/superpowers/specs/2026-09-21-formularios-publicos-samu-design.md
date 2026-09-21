# Design: Módulo Formulários (público) — Fase 1 SAMU

> Data: 2026-09-21  
> Status: aguardando revisão do utilizador  
> Repo: `cadastro-interativo-coop` / `coopvitta-app`

## 1. Objetivo

Criar na plataforma COOPVITTA uma área de **formulários públicos** com link partilhável (sem login), começando pela inscrição/pré-seleção da prova do SAMU, sobre um **motor genérico** que depois suporte builder tipo Google Forms.

## 2. Decisões de produto (aprovadas)

| Tema | Decisão |
|------|----------|
| Audiência | Público — link aberto |
| Identificação (agora) | Leve: nome completo + telefone |
| Identificação (depois) | Forte: CPF / validação cooperado |
| Quem gere | MASTER e staff com permissão no módulo `FORMULARIOS` |
| 1º formulário | Inscrição / pré-seleção — prova do SAMU |
| Abordagem técnica | Motor genérico em fases (não formulário 100% hard-coded) |

## 3. Fora de escopo (Fase 1)

- Builder drag-and-drop / UI de criação de perguntas
- Lógica condicional (“se X então Y”)
- Gráficos / dashboards de respostas
- Identificação por CPF
- Integração Google Forms / Typeform
- Multi-tenant avançado além do `tenantId` já existente (cada tenant vê os seus formulários)

## 4. Modelo de dados (Prisma)

```
Formulario
  id, tenantId, titulo, descricao?, slug (único por tenant),
  publico (bool), ativo (bool),
  identificacaoModo: LEVE | FORTE | ANONIMO  // Fase 1: LEVE
  criadoPorId?, createdAt, updatedAt

FormularioCampo
  id, formularioId, chave (ex: nomeCompleto),
  label, tipo: TEXTO | TELEFONE | ESCOLHA_UNICA | FICHEIRO,
  obrigatorio, ordem, opcoesJson? (ex: ["Técnico","Condutor"]),
  validacaoJson? (maxLength, acceptMime, maxBytes)

FormularioResposta
  id, formularioId, tenantId,
  status: NOVA | EM_ANALISE | PRE_SELECIONADA | REJEITADA | ARQUIVADA,
  remetenteNome, remetenteTelefone,
  ipHash?, userAgent?,
  createdAt, updatedAt

FormularioRespostaValor
  id, respostaId, campoId,
  valorTexto?, valorJson?,  // escolha
  // ficheiro:
  nomeArquivo?, caminhoArquivo?, mimeType?, tamanhoBytes?
```

Índices: `(tenantId, slug)` único; `(formularioId, createdAt)`; status.

## 5. Seed Fase 1 — formulário SAMU

- **Título:** Inscrição / pré-seleção — prova do SAMU  
- **Slug:** `samu-prova`  
- **URL pública:** `{FRONTEND}/f/samu-prova` (ex.: `https://app.coopvitta.cloud/f/samu-prova`)  
- **Campos:**
  1. `nomeCompleto` — TEXTO, obrigatório  
  2. `telefone` — TELEFONE, obrigatório  
  3. `profissao` — ESCOLHA_UNICA: `Técnico` \| `Condutor`, obrigatório  
  4. `curriculo` — FICHEIRO (PDF), obrigatório, máx. alinhado ao padrão da app (~10–25 MiB)

Fase 1: formulário criado por migration/seed (ou script admin). Edição de campos via builder fica para Fase 2; staff pode ativar/desativar e copiar o link.

## 6. API

### Público (sem JWT)

- `GET /api/public/formularios/:slug` — metadados + campos (sem dados internos)  
- `POST /api/public/formularios/:slug/respostas` — multipart (campos + ficheiro)  
  - Rate limit agressivo (IP)  
  - Validação de MIME/tamanho  
  - Resposta: confirmação sem expor IDs internos sensíveis

### Admin (JWT + módulo FORMULARIOS)

- `GET /admin/formularios` — listar  
- `GET /admin/formularios/:id` — detalhe + link público  
- `PATCH /admin/formularios/:id` — ativo, descrição (Fase 1)  
- `GET /admin/formularios/:id/respostas` — filtros (status, texto, data)  
- `GET /admin/formularios/:id/respostas/:respostaId` — detalhe  
- `PATCH /admin/formularios/:id/respostas/:respostaId` — status  
- `GET .../respostas/:respostaId/ficheiros/:campoId/download` — currículo  

Níveis: `VER` = listar/ver/descarregar; `EDITAR` = alterar status / ativo.

## 7. UI

### Público `/f/:slug`

- Página simples COOPVITTA (branding existente)  
- Formulário com os 4 campos + upload  
- Mensagem de sucesso após envio  
- Sem menu autenticado

### Admin `/formularios`

- Lista de formulários (link + copiar + ativo)  
- Detalhe SAMU → tabela de respostas (nome, telefone, profissão, data, status)  
- Abrir resposta → ver dados + descarregar currículo + mudar status  

## 8. Segurança e ops

- Rotas públicas fora de `authenticateToken`, com rate limit + tamanho body  
- Ficheiros em `uploads/formularios/` (volume Docker já usado)  
- Paths via `toStoredUploadPath` / `resolveStoredFileToAbsolute`  
- Não indexar dados sensíveis em logs (telefone mascarado)  
- CSRF: SPA pública same-origin; multipart como cadastro público  

## 9. Fases seguintes (backlog)

1. **Fase 2 — Builder:** criar/editar campos no admin (tipos básicos)  
2. **Fase 3 — Identificação forte:** CPF opcional/obrigatório por formulário  
3. **Fase 4 — Notificações:** e-mail à equipa ao receber resposta  
4. **Fase 5 — Export CSV** e mais tipos de pergunta  

## 10. Critérios de aceite (Fase 1)

- [ ] Link `/f/samu-prova` acessível sem login  
- [ ] Envio com os 4 campos + PDF grava resposta e ficheiro  
- [ ] Staff com `FORMULARIOS` vê respostas e descarrega currículo  
- [ ] Alterar status da inscrição  
- [ ] Formulário inativo rejeita novos envios  
- [ ] Rate limit impede flood óbvio  

## 11. Riscos

| Risco | Mitigação |
|-------|-----------|
| Spam no link público | Rate limit + captcha futuro se necessário |
| PDFs enormes | Limite multer + validação MIME |
| Escopo “Google Forms completo” | Fases explícitas; Fase 1 só SAMU + motor |
