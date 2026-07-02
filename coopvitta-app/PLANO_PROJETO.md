# 📋 Plano de Desenvolvimento - Viva Saúde

## 🎯 Visão Geral do Projeto

Sistema profissional para médicos (Viva Saúde) com autenticação via CPF e CRM, dashboard personalizado e arquitetura segura com Docker e banco de dados externo.

---

## 🏗️ Arquitetura do Sistema

### Stack Tecnológico Recomendado

#### **Frontend**
- **React** + **TypeScript** (ou Next.js para SSR)
- **Tailwind CSS** (estilização moderna)
- **React Router** (navegação)
- **Axios** (requisições HTTP)
- **React Query** (gerenciamento de estado do servidor)
- **Zod** (validação de formulários)

#### **Backend**
- **Node.js** + **Express** + **TypeScript** (ou NestJS para arquitetura mais robusta)
- **JWT** (autenticação)
- **bcrypt** (hash de senhas)
- **Prisma** ou **TypeORM** (ORM para banco de dados)
- **Zod** (validação de schemas)

#### **Banco de Dados**
- **PostgreSQL** (recomendado para dados relacionais e segurança)
- Banco externo ao container Docker (conexão via rede)

#### **Infraestrutura**
- **Docker** + **Docker Compose** (orquestração)
- **Nginx** (reverse proxy e load balancer)
- **SSL/TLS** (HTTPS obrigatório)
- **VPS** (Ubuntu Server recomendado)

---

## 📐 Estrutura de Pastas

```
app-medico/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── context/
│   │   └── utils/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── config/
│   ├── prisma/ (ou migrations/)
│   └── package.json
│
├── docker/
│   ├── nginx/
│   │   └── nginx.conf
│   └── docker-compose.yml
│
├── .env.example
├── .gitignore
└── README.md
```

---

## 🔐 Segurança e Conformidade

### Requisitos de Segurança
1. **LGPD Compliance**
   - Criptografia de dados sensíveis
   - Logs de auditoria
   - Consentimento explícito
   - Direito ao esquecimento

2. **Autenticação**
   - JWT com refresh tokens
   - Rate limiting
   - Validação de CRM (integração com conselhos regionais)
   - 2FA (opcional, recomendado)

3. **Dados**
   - Criptografia em trânsito (HTTPS)
   - Criptografia em repouso (banco de dados)
   - Hash de senhas (bcrypt, salt rounds 12+)
   - Sanitização de inputs

4. **Infraestrutura**
   - Firewall configurado
   - Backup automático do banco
   - Monitoramento e logs
   - Isolamento de rede

---

## 📊 Modelo de Dados

### Tabelas Principais

#### **medicos**
- id (UUID)
- cpf (criptografado)
- crm (número + estado)
- nome_completo
- email
- senha_hash
- especialidade
- telefone
- ativo (boolean)
- created_at
- updated_at

#### **sessoes** (tokens JWT)
- id
- medico_id
- token_hash
- expires_at
- created_at

#### **auditoria** (logs de ações)
- id
- medico_id
- acao
- ip_address
- user_agent
- created_at

---

## 🚀 Fases de Desenvolvimento

### **Fase 1: Setup Inicial** ✅
- [x] Estrutura de pastas
- [ ] Configuração do ambiente Docker
- [ ] Setup do banco de dados PostgreSQL
- [ ] Configuração do backend (Express/NestJS)
- [ ] Configuração do frontend (React/Next.js)
- [ ] Variáveis de ambiente (.env)

### **Fase 2: Autenticação** 🔐
- [ ] Tela de Login (CPF + CRM)
- [ ] Validação de CPF (algoritmo)
- [ ] Validação de CRM (formato + estado)
- [ ] Endpoint de login no backend
- [ ] Geração de JWT
- [ ] Middleware de autenticação
- [ ] Proteção de rotas no frontend

### **Fase 3: Dashboard** 📊
- [ ] Layout do dashboard
- [ ] Endpoint de dados do médico
- [ ] Componentes de visualização
- [ ] Integração com API
- [ ] Loading states e error handling

### **Fase 4: Segurança Avançada** 🛡️
- [ ] Rate limiting
- [ ] CORS configurado
- [ ] Helmet.js (headers de segurança)
- [ ] Validação de inputs (Zod)
- [ ] Logs de auditoria
- [ ] Criptografia de dados sensíveis

### **Fase 5: Docker e Deploy** 🐳
- [ ] Dockerfile para frontend
- [ ] Dockerfile para backend
- [ ] docker-compose.yml
- [ ] Nginx como reverse proxy
- [ ] Configuração de SSL
- [ ] Scripts de deploy
- [ ] Documentação de deploy

### **Fase 6: Testes e Otimização** 🧪
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Testes E2E
- [ ] Otimização de performance
- [ ] Monitoramento

---

## 🔧 Configurações Técnicas

### Variáveis de Ambiente

#### Backend (.env)
```env
# Servidor
PORT=3001
NODE_ENV=production

# Banco de Dados (EXTERNO - não no container)
DATABASE_URL=postgresql://user:password@HOST_EXTERNO:5432/app_medico
DB_HOST=IP_DO_BANCO_EXTERNO
DB_PORT=5432
DB_NAME=app_medico
DB_USER=usuario_db
DB_PASSWORD=senha_segura

# JWT
JWT_SECRET=chave_super_secreta_aleatoria
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=chave_refresh_secreta
JWT_REFRESH_EXPIRES_IN=7d

# Segurança
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# CORS
FRONTEND_URL=https://seu-dominio.com
```

#### Frontend (.env)
```env
REACT_APP_API_URL=https://api.seu-dominio.com
REACT_APP_ENV=production
```

---

## 🐳 Docker Compose

### Estrutura Proposta
- **Frontend Container**: Build do React
- **Backend Container**: Node.js + Express
- **Nginx Container**: Reverse proxy
- **Banco de Dados**: **EXTERNO** (não containerizado)

---

## 📝 Próximos Passos Imediatos

1. **Decidir Stack Final**
   - React ou Next.js?
   - Express ou NestJS?

2. **Configurar Repositório**
   - Git inicializado
   - Estrutura de pastas criada

3. **Setup Docker**
   - Dockerfiles criados
   - docker-compose.yml configurado

4. **Banco de Dados**
   - PostgreSQL instalado na VPS (fora do Docker)
   - Usuário e database criados
   - Conexão testada

5. **Desenvolvimento Iterativo**
   - Começar pela autenticação
   - Depois dashboard
   - Por fim, segurança e deploy

---

## ⚠️ Considerações Importantes

1. **Validação de CRM**: Verificar se há API pública dos conselhos regionais (CRM) ou implementar validação de formato
2. **LGPD**: Implementar políticas de privacidade e termos de uso
3. **Backup**: Estratégia de backup automático do banco externo
4. **Monitoramento**: Implementar logs e monitoramento (Sentry, LogRocket, etc.)
5. **Escalabilidade**: Arquitetura preparada para crescimento

---

## 📚 Recursos e Referências

- [LGPD - Lei Geral de Proteção de Dados](https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

**Status**: 📝 Planejamento Inicial
**Última Atualização**: 27/01/2026
