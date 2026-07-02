# Backend - App Médico

API REST desenvolvida com Node.js, Express, TypeScript e Prisma.

## 🚀 Tecnologias

- **Node.js** 18+
- **Express** - Framework web
- **TypeScript** - Tipagem estática
- **Prisma** - ORM para PostgreSQL
- **JWT** - Autenticação
- **bcrypt** - Hash de senhas
- **Zod** - Validação de schemas

## 📁 Estrutura

```
backend/
├── src/
│   ├── config/          # Configurações (database, env)
│   ├── controllers/     # Controladores das rotas
│   ├── services/        # Lógica de negócio
│   ├── routes/          # Definição de rotas
│   ├── middleware/      # Middlewares (auth, validation)
│   ├── utils/           # Utilitários (JWT, validação, etc)
│   ├── app.ts           # Configuração Express
│   └── server.ts        # Entry point
├── prisma/
│   └── schema.prisma    # Schema do banco de dados
└── package.json
```

## 🔧 Instalação

```bash
# Instalar dependências
npm install

# Gerar Prisma Client
npm run prisma:generate

# Criar migrations
npm run prisma:migrate
```

## 🏃 Desenvolvimento

```bash
# Modo desenvolvimento (com hot reload)
npm run dev

# Build
npm run build

# Produção
npm start
```

## 📊 Prisma

```bash
# Gerar Prisma Client
npm run prisma:generate

# Criar migration
npm run prisma:migrate

# Abrir Prisma Studio
npm run prisma:studio
```

## 🔐 Variáveis de Ambiente

Veja `.env.example` na raiz do projeto.

## 📝 Rotas da API

### Autenticação
- `POST /api/auth/login` - Login (CPF + CRM + Senha)

### Médico
- `GET /api/medico/perfil` - Perfil do médico logado (requer autenticação)

### Health Check
- `GET /health` - Status da API

## 🧪 Testes

```bash
npm test
```

---

**Desenvolvido com foco em segurança e profissionalismo** 🔒
