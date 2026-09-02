import { Request, Response } from 'express';
import {
  acceptInviteService,
  esqueciSenhaService,
  loginByEmailService,
  loginMasterService,
  loginMedicoService,
  previewResetPasswordEmailHtmlService,
  redefinirSenhaService,
  registerPublicMedicoService,
} from '../services/auth.service';
import { getMinhaPermissaoModulosService } from '../services/acesso-modulo.service';

export const loginMedicoController = async (req: Request, res: Response) => {
  try {
    const { cpf, crm } = req.body;

    const result = await loginMedicoService(cpf, crm);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao fazer login',
    });
  }
};

export const loginMasterController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await loginMasterService(email, password);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao fazer login master',
    });
  }
};

/** Erros de infraestrutura (DB / rede) que não devem parecer "senha errada". */
function isDatabaseOrNetworkFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("can't reach database") ||
    m.includes("server has closed the connection") ||
    m.includes('p1001') ||
    m.includes('p1017') ||
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('etimedout') ||
    m.includes('ssl') ||
    m.includes('certificate') ||
    m.includes('self signed') ||
    m.includes('no pg_hba.conf entry')
  );
}

export const loginEmailController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await loginByEmailService(email, password);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    const rawMsg = err?.message ?? String(error);
    console.error('[auth/login]', rawMsg);

    if (err?.statusCode === 401 || err?.statusCode === 400 || err?.statusCode === 403) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message || 'Erro ao fazer login',
      });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const infra = isDatabaseOrNetworkFailure(rawMsg);
    const statusCode = err?.statusCode ?? (infra ? 503 : 500);
    const errorMessage =
      err?.statusCode != null
        ? err.message || 'Erro ao fazer login'
        : infra
          ? isDev
            ? rawMsg
            : 'Não foi possível conectar ao banco de dados. Em Postgres na própria VPS, use sslmode=disable na DATABASE_URL se o servidor não usar TLS; confira host, porta e se rodou migrate/seed.'
          : isDev
            ? rawMsg
            : err.message || 'Erro ao fazer login';

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
    });
  }
};

export const acceptInviteController = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    const result = await acceptInviteService(token, password);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Convite aceito com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao aceitar convite',
    });
  }
};

export const registerPublicController = async (req: Request, res: Response) => {
  try {
    const files = (req.files as Record<string, Express.Multer.File[]> | undefined) || undefined;
    const result = await registerPublicMedicoService(req.body, files);
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[auth/register] erro:', {
      statusCode: error?.statusCode || 500,
      message: error?.message || 'Erro ao cadastrar usuário',
      stack: error?.stack || null,
      bodyKeys: Object.keys(req.body || {}),
      fileFields: Object.keys((req.files as Record<string, unknown>) || {}),
    });
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao cadastrar usuário',
    });
  }
};

export const getMeModulosAcessoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await getMinhaPermissaoModulosService(
      req.user.tenantId,
      req.user.role,
      req.user.id
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao consultar módulos de acesso',
    });
  }
};

// /login agora é o login único por e-mail/senha
export const loginController = loginEmailController;

export const esqueciSenhaController = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = await esqueciSenhaService(email);
    return res.status(200).json({
      success: true,
      message: result.message,
      ...(result.resetLink && { resetLink: result.resetLink }),
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    const message = error.message || 'Erro ao solicitar redefinição de senha';
    console.error('[esqueci-senha]', status, message, error?.stack || '');
    return res.status(status).json({
      success: false,
      error: status === 500 ? 'Erro ao solicitar redefinição. Tente novamente mais tarde.' : message,
    });
  }
};

export const redefinirSenhaController = async (req: Request, res: Response) => {
  try {
    const { token, novaSenha } = req.body;
    const result = await redefinirSenhaService(token, novaSenha);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao redefinir senha',
    });
  }
};

export const previewResetEmailController = async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).send('Not found');
    }
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const html = previewResetPasswordEmailHtmlService(token);
    // No preview web, permitir estilos inline (padrão de e-mail HTML) e logo externa sem quebrar CSP global.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: https://app.coopvitta.cloud; style-src 'self' 'unsafe-inline';"
    );
    return res.status(200).type('html').send(html);
  } catch (error: any) {
    return res.status(500).send(error?.message || 'Erro ao gerar preview');
  }
};
