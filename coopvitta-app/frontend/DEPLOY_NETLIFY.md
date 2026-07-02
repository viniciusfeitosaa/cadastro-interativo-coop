# 🚀 Deploy do Frontend no Netlify

## 📋 Pré-requisitos

- Conta no [Netlify](https://www.netlify.com/)
- Repositório Git (GitHub, GitLab ou Bitbucket)
- Backend em produção (para configurar a API)

## 🔧 Arquivos de Configuração Criados

### 1. `public/_redirects`
Redireciona todas as rotas para o `index.html` (necessário para SPAs com React Router)

### 2. `netlify.toml`
Configurações de build, redirects e headers de segurança

## 📝 Passo a Passo do Deploy

### 1️⃣ Fazer Push dos Arquivos de Configuração

```bash
git add frontend/public/_redirects frontend/netlify.toml
git commit -m "Add Netlify configuration files"
git push
```

### 2️⃣ Criar Novo Site no Netlify

1. Acesse [app.netlify.com](https://app.netlify.com/)
2. Clique em **"Add new site"** → **"Import an existing project"**
3. Conecte seu repositório Git
4. Selecione o repositório do projeto

### 3️⃣ Configurar Build Settings

O Netlify deve detectar automaticamente as configurações do `netlify.toml`, mas verifique:

- **Base directory:** `frontend`
- **Build command:** `npm run build`
- **Publish directory:** `frontend/dist`
- **Node version:** 18 ou superior

### 4️⃣ Configurar Variáveis de Ambiente

**IMPORTANTE:** Configure a variável de ambiente para apontar para o seu backend em produção.

1. No painel do Netlify, vá em **Site settings** → **Environment variables**
2. Clique em **"Add a variable"**
3. Adicione:

| Key | Value | Exemplo |
|-----|-------|---------|
| `VITE_API_URL` | URL base da API do backend (com `/api` no final) | `https://viva-saude-backend.onrender.com/api` |

> ⚠️ **Atenção:** Use a URL real do seu backend (ex.: Render). O frontend chama `VITE_API_URL` + rotas como `/auth/login`. Ex.: `https://seu-backend.onrender.com/api`.

### 5️⃣ Deploy

1. Clique em **"Deploy site"**
2. Aguarde o build completar (normalmente leva 1-3 minutos)
3. Acesse a URL fornecida pelo Netlify

## ✅ Verificação

Após o deploy, verifique se:

- [ ] A página inicial carrega corretamente
- [ ] Todas as rotas funcionam (Home, Login, Dashboard)
- [ ] Não há erro 404 ao navegar diretamente para rotas como `/login` ou `/dashboard`
- [ ] A API está conectando corretamente ao backend

## 🐛 Troubleshooting

### Erro 404 nas Rotas

✅ **RESOLVIDO** - O arquivo `_redirects` já está configurado corretamente.

### Erro de Conexão com API

1. Verifique se a variável `VITE_API_URL` está configurada corretamente
2. Certifique-se de que o backend está rodando e acessível
3. Verifique se o backend aceita requisições do domínio do Netlify (CORS)

### Build Falha

1. Verifique se o **Node version** é >= 18
2. Certifique-se de que `package.json` tem todas as dependências
3. Verifique os logs de build no Netlify

### CORS Error

Se você receber erros de CORS, configure o backend para aceitar requisições do domínio do Netlify:

```typescript
// No backend (app.ts)
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://seu-app.netlify.app' // Adicione o domínio do Netlify
  ],
  credentials: true
}));
```

## 🔄 Deploys Automáticos

O Netlify fará deploy automático sempre que você fizer push para a branch principal (main/master).

Para desabilitar:
1. **Site settings** → **Build & deploy** → **Continuous deployment**
2. Desative **"Auto publishing"**

## 🌐 Custom Domain

Para usar um domínio próprio:
1. **Domain settings** → **Add custom domain**
2. Siga as instruções para configurar o DNS

## 📊 Monitoramento

- **Analytics:** Site settings → Analytics
- **Build logs:** Deploys → (selecione um deploy) → Deploy log
- **Function logs:** Functions → (selecione uma função) → View logs

---

**✨ Deploy concluído!** Seu frontend está agora em produção no Netlify.
