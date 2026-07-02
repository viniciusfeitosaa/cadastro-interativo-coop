# Lighthouse — Landing Viva Saúde (Home)

**Data:** 10/06/2026  
**Ambiente:** dev local (`http://localhost:3001/`) via Vite + plugin landing  
**Ferramenta:** Lighthouse CLI (mobile + desktop preset)

## Scores

| Categoria | Mobile | Desktop | Meta briefing |
|-----------|--------|---------|---------------|
| **Performance** | **66** | **88** | ≥ 90 |
| **Accessibility** | **95** | — | 100 |
| **SEO** | **100** | — | — |
| **Best Practices** | **100** | — | — |

## Veredito

- **SEO, Best Practices e Acessibilidade:** dentro ou próximo do esperado após correções P0 (canonical, OG, FAQPage schema).
- **Performance mobile (66):** **abaixo da meta ≥ 90**. Desktop (88) também fica ligeiramente abaixo.
- Medição em **dev local** (CSS não minificado, imagens JPG pesadas, Google Fonts externo) tende a subestimar produção otimizada, mas os gargalos são reais.

## Principais gargalos (mobile)

| Métrica / auditoria | Valor observado |
|---------------------|-----------------|
| Largest Contentful Paint (LCP) | ~9,9 s |
| Speed Index | ~4,9 s |
| Peso total da página | ~1.730 KiB |
| CSS não utilizado | ~32 KiB estimados |

**Causas prováveis:** imagem hero JPG (~900px), folha `style.css` completa bloqueante, fontes Google externas, múltiplas fotos lazy na home, ambiente dev sem minificação/compressão.

## Ações recomendadas (P1 performance)

1. Converter imagens hero e seções para **WebP** + `<picture>` fallback JPG.
2. **Preload** da fonte crítica (Poppins 400/600) ou self-host woff2.
3. **CSS crítico inline** no hero + defer do restante em produção.
4. Minificar HTML/CSS/JS no pipeline `merge-landing.js`.
5. Reexecutar Lighthouse em **build de produção** (`npm run build` + preview) antes do go-live.

## Arquivos de evidência

- `docs/superpowers/reports/lighthouse-home-mobile.json`
- `docs/superpowers/reports/lighthouse-home-desktop.json`

## Comando para repetir

```bash
cd frontend && npm run dev
# em outro terminal:
npx lighthouse http://localhost:3001/ --only-categories=performance,accessibility,seo,best-practices --form-factor=mobile --output=json --output-path=../docs/superpowers/reports/lighthouse-home-mobile.json
```
