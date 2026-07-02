# CORS e Trust Proxy

## CORS no backend (Express)

- O frontend em produção está em `https://sejavivasaude.com.br` (incluindo as rotas em `/app`). A **origin** enviada pelo navegador é sempre o domínio: `https://sejavivasaude.com.br`.
- O backend deve permitir essa origem nas respostas (header `Access-Control-Allow-Origin`).
- Variáveis no **Render** (backend):
  - **`FRONTEND_URL`** = `https://sejavivasaude.com.br` (sem barra no final).
  - **`ALLOWED_ORIGINS`** = `https://sejavivasaude.com.br`.
- No código, a origem de produção pode ser **fixa** no allowlist (ex.: `https://sejavivasaude.com.br`) para não depender só da env. Fazer trim nas origens vindas do env para evitar espaços que quebrem o match.
- Usar **credentials: true** no CORS se o frontend envia cookies/auth.

## Trust proxy (Render)

- O Render coloca um proxy na frente do app; as requisições chegam com headers como **`X-Forwarded-For`** e **`X-Forwarded-Proto`**.
- O **express-rate-limit** exige que o Express confie no proxy para identificar o IP correto. Caso contrário: `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.
- **Prática:** configurar **trust proxy** logo no início do app, antes dos middlewares de rate limit:

```ts
app.set('trust proxy', 1);
```

- Assim o rate limit usa o IP real do cliente e o aviso do rate-limit deixa de aparecer.

## Ordem no app

1. `express()`.
2. `app.set('trust proxy', 1)`.
3. Demais middlewares (helmet, cors, rateLimit, rotas).

## Checklist rápido

- [ ] `FRONTEND_URL` e `ALLOWED_ORIGINS` no Render com o domínio do frontend (sem barra final).
- [ ] `app.set('trust proxy', 1)` antes do rate limiter.
- [ ] CORS com a origem de produção na allowlist (fixa ou via env).
