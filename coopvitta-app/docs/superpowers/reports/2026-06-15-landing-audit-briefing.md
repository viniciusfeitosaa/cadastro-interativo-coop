# Relatório de Auditoria — Landing Viva Saúde vs Briefing

**Data:** 15/06/2026  
**Escopo:** `landing/` (7 rotas)  
**Método:** Revisão estática de HTML/CSS/JS + inventário de assets (Lighthouse não executado nesta sessão)  
**Plano executado:** `docs/superpowers/plans/2026-06-15-auditoria-landing-briefing-viva-saude.md`

---

## 1. Resumo executivo

| Bloco | Score | Veredito |
|-------|-------|----------|
| **1. Identidade visual e design system** | **74%** | Tokens e raios bem mapeados ao briefing; ícones e gráficos parciais |
| **2. Imagens e fotografia** | **58%** | Home orientada a gestão; subpáginas sem fotos; assets stock no repo; sem WebP |
| **3. Componentes e seções** | **70%** | Timeline, pain, FAQ e authority bar sólidos; formulários desviam do spec |
| **4. SEO técnico** | **42%** | Home parcial; subpáginas fracas; sem FAQPage; og:image inadequado |
| **5. Acessibilidade** | **68%** | Base razoável; gaps em alt, focus global e testes formais |
| **6. LGPD e privacidade** | **52%** | Banner + política; faltam termos, cookies dedicados, consentimento em forms |
| **7. Integrações** | **38%** | WhatsApp ok; sem CRM/Typebot; CMS N/A |

### **Conformidade global estimada: ~58%**

**Conclusão:** A landing **atende parcialmente** o briefing. A **home** concentra a maior aderência (design system, seções especiais, SEO básico). **Subpáginas, performance, LGPD completa e integrações** ficam abaixo do especificado. **Não recomendado** considerar o briefing 100% atendido sem corrigir itens P0.

**Decisão sugerida:** Corrigir **P0** antes de tratar deploy como “briefing fechado”; P1/P2 em fases seguintes.

---

## 2. Matriz de conformidade

Legenda: ✅ Atendido · ⚠️ Parcial · ❌ Não atendido · N/A

### Bloco 1 — Identidade visual

