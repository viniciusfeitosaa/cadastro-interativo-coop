# Supabase: template de e-mail para Reset Password

Configuração do e-mail de redefinição de senha no Supabase (Authentication → Email Templates) para o projeto Viva Saúde.

---

## ⚠️ Este projeto usa o BACKEND para “Esqueci minha senha”

O fluxo atual do app é:

1. Usuário informa o e-mail na tela **Esqueci minha senha**.
2. O **frontend** chama a API do **backend** (`POST /auth/esqueci-senha`).
3. O **backend** gera o token, grava no banco e **envia o e-mail** (se SMTP estiver configurado no backend).

Ou seja: **quem envia o e-mail é o backend (nodemailer), não o Supabase.**  
O template que você configurou em **Supabase → Notifications → Email** só é usado quando se usa **Supabase Auth** (ex.: `supabase.auth.resetPasswordForEmail()`). Como o login e o reset são feitos pelo backend próprio, esse template do Supabase **não é usado** nesse fluxo.

**Para o e-mail de redefinição chegar hoje:**

- **Resend (recomendado):** Configure `RESEND_API_KEY` (e opcionalmente `RESEND_FROM`) no backend. Resend funciona bem quando a conta de e-mail é subconta (ex.: Outlook de organização) e não permite SMTP. Crie a chave em [resend.com](https://resend.com) → API Keys.
- **Ou SMTP:** Configure `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (e opcionalmente `SMTP_FROM`, `SMTP_PORT`) no backend.  
- Veja a seção **“Backend próprio (esqueci-senha): envio por Resend ou SMTP”** mais abaixo neste arquivo.

Se no futuro o reset for feito via **Supabase Auth**, aí sim o template em Notifications → Email será usado; até lá, o que vale é o envio do backend (Resend ou SMTP).

---

## Onde configurar (quando usar Supabase Auth)

1. **Supabase Dashboard** → seu projeto  
2. **Authentication** → **Email Templates**  
3. Aba **Reset Password**

---

## Assunto do e-mail (Subject)

Use um dos abaixo (ou adapte):

```
Redefinição de senha – Viva Saúde
```

ou

```
Altere sua senha – Viva Saúde
```

---

## Corpo do e-mail (Body)

O Supabase usa variáveis no estilo Go template. O link de confirmação é **`{{ .ConfirmationURL }}`** — não altere esse nome; o Supabase substitui pelo link real.

### Opção 1: corpo simples (texto)

```
Olá,

Você solicitou a redefinição de senha da sua conta no sistema Viva Saúde.

Clique no link abaixo para definir uma nova senha (o link expira em 1 hora):

{{ .ConfirmationURL }}

Se você não solicitou essa alteração, ignore este e-mail. Sua senha permanecerá a mesma.

—
Sistema Viva Saúde
```

### Opção 2: corpo em HTML (recomendado)

Use no campo **Message (HTML)** ou no editor que aceita HTML:

```html
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
  <p style="color: #14532d; font-weight: 600; font-size: 1.1em;">Viva Saúde</p>
  <p>Olá,</p>
  <p>Você solicitou a redefinição de senha da sua conta no sistema Viva Saúde.</p>
  <p>Clique no botão abaixo para definir uma nova senha. O link expira em 1 hora.</p>
  <p style="margin: 24px 0;">
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #166534; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600;">Redefinir senha</a>
  </p>
  <p style="color: #666; font-size: 0.9em;">Se você não solicitou essa alteração, ignore este e-mail. Sua senha permanecerá a mesma.</p>
  <p style="color: #999; font-size: 0.85em; margin-top: 32px;">— Sistema Viva Saúde</p>
</div>
```

Cores usadas (paleta viva do projeto): `#166534` (viva-800), `#14532d` (viva-900).

---

## Redirect URL (para onde o usuário vai após clicar)

Depois que o usuário clica no link, o Supabase valida o token e redireciona para a sua aplicação.

1. No Supabase: **Authentication** → **URL Configuration**  
2. Em **Redirect URLs**, adicione a URL da sua app (uma por linha), por exemplo:
   - Produção: `https://sejavivasaude.com.br/app/redefinir-senha`
   - Desenvolvimento: `http://localhost:3000/redefinir-senha`
3. Em **Site URL**, use a base do app, por exemplo: `https://sejavivasaude.com.br/app` (produção) ou `http://localhost:3000` (dev).

Assim, após confirmar o reset, o usuário cai na rota `/redefinir-senha` do frontend (com base `/app` em produção).

---

## Integração com o app

- O frontend já tem a página **RedefinirSenha** em `/redefinir-senha`, que hoje espera `?token=...` (fluxo do backend próprio).
- Se o reset for feito **pelo Supabase Auth**, o Supabase pode enviar o token na **URL fragment** (hash) ou em query string, dependendo da configuração. Nesse caso, pode ser necessário ajustar a página **RedefinirSenha** para ler o token do formato que o Supabase envia (ex.: `#access_token=...&type=recovery`) e chamar a API do Supabase para trocar a senha, ou manter o backend como proxy.
- Se o reset continuar sendo feito **só pelo backend** (esqueci-senha + token no banco), o e-mail deve ser enviado pelo backend (nodemailer, Resend, etc.) com o link `{{FRONTEND_URL}}/redefinir-senha?token=...`; nesse fluxo o template do Supabase **não** é usado, a menos que o backend chame alguma função do Supabase para disparar o e-mail.

---

## Resumo

| Onde | O quê |
|------|--------|
| **Email Templates → Reset Password** | Colar o **Subject** e o **Message (HTML)** acima |
| **URL Configuration → Redirect URLs** | `https://sejavivasaude.com.br/app/redefinir-senha` (e dev se quiser) |
| **Site URL** | `https://sejavivasaude.com.br/app` (produção) |

**Importante:** O app em produção está em **/app** (ex.: `https://sejavivasaude.com.br/app`). Por isso:
- No **backend**, use `FRONTEND_URL=https://sejavivasaude.com.br/app` para o link do e-mail de reset ficar correto (`.../app/redefinir-senha?token=...`).
- No Supabase (se usar Auth), use **Redirect URL** e **Site URL** com `/app` quando for o caso.

O link no e-mail continua sendo **`{{ .ConfirmationURL }}`**; o Supabase substitui por um link que valida o token e depois redireciona para a URL configurada.

---

## Backend próprio (esqueci-senha): envio por Resend ou SMTP

O projeto usa **backend próprio** para reset de senha (token no banco, rota `/auth/esqueci-senha`). O link é enviado pelo backend: **WhatsApp** (Evolution API ou Twilio) para médicos com telefone; caso contrário **e-mail** via Resend ou SMTP.

---

### Opções 100% gratuitas (sem pagar nada)

| Canal    | Ferramenta       | Custo | Observação |
|----------|------------------|-------|------------|
| **E-mail** | Resend           | Grátis | 3.000 e-mails/mês, 100/dia. Use `RESEND_FROM=Viva Saúde <onboarding@resend.dev>` e **não precisa configurar DNS**. |
| **WhatsApp** | Evolution API   | Grátis | Open source, self-hosted. Você usa seu próprio número WhatsApp; hospeda a API (Docker no seu servidor ou em um free tier). |

Ou seja: **Resend** (e-mail sem DNS) + **Evolution API** (WhatsApp com seu número) = zero custo.

### Opção 1 – Resend (e-mail; free tier, sem DNS)

| Variável        | Obrigatório | Exemplo |
|-----------------|-------------|---------|
| `RESEND_API_KEY` | Sim        | `re_xxxxxxxxxxxx` (em [resend.com](https://resend.com) → API Keys) |
| `RESEND_FROM`   | Não         | `Viva Saúde <noreply@sejavivasaude.com.br>` ou, **sem configurar DNS**, use `Viva Saúde <onboarding@resend.dev>` |
| `FRONTEND_URL`  | Sim (produção) | `https://sejavivasaude.com.br/app` |

**Resend sem DNS:** se você não tem acesso ao DNS do domínio, use o remetente de teste do Resend. No Render, defina apenas `RESEND_API_KEY` e `RESEND_FROM=Viva Saúde <onboarding@resend.dev>`. O e-mail será enviado por `onboarding@resend.dev` e **não exige configurar domínio** no Resend.

### Opção 2 – SMTP

| Variável     | Obrigatório | Exemplo |
|-------------|-------------|---------|
| `SMTP_HOST` | Sim*        | `smtp.gmail.com` ou servidor do seu provedor |
| `SMTP_PORT` | Não         | `587` (default) |
| `SMTP_SECURE` | Não       | `false` para 587, `true` para 465 |
| `SMTP_USER` | Sim*        | E-mail que envia |
| `SMTP_PASS` | Sim*        | Senha ou “app password” |
| `SMTP_FROM` | Não         | Remetente ex: `noreply@sejavivasaude.com.br` |
| `FRONTEND_URL` | Sim (produção) | `https://sejavivasaude.com.br/app` |

\* Sem **nenhum** provedor (Resend, SMTP ou WhatsApp) configurado, o backend **não envia**; em produção só registra o link no log; em desenvolvimento devolve o link na resposta da API.

### Opção 3 – WhatsApp (Evolution API = grátis, ou Twilio = pago)

O usuário informa o **e-mail** na tela "Esqueci minha senha". Se a conta for de **médico** com **telefone** cadastrado e WhatsApp estiver configurado, o link vai **por WhatsApp**. Contas **Master** não têm telefone; para elas use Resend com `onboarding@resend.dev`.

**3a) Evolution API (open source, gratuito)** – use seu próprio WhatsApp. Prioridade: se Evolution estiver configurado, o backend usa ela; senão, Twilio.

| Variável | Obrigatório | Exemplo |
|----------|-------------|---------|
| `EVOLUTION_API_URL` | Sim | `https://sua-evolution.com` ou `http://localhost:8080` (onde a API está rodando) |
| `EVOLUTION_API_KEY` | Sim | API key da instância (gerada ao criar a instância) |
| `EVOLUTION_INSTANCE` | Sim | Nome da instância que você criou |
| `FRONTEND_URL` | Sim (produção) | `https://sejavivasaude.com.br/app` |

**Como usar:** 1) Hospede a [Evolution API](https://github.com/EvolutionAPI/evolution-api) (Docker: `docker run -p 8080:8080 atendai/evolution-api`). 2) Crie uma instância (POST `/instance/create` com `instanceName` e `integration: WHATSAPP-BAILEYS`). 3) Conecte seu WhatsApp escaneando o QR code. 4) Use a API key retornada e o nome da instância nas variáveis acima. Documentação: [doc.evolution-api.com](https://doc.evolution-api.com).

**3b) Twilio (pago)** – alternativa se não quiser hospedar nada.

| Variável | Obrigatório | Exemplo |
|----------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | Sim | [twilio.com](https://www.twilio.com) → Console |
| `TWILIO_AUTH_TOKEN` | Sim | Console → Auth Token |
| `TWILIO_WHATSAPP_FROM` | Sim | `whatsapp:+14155238886` (sandbox) ou `whatsapp:+5511...` (número aprovado) |

No sandbox Twilio, o destinatário precisa ter enviado "join &lt;código&gt;" ao número do sandbox antes.

### Erro 500 em esqueci-senha

Se a API retornar 500 ao solicitar redefinição:

1. Ver os **logs do backend** (Render → Logs): o controller registra `[esqueci-senha] status message` e o stack do erro.
2. Causas comuns:
   - **Banco não configurado** (tenant padrão inexistente): rodar `npx prisma db push` e `npm run prisma:seed` no projeto.
   - **Tabela `reset_senha_tokens` ausente**: rodar migrações (`prisma migrate deploy`).
   - **Falha ao enviar e-mail** (SMTP ou Resend): o backend não retorna 500 (o token já foi criado); o link é logado. Conferir Resend (API key, domínio verificado) ou SMTP (host, porta, usuário, senha, “app password”).
