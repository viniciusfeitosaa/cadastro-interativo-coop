import { Request, Response } from 'express';
import {
  createPerfilAcessoService,
  getPerfilAcessoService,
  listPerfisAcessoService,
  updatePerfilAcessoService,
} from '../services/perfil-acesso.service';

const requireAuth = (req: Request) => {
  if (!req.user) throw { statusCode: 401, message: 'Não autenticado' };
  return req.user;
};

export const listPerfisAcessoController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await listPerfisAcessoService(user.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, error: error.message || 'Erro ao listar perfis de acesso' });
  }
};

export const getPerfilAcessoController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await getPerfilAcessoService(user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, error: error.message || 'Erro ao obter perfil de acesso' });
  }
};

export const createPerfilAcessoController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await createPerfilAcessoService(user.tenantId, user.id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, error: error.message || 'Erro ao criar perfil de acesso' });
  }
};

export const updatePerfilAcessoController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await updatePerfilAcessoService(user.tenantId, user.id, req.params.id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, error: error.message || 'Erro ao atualizar perfil de acesso' });
  }
};
