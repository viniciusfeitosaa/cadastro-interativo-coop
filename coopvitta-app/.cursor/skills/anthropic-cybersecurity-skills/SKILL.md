---
name: anthropic-cybersecurity-skills
description: Points agents to the mukul975 Anthropic Cybersecurity Skills library (754+ skills, 26 domains, five-framework mappings, agentskills.io). Use when the user mentions that GitHub repo, npx skills add mukul975/Anthropic-Cybersecurity-Skills, DFIR, threat hunting, malware analysis, cloud IR, MITRE ATT&CK/NIST CSF/ATLAS/D3FEND/NIST AI RMF skill workflows, or loading structured cybersecurity skills into Cursor.
disable-model-invocation: true
---

# Anthropic Cybersecurity Skills (biblioteca comunitária)

**Fonte canónica:** [github.com/mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) — projeto **comunitário**, **não afiliado** à Anthropic PBC. Licença **Apache-2.0**. Padrão [agentskills.io](https://agentskills.io).

## Primeira ação

Lê **[reference.md](reference.md)** para tabelas de domínios, cinco frameworks, anatomia de cada skill, campos YAML, fluxo de descoberta por tokens e ligações aos ficheiros grandes (`index.json`, `ATTACK_COVERAGE.md`) no repositório.

## Instalação oficial (para o agente ter as skills no disco)

```bash
npx skills add mukul975/Anthropic-Cybersecurity-Skills
```

Ou clone o repositório e aponta o Cursor / agente para a pasta `skills/` (cada skill é um diretório com `SKILL.md`).

## Como usar com o agente Cursor

1. **Com o repo instalado/clonado:** para uma tarefa concreta (ex.: análise de memória, caça a Kerberoasting), procura em `skills/` por `name` ou palavras-chave no `description` do frontmatter, ou consulta `index.json` no upstream. Carrega só o `SKILL.md` da skill escolhida e, se precisares, `references/` e `scripts/` dessa skill.
2. **Sem o repo:** aplica o mesmo **modelo mental** descrito em reference.md (When to Use → Prerequisites → Workflow → Verification) e avisa o utilizador a instalar a biblioteca para playbooks completos.
3. **Ética e legalidade:** só técnicas em sistemas e contas **autorizados** (exercícios, bug bounty, IR contratado). Não orientar ataques contra terceiros sem autorização explícita.

## O que esta skill do Cursor não substitui

Não duplica os 754 `SKILL.md` no repositório AppVS — apenas **documenta e encaminha** para o upstream e para cópias locais após `npx skills add` ou `git clone`.

## Recursos extra no repositório

- `ATTACK_COVERAGE.md` — cobertura ATT&CK (ficheiro grande).
- `mappings/` — mapeamentos por framework.
- `tools/` — ferramentas de apoio ao índice (ver README upstream).
