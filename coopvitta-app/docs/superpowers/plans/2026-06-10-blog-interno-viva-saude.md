# Plano — Blog interno Viva Saúde (sem WordPress)

**Data:** 10/06/2026  
**Status:** Proposta aprovável → implementação em fases  
**Decisão:** Não integrar WordPress. Mini-CMS nativo no stack atual (landing estática + API Express + admin React MASTER).

---

## 1. Contexto e decisão

| Item | Situação atual | Direção |
|------|----------------|---------|
| Blog público | HTML estático em `landing/blog/` (1 artigo real, vários “Em breve”) | Dinâmico via API, mesma URL `/blog/` |
| CSS blog | Classes `blog-grid`, `blog-card` **sem estilos** em `style.css` | Design system blog completo |
| Backend | Sem modelos de blog/comentário | Prisma + rotas `/api/blog` |
| Admin | Apenas perfil `MASTER` no app `/app` | Módulo “Blog” no painel master |
| WordPress | Descartado | — |

**Por que não WordPress:** stack já unificado (Netlify/nginx + Render API + Postgres); identidade visual controlada; moderação LGPD no mesmo backend; zero custo/host PHP extra.

---

## 2. Visão de produto (IHC — PA 2)

### Personas

| Persona | Objetivo | Contexto |
|-------|----------|----------|
| **Gestor / médico leitor** | Aprender sobre escalas, carreira, gestão hospitalar | Mobile ou desktop, leitura rápida, pouco tempo |
| **Visitante anônimo** | Avaliar autoridade da Viva Saúde antes de contato B2B | SEO, artigos compartilháveis |
| **Admin MASTER** | Publicar artigos, moderar e **responder** comentários | App `/app`, desktop, fluxo diário/semanal |

### Tarefas críticas (cenários)

1. **Ler artigo** — encontrar por categoria ou lista, ler até o fim, CTA institucional.
2. **Comentar** — enviar dúvida/opinião com nome + e-mail; ver confirmação de moderação.
3. **Admin publicar** — criar rascunho, revisar, publicar com slug e categoria.
4. **Admin moderar** — aprovar/rejeitar comentário; **responder oficialmente** (resposta visível como “Equipe Viva Saúde”).

### Modelo mental vs implementação

| Modelo mental (leitor) | Deve parecer | Evitar |
|------------------------|--------------|--------|
| “Blog da empresa” | Editorial confiável, tom consultivo | Parecer fórum genérico ou rede social |
| “Comentário” | Enviado → analisado → pode aparecer | Aparecer instantâneo sem moderação |
| “Resposta oficial” | Destaque visual da equipe | Misturar com comentários comuns |

---

## 3. Direção estética (frontend-design)

**Tom:** editorial/refinado — revista de gestão em saúde, não startup genérica.

**Elementos da marca (reutilizar):**
- Tipografia: Playfair Display (títulos) + Poppins (corpo) — já na landing
- Paleta: `#1A4011` primário, `#52a33a` acento, `#c9a227` dourado, fundo `#F8F8F8` em cards
- Padrão pontilhado (`--dot-pattern`) em hero do blog
- Cards com `--radius: 14px`, sombra suave

**Diferenciação memorável:**
- **Respostas oficiais** com barra lateral dourada + selo “Equipe Viva Saúde”
- **Categorias** como chips superiores (Gestão de Escalas, Gestão Hospitalar, Carreira Médica)
- **Grid assimétrico** na home do blog: 1 artigo em destaque + cards menores (desktop)

**Motion (CSS only na landing):**
- Fade-up nos cards (reutilizar `animations.js`)
- Hover nos cards: leve `translateY(-2px)` + borda verde

---

## 4. Arquitetura técnica

```
[Público]  landing/blog/*  +  blog-public.js
                │ fetch
                ▼
         GET /api/blog/posts
         GET /api/blog/posts/:slug
         POST /api/blog/posts/:slug/comments

[Admin MASTER]  /app/blog  (React)
                │ JWT MASTER
                ▼
         /api/admin/blog/*  (CRUD posts, moderar, responder)

                ▼
         PostgreSQL (Prisma)
         BlogCategory | BlogPost | BlogComment
```

### URLs públicas

| Rota | Comportamento |
|------|----------------|
| `/blog/` | Lista por categoria + destaque |
| `/blog/artigo/:slug` | Template único `landing/blog/artigo/index.html` + JS carrega conteúdo |
| `/blog/categoria/:slug` | Filtro (opcional fase 2; fase 1 usa query `?categoria=`) |

### URLs admin (React, `MasterOnly`)

