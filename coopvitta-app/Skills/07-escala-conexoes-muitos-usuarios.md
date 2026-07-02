# Escala: muitos usuários e requisições simultâneas

Quando a base cresce (ex.: 500+ usuários) e várias pessoas usam o sistema ao mesmo tempo, o pool de conexões e o rate limit precisam estar dimensionados.

---

## Capacidade aproximada (plano grátis Supabase + Render)

| Configuração | Usuários simultâneos (uso médio) |
|--------------|-----------------------------------|
| 1 instância, pool = 10 (default) | ~15–30 |
| 1 instância, DATABASE_POOL_SIZE = 15–20 | ~25–40 |

Ou seja: **dá para dizer que o plano grátis do Supabase + Render aguenta na faixa de até ~40 acessos simultâneos**, desde que o pool esteja aumentado (ex.: 15–20 conexões). Acima disso ou em picos muito fortes (muitos abrindo dashboard ao mesmo tempo), pode aparecer fila, timeout ou cold start no Render (free tier “dorme” após inatividade).

---

## 1. Pool de conexões (Prisma + Supabase)

### O que é

- **connection_limit** = quantas **conexões com o banco** uma **instância** do backend pode usar ao mesmo tempo.
- Cada requisição que acessa o banco “pega” uma conexão do pool, usa e devolve. Se todas estiverem em uso, a próxima requisição espera (até `pool_timeout` segundos) e pode dar timeout.

### Valores no projeto

- **Produção (default):** `connection_limit=10` por instância.
- **Desenvolvimento:** `connection_limit=3`.
- **Override:** variável **`DATABASE_POOL_SIZE`** no Render (ex.: `12` ou `15`). O código limita ao máximo **20** para não estourar o limite do Supabase por instância.

### Como escolher o número

| Cenário | Sugestão |
|--------|----------|
| 1 instância, poucos usuários simultâneos | 5–10 |
| 1 instância, 500+ usuários, picos de uso | 10–15 |
| Várias instâncias no Render | (limite Supabase ÷ nº de instâncias). Ex.: limite 50, 2 instâncias → até 25 por instância (use 20 no código). |

### Limite do Supabase

- **Free tier:** o pooler tem limite de conexões simultâneas (consultar no painel Supabase → Database ou documentação).
- **Pro:** limite maior. Não exceder o total: `connection_limit × nº de instâncias` deve ficar abaixo do limite do plano.

---

## 2. Rate limit (express-rate-limit)

- Limita **requisições por IP** em uma janela de tempo para evitar abuso e sobrecarga.
- Variáveis no backend:
  - **RATE_LIMIT_WINDOW_MS** – janela em ms (ex.: 900000 = 15 min).
  - **RATE_LIMIT_MAX_REQUESTS** – máx. de requisições por IP nessa janela (ex.: 500).
- Com muitos usuários legítimos, aumente **RATE_LIMIT_MAX_REQUESTS** no Render (ex.: 800 ou 1000). O dashboard faz várias chamadas em paralelo por carregamento; 500 já é generoso para uso normal.

---

## 3. Múltiplas instâncias (Render)

- Se escalar para **várias instâncias** do backend:
  - Cada instância tem seu próprio pool: `connection_limit` aplica **por instância**.
  - Total de conexões ao Supabase ≈ `DATABASE_POOL_SIZE` (ou 10) × nº de instâncias.
  - Ajuste **DATABASE_POOL_SIZE** por instância para que o total não ultrapasse o limite do Supabase (ex.: 2 instâncias → 10 cada = 20 total).

---

## 4. Otimização da aplicação

- **Queries:** evitar N+1 (usar `include`/`select` adequados no Prisma), reduzir queries desnecessárias.
- **Cache:** para dados que mudam pouco (ex.: lista de módulos de acesso), considerar cache em memória ou Redis para reduzir idas ao banco.
- **Resposta rápida:** quanto mais rápido a requisição devolve a conexão ao pool, mais requisições por segundo o mesmo pool aguenta.

---

## 5. Logout automático por inatividade (sessão)

- **Impacto em capacidade:** com **JWT** (token no frontend), um usuário **ocioso** não ocupa conexão com o banco — a conexão só é usada no momento da requisição. Então **logout automático por tempo sem uso não aumenta capacidade** de conexões; ele não “libera” conexões.
- **Por que fazer mesmo assim:**
  - **Segurança:** usuário esqueceu o PC aberto → após X minutos sem ação, fazer logout evita uso por terceiros.
  - **UX:** sessão “viva” só enquanto a pessoa está usando; depois de 30–60 min sem clicar/navegar, faz sentido pedir login de novo.
- **Implementação típica:** no frontend, um timer que:
  - reinicia a cada ação do usuário (clique, tecla, mudança de rota);
  - ao atingir o tempo limite (ex.: 30 min), chama `logout()` e redireciona para `/app/login`.
- Conclusão: **logout por inatividade é uma boa prática de segurança e UX**, mas não é tática para aumentar “quantos profissionais ativos ao mesmo tempo” — para isso continuam valendo pool maior, múltiplas instâncias, cache e otimização de queries.

## 6. Outras táticas que realmente aumentam capacidade

| Tática | O que faz |
|--------|-----------|
| **Pool maior** | Já feito: `DATABASE_POOL_SIZE` 10–20. Mais conexões = mais requisições simultâneas. |
| **Várias instâncias (Render)** | Cada instância tem seu pool; dobra/triplica a capacidade (respeitando limite do Supabase). |
| **Cache** | Dados pouco alterados (ex.: lista de módulos) em cache → menos idas ao banco. |
| **Otimizar queries** | Menos N+1, menos round-trips → cada conexão é liberada mais rápido. |
| **Limitar sessões por usuário** | Ex.: 1 dispositivo por vez. Não aumenta total, mas evita um usuário com 5 abas abertas consumir 5× as requisições. |
| **Logout por inatividade** | Segurança/UX; **não** aumenta capacidade (usuário ocioso já não usa conexão). |

## 7. Resumo prático

| Objetivo | Ação |
|----------|------|
| Mais requisições simultâneas por instância | Aumentar `DATABASE_POOL_SIZE` no Render (ex.: 12, 15). Máx. 20 no código. |
| Confirmar limite do banco | Ver no Supabase (Database / Connection pool) o limite de conexões do seu plano. |
| Várias instâncias | Manter `connection_limit × instâncias` ≤ limite Supabase. |
| Muitos usuários legítimos | Aumentar `RATE_LIMIT_MAX_REQUESTS` se começar a receber 429 em uso normal. |
| Segurança / sessão “limpa” | Implementar logout automático por inatividade no frontend (ex.: 30 min sem ação). |
