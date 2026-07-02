# Auditoria Landing vs Briefing Viva Saúde — Plano de Análise

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (ou `superpowers:subagent-driven-development`) para executar este plano tarefa a tarefa. O comando `/execute-plan` está **deprecated** — peça ao agente para usar a skill **executing-plans** na próxima sessão.
>
> **Nota:** Este documento é um plano de **auditoria/compliance**, não de implementação. O entregável final é um relatório de conformidade, não código.

**Goal:** Verificar, página a página e requisito a requisito, se a landing em `landing/` atende ao Briefing de Design e Desenvolvimento (Site Institucional Viva Saúde).

**Architecture:** Matriz de requisitos derivada do briefing → inventário do repositório → verificação visual (browser) + verificação técnica (HTML/CSS/JS/SEO) → classificação ✅ / ⚠️ / ❌ / N/A → relatório consolidado com gaps priorizados.

**Tech Stack:** HTML estático em `landing/`, CSS `style.css`, JS (`landing-ui.js`, formulários, widget WhatsApp), build via `frontend/scripts/merge-landing.js` → `dist/`.

**Escopo de páginas:**

| Rota | Arquivo |
|------|---------|
| `/` | `landing/index.html` |
| `/para-instituicoes/` | `landing/para-instituicoes/index.html` |
| `/para-medicos/` | `landing/para-medicos/index.html` |
| `/como-funciona/` | `landing/como-funciona/index.html` |
| `/quem-somos/` | `landing/quem-somos/index.html` |
| `/app-viva-saude/` | `landing/app-viva-saude/index.html` |
| `/politica-privacidade/` | `landing/politica-privacidade/index.html` |

**Referências cruzadas:** `landing/design.json`, `landing/README.md`, conversa de design recente (DoctorID, gestão vs clínica, nav ativo, WhatsApp popup).

---

## Formato do entregável

Criar `docs/superpowers/reports/2026-06-15-landing-audit-briefing.md` com:

1. **Resumo executivo** (score por bloco: Identidade, Imagens, Componentes, SEO, LGPD, Integrações)
2. **Matriz de conformidade** (tabela: Requisito | Status | Evidência | Arquivo/URL | Gap | Prioridade)
3. **Lista de ações** (P0 bloqueadores, P1 importantes, P2 polish)
4. **Anexo:** screenshots ou notas de browser por seção crítica

**Legenda de status:**

- ✅ Atendido conforme briefing
- ⚠️ Parcialmente atendido (desvio documentado)
- ❌ Não atendido
- N/A Não aplicável à fase atual / substituído por decisão de produto

---

## Bloco 1 — Identidade Visual e Sistema de Design

### Task 1: Paleta, tipografia e tokens CSS

**Files:** `landing/css/style.css`, `landing/design.json`, `landing/index.html` (Google Fonts)

- [ ] **Step 1:** Extrair tokens `:root` (`--color-*`, `--radius-*`, `--font-*`) e comparar com briefing + `design.json` (`#1A4011`, `#52a33a`, `#c9a227`, etc.)
- [ ] **Step 2:** Confirmar tipografia do portfólio (briefing: paleta e tipografia do portfólio; implementação atual: Playfair Display + Poppins) — marcar ⚠️ se diferente do brand book oficial
- [ ] **Step 3:** Verificar border-radius: cards 12–16px, botões 8px / 999px pill, inputs 8px, imagens 16–24px
- [ ] **Step 4:** Registrar evidência (linhas CSS ou computed styles no browser)

**Critérios briefing:**

| Item | Verificar |
|------|-----------|
| Cores primária/secundária/accent/dourado | Tokens vs spec |
| Tipografia display + body | Fontes carregadas e hierarquia h1–h3 |
| Raios de borda | Cards, botões, inputs, imagens |

---

### Task 2: Ícones e biblioteca

**Files:** `landing/css/style.css` (~linha 1109), todos os HTML com SVG inline

- [ ] **Step 1:** Buscar `phosphor`, `heroicons`, `@phosphor-icons` no repo — esperado: biblioteca ou SVG inline consistente
- [ ] **Step 2:** Medir tamanhos: 24px inline, 40–48px cards, 64px hero/autoridade
- [ ] **Step 3:** Verificar outline (fundo claro) vs filled (faixa verde/footer) por seção
- [ ] **Step 4:** Listar seções sem ícone onde o briefing exige (MVV, authority bar, pain cards)

