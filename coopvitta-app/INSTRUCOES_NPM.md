# 📋 Instruções: Como Usar npm no PowerShell

## ⚠️ Problema

O PowerShell está bloqueando a execução do `npm.ps1`, mas o `npm.cmd` funciona!

## ✅ Soluções

### Solução 1: Usar npm.cmd diretamente (Mais Rápido)

**No PowerShell, use:**

```powershell
# Backend
cd backend
& "C:\Program Files\nodejs\npm.cmd" install

# Frontend
cd ..\frontend
& "C:\Program Files\nodejs\npm.cmd" install
```

### Solução 2: Criar Alias no PowerShell

Adicione ao seu perfil do PowerShell (`$PROFILE`):

```powershell
# Abrir perfil
notepad $PROFILE

# Adicionar esta linha:
Set-Alias npm "C:\Program Files\nodejs\npm.cmd"
```

Depois, reinicie o PowerShell e use `npm` normalmente.

### Solução 3: Usar o Script Helper

Execute o script `npm-install.ps1` que criei:

```powershell
.\npm-install.ps1
```

### Solução 4: Usar CMD ao invés do PowerShell

1. Abra o **Prompt de Comando** (cmd.exe)
2. Navegue até a pasta:
   ```cmd
   cd C:\Users\vinic\Downloads\AppVS\backend
   ```
3. Execute normalmente:
   ```cmd
   npm install
   ```

### Solução 5: Alterar Política de Execução (Requer Admin)

**Execute o PowerShell como Administrador:**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Depois reinicie o PowerShell.

## 🚀 Comandos Rápidos

### Instalar Dependências

**Backend:**
```powershell
cd backend
& "C:\Program Files\nodejs\npm.cmd" install
```

**Frontend:**
```powershell
cd frontend
& "C:\Program Files\nodejs\npm.cmd" install
```

### Outros Comandos npm

Substitua `npm` por `& "C:\Program Files\nodejs\npm.cmd"`:

```powershell
# Exemplos
& "C:\Program Files\nodejs\npm.cmd" run dev
& "C:\Program Files\nodejs\npm.cmd" run build
& "C:\Program Files\nodejs\npm.cmd" install express
```

## 💡 Dica: Criar Função no PowerShell

Adicione ao seu `$PROFILE`:

```powershell
function npm {
    & "C:\Program Files\nodejs\npm.cmd" $args
}
```

Depois use `npm` normalmente!

## 📝 Verificar Instalação

```powershell
& "C:\Program Files\nodejs\npm.cmd" --version
& "C:\Program Files\nodejs\node.exe" --version
```

---

## ⚠️ Se aparecer erro de cache (ENOTCACHED)

Se aparecer: `cache mode is 'only-if-cached' but no cached response is available`:

1. **Limpar configuração de cache:**
   ```powershell
   & "C:\Program Files\nodejs\npm.cmd" config delete cache
   ```

2. **Ou definir cache manualmente:**
   ```powershell
   & "C:\Program Files\nodejs\npm.cmd" config set cache "C:\Users\vinic\AppData\Local\npm-cache" --global
   ```

3. **Depois tente novamente:**
   ```powershell
   & "C:\Program Files\nodejs\npm.cmd" install
   ```

---

**Recomendação:** Use a **Solução 1** ou **Solução 4** (CMD) para começar rapidamente! 🚀
