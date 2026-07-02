# Deploy do frontend no Netlify

## Estrutura: landing na raiz + app em `/app`

- **Domínio raiz** (ex.: `https://sejavivasaude.com.br/`) → conteúdo estático da pasta `landing/`.
- **App React** em `/app` (ex.: `https://sejavivasaude.com.br/app`, `/app/login`, `/app/dashboard`).

### Build

1. **Vite** em produção usa `base: '/app/'` (em dev continua `base: '/'`).
2. **React Router** usa `basename={import.meta.env.PROD ? '/app' : '/'}`.
3. Após o build do Vite, o script `frontend/scripts/merge-landing.js`:
   - Move o output do React para `dist/app/`;
   - Copia o conteúdo de `landing/` para a raiz de `dist/`.
4. **Netlify** publica a pasta `frontend/dist` (ou `dist` com base directory `frontend`).

### URL da API em produção

- A URL da API é definida **no build** via `VITE_API_URL`.
- No Netlify, a variável da UI às vezes não chega ao build; por isso está definida no **`frontend/netlify.toml`**:

```toml
[build.environment]
  VITE_API_URL = "https://appvs.onrender.com/api"
```

- Valor esperado: `https://SEU-BACKEND.onrender.com/api` (com `/api` no final).

### Assets (imagens, favicon)

- Em produção o app está em `/app`, então os assets ficam em `/app/assets/...`.
- No código, usar **base dinâmica** para não quebrar em produção:
  - Exemplo: `src={\`${import.meta.env.BASE_URL}assets/logo.avif\`}`.
- No `index.html` do frontend, favicon com caminho relativo: `href="./vite.svg"`.

### Redirects (Netlify)

- A raiz `/` serve o `index.html` da landing (não redirecionar tudo para o SPA).
- Apenas `/app` e `/app/*` devem fazer rewrite para o SPA:

```toml
[[redirects]]
  from = "/app"
  to = "/app/index.html"
  status = 200
[[redirects]]
  from = "/app/*"
  to = "/app/index.html"
  status = 200
```

### Link “Área do associado” na landing

- No `landing/index.html`, o botão deve apontar para **`/app/login`** (não só `/app`).

### Checklist rápido

- [ ] Base directory do site no Netlify = `frontend`.
- [ ] Publish directory = `dist`.
- [ ] `VITE_API_URL` no `netlify.toml` ou nas env vars do site.
- [ ] Pasta `landing/` no mesmo repositório (mesmo nível que `frontend/`).