---

### Task 3: Elementos gráficos de marca

**Files:** `landing/index.html`, `landing/css/style.css` (hero, dot-pattern, brazil-map)

- [ ] **Step 1:** Losango/diamante — `.hero-diamond-outline`, animação `diamondSpin`; foto hero quadrada vs losango como moldura (decisão recente: quadrado + moldura animada)
- [ ] **Step 2:** Linhas curvas / fluxo — existem ou ausentes?
- [ ] **Step 3:** Padrão pontilhado (`--dot-pattern-*`) em seções alternadas
- [ ] **Step 4:** Mapa Brasil estilizado — `assets/brazil-map.svg` na seção abrangência; alt text, estados em verde

---

## Bloco 2 — Imagens e Fotografia

### Task 4: Inventário de assets

**Files:** `landing/assets/photos/*`, referências `<img>` em cada HTML

- [ ] **Step 1:** Listar todas as imagens usadas por página (hero, pain, pillars, strip, diferenciais)
- [ ] **Step 2:** Classificar cada foto: gestão / clínica / equipamento / stock — briefing pede humanização + gestão por contexto
- [ ] **Step 3:** Verificar largura mínima hero (1400px), formato (jpg vs webp/avif), `loading="lazy"` exceto above-the-fold
- [ ] **Step 4:** Verificar `alt` descritivo em 100% das imagens

---

### Task 5: Imagens por seção (checklist briefing)

| Página/Seção | Briefing pede | Verificar em |
|--------------|---------------|--------------|
| Hero home | Opção A/B/C (foto equipe, vídeo, losango) | `index.html` hero |
| Para Instituições | Gestores, recepção, briefing plantão, dashboard | `para-instituicoes/index.html` |
| Para Médicos | Médico + app, jaleco, ambulatorial, conversa | `para-medicos/index.html` |
| App | Mockup smartphone, 2 devices, depoimentos | `app-viva-saude/index.html`, home app section |
| Evitar | Só equipamento, coração, clínica genérica | Todas |

- [ ] **Step 1:** Preencher matriz por linha com ✅/⚠️/❌
- [ ] **Step 2:** Anotar fotos de banco vs fotos reais Viva Saúde (gap conhecido)

---

## Bloco 3 — Componentes e Seções Especiais

### Task 6: Timeline (5 passos)

**Files:** `landing/index.html`, `landing/como-funciona/index.html`, `landing/para-medicos/index.html`, CSS `.steps-timeline`, `landing/js/animations.js`

- [ ] **Step 1:** Contar passos (briefing: 5)
- [ ] **Step 2:** Desktop horizontal / mobile vertical
- [ ] **Step 3:** Número circular 40px, fundo verde escuro, linha `#A4CB82` 2px
- [ ] **Step 4:** Animação sequencial Intersection Observer

---

### Task 7: Pain section (dores)

**Files:** `landing/index.html`, CSS `--color-pain-bg`, `.pain-*`

- [ ] **Step 1:** Fundo `#F8F8F8`
- [ ] **Step 2:** Grid 2x2 desktop / 1 col mobile
- [ ] **Step 3:** Ícones laranja `#E8612A` (única seção laranja)
- [ ] **Step 4:** Hover borda laranja/vermelha

---

### Task 8: FAQ accordion

**Files:** `landing/index.html`, `landing/como-funciona/index.html`, `landing-ui.js`, CSS `.faq-*`

- [ ] **Step 1:** Borda bottom, título bold ~16px, chevron rotativo
- [ ] **Step 2:** Expansão suave max-height 0.25s
- [ ] **Step 3:** Aberto: bg `#F0F7E8`, border-left 4px verde
- [ ] **Step 4:** Apenas um aberto por vez (JS)
- [ ] **Step 5:** Schema `FAQPage` no JSON-LD (briefing SEO) — grep `FAQPage` em HTML

---

### Task 9: Formulários

