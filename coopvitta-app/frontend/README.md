# Frontend - App Médico

Interface desenvolvida com React, TypeScript, Vite e Tailwind CSS.

## 🚀 Tecnologias

- **React** 18
- **TypeScript** - Tipagem estática
- **Vite** - Build tool
- **React Router** - Roteamento
- **React Query** - Gerenciamento de estado do servidor
- **React Hook Form** - Formulários
- **Zod** - Validação
- **Tailwind CSS** - Estilização
- **Axios** - Cliente HTTP

## 📁 Estrutura

```
frontend/
├── src/
│   ├── pages/           # Páginas (Home, Login, Dashboard)
│   ├── components/      # Componentes reutilizáveis
│   │   ├── Layout/      # Componentes de layout
│   │   ├── Forms/       # Componentes de formulário
│   │   └── UI/          # Componentes de UI
│   ├── services/       # Serviços de API
│   ├── hooks/          # Custom hooks
│   ├── context/         # Context API (Auth)
│   ├── utils/          # Utilitários
│   ├── types/          # Tipos TypeScript
│   ├── App.tsx         # Componente principal
│   └── main.tsx        # Entry point
├── public/             # Arquivos estáticos
└── package.json
```

## 🔧 Instalação

```bash
# Instalar dependências
npm install
```

## 🏃 Desenvolvimento

```bash
# Servidor de desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

## 🎨 Estilização

O projeto usa **Tailwind CSS** para estilização. As classes utilitárias estão disponíveis globalmente.

### Componentes Customizados

- `.btn` - Botão base
- `.btn-primary` - Botão primário
- `.btn-secondary` - Botão secundário
- `.input` - Input estilizado
- `.card` - Card container

## 🔐 Autenticação

A autenticação é gerenciada pelo `AuthContext` que:
- Armazena tokens no localStorage
- Protege rotas com `ProtectedRoute`
- Gerencia estado do usuário

## 📝 Páginas

- **/** - Home (página inicial)
- **/login** - Login (CPF + CRM + Senha)
- **/dashboard** - Dashboard (protegida, requer autenticação)

## 🌐 Variáveis de Ambiente

Crie um arquivo `.env` baseado em `.env.example`:

```env
VITE_API_URL=http://localhost:3001/api
```

## 🐳 Docker

O frontend é servido via Nginx no Docker. Veja `Dockerfile` e `nginx.conf`.

---

**Interface moderna e responsiva** 🎨
