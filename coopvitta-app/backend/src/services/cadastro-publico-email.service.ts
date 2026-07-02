import tls from 'tls';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { escapeHtmlAttr, getEmailLogoUrl, getOrgDisplayName, getEmailTagline, getFrontendAppBaseUrl } from '../utils/email-branding.util';

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function org(): string {
  return getOrgDisplayName();
}

function getAppBaseUrl(): string {
  return getFrontendAppBaseUrl();
}

function hasResendConfig(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function hasSmtpConfig(): boolean {
  const e = process.env;
  return !!(e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS);
}

function buildEmailShell(options: {
  preheader: string;
  headline: string;
  bodyParagraphsHtml: string[];
}): string {
  const logoSrc = escapeHtmlAttr(getEmailLogoUrl());
  const orgName = escapeHtmlText(org());
  const year = new Date().getFullYear();
  const pre = escapeHtmlText(options.preheader);
  const headline = escapeHtmlText(options.headline);
  const blocks = options.bodyParagraphsHtml.join('\n');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fb;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${pre}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f5f7fb;">
  <tr>
    <td align="center" style="padding:28px 14px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
        <tr>
          <td bgcolor="#f8fafc" style="padding:32px 28px 24px;text-align:center;background:linear-gradient(180deg,#f8fafc 0%,#ffffff 60%);border-bottom:1px solid #e5e7eb;">
            <img src="${logoSrc}" alt="${orgName}" width="220" height="auto" style="display:block;margin:0 auto 12px;max-width:220px;height:auto;border:0;">
            <p style="margin:0;font-size:13px;letter-spacing:0.02em;color:#64748b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtmlText(getEmailTagline())}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
            <h1 style="margin:0 0 18px;font-size:22px;font-weight:700;line-height:1.3;color:#0f172a;letter-spacing:-0.02em;">${headline}</h1>
            ${blocks}
            <p style="margin:22px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;font-size:14px;line-height:1.55;color:#4b5563;">Com os melhores cumprimentos,<br><strong style="color:#0d9488;">Equipe ${orgName}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 22px;background-color:#f8fafc;text-align:center;font-size:11px;line-height:1.55;color:#94a3b8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
            © ${year} ${orgName}. Mensagem automática; não é necessário responder.<br>
            Dúvidas? Use o canal de suporte da sua instituição ou o contato oficial da plataforma.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#4b5563;">${text}</p>`;
}

function subjectConfirmacao(): string {
  return `Cadastro recebido — ${org()}`;
}

function subjectBoasVindas(): string {
  return `Bem-vindo à ${org()} — o seu pedido de associação`;
}

function subjectCadastroAprovado(): string {
  return `Cadastro aprovado — análise concluída | ${org()}`;
}

function buildConfirmacaoHtml(primeiroNome: string, versaoTermos: string): string {
  const loginHref = escapeHtmlAttr(`${getAppBaseUrl()}/login`);
  const orgName = escapeHtmlText(org());
  return buildEmailShell({
    preheader: `Confirmámos a receção do seu pedido de cadastro na ${org()}.`,
    headline: 'Recebemos o seu cadastro',
    bodyParagraphsHtml: [
      p(`Olá, <strong style="color:#0f172a;">${escapeHtmlText(primeiroNome)}</strong>,`),
      p(
        `Este e-mail confirma que o <strong style="color:#0f172a;">pedido de cadastro</strong> que você enviou na plataforma <strong style="color:#0f172a;">${orgName}</strong> foi <strong style="color:#0f172a;">recebido com sucesso</strong> pelos nossos sistemas, incluindo os dados e documentos enviados nessa sessão.`
      ),
      p(
        'Seu pedido segue agora para <strong style="color:#0f172a;">análise pela equipe competente</strong>. Enquanto a análise não for concluída, o acesso à plataforma permanece inativo. Você será notificado por e-mail ou pelos canais da sua instituição quando houver decisão.'
      ),
      p(
        `Para sua segurança e conformidade legal, registramos o aceite da declaração e dos termos de cadastro na <strong style="color:#0f172a;">versão ${escapeHtmlText(
          versaoTermos
        )}</strong>, no momento do envio do formulário.`
      ),
      p(
        `Quando seu acesso for aprovado, você poderá entrar em <a href="${loginHref}" style="color:#0d9488;font-weight:600;">${escapeHtmlText(
          `${getAppBaseUrl()}/login`
        )}</a> com o e-mail e a senha que cadastrou.`
      ),
    ],
  });
}

function buildConfirmacaoText(primeiroNome: string, versaoTermos: string): string {
  const login = `${getAppBaseUrl()}/login`;
  const orgName = org();
  return [
    `${orgName.toUpperCase()} — Cadastro recebido`,
    '─'.repeat(44),
    '',
    `Olá, ${primeiroNome},`,
    '',
    `Confirmamos o recebimento do seu pedido de cadastro na plataforma ${orgName}, incluindo os dados e documentos enviados.`,
    'O pedido segue para análise; o acesso permanece inativo até a aprovação.',
    '',
    `Versão dos termos e da declaração aceitos: ${versaoTermos}.`,
    '',
    `Após a aprovação, acesse: ${login}`,
    '',
    'Com os melhores cumprimentos,',
    `Equipe ${orgName}`,
  ].join('\n');
}

function buildBoasVindasHtml(primeiroNome: string): string {
  const loginHref = escapeHtmlAttr(`${getAppBaseUrl()}/login`);
  const orgName = escapeHtmlText(org());
  return buildEmailShell({
    preheader: `Obrigado por confiar na ${org()} — estamos com você nesta etapa.`,
    headline: `Bem-vindo à ${org()}`,
    bodyParagraphsHtml: [
      p(`Olá, <strong style="color:#0f172a;">${escapeHtmlText(primeiroNome)}</strong>,`),
      p(
        `É com satisfação que damos as <strong style="color:#0f172a;">boas-vindas</strong> à comunidade de profissionais e parceiros que utilizam a <strong style="color:#0f172a;">${orgName}</strong> para simplificar rotinas de trabalho, escalas, documentação e comunicação com sua instituição.`
      ),
      p(
        'Seu pedido de associação foi registrado e está sendo tratado com o rigor que merece. Nossa equipe e a instituição com a qual você se associa trabalham para concluir a análise o mais breve possível.'
      ),
      p(
        'Assim que sua conta for <strong style="color:#0f172a;">aprovada</strong>, você poderá acessar a plataforma e explorar os módulos para os quais tiver permissão (conforme definido pela instituição).'
      ),
      p(
        `Guarde este e-mail para referência. Link de acesso: <a href="${loginHref}" style="color:#0d9488;font-weight:600;">${escapeHtmlText(
          `${getAppBaseUrl()}/login`
        )}</a>`
      ),
    ],
  });
}

function buildBoasVindasText(primeiroNome: string): string {
  const login = `${getAppBaseUrl()}/login`;
  const orgName = org();
  return [
    `${orgName.toUpperCase()} — Boas-vindas`,
    '─'.repeat(44),
    '',
    `Olá, ${primeiroNome},`,
    '',
    `Bem-vindo à ${orgName}.`,
    '',
    'Seu pedido de associação foi recebido e está em análise. Quando for aprovado, você poderá acessar a plataforma com o e-mail e a senha que cadastrou.',
    '',
    `Página de login: ${login}`,
    '',
    'Com os melhores cumprimentos,',
    `Equipe ${orgName}`,
  ].join('\n');
}

function buildCadastroAprovadoHtml(primeiroNome: string, nomeInstituicao?: string): string {
  const loginHref = escapeHtmlAttr(`${getAppBaseUrl()}/login`);
  const inst = (nomeInstituicao || '').trim();
  const blocoInstituicao = inst
    ? p(
        `A <strong style="color:#0f172a;">análise do seu cadastro</strong> pela equipe da instituição <strong style="color:#0f172a;">${escapeHtmlText(
          inst
        )}</strong> foi <strong style="color:#0d9488;">concluída</strong> e o seu perfil profissional foi <strong style="color:#0d9488;">aprovado</strong>.`
      )
    : p(
        'A <strong style="color:#0f172a;">análise do seu cadastro</strong> foi <strong style="color:#0d9488;">concluída</strong> e o seu perfil profissional foi <strong style="color:#0d9488;">aprovado</strong>.'
      );
  return buildEmailShell({
    preheader: 'A análise do seu cadastro foi concluída e o seu acesso está ativo.',
    headline: 'Cadastro aprovado',
    bodyParagraphsHtml: [
      p(`Olá, <strong style="color:#0f172a;">${escapeHtmlText(primeiroNome)}</strong>,`),
      blocoInstituicao,
      p(
        'Já pode entrar na plataforma com o <strong style="color:#0f172a;">e-mail</strong> e a <strong style="color:#0f172a;">senha</strong> que definiu no pedido de associação.'
      ),
      p(
        `Acesse o painel: <a href="${loginHref}" style="color:#0d9488;font-weight:600;">${escapeHtmlText(
          `${getAppBaseUrl()}/login`
        )}</a>`
      ),
    ],
  });
}

function buildCadastroAprovadoText(primeiroNome: string, nomeInstituicao?: string): string {
  const login = `${getAppBaseUrl()}/login`;
  const orgName = org();
  const inst = (nomeInstituicao || '').trim();
  const linhaAnalise = inst
    ? `A análise do seu cadastro pela instituição "${inst}" foi concluída e o seu perfil profissional foi aprovado.`
    : 'A análise do seu cadastro foi concluída e o seu perfil profissional foi aprovado.';
  return [
    `${orgName.toUpperCase()} — Cadastro aprovado`,
    '─'.repeat(44),
    '',
    `Olá, ${primeiroNome},`,
    '',
    linhaAnalise,
    '',
    'Já pode entrar na plataforma com o e-mail e a senha que definiu no pedido de associação.',
    '',
    `Página de login: ${login}`,
    '',
    'Com os melhores cumprimentos,',
    `Equipe ${orgName}`,
  ].join('\n');
}

async function sendEmailHtml(to: string, subject: string, html: string, text: string): Promise<void> {
  const orgName = org();
  if (hasSmtpConfig()) {
    const host = process.env.SMTP_HOST!;
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true';
    const tlsServername =
      process.env.SMTP_TLS_SERVERNAME?.trim() ||
      (['maddy', '127.0.0.1', 'localhost'].includes(host) ? 'mail.coopvitta.cloud' : host);
    const tlsOptions: tls.ConnectionOptions = {
      servername: tlsServername,
      ...(host !== tlsServername
        ? {
            checkServerIdentity: (_hostname: string, cert: tls.PeerCertificate) =>
              tls.checkServerIdentity(tlsServername, cert),
          }
        : {}),
    };
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      requireTLS: !secure && port === 587,
      tls: tlsOptions,
    });
    const fromAddr = process.env.SMTP_FROM || user;
    await transporter.sendMail({
      from: fromAddr ? `${orgName} <${fromAddr}>` : user,
      to,
      subject,
      text,
      html,
    });
    console.log('[cadastro-publico-email] SMTP enviado para:', to, 'assunto:', subject);
    return;
  }
  if (hasResendConfig()) {
    const apiKey = process.env.RESEND_API_KEY!;
    const from = process.env.RESEND_FROM || `${orgName} <onboarding@resend.dev>`;
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) throw new Error(error.message || 'Resend falhou');
    console.log('[cadastro-publico-email] Resend enviado. id:', data?.id ?? 'n/a', 'para:', to, 'assunto:', subject);
    return;
  }
  throw new Error('Nenhum provedor de e-mail configurado (SMTP ou RESEND_API_KEY)');
}

