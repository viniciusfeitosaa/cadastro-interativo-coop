# Instruções para agentes de IA

Antes de explorar o repositório inteiro ou refazer decisões já tomadas, **leia a pasta [`contexto/`](./contexto/)**.

## Ordem de leitura recomendada

1. [`contexto/README.md`](./contexto/README.md) — regras do harness
2. [`contexto/00-indice.md`](./contexto/00-indice.md) — mapa dos documentos
3. [`contexto/15-estado-atual-e-pendencias.md`](./contexto/15-estado-atual-e-pendencias.md) — o que está pronto e o que falta
4. O arquivo da **etapa** relacionada à sua tarefa (ex.: ponto → `07-ponto-eletronico.md`)

## Ao concluir uma tarefa

Atualize o documento da etapa afetada e, se necessário, `15-estado-atual-e-pendencias.md`.  
Siga o guia em [`contexto/16-como-atualizar.md`](./contexto/16-como-atualizar.md).

## Obsidian (humano no PC)

O vault versionado é a pasta `contexto/`. O usuário pode anotar no Obsidian local; mudanças entram via Git.  
Não é possível abrir o Obsidian do PC a partir do agente na nuvem — apenas atualizar os `.md` no repo.

## Não fazer sem necessidade

- Reescanear todo o monorepo se o `contexto/` já responder à pergunta
- Duplicar documentação longa em `README.md` — use `contexto/` para histórico por etapa
- Assumir que `CHECKLIST_PROJETO.md` ou `README.md` refletem o estado real (estão defasados)
