# 🚀 Deploy do Backend no Render

## 🐳 Docker vs Node.js Nativo

Este projeto suporta **duas formas de deploy**:

### ✅ Docker (Recomendado)
- ✅ Ambiente idêntico entre dev e produção
- ✅ Migrações automáticas via entrypoint
- ✅ Builds em cache (mais rápido)
- ✅ Maior confiabilidade

**👉 [Ver guia completo de deploy com Docker](./DEPLOY_RENDER_DOCKER.md)**

### Node.js Nativo (Alternativa)
- Mais simples para projetos pequenos
- Requer executar migrações manualmente
- Instruções abaixo ⬇️

---

## 📋 Pré-requisitos (Deploy Node.js Nativo)

- Conta no [Render](https://render.com/)
- Repositório Git (GitHub ou GitLab)
- Código do backend commitado com os arquivos de configuração

## 🔧 Arquivos de Configuração Criados

### 1. `.env.example`
Template com todas as variáveis de ambiente necessárias

### 2. `render.yaml`
Configuração automática de infraestrutura (Blueprint)

## 📝 Passo a Passo do Deploy

### 1️⃣ Fazer Push dos Arquivos de Configuração

```bash
git add backend/.env.example backend/render.yaml backend/DEPLOY_RENDER.md
git commit -m "Add Render configuration files"
git push
```

### 2️⃣ Criar PostgreSQL Database no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com/)
2. Clique em **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `viva-saude-db`
   - **Database:** `viva_saude`
   - **User:** `viva_admin`
   - **Region:** Oregon (US West)
   - **Plan:** Free
4. Clique em **"Create Database"**
5. Aguarde a criação (1-2 minutos)
6. **Copie a "Internal Database URL"** (você vai precisar!)

### 3️⃣ Criar Web Service (Backend API)

1. No dashboard, clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório Git
3. Configure:

#### Build & Deploy

| Campo | Valor |
|-------|-------|
| **Name** | `viva-saude-backend` |
| **Region** | Oregon (US West) |
| **Branch** | `main` (ou sua branch principal) |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npm run start` |

#### Environment Variables

Adicione as seguintes variáveis:

| Key | Value | Notas |
|-----|-------|-------|
| `NODE_ENV` | `production` | - |
| `DATABASE_URL` | *Cole a Internal Database URL* | Do PostgreSQL criado no passo 2 |
| `JWT_SECRET` | *Gerar valor aleatório* | Mínimo 32 caracteres |
| `JWT_REFRESH_SECRET` | *Gerar valor aleatório* | Mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | `24h` | - |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | - |
| `BCRYPT_ROUNDS` | `12` | - |
| `RATE_LIMIT_WINDOW_MS` | `900000` | 15 minutos |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | - |
| `FRONTEND_URL` | `https://seu-app.netlify.app` | URL do frontend no Netlify |
| `ALLOWED_ORIGINS` | `https://seu-app.netlify.app` | Mesma URL do frontend |

**🔐 Como gerar JWT_SECRET e JWT_REFRESH_SECRET:**

No terminal local, execute:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Execute duas vezes para gerar dois secrets diferentes.

4. Clique em **"Create Web Service"**

### 4️⃣ Executar Migrações do Prisma

Após o primeiro deploy, você precisa criar as tabelas no banco de dados:

1. No painel do seu Web Service, vá em **"Shell"** (no menu lateral)
2. Execute os comandos:

```bash
# Gerar o Prisma Client
npx prisma generate

# Criar as tabelas no banco de dados
npx prisma migrate deploy

# Verificar se as tabelas foram criadas
npx prisma studio
```

**Alternativa (se não tiver acesso ao Shell):**

1. Vá em **"Events"** → **"Manual Deploy"** → **"Clear build cache & deploy"**
2. Adicione um script de migração automática no `package.json`:

```json
{
  "scripts": {
    "build": "tsc && npm run prisma:deploy",
    "prisma:deploy": "prisma migrate deploy"
  }
}
```

### 5️⃣ Importar Dados do CSV (Opcional)

Se você precisar importar os médicos do CSV:

1. Faça upload do arquivo CSV para um serviço como Google Drive, Dropbox, ou S3
2. No Shell do Render:

```bash
# Download do CSV
curl -o medicos.csv "URL_DO_SEU_CSV"

# Executar import
npm run prisma:import
```

## ✅ Verificação

Após o deploy, verifique:

- [ ] Build completou sem erros
- [ ] Service está "Live" (bolinha verde)
- [ ] Banco de dados está conectado
- [ ] Acessar `https://seu-backend.onrender.com/api/health` retorna status OK
- [ ] Logs não mostram erros de conexão

### Testar Endpoint

```bash
curl https://seu-backend.onrender.com/api/health
```

Deve retornar algo como:
```json
{
  "status": "ok",
  "timestamp": "2026-01-29T..."
}
```

## 🐛 Troubleshooting

### Build Falha

**Erro:** `Cannot find module '@prisma/client'`

✅ **Solução:** Adicione `npx prisma generate` no build command:
```bash
npm install && npx prisma generate && npm run build
```

---

**Erro:** `P1001: Can't reach database server`

✅ **Solução:** 
1. Verifique se a `DATABASE_URL` está correta (deve ser a "Internal Database URL")
2. Certifique-se de que o banco de dados está "Available"

---

**Erro:** `Environment variable not found: JWT_SECRET`

✅ **Solução:** Adicione todas as variáveis de ambiente obrigatórias no painel do Render

### Service Crash ao Iniciar

**Erro:** `Error: P3009 - Database does not exist`

✅ **Solução:** Execute as migrações:
```bash
npx prisma migrate deploy
```

---

**Erro:** `ECONNREFUSED`

✅ **Solução:** Verifique se a PORT está sendo lida corretamente:

```typescript
// src/server.ts
const PORT = process.env.PORT || 3001;
```

### CORS Error no Frontend

Se o frontend não conseguir conectar:

1. Verifique se `FRONTEND_URL` e `ALLOWED_ORIGINS` estão configurados
2. Verifique o CORS no `app.ts`:

```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
```

## 🔄 Deploys Automáticos

O Render faz deploy automático sempre que você fizer push para a branch configurada.

Para desabilitar:
- **Settings** → **Build & Deploy** → Desative **"Auto-Deploy"**

## 📊 Monitoramento

- **Logs:** No painel do service, clique em "Logs"
- **Metrics:** "Metrics" → CPU, Memory, Request Count
- **Events:** Histórico de deploys e eventos

## 🔐 Segurança

### Renovar JWT Secrets

Se precisar renovar os secrets (segurança):

1. Gere novos valores
2. Atualize no Render: **Environment** → Edite as variáveis
3. **Manual Deploy** → Restart

### Backup do Banco de Dados

O Render Free não oferece backup automático. Para produção:

1. Upgrade para plano pago (backup automático)
2. Ou faça backup manual:

```bash
# No Shell do Render
pg_dump $DATABASE_URL > backup.sql
```

## 💰 Custos

### Plano Free (Atual):
- ✅ Web Service: Grátis
- ✅ PostgreSQL: Grátis (1GB, 90 dias de inatividade = deleção)
- ⚠️ Limitação: Service "dorme" após 15 minutos de inatividade (primeira requisição demora ~30s)

### Plano Pago (Recomendado para Produção):
- 💵 Web Service: $7/mês (sem sleep)
- 💵 PostgreSQL: $7/mês (25GB, backups automáticos)

## 🌐 Custom Domain

Para usar um domínio próprio:

1. **Settings** → **Custom Domain** → **Add Custom Domain**
2. Configure o DNS:
   - Tipo: `CNAME`
   - Nome: `api` (ou `backend`)
   - Valor: `seu-service.onrender.com`

## 🔗 Próximo Passo

Após o backend estar rodando:

1. Copie a URL do backend: `https://seu-backend.onrender.com`
2. Configure no frontend (Netlify):
   - Variável: `VITE_API_URL`
   - Valor: `https://seu-backend.onrender.com/api`
3. Faça redeploy do frontend

---

**✨ Deploy concluído!** Seu backend está agora em produção no Render.

## 📚 Recursos Úteis

- [Render Docs - Node.js](https://render.com/docs/deploy-node-express-app)
- [Render Docs - PostgreSQL](https://render.com/docs/databases)
- [Prisma Docs - Deploy](https://www.prisma.io/docs/guides/deployment)
