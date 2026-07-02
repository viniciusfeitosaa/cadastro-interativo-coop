---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

---

## Project Conventions (Viva Saúde / AppVS)

Padrões estabelecidos para manter consistência visual em todo o app. Usar ao criar ou alterar páginas, componentes e layouts.

### Tipografia
- **Display / Sans**: Outfit (400, 500, 600, 700) — títulos, labels, nav, botões. Classes: `font-display` ou `font-sans`.
- **Serif**: IBM Plex Serif (400, 500, 600, itálico 400) — descrições, textos corridos. Classe: `font-serif`.
- **Tamanhos**: `text-xl` / `text-2xl` para h1; `text-xs` para labels; `text-[10px]` para metadados e auxiliares. Evitar `text-lg` em títulos de card; preferir `text-xs uppercase` para seções.

### Cores e variáveis CSS
- Paleta **viva** (verde): `viva-50` a `viva-950`. Cor principal `viva-600` / `viva-900`.
- Variáveis em `:root`: `--app-bg`, `--app-border`, `--app-accent`, `--app-accent-hover`, `--card-shadow`, `--card-shadow-hover`.
- Textos: `text-viva-900` (títulos), `text-viva-700` (corpo), `text-viva-600` (labels). Evitar `text-gray-600` em favor de `text-viva-700`.

### Componentes (index.css + Tailwind)
- **Hero**: `.card.dashboard-hero` — gradiente sutil, `border border-viva-200/60`. Estrutura: label uppercase (`text-xs tracking-widest`), título (`text-xl md:text-2xl font-bold`), descrição (`font-serif text-base`).
- **Card**: `.card` — `rounded-2xl`, `border`, `backdrop-blur-sm`, sombra. Hover aumenta sombra.
- **CTA / Destaque**: `border-l-4 border-l-viva-500` + `bg-gradient-to-r from-viva-50/60 to-transparent` ou `bg-gradient-to-br from-white to-viva-50/30`.
- **Botões**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-sm`. Rounded-xl.
- **Input**: `.input` — bordas `viva-200`, `focus:ring-viva-500/40`.
- **Labels de seção**: `text-xs font-semibold uppercase tracking-wider text-viva-600 font-display mb-4`.

### Animações (stagger)
- Classes `.stagger-1` a `.stagger-6` com `fadeInUp` e delays progressivos (0.05s, 0.12s, …).
- Aplicar em cards na ordem de leitura (hero=1, primeiros cards=2–3, etc.).

### Layout
- **Grid dashboard**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`. Hero com `col-span-full`.
- **Espaçamento**: `space-y-6` ou `gap-6` entre blocos. Cards com `p-6`.
- **Itens em lista**: `rounded-xl`, `bg-viva-50/30` ou `bg-viva-50/50`, `border border-viva-200/40`. Item ativo: `border-l-4 border-l-viva-500`.

### AppShell
- Header: `sticky top-0`, `bg-white/80 backdrop-blur-md`, `border-b border-[var(--app-border)]`.
- Bottom nav (mobile): `fixed bottom-0`, 3 colunas (Dashboard, Ponto ou Escalas, Mais), ícones + labels `text-[11px]`.
- Drawer (menu lateral): slide da direita, `animate-slide-in-right`, itens com ícones por tipo.

### Restrições técnicas
- **Não usar** `font-display` (classe Tailwind) dentro de `@apply` no `index.css` — causa erro PostCSS. Aplicar `font-display` diretamente nas classes dos componentes.
