# Playbook de auditoria de segurança — AppVS

Documento para **experimentação contínua** no próprio ambiente (staging/homologação). Não execute testes de carga ou exploração em produção sem autorização formal.

---

## 1. Race condition

### O que testar

Fluxos com **ler → decidir → escrever** sem trava no banco: dois pedidos paralelos podem duplicar efeito ou furar regra.

### Candidatos no AppVS (revisar código)

| Área | Risco | Mitigação já vista no código |
|------|--------|------------------------------|
| Check-in | Dois check-ins “abertos” | `ponto.service` usa transação e revalidação |
| Checkout | Fechar o mesmo registro duas vezes | `updateMany` com `checkOutAt: null` |
| Convite / reset de senha | Token usado duas vezes | Transações em `auth.service` |
| Vagas — resposta do publicador (`PATCH` status candidato) | Dois `PATCH` paralelos no mesmo interesse `PENDENTE` | `vaga.service`: transação + `updateMany` só com `status: PENDENTE`; segundo pedido → **400** (“já respondido”) |
| Vagas — demonstrar interesse | Janela entre “vaga válida” e `create` interesse | `registrarInteresseVaga` em `prisma.$transaction`; duplicidade → **409** (unique) |

### Como testar (ferramentas)

- **Burp Suite Repeater** ou **curl** em paralelo (`&` no bash, ou script com `Promise.all` no Node).
- Enviar **duas requisições idênticas** no mesmo milissegundo e verificar: um 409/404 esperado ou um único registro no banco.

### Script conceitual (bash)

```bash
# Exemplo: dois POSTs paralelos (substitua URL e TOKEN)
TOKEN="seu_jwt_staging"
URL="https://api-staging.exemplo.com/api/ponto/checkin-sem-foto"
for i in 1 2; do
  curl -s -o "out-$i.json" -w "%{http_code}" -X POST "$URL" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"escalaId":"...","observacao":"","motivoSemFoto":"teste de corrida com 15+ chars"}' &
done
wait
```

Depois: conferir no banco se existe **apenas um** `registro_ponto` aberto para o médico.

---

## 2. Upload de arquivos (MIME, magic bytes, tamanho)

### Estado atual (revisão de código)

| Upload | MIME (Multer) | Tamanho | Magic bytes |
|--------|----------------|---------|-------------|
| Foto ponto (`ponto-checkin`) | Sim (JPEG/PNG/WebP) | 5 MB | Sim (`image-magic-bytes.util.ts`) |
| Documentos perfil médico (`medicos/`) | **Não** no `fileFilter` genérico | 10 MB | **Não** no fluxo analisado |
| Documento enviado admin | Genérico | 15 MB | **Não** no fluxo analisado |

### Testes manuais

1. **MIME falso**: enviar arquivo `.exe` com `Content-Type: image/jpeg` no ponto — deve falhar na validação de **conteúdo** (magic bytes).
2. **Polyglot**: PNG mínimo válido com payload extra — avaliar se regras de negócio exigem só “foto de rosto” (não só formato).
3. **Tamanho**: arquivo de 6 MB no ponto — deve ser bloqueado pelo Multer **antes** de gravar (ou apagar após falha).

### Melhorias recomendadas (backlog)

- Aplicar **lista de tipos permitidos + magic bytes** (ou antivírus / ClamAV em fila) nos uploads de **documentos administrativos** e **perfil**, se aceitarem PDF/imagens.
- Servir uploads **sem** exposição pública direta (ver IDOR abaixo).

---

## 3. IDOR (Insecure Direct Object Reference)

### Vetor crítico (mitigado): `/uploads` público

**Antes:** `express.static('/uploads')` permitia baixar arquivo sem JWT se o caminho fosse conhecido.

**Agora:** o static foi **removido**. Downloads passam por rotas autenticadas, por exemplo:

- `GET /api/medico/perfil/documentos/:docId/download` — documentos do próprio perfil (módulo PERFIL).
- `GET /api/medico/documentos-enviados/:id/download` — já existia (documentos enviados pelo master).
- `GET /api/ponto/registros/:id/foto-checkin` — foto do próprio check-in (médico).
- `GET /api/admin/registros-ponto/:id/foto-checkin` — master com módulo RELATÓRIOS.

Caminhos no disco são resolvidos com `upload-path.util.ts` (sem path traversal).

