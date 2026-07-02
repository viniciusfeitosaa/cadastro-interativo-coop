# Harness IA — Contexto do projeto Viva Saúde

Esta pasta é a **memória operacional** do projeto para humanos e agentes de IA.  
Objetivo: evitar retrabalho — não redescobrir arquitetura, rotas, decisões e pendências a cada sessão.

## Princípios

| Princípio | Significado |
|-----------|-------------|
| **Uma etapa, um arquivo** | Cada módulo/fase tem um `.md` próprio com escopo, arquivos-chave e decisões |
| **Estado explícito** | Sempre deixar claro o que está **feito**, **parcial** ou **não iniciado** |
| **Atualizar ao entregar** | Toda PR/tarefa relevante atualiza pelo menos 1 arquivo de etapa + o estado atual |
| **Código é fonte da verdade** | Se doc e código divergirem, corrija o doc ou marque `[DESATUALIZADO]` |

## Mapa rápido

| Arquivo | Conteúdo |
|---------|----------|
| [00-indice.md](./00-indice.md) | Índice navegável |
| [01-produto-e-visao.md](./01-produto-e-visao.md) | O que é o produto e para quem |
| [02-arquitetura.md](./02-arquitetura.md) | Stack, pastas, fluxo de dados |
| [03-fundacao-setup.md](./03-fundacao-setup.md) | Monorepo, Docker, Prisma, env |
| [04-autenticacao-acessos.md](./04-autenticacao-acessos.md) | Login, JWT, papéis, módulos |
| [05-medicos-contratos.md](./05-medicos-contratos.md) | CRUD médicos, convites, contratos |
| [06-escalas-plantoes.md](./06-escalas-plantoes.md) | Escalas, plantões, trocas |
| [07-ponto-eletronico.md](./07-ponto-eletronico.md) | Check-in/out, geo, valores |
| [08-vagas.md](./08-vagas.md) | Vagas e interesses |
| [09-documentos.md](./09-documentos.md) | Documentos de perfil e envio |
| [10-relatorios.md](./10-relatorios.md) | Relatórios ponto e procedimentos |
| [11-frontend-ux.md](./11-frontend-ux.md) | React, rotas, layout, padrões UI |
| [12-mobile-capacitor.md](./12-mobile-capacitor.md) | App Android/iOS |
| [13-infra-deploy.md](./13-infra-deploy.md) | CI/CD, VPS, Nginx |
| [14-convencoes-codigo.md](./14-convencoes-codigo.md) | Padrões backend/frontend |
| [15-estado-atual-e-pendencias.md](./15-estado-atual-e-pendencias.md) | Snapshot vivo do projeto |
| [16-como-atualizar.md](./16-como-atualizar.md) | Ritual de manutenção do harness |

## Documentação legada (não usar como estado atual)

- `README.md` — visão genérica; status desatualizado
- `CHECKLIST_PROJETO.md` — checklist inicial; maioria dos itens já implementados
- `PLANO_PROJETO.md` / `GUIA_IMPLEMENTACAO.md` — planejamento histórico

## Obsidian

Esta pasta é um **vault Obsidian** (`.obsidian/` incluído).  
Abra `contexto/` no Obsidian ou rode `scripts/setup-obsidian-vault.ps1` no Windows.  
Guia completo: [[SETUP-OBSIDIAN]] · nota inicial: [[Home]]

## Entrada para Cursor / outros agentes

O arquivo raiz [`AGENTS.md`](../AGENTS.md) aponta para esta pasta.
