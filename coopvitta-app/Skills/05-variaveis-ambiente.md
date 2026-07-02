# Variáveis de ambiente – resumo

Referência rápida de onde configurar cada variável (Netlify = frontend, Render = backend).

---

## Netlify (frontend)

| Variável | Obrigatório | Exemplo | Observação |
|----------|-------------|---------|------------|
| **VITE_API_URL** | Sim (produção) | `https://appvs.onrender.com/api` | Definir no `netlify.toml` em `[build.environment]` para garantir que o build use; pode ser sobrescrito pela UI. |

- Base directory do site: **`frontend`**.
- Publish directory: **`dist`**.

---

## Render (backend)

| Variável | Obrigatório | Exemplo | Observação |
|----------|-------------|---------|------------|
| **PORT** | Automático | (Render injeta) | Não definir manualmente; usar no `app.listen(PORT, '0.0.0.0', ...)`. |
| **DATABASE_URL** | Sim | Ver [03-supabase-prisma-render.md](./03-supabase-prisma-render.md) | Session pooler (5432), `sslmode=require`, `connect_timeout=30`, `pool_timeout=30`. O código define connection_limit (default 10 em prod). |
| **DATABASE_POOL_SIZE** | Opcional | `10` ou `15` | Conexões por instância (máx. 20). Ver [07-escala-conexoes-muitos-usuarios.md](./07-escala-conexoes-muitos-usuarios.md). |
| **JWT_SECRET** | Sim | string 32+ caracteres | Gerar valor aleatório seguro. |
| **JWT_REFRESH_SECRET** | Sim | string 32+ caracteres | Gerar valor aleatório seguro. |
| **FRONTEND_URL** | Sim (produção) | `https://sejavivasaude.com.br` | Sem barra no final; usado em CORS e links (ex.: e-mail). |
| **ALLOWED_ORIGINS** | Recomendado | `https://sejavivasaude.com.br` | Mesmo valor que FRONTEND_URL para CORS. |
| **NODE_ENV** | Opcional | `production` | Render costuma definir em produção. |
| **TENANT_DEFAULT_SLUG** | Conforme app | `seja-viva-saude` | Slug do tenant padrão. |
| **MASTER_INITIAL_EMAIL** / **MASTER_INITIAL_PASSWORD** | Conforme app | (dados do admin) | Só para seed/setup inicial. |

---

## Boas práticas

- **Nunca** commitar `.env` com valores reais; usar `.env.example` com placeholders e documentação.
- **DATABASE_URL**: senha com caracteres especiais (`@`, `#`, `%`) deve ser URL-encoded na string.
- **CORS**: origem exata (esquema + host + porta), sem barra no final; fazer trim ao ler do env.
- **Connection pool**: forçar `connection_limit` e `pool_timeout` no código quando usar Supabase + Render, para não depender só do que vem na URL.