**Files:** `landing/para-instituicoes/index.html`, `landing/js/subpage-form.js`, `landing/js/contact-form.js`, `landing/para-medicos/index.html`

**B2B (5 campos):**

- [ ] Nome, Cargo, Instituição, Cidade+Estado, WhatsApp
- [ ] Botão dourado `#C49A00`, texto especificado
- [ ] Tela confirmação pós-envio com check animado

**Médicos (7 campos + upload):**

- [ ] Campos completos ou redirect para `/app/cadastro` (decisão de produto)
- [ ] CRM validação, WhatsApp máscara, drag-drop PDF
- [ ] Checkbox consentimento LGPD antes do envio

**Inputs gerais:**

- [ ] Height 48px, radius 8px, borda 1.5px `#CCC`
- [ ] Focus 2px `#1A5C2A` + shadow
- [ ] Error state vermelho + mensagem 12px

---

### Task 10: Navegação e UX recentes

- [ ] **Step 1:** Item ativo no menu — cor verde + sublinhado, sem pill (pedido recente)
- [ ] **Step 2:** Headlines uppercase, sem travessões, margens/fontes (v17–v20 CSS)
- [ ] **Step 3:** Logo tamanho header/footer
- [ ] **Step 4:** WhatsApp float → popup suporte (não link direto) — `whatsapp-widget.js`

---

## Bloco 4 — SEO Técnico

### Task 11: On-page por URL

**Files:** cada `index.html`, `landing/robots.txt`, `landing/sitemap.xml`

Para **cada página** do escopo:

- [ ] Meta title único ≤60 chars
- [ ] Meta description única ≤155 chars
- [ ] Open Graph (`og:title`, `og:description`, `og:image` 1200×630)
- [ ] Canonical
- [ ] URL amigável (`/para-instituicoes` vs `/app` — briefing pede `/app`, site usa `/app-viva-saude/`)

**Schema.org:**

- [ ] Organization / MedicalOrganization (home)
- [ ] FAQPage (home FAQ)
- [ ] Verificar JSON-LD válido (Google Rich Results Test ou schema validator)

---

### Task 12: Performance e Lighthouse

**Ambiente:** `cd frontend && npm run dev` → `http://localhost:PORT/`

- [ ] **Step 1:** Lighthouse em mobile + desktop para `/` e uma subpágina
- [ ] **Step 2:** Registrar LCP, CLS, INP/FID
- [ ] **Step 3:** Verificar: WebP/AVIF, lazy loading, font preload, `font-display: swap`
- [ ] **Step 4:** CSS crítico inline no head (briefing) — provável ❌
- [ ] **Step 5:** Minificação em produção (`merge-landing.js` / build)
- [ ] **Step 6:** Meta score: Performance ≥90, Acessibilidade 100 (briefing)

---

## Bloco 5 — Acessibilidade (WCAG 2.1 AA)

### Task 13: Checklist a11y

- [ ] **Step 1:** Contraste texto (ferramenta: axe DevTools ou Lighthouse a11y)
- [ ] **Step 2:** Navegação teclado: header, menu mobile, FAQ, cookie banner, WhatsApp popup (Tab/Esc)
- [ ] **Step 3:** ARIA em botões, dialog WhatsApp, nav `aria-current`
- [ ] **Step 4:** Focus visible em links/botões/inputs
- [ ] **Step 5:** Imagens decorativas `alt=""` vs informativas com alt descritivo

---

## Bloco 6 — LGPD e Privacidade

### Task 14: Conformidade legal

**Files:** `landing/index.html` (cookie banner), `landing/politica-privacidade/index.html`

- [ ] Banner primeira visita: aceitar / preferências / essenciais — briefing pede 3 opções; implementação tem 2 (aceitar + essenciais)
- [ ] Política de Privacidade dedicada — ✅ existe
- [ ] Termos de Uso dedicados — buscar `/termos` ou página equivalente (provável ❌)
- [ ] Política de Cookies dedicada — link `#politica-cookies` vs página real
- [ ] Checkbox consentimento em formulários
- [ ] CookieYes/Cookiebot — briefing sugere; implementação usa banner custom localStorage
- [ ] Criptografia/armazenamento leads — verificar backend/integração (fora do HTML)

---

