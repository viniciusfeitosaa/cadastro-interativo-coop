# Skills – Boas práticas e documentação

Esta pasta reúne as práticas adotadas no projeto para **deploy**, **banco de dados**, **CORS** e **variáveis de ambiente**. Use como referência para não precisar repensar as soluções no futuro.

## Índice

| Arquivo | Assunto |
|---------|---------|
| [01-deploy-netlify-frontend.md](./01-deploy-netlify-frontend.md) | Frontend no Netlify: landing + app no mesmo domínio, VITE_API_URL, assets |
| [02-deploy-render-backend.md](./02-deploy-render-backend.md) | Backend no Render: Docker, porta, iniciar servidor antes do banco |
| [03-supabase-prisma-render.md](./03-supabase-prisma-render.md) | Supabase + Prisma no Render: URL, pool, connection_limit, conexão em background |
| [04-cors-e-trust-proxy.md](./04-cors-e-trust-proxy.md) | CORS, origens permitidas e trust proxy atrás do Render |
| [05-variaveis-ambiente.md](./05-variaveis-ambiente.md) | Resumo de variáveis de ambiente por ambiente (Netlify, Render) |
| [06-plugin-document-skills.md](./06-plugin-document-skills.md) | Plugin Cursor: instalação de `document-skills@anthropic-agent-skills` |
| [07-escala-conexoes-muitos-usuarios.md](./07-escala-conexoes-muitos-usuarios.md) | Pool de conexões, rate limit e escala para muitos usuários simultâneos |
| [08-supabase-email-reset-password.md](./08-supabase-email-reset-password.md) | Supabase: template de e-mail para reset de senha (Viva Saúde) e Redirect URL |

## Como usar

- Ao configurar um novo deploy, consulte o skill correspondente.
- Ao trocar de provedor (ex.: outro host do backend), adapte a partir destes documentos.
- Ao onboardar alguém no projeto, use esta pasta como referência de “como as coisas estão configuradas e por quê”.
