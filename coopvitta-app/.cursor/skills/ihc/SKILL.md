---
name: ihc-interacao-humano-computador
description: Applies Human-Computer Interaction (IHC) and UX from Unifor PA materials (Mônica Paz) to review and improve any interactive product—web, mobile, desktop, games, physical devices, kiosks, wearables, and mixed systems. Covers usability, ergonomics, Nielsen heuristics, user/task modeling, accessibility, and evaluation. Use when the user mentions IHC, UX, usabilidade, ergonomia, avaliação heurística, interfaces, jogabilidade, hardware, mobile, or improving any product with the PA/PDF study materials.
disable-model-invocation: true
---

# IHC — Interação Humano-Computador (Unifor / Mônica Paz)

**Âmbito:** qualquer produto interativo — não só software web.

| Tipo de produto | PA com peso maior |
|-----------------|-------------------|
| Sites, SPAs, backends com UI | PA 1, 2, 3 |
| Apps mobile / tablet | PA 1, 2, 3 + PA 4 (mobile) |
| Desktop, CLI com TUI | PA 1, 2, 3 |
| Videogames | PA 1, 3 + PA 4 (usabilidade **e** jogabilidade) |
| Hardware, quiosques, wearables, IoT com UI | PA 1, 4 (ergonomia física + protótipos) |
| Produto híbrido (físico + digital) | PA 1–4 integrados |

Base: Percurso de Aprendizagem 1–4 (Paz, 2021). Texto integral: [references/extracted/](references/extracted/). Síntese: [reference.md](reference.md), índice: [curriculum-index.md](curriculum-index.md).

**Licença dos PDFs:** CC BY-NC-ND 4.0 — melhorar projetos do utilizador; não republicar PDFs como derivado comercial.

**Instalação:** cópia global em `~/.cursor/skills/ihc-interacao-humano-computador/` (todos os repositórios). Cópia neste repo: `.cursor/skills/ihc/`.

## Quando aplicar

- Qualquer **interface** ou **interação** (ecrã, voz, gestos, controlos físicos ligados a software).
- **Usabilidade**, **UX**, **acessibilidade**, **ergonomia**, **jogabilidade** (se jogo).
- Antes de lançar feature, protótipo ou revisão de design.
- Utilizador como **agente principal**; ciclo **análise → síntese → avaliação**.

## Fluxo (todos os produtos)

```
- [ ] 1. Contexto: utilizadores, ambientes, dispositivos, tarefas críticas
- [ ] 2. Modelos: mental vs conceitual (exposto) vs implementação (oculto)
- [ ] 3. Usabilidade (ISO 9241-11) + comunicabilidade + acessibilidade
- [ ] 4. Ergonomia: digital (heurísticas Nielsen + Cybis et al.) e física se aplicável (PA 4)
- [ ] 5. Avaliação: inspeção / heurística / testes (lab ou campo)
- [ ] 6. Relatório com severidade e recomendações
```

### 1. Contexto (PA 2)

Personas, **cenários** (problema, atividade, informação, interação), **tarefas**, restrições (luz, ruído, uma mão, público PcD, etc.).

### 2. Modelos (PA 1)

Desalinhamento mental ↔ conceitual ↔ implementação → erros e frustração (Norman).

### 3. Usabilidade e qualidades (PA 1)

**ISO 9241-11:** eficácia, eficiência, satisfação no **contexto de uso real**.

Também: aprendizagem, memorização, segurança no uso, comunicabilidade, acessibilidade (perceptiva, motora, cognitiva).

### 4. Heurísticas e ergonomia (PA 1 + PA 3 + PA 4)

- **Digital:** 10 heurísticas Nielsen + critérios Cybis, Betiol e Faust (2015) — [reference.md](reference.md).
- **Físico / postura / controlos:** teclado, rato, ecrã, toque, gamepad — PA 4.
- **Jogos:** avaliar **usabilidade da interação** primeiro; **jogabilidade** (enredo, mecânicas, balanceamento) depois.

### 5. Avaliação (PA 3 + PA 4)

| Maturidade | Métodos |
|------------|---------|
| Ideia / wireframe | Inspeção, heurística (3–4 avaliadores) |
| Protótipo (baixa ou alta fidelidade, físico ou virtual) | Heurística + walkthrough |
| Pré-lançamento | Testes com utilizadores (laboratório ou **campo** — essencial em mobile) |
| Em produção | Métricas, feedback, iteração |

**Mobile:** testes em contexto real (movimento, luz, rede). **Hardware:** protótipos físicos reduzem esforço cognitivo de interpretação.

### 6. Relatório

```markdown
## Revisão IHC — [produto / funcionalidade]
**Tipo:** web | mobile | desktop | jogo | físico | híbrido

### Contexto
### Pontos fortes
### Problemas
| # | Onde | Critério | Severidade | Recomendação |
### Prioridade
```

## Integração no trabalho diário

| Artefacto | Ação IHC mínima |
|-----------|-----------------|
| Novo ecrã ou fluxo | Tarefa principal + 3 heurísticas Nielsen críticas |
| API só para humanos indiretos | Documentação como “interface” (comunicabilidade) |
| Jogo / app lúdica | Separar bugs de usabilidade vs design de jogo |
| Dispositivo com botões/ecrã | PA 4: postura, affordance física, protótipo |
| PR de UI | Checklist em [reference.md](reference.md) |

Não dispensar **testes com utilizadores** quando impacto, segurança ou público diverso for alto.

## Materiais de apoio

| Ficheiro | Conteúdo |
|----------|----------|
| [curriculum-index.md](curriculum-index.md) | PA1–PA4 |
| [reference.md](reference.md) | Nielsen, ISO, métodos, checklist |
| [references/sources.md](references/sources.md) | PDFs originais |
| `references/extracted/*.txt` | Texto completo dos PA |

## Exemplos de pedido

- Web: «Revisa o onboarding desta SPA com IHC.»
- Mobile: «Avalia gestos e feedback em campo no fluxo de checkout.»
- Jogo: «Separa problemas de usabilidade vs jogabilidade no menu principal.»
- Físico: «Revisa ergonomia do quiosque + UI do ecrã tátil.»
