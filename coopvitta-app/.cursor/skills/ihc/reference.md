# Referência IHC — síntese para qualquer produto interativo

Fonte pedagógica: Mônica Paz, *Interação humano – computador*, Percurso de Aprendizagem 1–4, Universidade de Fortaleza, 2021. Detalhe verbatim: `references/extracted/*.txt`.

## Âmbito por tipo de produto

| Tipo | Foco principal nos PA | Avaliação típica |
|------|------------------------|------------------|
| Web / SPA / admin | PA 1–3, heurísticas, acessibilidade | Heurística + testes remotos |
| Mobile / tablet | PA 1–3 + PA 4 (contexto, gesto, ecrã) | Testes **em campo** |
| Desktop | PA 1–3, atalhos, densidade de informação | Heurística + tarefas |
| Videogame | Usabilidade (menus, HUD, input) depois jogabilidade | Playtests + heurística |
| Quiosque / ATM / POS | PA 4 ergonomia física + PA 1–3 UI | Protótipo físico + observação |
| Wearable / IoT com UI | PA 4 + feedback limitado, contexto | Campo, tarefas curtas |
| Voz / multimodal | PA 1 comunicabilidade, correspondência mundo real | Diálogos, recuperação de erro |
| API / CLI (TUI) | Memorização, eficiência expert, mensagens de erro | Tarefas scriptadas |

---

## Definição operacional de IHC

Disciplina na interseção de computação e ciências sociais/comportamentais; foco na **qualidade de uso** e no **impacto na vida dos utilizadores**. Equipas multidisciplinares (dev, design, comunicação, psicologia, etc.).

**Objetivos práticos da área (resumo PA 1):**

- Aumentar eficiência dos sistemas interativos  
- Reduzir erros e tempo de aprendizagem  
- Melhorar satisfação e aceitação  
- Tornar sistemas mais seguros e acessíveis  

---

## Ciclo de design (PA 2)

```
Análise (situação problema, utilizador, contexto)
    → Síntese (intervenção, interface, protótipo)
        → Avaliação (inspeção, heurística, testes)
            → (iterar)
```

---

## Modelos (PA 1)

| Modelo | Quem constrói | O que representa |
|--------|---------------|------------------|
| Mental | Utilizador | Crenças sobre funcionamento |
| Conceitual | Designer (via UI) | Conceitos expostos na interface |
| Implementação | Engenharia | Código, BD, APIs |

**Regra de revisão:** a UI deve materializar um modelo conceitual alinhado ao mental do público-alvo; detalhes de implementação não devem “vazar”.

---

## Usabilidade — ISO 9241-11

Usabilidade = capacidade de ser **usado em contexto específico** para que o utilizador atinja objetivos com:

1. **Eficácia** — tarefa correta concluída  
2. **Eficiência** — tempo/recursos adequados  
3. **Satisfação** — reação emocional aceitável  

**Fatores cognitivos/perceptivos/motores (Barbosa & Silva):**

| Fator | Foco na revisão |
|-------|-----------------|
| Learnability | Primeiro uso, curva de aprendizagem |
| Memorability | Retorno após ausência |
| Efficiency | Atalhos, fluxos curtos para experts |
| Safety | Prevenir e recuperar erros |
| Satisfaction | Confiança, estética, frustração |

**Comunicabilidade:** a interface comunica a lógica do design (intenções, princípios de interação).

**Acessibilidade:** sem barreiras perceptivas, motoras ou cognitivas desnecessárias.

---

## 10 Heurísticas de Nielsen (PA 3)

1. Visibilidade do estado do sistema  
2. Correspondência entre sistema e mundo real  
3. Controle e liberdade do utilizador  
4. Consistência e padronização  
5. Reconhecimento em vez de memorização  
6. Flexibilidade e eficiência de uso  
7. Projeto estético e minimalista  
8. Prevenção de erros  
9. Ajuda a reconhecer, diagnosticar e recuperar erros  
10. Ajuda e documentação  

**Avaliação heurística (especialistas):** 3–4 avaliadores, inspeção individual, relatório consolidado. Abordagens: por tarefas, por estrutura de menus (profundidade/largura), ou ambas.

**Avaliação participativa:** especialista + utilizador em protótipo; tarefas + verbalização de expectativas.

---

## Critérios ergonômicos integradores (Cybis, Betiol, Faust, 2015 — PA 1)