| Rota | Função |
|------|--------|
| `/app/blog` | Dashboard: rascunhos, publicados, comentários pendentes |
| `/app/blog/novo` | Editor de post |
| `/app/blog/editar/:id` | Editar post |
| `/app/blog/comentarios` | Fila de moderação + respostas |

---

## 5. Modelo de dados (Prisma — proposta)

```prisma
enum BlogPostStatus {
  RASCUNHO
  PUBLICADO
  ARQUIVADO
}

enum BlogCommentStatus {
  PENDENTE
  APROVADO
  REJEITADO
}

model BlogCategory {
  id        String   @id @default(uuid())
  tenantId  String
  slug      String   // gestao-escalas
  nome      String
  ordem     Int      @default(0)
  posts     BlogPost[]
  @@unique([tenantId, slug])
}

model BlogPost {
  id           String   @id @default(uuid())
  tenantId     String
  categoryId   String
  slug         String
  titulo       String
  resumo       String   @db.VarChar(320)
  conteudo     String   @db.Text   // Markdown ou HTML sanitizado
  capaUrl      String?
  status       BlogPostStatus @default(RASCUNHO)
  publicadoEm  DateTime?
  autorId      String   // usuarioMaster
  seoTitle     String?
  seoDescription String?
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt
  comentarios  BlogComment[]
  @@unique([tenantId, slug])
}

model BlogComment {
  id            String   @id @default(uuid())
  tenantId      String
  postId        String
  autorNome     String
  autorEmail    String
  conteudo      String   @db.Text
  status        BlogCommentStatus @default(PENDENTE)
  // Resposta oficial (admin)
  respostaTexto String?  @db.Text
  respondidoPorId String?
  respondidoEm  DateTime?
  criadoEm      DateTime @default(now())
  post          BlogPost @relation(...)
}
```

**Seed inicial:** migrar conteúdo de `escala-sem-improviso.html` para 1 post publicado + 3 categorias já usadas no HTML.

---

## 6. API (contratos resumidos)

### Público (`/api/blog`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/posts` | Lista publicados (`?categoria=&page=&limit=`) |
| GET | `/posts/:slug` | Artigo + comentários **aprovados** com resposta |
| POST | `/posts/:slug/comments` | Novo comentário → `PENDENTE` |

**POST comentário — body:** `autorNome`, `autorEmail`, `conteudo`, `consentimentoLgpd: true`  
**Rate limit:** sim (ex.: 5/h por IP)  
**Validação:** express-validator, e-mail, tamanho máx. 2000 chars

### Admin (`/api/admin/blog`, `authenticateToken` + `requireRole([MASTER])`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/posts` | Listar (incl. rascunho) / criar |
| PUT/DELETE | `/posts/:id` | Editar / arquivar |
| PATCH | `/posts/:id/publicar` | Publica + `publicadoEm` |
| GET | `/comments?status=PENDENTE` | Fila moderação |
| PATCH | `/comments/:id/aprovar` | Aprova |
| PATCH | `/comments/:id/rejeitar` | Rejeita |
| POST | `/comments/:id/responder` | `{ respostaTexto }` — aprova + grava resposta oficial |

---

## 7. Frontend público (landing)

### Arquivos novos/alterados

| Arquivo | Função |
|---------|--------|
| `landing/css/style.css` | `.blog-*`, `.blog-article`, `.blog-comments`, `.blog-reply-official` |
| `landing/js/blog-public.js` | Fetch API, render lista/artigo/comentários |
| `landing/blog/index.html` | Shell + `#blog-root` (remove cards hardcoded) |
| `landing/blog/artigo/index.html` | Template artigo + formulário comentário |
| `landing/sitemap.xml` | Incluir `/blog/` + posts (geração script ou manual fase 1) |

### Componentes visuais

1. **Hero blog** — título + lead (já existe, alinhar nav/footer v44)
2. **Destaque** — card grande último post ou escolhido (`destaque: true` fase 2)
3. **Grid de cards** — imagem opcional, categoria chip, data, resumo, “Ler artigo →”
4. **Artigo** — breadcrumb, meta, corpo tipografado, CTA institucional (já no artigo estático)
5. **Comentários** — lista aprovada; resposta oficial destacada
6. **Form comentário** — nome, e-mail, textarea, checkbox LGPD, feedback sucesso/erro

---

## 8. Frontend admin (React)

- Nova entrada no menu master: **Blog** (ícone documento/pen)
- **Não** exige novo `ModuloSistema` na fase 1 — apenas `MasterOnly` (como outros fluxos master)
- Fase 2: opcional `ModuloSistema.BLOG` na matriz de acessos

