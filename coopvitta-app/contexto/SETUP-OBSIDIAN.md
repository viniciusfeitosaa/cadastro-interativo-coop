# Setup Obsidian — Viva Saúde

**Objetivo:** anotar e consultar todo o contexto do projeto no Obsidian, sincronizado com o repositório Git.

---

## Estratégia recomendada (vault = pasta `contexto/`)

A pasta `contexto/` **já é um vault Obsidian** (contém `.obsidian/`).  
Não precisa copiar arquivos: o Git sincroniza entre PC, nuvem e agentes de IA.

### No seu PC (Windows)

1. Clone ou abra o repo `AppVS` no disco (ex.: `C:\dev\AppVS`).
2. Abra o **Obsidian** → *Open folder as vault* → selecione:
   ```
   C:\dev\AppVS\contexto
   ```
3. Fixe [[Home]] como nota de abertura (Settings → Core plugins → Daily notes / ou plugin Workspaces).
4. `git pull` / `git push` = sincronização entre máquinas.

### Atalho (script)

Na raiz do repo, no PowerShell:

```powershell
.\scripts\setup-obsidian-vault.ps1 -Open
```

Na primeira vez, informe o caminho do Obsidian se o script não achar sozinho.

---

## Estratégia « memoria total » (seu vault no Windows)

Se você criou a pasta **`memoria total`** dentro do Obsidian:

```powershell
git pull
.\rodar-cofre-memoria.ps1
```

Vault: `C:\Users\vinic\Documents\COFRE - MEMORIA`

Ou o genérico (pede o caminho):

```powershell
.\rodar-memoria-total.ps1
```

O script cria (sem apagar o que você já tem em `memoria total`):

```
SeuVault/
└── memoria total/
    └── Viva-Saude/     ← junction → AppVS\contexto\  (Git)
        ├── Home.md
        ├── 01-produto-e-visao.md
        └── journal/
```

- Anotações do **projeto** → dentro de `memoria total/Viva-Saude/`
- Notas **pessoais** → outros arquivos ao lado de `Viva-Saude/` em `memoria total/`
- Detalhes: [[memoria-total]]

Parâmetros opcionais:

```powershell
.\scripts\setup-memoria-total.ps1 -VaultPath "C:\caminho\do\vault" -MemoriaFolder "memoria total" -Open -SaveConfig
```

---

## Estratégia alternativa (vault separado no Documents)

Se você **já tem** um vault em `Documents\Obsidian\...` e quer manter tudo lá:

```powershell
.\scripts\setup-obsidian-vault.ps1 -Mode symlink -VaultPath "$env:USERPROFILE\Documents\Obsidian\Viva-Saude"
```

Isso cria um **junction** (atalho de pasta):

```
Documents\Obsidian\Viva-Saude\AppVS-contexto  →  <repo>\contexto
```

Edite no Obsidian dentro de `AppVS-contexto`; as mudanças vão direto para o Git.

---

## Sincronização contínua (opcional)

Para espelhar um vault externo ↔ repo (somente se **não** usar symlink):

```powershell
.\scripts\sync-obsidian.ps1 -Direction to-vault    # repo → Obsidian
.\scripts\sync-obsidian.ps1 -Direction from-vault  # Obsidian → repo
.\scripts\sync-obsidian.ps1 -Direction both        # cópia nos dois sentidos (cuidado)
```

Prefira **symlink** ou **vault = contexto/** para evitar conflitos.

---

## Plugins úteis (opcionais)

| Plugin | Uso |
|--------|-----|
| **Obsidian Git** | commit/pull/push do vault pelo Obsidian |
| **Templater** | templates em `_templates/` |
| **Dataview** | listar `#pendente` nas notas |

Não são obrigatórios — o harness funciona só com Markdown.

---

## Fluxo após cada tarefa

1. Editar a nota da etapa (ex. [[07-ponto-eletronico]])
2. Atualizar [[15-estado-atual-e-pendencias]]
3. Opcional: criar nota em `journal/AAAA-MM-DD-titulo.md` com template [[_templates/entrega]]
4. `git add contexto && git commit && git push`

---

## O que o agente de IA não faz sozinho

O Cursor/cloud **não acessa** o Obsidian instalado no seu PC.  
Ele atualiza `contexto/` no Git; você abre o vault local ou usa `git pull` para ver no Obsidian.

Config local (caminho do vault no PC): arquivo `.obsidian-vault.json` na raiz do repo (não vai pro Git).
