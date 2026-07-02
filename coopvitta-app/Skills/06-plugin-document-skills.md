# Plugin Document Skills (Cursor)

Plugin do Cursor para documentar e usar Skills com o agente.

## Instalação

**Importante:** o comando abaixo é do **Cursor** (chat do agente), **não** do terminal (PowerShell, bash, etc.). Não rode no terminal; use no **campo de chat do Cursor** onde você fala com o assistente.

No **chat do Cursor**, digite:

```
/plugin install document-skills@anthropic-agent-skills
```

- **document-skills** – nome do plugin.
- **anthropic-agent-skills** – pacote/origem do plugin.

Se o Cursor não reconhecer `/plugin`, a instalação de extensões/plugins pode ser feita pelo **Cursor Settings** ou pela paleta de comandos (Ctrl+Shift+P) procurando por "Extensions" ou "Install Extension", e então buscar por "document-skills" ou "anthropic agent skills" no marketplace.

## Relação com esta pasta

A pasta **`Skills/`** deste repositório contém a documentação em Markdown (deploy, Supabase, CORS, etc.). O plugin **document-skills** pode ser usado para que o agente do Cursor leia e aplique essas práticas automaticamente quando relevante.

## Quando usar

- Ao configurar o Cursor em uma máquina nova ou para um novo dev no projeto.
- Se o agente não estiver seguindo as práticas documentadas em `Skills/`, verificar se o plugin está instalado e ativo.