### Mitigações adicionais

- **APIs**: garantir que **todo** `findFirst`/`update` use `id` **e** `tenantId` onde aplicável.

### Teste manual IDOR API

1. Login como médico **A**, copiar `id` de recurso (ex.: escala, notificação).
2. Login como médico **B** (mesmo tenant ou outro, conforme caso de teste).
3. Repetir `GET`/`PUT` com o `id` do A — deve retornar **403/404**, nunca dados do A.

---

## 4. Secrets no repositório

### Ferramentas

```bash
cd /caminho/AppVS
# Busca grosseira (ajuste padrões)
git grep -E 'sk_live|AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH )?PRIVATE KEY|password\s*=\s*['\''\"][^'\'']{8,}' -- ':!*.md' || true
```

- Use **git-secrets**, **TruffleHog** ou **Gitleaks** em CI.
- Garantir `.env` no `.gitignore` (já está) e **nunca** commitar `.env` de produção.

### Rotação

Se algum segredo já vazou em commit ou print: **rotacione** `JWT_*`, `RESEND_*`, senhas de banco, chaves SSH.

---

## 5. Limite de input

### Pontos verificados

- `express.json({ limit: '10mb' })` — limite global alto; rotas sensíveis devem validar **tamanho máximo por campo** onde fizer sentido (`express-validator`: `.isLength({ max: N })`).
- Revisar `validation.middleware.ts` para endpoints novos: sempre **max length** em strings livres (observação, motivo, nomes).

---

## 6. Análise de fluxos

Ordem sugerida de revisão manual:

1. **Auth** → JWT contém `tenantId` + `role` + `id`; nenhum desses pode ser sobrescrito pelo body.
2. **Admin** → `requireRole(MASTER)` + `requireModuleAccess`.
3. **Médico** → `requireModuleAccess` por rota; `req.user.id` como sujeito da ação.
4. **Vagas** → `requireModuleAccess(VAGAS)`; todas as queries com `tenantId` do JWT; publicador verificado antes de listar candidatos / alterar status; mutações com rate limit dedicado (`medico.routes.ts`).
5. **Ponto** → escala/plantão sempre filtrados por `tenantId` + vínculo do médico.

---

## 7. Autenticação e autorização

### Checklist

- [ ] Token expirado → 401.
- [ ] Médico acessando rota só master → 403.
- [ ] Módulo desligado (ex.: PONTO_ELETRONICO) → 403.
- [ ] Refresh token rotation / revogação (se aplicável ao desenho atual).

### Teste rápido

Remover `Authorization` ou usar token de **outro tenant** (se conseguir em staging) nas rotas `/api/admin/*` e `/api/ponto/*`.

---

## 8. RLS (Row Level Security) no PostgreSQL

### Situação

Não há políticas `ENABLE ROW LEVEL SECURITY` nas migrations pesquisadas — o isolamento por tenant é **na aplicação** (Prisma + `where: { tenantId }`).

### Riscos

- Bug em uma query sem `tenantId` → vazamento cross-tenant.
- Acesso direto ao banco (ferramenta, backup restaurado em ambiente errado) sem camada extra.

### Melhorias (opcional, avançado)

- Definir RLS no Postgres por `tenant_id` para tabelas multi-tenant **e** usar role de BD com `SET app.tenant_id = ...` por sessão (exige mudança de arquitetura).
- Para muitos projetos, **auditoria de queries** + testes automatizados de isolamento são mais baratos que RLS imediato.

---

## 9. “Hackear o próprio sistema” (ético)

1. **Ambiente**: só **staging** ou VM local com cópia anonimizada do banco.
2. **Contas**: dois médicos, um master; tentar escalar privilégio e cruzar tenants.
3. **Registro**: OWASP ZAP ou Burp no mapa de rotas; repetir com token válido/ inválido.
4. **Documentar**: cada achado com severidade (Crítico / Alto / Médio / Baixo), passos para reproduzir, e issue no tracker.

---

## Referências no repositório

- `SECURITY.md` — padrão interno.
- `backend/src/middleware/upload.middleware.ts` — limites Multer.
- `backend/src/utils/image-magic-bytes.util.ts` — ponto com foto.
- `backend/src/services/ponto.service.ts` — transações check-in/out.

---

*Última atualização: auditoria estática de código + checklist de testes manuais.*