**Telas:**
1. Lista posts (tabs: Publicados | Rascunhos | Arquivados)
2. Editor — título, slug auto, categoria, resumo, editor Markdown simples ou textarea + preview
3. Comentários — tabela/fila: post, autor, trecho, ações Aprovar / Rejeitar / Responder
4. Modal resposta — textarea + “Publicar resposta” (marca `respondidoEm` + aprova se pendente)

Estilo admin: **reutilizar** componentes Viva (`btn`, cards `viva-*`) — admin funcional, não reinventar landing no app.

---

## 9. Revisão IHC (heurísticas prioritárias)

| # | Heurística | Aplicação |
|---|------------|-----------|
| 1 | Visibilidade do status | Após comentar: “Recebemos seu comentário. Ele aparecerá após moderação.” |
| 2 | Correspondência sistema/mundo real | “Equipe Viva Saúde” em respostas, não “Admin” |
| 3 | Controle e liberdade | Admin pode despublicar arquivar; leitor não edita comentário após envio |
| 4 | Consistência | Mesmo header/footer da landing em todo `/blog/` |
| 5 | Prevenção de erro | Slug único validado; confirmação ao rejeitar comentário |
| 6 | Reconhecimento | Badge contador “N comentários pendentes” no menu admin |
| 7 | Flexibilidade | Editor markdown simples (fase 1); rich text (fase 3 opcional) |
| 8 | Design minimalista | Artigo max-width 720px, comentários secundários visualmente |
| 9 | Recuperação de erros | Mensagens API em português claro no form |
| 10 | Ajuda | Link política privacidade no form de comentário |

**Acessibilidade mínima:** labels visíveis, focus ring nos inputs, contraste 4.5:1 nos textos do form, `aria-live` no feedback pós-envio.

---

## 10. SEO e LGPD

- `meta description` + `canonical` por artigo (injetados via JS fase 1; **ideal** endpoint SSR ou snapshot estático na publicação — fase 2)
- JSON-LD `BlogPosting` no artigo
- `sitemap.xml` dinâmico via script pós-publicação ou rota backend `/api/blog/sitemap.xml`
- Comentários: consentimento explícito + menção à política de privacidade
- E-mail do comentarista: **não** exibir publicamente; só admin vê

---

## 11. Fases de implementação

### Fase 1 — Fundação (MVP) · ~3–4 dias
- [ ] Migration Prisma + seed 1 artigo + categorias
- [ ] API pública + admin CRUD posts
- [ ] CSS blog completo na landing
- [ ] `blog-public.js` — lista + artigo
- [ ] Admin: listar/criar/editar/publicar posts
- [ ] Migrar/remover HTML estático redundante

### Fase 2 — Comentários · ~2 dias
- [ ] POST comentário + moderação admin
- [ ] Resposta oficial admin
- [ ] UI comentários no artigo + fila admin
- [ ] Rate limit + LGPD checkbox

### Fase 3 — Polish · ~1–2 dias
- [ ] SEO (JSON-LD, sitemap automático)
- [ ] Destaque na home do blog
- [ ] Alinhar nav/footer/CSS v44 em todas páginas blog
- [ ] Testes manuais mobile + checklist IHC

### Fora do escopo (fase futura)
- Rich text WYSIWYG
- Upload de capa no S3/storage existente
- Newsletter integrada (hoje CTA aponta para `#cta-final`)
- Comentários aninhados (threads)
- Notificação e-mail ao admin quando novo comentário

---

## 12. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| SEO fraco com CSR puro | Gerar snapshot HTML na publicação ou meta tags server-side fase 2 |
| Spam em comentários | Rate limit + moderação obrigatória + honeypot |
| XSS no conteúdo | Sanitizar HTML/Markdown no backend (DOMPurify ou marked + allowlist) |
| Blog CSS inexistente hoje | Prioridade fase 1 — cards estão sem estilo |

---

## 13. Critérios de aceite (MVP)

1. Admin MASTER cria e publica artigo com categoria pelo app.
2. Artigo aparece em `/blog/` e abre em `/blog/artigo/:slug`.
3. Visitante envia comentário; vê mensagem de moderação.
4. Admin aprova e responde; resposta aparece destacada no artigo.
5. Visual consistente com landing (verde, Playfair, cards, hero).
6. Nenhuma dependência WordPress.

---

## 14. Próximo passo

Aprovar este plano → iniciar **Fase 1** (schema + API + CSS blog + lista/artigo públicos).

Ordem sugerida de commits:
1. `feat(blog): schema prisma e seed`
2. `feat(blog): api publica e admin posts`
3. `feat(landing): design system blog e blog-public.js`
4. `feat(app): painel admin blog master`
