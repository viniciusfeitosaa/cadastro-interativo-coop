# Supabase + Prisma no Render

## Qual URL usar

- **Não usar** a “Direct connection” do Supabase (`db.xxx.supabase.co`) a partir do Render; costuma falhar (rede/SSL).
- Usar sempre o **Connection pooling** do Supabase:
  - **Session pooler** (porta **5432**): costuma ser mais estável do Render. Recomendado.
  - **Transaction pooler** (porta **6543**): usar `?pgbouncer=true` na URL.

## Parâmetros obrigatórios na URL

- **`sslmode=require`** – conexão SSL (exigido pelo Supabase a partir de fora).
- **`connect_timeout=30`** – tempo para estabelecer a conexão (evita falha rápida em cold start).
- **`connection_limit`** – em produção o código usa **10** por padrão (configurável via **DATABASE_POOL_SIZE**, máx. 20). Com 1, várias requisições disputam a mesma conexão e geram timeout; com 10+ suporta bem vários usuários simultâneos. Ver [07-escala-conexoes-muitos-usuarios.md](./07-escala-conexoes-muitos-usuarios.md).
- **`pool_timeout=30`** – tempo que o Prisma espera por uma conexão do pool (evitar o default de 10s).

Exemplo (Session pooler, porta 5432). O `connection_limit` é sobrescrito no código (default 10 em produção):

```
postgresql://postgres.[REF]:[SENHA]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30&pool_timeout=30
```

## Garantir connection_limit no código

- Se no Render a `DATABASE_URL` vier com `connection_limit=1`, o Prisma usa 1 e os timeouts voltam.
- No código (ex.: `config/database.ts`), o **connection_limit** é definido por **DATABASE_POOL_SIZE** (opcional) ou default (10 em produção, 3 em dev), com máximo 20. A URL é ajustada antes de passar ao `PrismaClient`.
- Assim o app usa sempre um pool adequado, independente do que vier na env.

## Conexão em background

- Não bloquear o startup do servidor esperando a conexão com o banco (ver [02-deploy-render-backend.md](./02-deploy-render-backend.md)).
- Tentar conectar em background com retries (ex.: 5 tentativas com 5s de intervalo; depois, se falhar, nova tentativa a cada 30s). Quando o Supabase responder (ex.: projeto “acordando” no free tier), a conexão é estabelecida.

## Supabase: projeto e rede

- **Projeto pausado** (free tier): reativar no painel se o deploy falhar com P1001.
- **Rede:** por padrão o Supabase aceita conexões de qualquer IP; se houver “Restrict connections”, liberar o acesso necessário para o Render (ou desativar a restrição para testes).

## Resumo

| Item | Prática |
|------|--------|
| Host | `*.pooler.supabase.com` (Session 5432 ou Transaction 6543) |
| SSL | `sslmode=require` |
| Timeouts | `connect_timeout=30`, `pool_timeout=30` |
| Pool | `connection_limit` = 10 em prod (ou DATABASE_POOL_SIZE; máx. 20) |
| Startup | Servidor sobe primeiro; conexão ao banco em background com retry |
