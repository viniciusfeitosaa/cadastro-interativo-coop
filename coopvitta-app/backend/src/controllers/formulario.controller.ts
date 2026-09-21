import { Request, Response } from 'express';
import { FormularioRespostaStatus } from '@prisma/client';
import {
  getFormularioAdminService,
  getFormularioPublicoBySlug,
  getRespostaFicheiroDownloadService,
  getRespostaService,
  listFormulariosService,
  listRespostasService,
  patchFormularioService,
  patchRespostaStatusService,
  submitFormularioPublico,
} from '../services/formulario.service';

function clientIp(req: Request): string | undefined {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0]?.trim();
  return req.ip;
}

export const getFormularioPublicoController = async (req: Request, res: Response) => {
  try {
    const data = await getFormularioPublicoBySlug(req.params.slug);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar formulário',
    });
  }
};

export const submitFormularioPublicoController = async (req: Request, res: Response) => {
  try {
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (typeof v === 'string') fields[k] = v;
    }
    const file = req.file as Express.Multer.File | undefined;
    const data = await submitFormularioPublico(req.params.slug, fields, file, {
      ip: clientIp(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
    return res.status(201).json({ success: true, data, message: 'Inscrição enviada com sucesso' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao enviar inscrição',
    });
  }
};

export const listFormulariosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const data = await listFormulariosService(req.user.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar formulários',
    });
  }
};

export const getFormularioAdminController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const data = await getFormularioAdminService(req.user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar formulário',
    });
  }
};

export const patchFormularioController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const data = await patchFormularioService(req.user.tenantId, req.params.id, {
      ativo: typeof req.body?.ativo === 'boolean' ? req.body.ativo : undefined,
      descricao: typeof req.body?.descricao === 'string' ? req.body.descricao : undefined,
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar formulário',
    });
  }
};

export const listFormularioRespostasController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      statusRaw && Object.values(FormularioRespostaStatus).includes(statusRaw as FormularioRespostaStatus)
        ? (statusRaw as FormularioRespostaStatus)
        : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const data = await listRespostasService(req.user.tenantId, req.params.id, { status, q });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar respostas',
    });
  }
};

export const getFormularioRespostaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const data = await getRespostaService(req.user.tenantId, req.params.id, req.params.respostaId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar resposta',
    });
  }
};

export const patchFormularioRespostaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const status = req.body?.status as FormularioRespostaStatus;
    const data = await patchRespostaStatusService(
      req.user.tenantId,
      req.params.id,
      req.params.respostaId,
      status
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar status',
    });
  }
};

export const downloadFormularioRespostaFicheiroController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const { path: filePath, nomeArquivo, mimeType } = await getRespostaFicheiroDownloadService(
      req.user.tenantId,
      req.params.id,
      req.params.respostaId,
      req.params.campoId
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo.replace(/"/g, '')}"`);
    return res.sendFile(filePath);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao descarregar ficheiro',
    });
  }
};