## Bloco 7 — Integrações Técnicas

### Task 15: Integrações fase 1

| Integração | Briefing | Verificar |
|------------|----------|-----------|
| CRM (RD/HubSpot) | API/embed forms | Forms abrem WhatsApp ou POST? |
| WhatsApp | wa.me + botão flutuante | `design.json` phoneWa, widget popup |
| Typebot | Snippet JS embed | Custom widget vs Typebot oficial |
| Blog/CMS | Sanity/Contentful + Next | N/A — site estático HTML |
| Chatbot | Typebot | Popup custom `whatsapp-widget.js` |

- [ ] **Step 1:** Documentar fluxo real de lead B2B e médico
- [ ] **Step 2:** Classificar cada integração ✅/⚠️/❌/N/A

---

## Bloco 8 — Consistência entre páginas

### Task 16: Paridade visual e técnica

- [ ] **Step 1:** Versão CSS (`style.css?v=`) — unificar (subpáginas ainda em v10–v20 misturado)
- [ ] **Step 2:** Header/footer idênticos ou equivalentes
- [ ] **Step 3:** `landing-ui.js` + `whatsapp-widget.js` em todas as páginas com float
- [ ] **Step 4:** Copy: travessões removidos, headlines uppercase em subpáginas
- [ ] **Step 5:** Produção `sejavivasaude.com.br` vs repo local — deploy gap

---

## Ordem de execução recomendada

```
Task 1–3  (Design system)     → 1 sessão
Task 4–5  (Fotos)             → 1 sessão
Task 6–10 (Componentes)       → 1 sessão
Task 11–12 (SEO + Perf)       → 1 sessão (requer browser + Lighthouse)
Task 13     (A11y)            → junto com Task 12
Task 14–15 (LGPD + Integr.)   → 1 sessão
Task 16     (Paridade)        → consolidação
→ Redigir relatório final
```

**Estimativa:** 4–6 horas de auditoria manual + 1 hora de relatório.

---

## Hipóteses iniciais (pré-auditoria — validar na execução)

> Não substituir a auditoria; usar como checklist rápido.

| Área | Hipótese |
|------|----------|
| Identidade cores/raios | ⚠️ Parcial — tokens existem; tipografia pode divergir do portfólio |
| Ícones Phosphor/Heroicons | ⚠️ SVG inline estilo Heroicons, não biblioteca tree-shakeable |
| Losango hero | ⚠️ Moldura animada; foto quadrada (decisão de produto) |
| Fotos gestão vs clínica | ⚠️ Home ajustada; subpáginas podem estar desatualizadas |
| Timeline / Pain / FAQ | ⚠️ Implementados; validar detalhes (#A4CB82, laranja, FAQPage schema) |
| Form B2B completo | ⚠️ Verificar campos + botão dourado + confirmação |
| Form médicos 7 campos | ❌ Provável redirect para app cadastro |
| SEO básico | ⚠️ robots + sitemap + home OG/schema; subpáginas incompletas |
| Performance | ❌ Sem WebP/AVIF, sem critical CSS; Lighthouse a medir |
| LGPD | ⚠️ Banner + privacidade; falta termos, cookies dedicado, preferências granulares |
| Typebot/RD Station | ❌ Não integrados; WhatsApp custom |
| URL `/app` | ❌ Usa `/app-viva-saude/` |

---

## Como executar na próxima sessão

1. Abrir nova conversa e pedir: **"Execute o plano em `docs/superpowers/plans/2026-06-15-auditoria-landing-briefing-viva-saude.md` usando executing-plans"**
2. Subir dev server: `cd frontend && npm run dev`
3. Marcar checkboxes conforme avança
4. Salvar relatório em `docs/superpowers/reports/2026-06-15-landing-audit-briefing.md`
5. Opcional: Canvas com matriz de conformidade para revisão visual com stakeholder

---

## Critério de sucesso do plano

- [ ] 100% dos requisitos do briefing mapeados na matriz
- [ ] Cada requisito tem status + evidência objetiva
- [ ] Gaps priorizados P0/P1/P2 com estimativa de esforço
- [ ] Stakeholder consegue decidir: "deploy as-is", "corrigir P0 antes", ou "fase 2"