Agrupamentos úteis em revisão de interface:

| Grupo | Exemplos de princípios |
|-------|------------------------|
| Poder de encantar | Interface estética, animação adequada |
| Poder de surpreender | Funcionalidades úteis acima da expectativa |
| Poder de simplificar | Produtividade, menos passos |
| Qualidade da ajuda | Documentação conceitual, contextual, tutoriais |
| Adequação ao aprendizado | Metáforas, ícones, modelos mentais conhecidos |
| Condução às ações | Estado do sistema, convite, feedback imediato |
| Qualidade das apresentações | Rótulos claros, legibilidade, agrupamento lógico |

*(Lista completa no Quadro 5 do PA 1 — ver `references/extracted/notadeaula1.txt` ~linha 1342.)*

---

## Métodos de avaliação (PA 3)

| Tipo | Quando | Exemplos |
|------|--------|----------|
| Analítica / preditiva | Antes ou sem utilizadores finais | Inspeção de normas, heurística, percurso cognitivo |
| Empírica | Com utilizadores | Testes de usabilidade, questionários |

**Classificação de problemas:** usabilidade, ergonomia, experiência do utilizador, acessibilidade.

**Normas citadas:** ISO/IEC 9241 (partes de ergonomia da interação).

---

## PA 2 — Modelagem (resumo)

- **Utilizador:** personas, perfis, necessidades, contexto.  
- **Tarefas:** objetivos, sub-tarefas, frequência, erros.  
- **Cenários:** problema, atividade, informação, interação.  
- **Design:** storyboard, wireframes, múltiplas alternativas antes de implementar.

Ferramentas mencionadas nos PA: Canva (storyboard), Pencil, prototipação de baixa/alta fidelidade.

---

## PA 4 — Ergonomia física, hardware, mobile, jogos (sempre considerar)

- **Ergonomia de produto:** saúde, segurança, satisfação; eficiência como consequência (Iida, 2005).  
- **Hardware de entrada/saída:** teclado, rato, monitor, toque, gamepad — função e utilização no contexto da tarefa.  
- **Protótipos:** físicos (modelos, pilotos) e virtuais (baixa/alta fidelidade); reduzem esforço cognitivo.  
- **Mobile:** personalização, interrupções, uma mão, luz solar; testes em **laboratório** vs **campo**.  
- **Videogames (ordem PA 4):**  
  1. **Usabilidade** — menus, HUD, controlos, tutoriais, acessibilidade de input.  
  2. **Jogabilidade** — enredo, personagens, som, mecânicas, progressão.  
  Classificar cada achado explicitamente numa das duas categorias.

---

## Checklist universal (qualquer entrega interativa)

```
[ ] Contexto de uso descrito (quem, onde, com que dispositivo)
[ ] Tarefa principal completável sem passos ocultos
[ ] Estado do sistema visível (carregamento, progresso, erro)
[ ] Controlo e reversão onde há risco (cancelar, desfazer)
[ ] Correspondência com mundo real (linguagem, metáforas)
[ ] Consistência de padrões no mesmo produto
[ ] Prevenção de erros + recuperação clara
[ ] Acessibilidade: perceber, operar, compreender (PcD, idade, stress)
```

### Acrescentar se mobile

```
[ ] Alvos de toque e gestos naturais; thumb zone
[ ] Interrupções (chamada, notificação) não perdem dados
[ ] Teste em movimento / luz real se possível
```

### Acrescentar se jogo

```
[ ] Usabilidade dos ecrãs de sistema separada de balanceamento/diversão
[ ] Tutorial opcional; controlos remapeáveis se plataforma permitir
```

### Acrescentar se físico + digital

```
[ ] Postura e alcance dos controlos
[ ] Feedback tátil/visual/sonoro alinhado à ação
[ ] Protótipo físico ou mockup antes de fabricar
```

### Acrescentar se PR web/desktop

```
[ ] Contraste, foco teclado, rótulos de formulário
[ ] Heurística Nielsen em 15–30 min ou teste com 3 utilizadores
```

---

## Citação dos materiais

```text
PAZ, Mônica. Interação humano – computador [recurso eletrônico].
Fortaleza: Universidade de Fortaleza, 2021. (Percurso de Aprendizagem 1–4).
Licença CC BY-NC-ND 4.0.
```
