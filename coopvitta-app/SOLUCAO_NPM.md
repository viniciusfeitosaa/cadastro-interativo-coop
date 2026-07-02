# 🔧 Solução: Problema com npm no PowerShell

## ❌ Erro Encontrado

```
npm : O arquivo C:\Program Files\nodejs\npm.ps1 não pode ser carregado porque a execução 
de scripts foi desabilitada neste sistema.
```

## ✅ Solução

### Método 1: Alterar Política de Execução (Recomendado)

Execute no PowerShell **como Administrador**:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Ou para todos os usuários (requer Admin):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
```

**Opções de política:**
- `RemoteSigned` - Permite scripts locais, scripts remotos precisam ser assinados (RECOMENDADO)
- `Unrestricted` - Permite todos os scripts (menos seguro)
- `Bypass` - Ignora todas as políticas (não recomendado para uso geral)

### Método 2: Executar npm via cmd

Se não quiser alterar a política, use o **CMD** ao invés do PowerShell:

1. Abra o **Prompt de Comando** (cmd.exe)
2. Navegue até a pasta:
   ```cmd
   cd C:\Users\vinic\Downloads\AppVS\backend
   ```
3. Execute:
   ```cmd
   npm install
   ```

### Método 3: Usar npx diretamente

Tente usar o caminho completo:

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
```

Ou use `npx`:

```powershell
npx npm install
```

## 🔍 Verificar Política Atual

```powershell
Get-ExecutionPolicy -List
```

## 📝 Explicação

O PowerShell tem políticas de segurança que bloqueiam a execução de scripts por padrão. Isso é uma medida de segurança do Windows.

**RemoteSigned** é a política recomendada porque:
- ✅ Permite executar scripts locais (como npm.ps1)
- ✅ Bloqueia scripts remotos não assinados
- ✅ Mantém segurança adequada

## ⚠️ Se Ainda Não Funcionar

1. **Reiniciar o PowerShell** após alterar a política
2. **Verificar se Node.js está no PATH:**
   ```powershell
   $env:PATH -split ';' | Select-String nodejs
   ```
3. **Tentar usar cmd.exe** ao invés do PowerShell
4. **Reinstalar Node.js** e marcar "Add to PATH"

## 🚀 Após Resolver

Execute:

```powershell
cd C:\Users\vinic\Downloads\AppVS\backend
npm install

cd ..\frontend
npm install
```

---

**Dica:** Se você usar o CMD (cmd.exe) ao invés do PowerShell, geralmente não terá esse problema! 💡

---

## Usar npm via npm.cmd (contornar bloqueio de scripts)

Se não puder alterar a política de execução, use o **npm.cmd** em vez de **npm**:

```powershell
# Em qualquer pasta do projeto
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Ou crie um alias no seu perfil do PowerShell (`notepad $PROFILE`):

```powershell
Set-Alias npm "C:\Program Files\nodejs\npm.cmd"
```
