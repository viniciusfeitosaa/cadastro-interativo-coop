# 16 — Como atualizar o harness

Use este ritual **ao final de cada tarefa** (humano ou IA) para não perder contexto.

## Checklist rápido (2–5 min)

- [ ] Identifique a **etapa** (arquivo `0X-*.md`)
- [ ] Atualize seção **Status** e **Última atualização** (data ISO)
- [ ] Liste o que foi **feito** (bullets objetivos)
- [ ] Liste **arquivos tocados** (caminhos reais)
- [ ] Atualize **Pendências** (marque `[x]` ou adicione novas)
- [ ] Atualize [`15-estado-atual-e-pendencias.md`](./15-estado-atual-e-pendencias.md)
- [ ] Se nova etapa/módulo: crie `0X-novo-modulo.md` e linke em `00-indice.md`

## Template para entrada em etapa

```markdown
## Changelog

### YYYY-MM-DD — [título curto da entrega]
- O que mudou (comportamento / API / UI)
- Arquivos: `path/a`, `path/b`
- Migration: `backend/prisma/migrations/...` (se houver)
- Decisão: [por que assim]
```

## Quando criar novo arquivo de etapa

- Novo domínio de negócio (ex.: faturamento, telemedicina)
- Módulo com >5 endpoints e regras próprias
- Integração externa relevante (pagamentos, ERP)

## O que NÃO colocar aqui

- Código inteiro (linkar caminhos)
- Segredos (.env, tokens, senhas)
- Dumps grandes de conversa com IA

## Obsidian (seu PC)

- Vault recomendado: pasta `contexto/` do repo (ver [[SETUP-OBSIDIAN]])
- Após editar no Obsidian: `git commit` + `git push` — o agente na nuvem vê na próxima sessão
- Entregas grandes: duplicar resumo em `journal/AAAA-MM-DD-titulo.md` (template [[_templates/entrega]])

## Para agentes Cursor

1. Ler `AGENTS.md` na raiz
2. Ler `15-estado-atual-e-pendencias.md`
3. Ler só o `0X` da tarefa
4. Ao terminar, commitar código **e** atualização do `contexto/` na mesma PR quando possível

## Exemplo de mensagem de commit

```
feat(ponto): tolerância configurável por escala

- contexto: atualiza 07-ponto-eletronico.md e 15-estado-atual
```