| Requisito | Status | Evidência | Gap | P |
|-----------|--------|-----------|-----|---|
| Paleta (#1A4011, #52a33a, #c9a227…) | ✅ | `style.css` `:root` L6–25; `design.json` | — | — |
| Tipografia do portfólio | ⚠️ | Playfair + Poppins (`index.html` L24); `--font-display: Bebas Neue` definido mas pouco usado | Confirmar com brand book oficial | P2 |
| Cards radius 12–16px | ✅ | `--radius: 14px` L36 | — | — |
| Botões 8px / pill 999px | ✅ | `--radius-sm: 8px`, `--radius-pill: 999px` | — | — |
| Inputs radius 8px | ✅ | `.form-row input` usa `--radius-sm` | — | — |
| Imagens 16–24px radius | ✅ | `--radius-img: 20px` | — | — |
| Phosphor ou Heroicons (lib) | ⚠️ | SVG inline estilo Heroicons (`style.css` L1109+); sem npm/tree-shake | Biblioteca não instalada | P2 |
| Ícones 24/40–48/64px | ⚠️ | Authority ~28px; pain ~26px; pillar 48px; MVV ~26px | Nem sempre 64px em hero | P2 |
| Outline claro / filled escuro | ⚠️ | Outline em cards; filled implícito na authority bar | Não sistemático | P2 |
| Losango/diamante na hero | ⚠️ | `.hero-diamond-outline` + animação; foto **quadrada** dentro | Opção C parcial (decisão de produto) | P2 |
| Linhas curvas de conexão | ❌ | Não encontrado no CSS/HTML | Elemento gráfico ausente | P2 |
| Padrão pontilhado | ✅ | `--dot-pattern` em services/page-hero | — | — |
| Mapa Brasil estilizado | ⚠️ | `brazil-map.svg` na home; `alt=""` vazio | Alt e estados destacados não validados visualmente | P1 |

### Bloco 2 — Imagens

| Requisito | Status | Evidência | Gap | P |
|-----------|--------|-----------|-----|---|
| Hero home (foto equipe/gestão) | ⚠️ | `hero-gestao.jpg`, `fetchpriority="high"` | Stock; não vídeo; losango só na moldura | P1 |
| Fotos Para Instituições | ❌ | `para-instituicoes/index.html` — só texto | Sem imagens de gestão/reunião | P1 |
| Fotos Para Médicos | ❌ | `para-medicos/index.html` — só texto | Sem médico+app/jaleco | P1 |
| App: mockup smartphone | ❌ | `app-viva-saude`: `.phone-frame` placeholder CSS | Sem screenshot real nem 2 devices | P1 |
| Evitar só equipamento/coração | ✅ | Home usa gestao-*, planejamento-* | Assets stock médico/cirurgia existem mas não usados na home | — |
| Resolução hero ≥1400px | ⚠️ | `width="900"` declarado; JPG no repo | Validar dimensão real do arquivo | P1 |
| WebP/AVIF | ❌ | Apenas `.jpg`/`.png`/`.svg` | Formato não otimizado | P1 |
| Lazy loading | ⚠️ | Secundárias com `loading="lazy"`; hero sem lazy (correto) | — | — |
| Alt descritivo | ⚠️ | Maioria das fotos ok; `brazil-map.svg`, badges `alt=""` | Decorativos ok; mapa deveria descrever | P2 |

### Bloco 3 — Componentes

| Requisito | Status | Evidência | Gap | P |
|-----------|--------|-----------|-----|---|
| Timeline 5 passos | ✅ | Home + instituições + como-funciona (5); médicos (4) | Médicos com 4 passos | P2 |
| Linha #A4CB82 2px | ✅ | `.steps-timeline::before` L1631 | — | — |
| Número circular 40px | ✅ | `.step-num` L1661–1674 | — | — |
| Animação sequencial IO | ✅ | `animations.js` + `.steps-timeline[data-animate]` | Só home com `data-animate` | P2 |
| Pain fundo #F8F8F8 | ✅ | `--color-pain-bg` | — | — |
| Pain grid 2x2 | ✅ | `.pain-grid` | — | — |
| Ícones laranja #E8612A | ✅ | `.pain-icon` L1401–1410 | — | — |
| Pain hover laranja | ✅ | `.pain-card:hover` L1395–1399 | — | — |
| FAQ accordion | ✅ | `details.faq-item`; `landing-ui.js` um aberto | — | — |
| FAQ aberto #F0F7E8 + borda 4px | ✅ | `.faq-v2 .faq-item[open]` L1985–1990 | — | — |
| FAQ chevron rotativo | ✅ | `.faq-v2 .faq-question::after` L2002–2013 | — | — |
| Form B2B 5 campos spec | ⚠️ | `para-instituicoes` L88–96 | 7 campos; falta Cidade+Estado select; envia WhatsApp | P0 |
| Botão dourado #C49A00 | ✅ | `--color-gold-cta`; `.btn-gold` | Texto difere do briefing | P2 |
| Confirmação pós-envio animada | ❌ | CSS `.form-success` existe; **não usado** em HTML | Sem tela de sucesso | P0 |
| Form médico 7 campos + upload | ❌ | Redirect `/app/cadastro` (`para-medicos` L96) | Decisão produto; não atende spec landing | P1 |
| Inputs 48px, focus, error | ✅ | `.form-row input` L2315–2334 | — | — |
| Checkbox consentimento forms | ❌ | `contact-form.js` suporta `leadConsent`; **não incluído** nos forms ativos | LGPD forms | P0 |
| Nav item ativo (cor) | ✅ | `.nav-links a.is-active` verde + sublinhado | — | — |
| Headlines uppercase | ⚠️ | `.section-title`, pain h3, step h3 | Subpáginas `page-hero h1` nem sempre | P2 |
| WhatsApp popup suporte | ⚠️ | `whatsapp-widget.js` via `landing-ui.js?v=2` | Produção pode estar desatualizada; widget custom ≠ Typebot | P1 |
| MVV com ícones | ✅ | `quem-somos/index.html` `.mvv-icon` | — | — |

### Bloco 4 — SEO

| Requisito | Status | Evidência | Gap | P |
|-----------|--------|-----------|-----|---|
| robots.txt | ✅ | `landing/robots.txt` | — | — |
| sitemap.xml | ✅ | 7 URLs | — | — |
| Home: meta, canonical, OG | ⚠️ | `index.html` L6–21 | `og:image` = icon-512, não 1200×630 | P0 |
| Subpáginas: meta description | ⚠️ | instituições + médicos têm; quem-somos/como-funciona/app **não** | Incompleto | P0 |
| Subpáginas: canonical / OG | ❌ | Só home tem | Duplicidade/indexação | P0 |
| MedicalOrganization schema | ✅ | `index.html` L26–45 | — | — |
| FAQPage schema | ❌ | Ausente | Rich results FAQ | P0 |
| URL `/app` | ❌ | Rota `/app-viva-saude/` | Briefing pede `/app` | P1 |
| Titles únicos ≤60 chars | ✅ | Todas as páginas têm `<title>` | Otimização SEO por keyword possível | P2 |
| CSS crítico inline | ❌ | CSS externo bloqueante | Performance | P1 |
| WebP + preload fonts | ⚠️ | `preconnect` fonts; `display=swap` na URL Google | Sem preload woff2; sem WebP | P1 |
| Minificação produção | ⚠️ | `merge-landing.js` copia arquivos | Sem minify HTML/CSS/JS explícito | P1 |
| Lighthouse ≥90 / a11y 100 | ❓ | **Não medido** nesta sessão | Executar antes de go-live | P0 |

### Bloco 5 — Acessibilidade

| Requisito | Status | Evidência | Gap | P |
|-----------|--------|-----------|-----|---|
| Contraste 4.5:1 | ⚠️ | Tokens escuros sobre claro; não validado com ferramenta | Teste axe/Lighthouse | P1 |
| Navegação teclado | ⚠️ | FAQ native; cookie banner; wa popup Esc; nav toggle | Teste manual completo pendente | P1 |
| ARIA interativos | ⚠️ | `aria-current`, `aria-label` em vários pontos | Nem todos os botões | P2 |
| Focus visible | ⚠️ | `.store-badge-link:focus-visible`; inputs focus | Global `:focus-visible` incompleto | P2 |
| Alt em imagens | ⚠️ | Fotos informativas ok; decorativas vazias | Mapa sem descrição | P2 |

### Bloco 6 — LGPD

| Requisito | Status | Evidência | Gap | P |
|-----------|--------|-----------|-----|---|
| Banner cookies 1ª visita | ✅ | `#cookieBanner`; localStorage | — | — |
| Aceitar / essenciais / preferências | ⚠️ | 2 botões apenas | Falta “preferências” granular | P1 |
| Política de Privacidade | ✅ | `/politica-privacidade/` | — | — |
| Termos de Uso | ❌ | Não existe rota | Página dedicada ausente | P0 |
| Política de Cookies dedicada | ❌ | Link `/#politica-cookies` quebrado/inexistente | Página ou seção real | P0 |
| Consentimento em formulários | ❌ | Forms B2B sem checkbox | Art. 8 LGPD | P0 |
| CookieYes/Cookiebot | ❌ | Banner custom | Briefing sugere ferramenta | P2 |
| Criptografia leads backend | N/A | Leads vão para WhatsApp | Fora escopo HTML | — |

### Bloco 7 — Integrações

| Requisito | Status | Evidência | Gap | P |
|-----------|--------|-----------|-----|---|
| CRM RD/HubSpot | ❌ | `subpage-form.js` → `wa.me` | Sem API/embed | P1 |
| WhatsApp wa.me | ✅ | `design.json` phoneWa; widget + links | — | — |
| Typebot embed | ❌ | Widget custom `whatsapp-widget.js` | Não é Typebot | P1 |
| Blog/CMS | N/A | Site estático | Fase 2 | — |

### Bloco 8 — Paridade entre páginas

| Requisito | Status | Evidência | Gap | P |
|-----------|--------|-----------|-----|---|
| CSS version unificada | ⚠️ | v20: home, instituições, médicos, como-funciona, quem-somos | v10: app, política, partials | P1 |
| Header/footer consistentes | ⚠️ | Mesma estrutura; footers simplificados em subpáginas | — | P2 |
| landing-ui.js em todas | ⚠️ | Maioria com `?v=2`; app/política sem versão | WhatsApp widget inconsistente | P1 |
| Copy sem travessões | ⚠️ | Home corrigida; `para-medicos` L33,76 ainda com `—` | Revisão copy | P2 |
| Produção vs repo | ❓ | Usuário reportou prod desatualizada | Deploy pendente | P0 |

---

## 3. Lista de ações priorizadas

### P0 — Bloqueadores (antes de fechar briefing)

| # | Ação | Esforço |
|---|------|---------|
| 1 | SEO subpáginas: `meta description`, `canonical`, Open Graph em todas as rotas | 2–3 h |
| 2 | `og:image` 1200×630 dedicado (não icon-512) | 1 h |
| 3 | JSON-LD `FAQPage` na home | 1 h |
| 4 | Criar **Termos de Uso** e **Política de Cookies** (páginas reais) | 4–6 h |
| 5 | Checkbox consentimento LGPD nos formulários B2B | 1 h |
| 6 | Tela de confirmação pós-envio OU integrar CRM conforme briefing | 2–4 h |
| 7 | Rodar Lighthouse mobile/desktop; corrigir até meta briefing ou documentar exceção | 2–4 h |
| 8 | **Deploy** alinhado ao repo (prod ainda mostra WhatsApp link direto) | 1 h |

### P1 — Importantes

| # | Ação | Esforço |
|---|------|---------|
| 9 | Fotos de gestão nas subpáginas instituições/médicos/app | 3–4 h |
| 10 | Mockup real do app (1–2 devices) | 2–3 h |
| 11 | Converter imagens para WebP + `<picture>` | 2 h |
| 12 | Unificar CSS `?v=` e carregar `landing-ui.js?v=2` em todas as páginas | 1 h |
| 13 | Redirect `/app` → `/app-viva-saude/` ou renomear rota | 30 min |
| 14 | Banner cookies com painel “preferências” | 2–3 h |
| 15 | Avaliar RD Station / HubSpot vs manter WhatsApp documentado | decisão |

### P2 — Polish

| # | Ação | Esforço |
|---|------|---------|
| 16 | Instalar Phosphor/Heroicons como lib | 2 h |
| 17 | Linhas curvas decorativas | 2 h |
| 18 | Vídeo hero loop (Opção B briefing) | 4+ h |
| 19 | Remover travessões restantes no copy | 1 h |
| 20 | Remover ou conectar `contact-form.js` (código morto) | 1 h |
| 21 | Timeline animada em todas as subpáginas | 1 h |

---

## 4. Anexo — Inventário rápido

### Páginas auditadas

| Rota | CSS | Meta SEO | Fotos | Form | WhatsApp widget |
|------|-----|----------|-------|------|-----------------|
| `/` | v20 | ⚠️ parcial | ✅ gestão | WA panel (não form) | ✅ |
| `/para-instituicoes/` | v20 | ⚠️ desc only | ❌ | WA form 7 campos | ✅ |
| `/para-medicos/` | v20 | ⚠️ desc only | ❌ | link cadastro app | ✅ |
| `/como-funciona/` | v20 | ❌ | ❌ | — | ✅ |
| `/quem-somos/` | v20 | ❌ | ❌ | — | ✅ |
| `/app-viva-saude/` | v10 | ❌ | ❌ placeholder | — | ❌ |
| `/politica-privacidade/` | v10 | ⚠️ | — | — | ❌ |

### Assets foto (repo)

**Em uso na home:** `hero-gestao.jpg`, `gestao-escalas.jpg`, `planejamento-operacao.jpg`, `reuniao-gestao.jpg`, `dashboard-gestao.jpg`, `gestao-saude.jpg`, `operacao-escala.jpg`

**No repo, não usados na home:** `equipe-clinica.jpg`, `hero-equipe-medica.jpg`, `plantao-medico.jpg`, `medico-atendimento.jpg`, fotos cirurgia (Unsplash), etc.

### Scripts

| Arquivo | Uso |
|---------|-----|
| `landing-ui.js?v=2` | Nav, cookies, FAQ, carrega whatsapp-widget |
| `whatsapp-widget.js` | Popup suporte |
| `animations.js` | Intersection Observer (home) |
| `subpage-form.js` | Form B2B → WhatsApp |
| `contact-form.js` | **Não referenciado** em nenhum HTML |

---

## 5. Verificação pendente (próxima sessão)

- [ ] Lighthouse Performance + Accessibility (home + para-instituicoes)
- [ ] Google Rich Results Test (MedicalOrganization + FAQPage após implementar)
- [ ] Teste manual teclado: menu mobile, cookie banner, wa popup
- [ ] Comparar produção `sejavivasaude.com.br` com repo pós-deploy

---

## 6. Critérios de sucesso do plano

| Critério | Status |
|----------|--------|
| 100% requisitos mapeados | ✅ |
| Status + evidência por item | ✅ |
| Gaps P0/P1/P2 | ✅ |
| Stakeholder pode decidir próximo passo | ✅ |

**Auditoria concluída.** Próximo passo recomendado: implementar P0 ou pedir sessão de **implementação** separada com `executing-plans` focada em correções.
