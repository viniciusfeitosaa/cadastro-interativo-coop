# ⚡ Setup Rápido - App Médico

## 🎯 Passo a Passo Rápido

### 1️⃣ Instalar Node.js (Se ainda não tiver)

**Opção A - Download Direto:**
1. Acesse: https://nodejs.org/
2. Baixe a versão **LTS**
3. Instale (marque "Add to PATH")
4. Reinicie o PowerShell

**Opção B - Via Winget:**
```powershell
winget install OpenJS.NodeJS.LTS
```

**Verificar:**
```powershell
node --version
npm --version
```

### 2️⃣ Instalar Dependências

```powershell
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3️⃣ Configurar Banco de Dados

**Criar arquivo `.env` na raiz do projeto:**

```env
# Backend
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://usuario:senha@IP_VPS:5432/app_medico
JWT_SECRET=sua_chave_super_secreta_aqui_minimo_32_caracteres
JWT_REFRESH_SECRET=outra_chave_super_secreta_aqui_minimo_32_caracteres
FRONTEND_URL=http://localhost:3000
```

**Frontend - criar `frontend/.env`:**

```env
VITE_API_URL=http://localhost:3001/api
```

### 4️⃣ Configurar Prisma

```powershell
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### 5️⃣ Rodar Aplicação

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

### 6️⃣ Acessar

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

---

## 🐳 Alternativa: Usar Docker (Sem Node.js Local)

Se não quiser instalar Node.js:

```powershell
# Na raiz do projeto
docker-compose up --build
```

Acesse:
- Frontend: http://localhost
- Backend: http://localhost:3001

---

## ⚠️ Problemas Comuns

### npm não encontrado
- Instale Node.js (veja passo 1)
- Reinicie o terminal

### Erro de conexão com banco
- Verifique se o PostgreSQL está rodando
- Confira a `DATABASE_URL` no `.env`

### Porta já em uso
- Mude a porta no `.env`
- Ou pare o processo que está usando a porta

---

**Pronto! Agora você pode começar a desenvolver.** 🚀
