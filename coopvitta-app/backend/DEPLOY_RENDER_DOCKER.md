# 🐳 Deploy do Backend no Render com Docker

## 🎯 Por que usar Docker no Render?

- ✅ **Consistência total** entre dev, staging e produção
- ✅ **Ambiente isolado** com todas as dependências incluídas
- ✅ **Migrações automáticas** via entrypoint script
- ✅ **Builds mais rápidos** com cache de layers
- ✅ **Menor chance de erros** "funciona na minha máquina"

## 📋 Pré-requisitos

- Conta no [Render](https://render.com/)
- Repositório Git (GitHub ou GitLab)
- Docker configurado localmente (para testes)

## 🔧 Arquivos de Configuração

### Novos Arquivos Criados:

1. **`docker-entrypoint.sh`**
   - Script que executa migrações do Prisma automaticamente
   - Garante que o banco está atualizado antes de iniciar o servidor

2. **`Dockerfile`** (atualizado)
   - Multi-stage build otimizado
   - Executa entrypoint para migrações
   - Health check integrado
   - Usuário não-root para segurança

3. **`render.yaml`** (atualizado)
   - Configurado para usar Docker (`env: docker`)
   - Define `dockerfilePath` e `dockerContext`

## 📝 Passo a Passo do Deploy

### 1️⃣ Testar Docker Localmente (Opcional mas Recomendado)

Antes de fazer deploy, teste o build do Docker:

```bash
cd backend

# Build da imagem
docker build -t viva-saude-backend .

# Testar localmente (crie um .env antes)
docker run -p 3001:3001 --env-file .env viva-saude-backend

# Verificar health check
curl http://localhost:3001/health
```

### 2️⃣ Fazer Push das Alterações

```bash
git add backend/Dockerfile backend/docker-entrypoint.sh backend/render.yaml
git commit -m "Add Docker support for Render deployment"
git push
```

### 3️⃣ Criar PostgreSQL Database no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com/)
2. Clique em **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `viva-saude-db`
   - **Database:** `viva_saude`
   - **User:** `viva_admin`
   - **Region:** Oregon (US West) - *mesma região do backend*
   - **Plan:** Free
4. Clique em **"Create Database"**
5. **Copie a "Internal Database URL"**

### 4️⃣ Criar Web Service com Docker

1. No dashboard, clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório Git
3. Configure:

#### Build & Deploy Settings

| Campo | Valor | Observações |
|-------|-------|-------------|
| **Name** | `viva-saude-backend` | Nome do serviço |
| **Region** | Oregon (US West) | Mesma região do DB |
| **Branch** | `main` | Sua branch principal |
| **Root Directory** | `backend` | ⚠️ Importante! |
| **Environment** | **Docker** | ⚠️ Selecione Docker! |
| **Dockerfile Path** | `./Dockerfile` | Padrão |
| **Docker Build Context** | `.` | Padrão |

> ⚠️ **Importante:** Certifique-se de selecionar **"Docker"** como Environment, não "Node"!

#### Environment Variables

Adicione as seguintes variáveis de ambiente:

| Key | Value | Como Gerar |
|-----|-------|------------|
| `NODE_ENV` | `production` | - |
| `PORT` | `3001` | Render sobrescreve automaticamente |
| `DATABASE_URL` | *Cole a Internal Database URL* | Do PostgreSQL (passo 3) |
| `JWT_SECRET` | *Gerar* | Ver comando abaixo ⬇️ |
| `JWT_REFRESH_SECRET` | *Gerar* | Ver comando abaixo ⬇️ |
| `JWT_EXPIRES_IN` | `24h` | - |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | - |
| `BCRYPT_ROUNDS` | `12` | - |
| `RATE_LIMIT_WINDOW_MS` | `900000` | 15 minutos |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | - |
| `FRONTEND_URL` | `https://seu-app.netlify.app` | URL do Netlify |
| `ALLOWED_ORIGINS` | `https://seu-app.netlify.app` | URL do Netlify |

**🔐 Gerar JWT Secrets Seguros:**

Execute no terminal local:
```bash
# Gerar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Gerar JWT_REFRESH_SECRET (execute novamente para valor diferente)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Clique em **"Create Web Service"**

### 5️⃣ Acompanhar o Build

O Render vai:
1. ✅ Clonar o repositório
2. ✅ Fazer build da imagem Docker (multi-stage)
3. ✅ Executar health checks
4. ✅ Iniciar o container
5. ✅ Executar migrações automaticamente via entrypoint

**Tempo estimado:** 3-5 minutos (primeiro build)

Você pode acompanhar em tempo real na aba **"Logs"**.

### 6️⃣ Verificar Deploy

Após o deploy concluir (status "Live"):

```bash
# Verificar health check
curl https://seu-backend.onrender.com/health

# Deve retornar:
{
  "status": "ok",
  "timestamp": "2026-01-29T...",
  "uptime": 123.45
}
```

## ✅ Vantagens do Docker no Render

### 🚀 Migrações Automáticas

O script `docker-entrypoint.sh` executa `prisma migrate deploy` automaticamente em cada deploy. Você **não precisa** executar migrações manualmente!

```bash
# Não é mais necessário fazer isso:
# npx prisma migrate deploy  ❌

# O entrypoint faz automaticamente! ✅
```

### 📦 Build em Camadas

O Docker usa cache de layers, tornando rebuilds muito mais rápidos:

- **Primeiro build:** ~3-5 minutos
- **Rebuilds (sem mudanças em dependências):** ~1-2 minutos

### 🔒 Segurança

- Container roda com usuário não-root (`nodejs`)
- Dependências isoladas
- Health checks automáticos

## 🗄️ Baseline do banco (primeira vez com banco já populado)

Se o banco (ex.: Neon) **já existe** e já tem as tabelas (criadas com `prisma db push` ou manualmente), o primeiro deploy vai falhar com:

```text
No migration found in prisma/migrations
Error: P3005 - The database schema is not empty. Read more about how to baseline...
```

**Faça uma única vez** na sua máquina, apontando para o **mesmo** `DATABASE_URL` do Render/Neon:

```bash
cd backend
# Use a mesma URL do banco de produção (Neon)
$env:DATABASE_URL = "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
npx prisma migrate resolve --applied "20250127000000_init"
```

Isso marca a migração inicial como “já aplicada”. Nos próximos deploys o `prisma migrate deploy` no container vai apenas conferir o histórico e aplicar migrações **novas** (se houver).

---

## 🐛 Troubleshooting

### Build Falha com "Cannot find Dockerfile"

✅ **Solução:** Use o **Dockerfile na raiz** do repositório; Root Directory deixe em branco (raiz).

---

### Container Crash ao Iniciar

**Erro nos logs:** `Error: connect ECONNREFUSED`

✅ **Solução:** 
1. Verifique se `DATABASE_URL` está correta (deve ser a Internal URL)
2. Certifique-se de que o banco de dados está "Available"

---

### Migrações não são Executadas

✅ **Solução:** Verifique os logs do entrypoint:

```bash
# Deve aparecer nos logs:
📦 Executando migrações do Prisma...
✅ Migrações concluídas!
```

Se não aparecer, verifique se `NODE_ENV=production` está configurado.

---

### "Permission Denied" no Entrypoint

✅ **Solução:** O `chmod +x` no Dockerfile deve resolver. Se persistir:

```dockerfile
# No Dockerfile, antes de copiar o entrypoint:
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh  # ✅ Esta linha deve estar presente
```

---

### Build muito Lento

✅ **Solução:** O primeiro build é sempre mais lento. Os próximos usam cache:

- Evite mudar `package.json` frequentemente
- Use `.dockerignore` para excluir arquivos desnecessários
- Multi-stage build já otimiza o processo

## 🔄 Rebuilds e Updates

### Deploy Automático

O Render faz rebuild automático quando você faz push:

```bash
git add .
git commit -m "Update backend"
git push
# Render detecta e faz rebuild automaticamente
```

### Deploy Manual

No painel do Render:
1. **Manual Deploy** → **Clear build cache & deploy**
2. Use quando precisar rebuild completo

### Forçar Nova Migração

Se adicionar uma nova migração:

```bash
# Localmente, criar migração:
cd backend
npx prisma migrate dev --name nova_feature

# Commit e push
git add prisma/migrations/
git commit -m "Add new migration"
git push

# Render vai:
# 1. Rebuild da imagem Docker
# 2. Executar automaticamente: prisma migrate deploy
```

## 📊 Monitoramento

### Logs em Tempo Real

No painel do Render:
- **Logs** → Ver logs do container
- Inclui logs do entrypoint (migrações)
- Filtre por erro, warning, etc.

### Métricas

- **Metrics** → CPU, Memory, Request Count
- **Events** → Histórico de deploys

### Health Checks

O Docker tem health check integrado:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3
```

O Render usa isso para detectar se o container está saudável.

## 🔧 Customizações Avançadas

### Adicionar Comando de Seed

Se quiser popular o banco automaticamente:

```bash
# docker-entrypoint.sh
if [ "$NODE_ENV" = "production" ] && [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Executando seed..."
  npx prisma db seed
fi
```

Configure `RUN_SEED=true` nas variáveis de ambiente apenas na primeira vez.

### Build Multi-Arquitetura

Para suportar ARM64 (Apple Silicon):

```yaml
# render.yaml
services:
  - type: web
    dockerCommand: docker buildx build --platform linux/amd64
```

## 💰 Custos

### Plano Free:
- ✅ Web Service: Grátis
- ✅ PostgreSQL: Grátis (1GB)
- ⚠️ Container "dorme" após 15 min de inatividade

### Plano Pago (Recomendado para Produção):
- 💵 Web Service: $7/mês (sem sleep)
- 💵 PostgreSQL: $7/mês (25GB, backups)

## 🌐 Próximos Passos

1. ✅ Backend rodando: `https://seu-backend.onrender.com`
2. 📝 Copie a URL e configure no Netlify:
   - Variável: `VITE_API_URL`
   - Valor: `https://seu-backend.onrender.com/api`
3. 🔄 Redeploy do frontend

---

## 📚 Recursos Úteis

- [Render - Docker Deploys](https://render.com/docs/docker)
- [Render - PostgreSQL](https://render.com/docs/databases)
- [Docker - Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Prisma - Production Best Practices](https://www.prisma.io/docs/guides/deployment/deployment)

---

**✨ Deploy com Docker concluído!** Seu backend está em produção com ambiente totalmente isolado e migrações automáticas. 🐳
