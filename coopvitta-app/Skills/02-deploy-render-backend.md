# Deploy do backend no Render

## Porta e binding

- O Render espera o serviço escutando na porta definida pela variável **`PORT`** (injetada automaticamente).
- É **obrigatório** escutar em **`0.0.0.0`** para o Render detectar a porta e considerar o deploy como “running”:

```ts
app.listen(PORT, '0.0.0.0', () => { ... });
```

- Se escutar só em `localhost` ou omitir o host, o Render não vê a porta e o deploy falha com “No open ports detected”.

## Ordem de inicialização: servidor antes do banco

- **Problema:** Se o app só sobe depois de conectar ao banco e o Supabase demorar ou falhar (cold start, rede), o processo nunca abre a porta e o Render encerra o deploy.
- **Prática:** Iniciar o **servidor HTTP primeiro** (listen na porta) e conectar ao banco **em background** (sem bloquear o startup).
- No `server.ts`: chamar `createApp()` (que não conecta ao banco), fazer `app.listen(...)` e, no callback do listen, chamar `connectDatabaseInBackground()`. Se a conexão falhar, fazer retry (ex.: a cada 30s) sem derrubar o processo.
- Assim o deploy “passa” e o serviço fica no ar; quando o banco responder, a conexão é estabelecida.

## Docker (quando usado)

- O `docker-entrypoint.sh` roda migrações e depois inicia o Node. Se as migrações falharem (ex.: P1001), o script continua e inicia o servidor mesmo assim (evitar `set -e` que interrompe no primeiro erro nas migrações, ou tratar o código de saída).
- Build: `npx prisma generate` e `npm run build` na etapa de build da imagem.

## Checklist rápido

- [ ] `app.listen(PORT, '0.0.0.0', ...)`.
- [ ] Conexão ao banco em background após o listen (não bloquear o startup).
- [ ] Variável `PORT` usada (Render a define automaticamente).
