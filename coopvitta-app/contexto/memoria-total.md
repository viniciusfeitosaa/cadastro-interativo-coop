# Memória total (Obsidian no Windows)

Use esta nota quando o vault principal tiver a pasta **`memoria total`**.

## Estrutura no Obsidian (após o script)

```
SeuVault/
└── memoria total/
    └── Viva-Saude/          ← atalho (junction) para o Git: AppVS/contexto/
        ├── Home.md
        ├── 01-produto-e-visao.md
        ├── journal/
        └── ...
```

Edite em **`memoria total/Viva-Saude/`** — salva direto no repositório.

## Comando no PC

Na pasta do repo (PowerShell):

```powershell
git pull
.\rodar-memoria-total.ps1
```

### Vault configurado (vinic)

```
C:\Users\vinic\Documents\COFRE - MEMORIA
```

Repo local (vinic): `C:\Users\vinic\Downloads\GymApp\AppVS`

Atalho na raiz do repo (**comando separado** do `git pull`):

```powershell
cd C:\Users\vinic\Downloads\GymApp\AppVS
git pull
.\rodar-cofre-memoria.ps1
```

> Não use `git pull .\rodar-cofre-memoria.ps1` — são dois comandos diferentes.

Na primeira vez em outro PC, informe o caminho do **vault** (pasta pai da `memoria total`).

## Notas pessoais na mesma pasta

Você pode criar outros `.md` **ao lado** de `Viva-Saude/` dentro de `memoria total/` (ex.: ideias gerais).  
Só o conteúdo dentro de **`Viva-Saude/`** vai para o Git do AppVS.

## Sincronização

| Ação | Comando |
|------|---------|
| Ver o que o agente fez | `git pull` no repo |
| Enviar suas anotações | `git add contexto` → `commit` → `push` |

## Changelog

### 2026-05-28 — Junction confirmada (vinic)

- `.\rodar-cofre-memoria.ps1` executado com sucesso
- Repo: `C:\Users\vinic\Downloads\GymApp\AppVS`
- Vault: `C:\Users\vinic\Documents\COFRE - MEMORIA\memoria total\Viva-Saude`

Ver também: [[SETUP-OBSIDIAN]]
