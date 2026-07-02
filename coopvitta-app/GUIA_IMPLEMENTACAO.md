# 🚀 Guia de Implementação Passo a Passo

## Passo 1: Preparação do Ambiente Local

### 1.1 Instalações Necessárias
```bash
# Docker e Docker Compose
# Node.js 18+ e npm
# Git
```

### 1.2 Estrutura Inicial
```bash
mkdir app-medico
cd app-medico
git init
```

---

## Passo 2: Configuração do Banco de Dados (VPS)

### 2.1 Instalação do PostgreSQL na VPS
```bash
# No servidor VPS (Ubuntu)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Criar usuário e database
sudo -u postgres psql
CREATE USER app_medico_user WITH PASSWORD 'senha_super_segura';
CREATE DATABASE app_medico OWNER app_medico_user;
GRANT ALL PRIVILEGES ON DATABASE app_medico TO app_medico_user;
\q
```

### 2.2 Configuração de Segurança
```bash
# Editar postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf
# Garantir que listen_addresses está configurado corretamente

# Editar pg_hba.conf para permitir conexão do Docker
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Adicionar: host all all IP_DO_CONTAINER/32 md5
```

### 2.3 Firewall
```bash
# Permitir apenas IP do container Docker
sudo ufw allow from IP_DO_CONTAINER to any port 5432
```

---

## Passo 3: Setup do Backend

### 3.1 Inicialização
```bash
cd backend
npm init -y
npm install express typescript ts-node @types/node @types/express
npm install prisma @prisma/client
npm install jsonwebtoken bcryptjs
npm install zod express-validator
npm install cors helmet express-rate-limit
npm install dotenv
npm install -D @types/bcryptjs @types/jsonwebtoken @types/cors
```

### 3.2 Estrutura de Arquivos
```
backend/
├── src/
│   ├── app.ts (configuração Express)
│   ├── server.ts (entry point)
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   └── medico.routes.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   └── medico.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   └── medico.service.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── validation.middleware.ts
│   ├── models/ (Prisma schema)
│   └── utils/
│       ├── jwt.util.ts
│       ├── cpf.util.ts
│       └── crm.util.ts
├── prisma/
│   └── schema.prisma
└── package.json
```

---

## Passo 4: Setup do Frontend

### 4.1 Inicialização
```bash
cd frontend
npx create-react-app . --template typescript
# ou
npx create-next-app . --typescript

npm install axios react-query
npm install react-router-dom
npm install zod react-hook-form @hookform/resolvers
npm install tailwindcss postcss autoprefixer
```

### 4.2 Estrutura de Arquivos
```
frontend/
├── src/
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   └── Dashboard.tsx
│   ├── components/
│   │   ├── Layout/
│   │   ├── Forms/
│   │   └── UI/
│   ├── services/
│   │   └── api.ts
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── context/
│   │   └── AuthContext.tsx
│   └── utils/
│       └── validation.ts
└── package.json
```

---

## Passo 5: Docker Configuration

### 5.1 Dockerfile Backend
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

### 5.2 Dockerfile Frontend
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 5.3 docker-compose.yml
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - app-network

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

---

## Passo 6: Implementação da Autenticação

### 6.1 Validação de CPF
- Algoritmo de validação de CPF brasileiro
- Remover formatação antes de validar
- Armazenar criptografado no banco

### 6.2 Validação de CRM
- Formato: Número + Estado (ex: 12345-SP)
- Validar formato regex
- Verificar estado válido (26 estados + DF)
- (Opcional) Integração com API do conselho

### 6.3 Fluxo de Login
1. Usuário insere CPF e CRM
2. Frontend valida formato
3. Envia para `/api/auth/login`
4. Backend valida CPF e CRM
5. Busca médico no banco
6. Compara senha (bcrypt)
7. Gera JWT
8. Retorna token + dados do médico
9. Frontend armazena token
10. Redireciona para dashboard

---

## Passo 7: Dashboard

### 7.1 Endpoints Necessários
- `GET /api/medico/perfil` - Dados do médico logado
- `GET /api/medico/estatisticas` - Estatísticas (se aplicável)

### 7.2 Componentes do Dashboard
- Header com nome do médico
- Cards com informações principais
- Gráficos (se necessário)
- Menu de navegação

---

## Passo 8: Deploy na VPS

### 8.1 Preparação da VPS
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt install docker-compose-plugin

# Configurar usuário
sudo usermod -aG docker $USER
```

### 8.2 Deploy
```bash
# Clonar repositório na VPS
git clone seu-repositorio.git
cd app-medico

# Configurar .env
cp .env.example .env
nano .env

# Build e start
docker-compose build
docker-compose up -d
```

### 8.3 SSL/HTTPS
```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d seu-dominio.com
```

---

## Passo 9: Monitoramento e Manutenção

### 9.1 Logs
```bash
# Ver logs dos containers
docker-compose logs -f

# Logs específicos
docker-compose logs backend
docker-compose logs frontend
```

### 9.2 Backup do Banco
```bash
# Script de backup automático (cron)
#!/bin/bash
pg_dump -h localhost -U app_medico_user app_medico > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 9.3 Atualizações
```bash
# Pull do código
git pull

# Rebuild e restart
docker-compose down
docker-compose build
docker-compose up -d
```

---

## ✅ Checklist de Segurança

- [ ] HTTPS configurado (SSL/TLS)
- [ ] Senhas com hash bcrypt (12+ rounds)
- [ ] JWT com expiração adequada
- [ ] Rate limiting implementado
- [ ] CORS configurado corretamente
- [ ] Headers de segurança (Helmet)
- [ ] Validação de inputs (Zod)
- [ ] Logs de auditoria
- [ ] Backup automático do banco
- [ ] Firewall configurado
- [ ] Variáveis sensíveis em .env (não commitadas)
- [ ] Banco de dados externo ao container
- [ ] Conexão do banco apenas do container permitida

---

## 📞 Próximas Ações

1. Revisar e aprovar o plano
2. Decidir stack final (React vs Next.js, Express vs NestJS)
3. Iniciar implementação da Fase 1
4. Configurar repositório Git
5. Setup inicial do projeto
