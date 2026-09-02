import { Request, Response } from 'express';
import {
  createUsuarioStaffService,
  listUsuariosStaffService,
  updateUsuarioStaffService,
} from '../services/usuario-staff.service';

const requireAuth = (req: Request) => {
  if (!req.user) throw { statusCode: 401, message: 'Não autenticado' };
  return req.user;
};

export const listUsuariosStaffController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await listUsuariosStaffService(user.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, error: error.message || 'Erro ao listar usuários staff' });
  }
};

export const createUsuarioStaffController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await createUsuarioStaffService(user.tenantId, user.id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, error: error.message || 'Erro ao criar usuário staff' });
  }
};

export const updateUsuarioStaffController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await updateUsuarioStaffService(user.tenantId, user.id, req.params.id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, error: error.message || 'Erro ao atualizar usuário staff' });
  }
};