export async function enviarEmailsPosCadastroPublico(params: {
  to: string;
  nomeCompleto: string;
  versaoTermos: string;
}): Promise<void> {
  const to = params.to.trim().toLowerCase();
  if (!to) return;
  const primeiro = params.nomeCompleto.trim().split(/\s+/)[0] || 'Profissional';

  try {
    await sendEmailHtml(
      to,
      subjectConfirmacao(),
      buildConfirmacaoHtml(primeiro, params.versaoTermos),
      buildConfirmacaoText(primeiro, params.versaoTermos)
    );
  } catch (err) {
    console.error('[cadastro-publico-email] Falha no e-mail de confirmação de cadastro:', err);
  }

  try {
    await sendEmailHtml(to, subjectBoasVindas(), buildBoasVindasHtml(primeiro), buildBoasVindasText(primeiro));
  } catch (err) {
    console.error('[cadastro-publico-email] Falha no e-mail de boas-vindas:', err);
  }
}

export async function enviarEmailCadastroAprovado(params: {
  to: string | null | undefined;
  nomeCompleto: string;
  nomeInstituicao?: string | null;
}): Promise<void> {
  const to = (params.to ?? '').trim().toLowerCase();
  if (!to) return;
  const primeiro = params.nomeCompleto.trim().split(/\s+/)[0] || 'Profissional';
  const nomeInstituicao = params.nomeInstituicao?.trim() || undefined;
  await sendEmailHtml(
    to,
    subjectCadastroAprovado(),
    buildCadastroAprovadoHtml(primeiro, nomeInstituicao),
    buildCadastroAprovadoText(primeiro, nomeInstituicao)
  );
}
