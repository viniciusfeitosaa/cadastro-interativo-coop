# 📦 Guia de Instalação do Node.js

## ⚠️ Situação Atual

O Node.js não está instalado no seu sistema. Você tem duas opções:

## Opção 1: Instalar Node.js (Recomendado para Desenvolvimento)

### Método 1: Instalador Oficial (Mais Fácil)

1. **Baixar Node.js:**
   - Acesse: https://nodejs.org/
   - Baixe a versão **LTS** (Long Term Support)
   - Versão recomendada: **Node.js 18.x ou superior**

2. **Instalar:**
   - Execute o instalador baixado
   - Siga o assistente de instalação
   - **IMPORTANTE**: Marque a opção "Add to PATH" durante a instalação

3. **Verificar instalação:**
   ```powershell
   node --version
   npm --version
   ```

### Método 2: Via Chocolatey (Gerenciador de Pacotes Windows)

Se você tem o Chocolatey instalado:

```powershell
# Executar como Administrador
choco install nodejs-lts
```

### Método 3: Via Winget (Windows Package Manager)

```powershell
winget install OpenJS.NodeJS.LTS
```

## Opção 2: Usar Apenas Docker (Sem Node.js Local)

Se você **não quer instalar Node.js localmente**, pode desenvolver usando apenas Docker:

### Vantagens:
- ✅ Não precisa instalar Node.js
- ✅ Ambiente isolado e consistente
- ✅ Pronto para produção

### Desvantagens:
- ❌ Build mais lento
- ❌ Sem hot reload automático
- ❌ Mais difícil debugar

### Como usar:

1. **Desenvolvimento com Docker:**
   ```bash
   # Build e rodar
   docker-compose up --build
   
   # Ver logs
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

2. **Para fazer mudanças:**
   - Edite os arquivos normalmente
   - Rebuild o container:
     ```bash
     docker-compose build backend
     docker-compose up -d backend
     ```

## 🔧 Após Instalar Node.js

### 1. Verificar Instalação

```powershell
node --version   # Deve mostrar v18.x ou superior
npm --version    # Deve mostrar 9.x ou superior
```

### 2. Instalar Dependências

```powershell
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configurar Variáveis de Ambiente

**Backend:**
```powershell
cd backend
# Copiar .env.example para .env (na raiz do projeto)
# Editar .env com suas configurações
```

**Frontend:**
```powershell
cd frontend
# Copiar .env.example para .env
# Editar .env com a URL da API
```

### 4. Rodar em Desenvolvimento

**Backend:**
```powershell
cd backend
npm run dev
```

**Frontend:**
```powershell
cd frontend
npm run dev
```

## 🐛 Troubleshooting

### Node.js não encontrado após instalação

1. **Reiniciar o PowerShell/Terminal**
   - Feche e abra novamente o terminal

2. **Verificar PATH:**
   ```powershell
   $env:PATH -split ';' | Select-String node
   ```

3. **Adicionar manualmente ao PATH:**
   - Pressione `Win + R`
   - Digite: `sysdm.cpl`
   - Aba "Avançado" → "Variáveis de Ambiente"
   - Em "Variáveis do sistema", edite "Path"
   - Adicione: `C:\Program Files\nodejs\`

4. **Reiniciar o computador** (último recurso)

### npm não funciona

Se `node` funciona mas `npm` não:

```powershell
# Verificar se npm está instalado
where.exe npm

# Se não encontrar, reinstalar Node.js
# O npm vem junto com o Node.js
```

## 📝 Recomendação

**Para desenvolvimento local:** Instale o Node.js (Opção 1)
- Desenvolvimento mais rápido
- Hot reload automático
- Debugging mais fácil
- Melhor experiência de desenvolvimento

**Para produção:** Use Docker
- Ambiente consistente
- Fácil deploy
- Isolamento de dependências

## 🔗 Links Úteis

- **Node.js Oficial:** https://nodejs.org/
- **Documentação:** https://nodejs.org/docs/
- **npm Docs:** https://docs.npmjs.com/

---

**Após instalar, execute novamente `npm install` nos diretórios backend e frontend!** 🚀
