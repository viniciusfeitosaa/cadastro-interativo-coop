import { Request, Response } from 'express';
import {
  addEquipeToEscalaService,
  addMedicoToEquipeService,
  addMedicoToSubgrupoService,
  addSubgrupoToEscalaService,
  createEquipeService,
  createSubgrupoService,
  deleteEquipeService,
  deleteSubgrupoService,
  listEquipeMedicosService,
  listEquipesService,
  listEscalaEquipesService,
  listEscalaSubgruposService,
  listSubgrupoMedicosService,
  listSubgruposService,
  removeEquipeFromEscalaService,
  removeMedicoFromEquipeService,
  removeMedicoFromSubgrupoService,
  removeSubgrupoFromEscalaService,
  updateEquipeService,
  updateSubgrupoService,
} from '../services/grupo-equipe.service';

const requireAuth = (req: Request) => {
  if (!req.user) throw { statusCode: 401, message: 'Não autenticado' };
  return req.user;
};

export const listSubgruposController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await listSubgruposService(user.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao listar subgrupos' });
  }
};

export const createSubgrupoController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await createSubgrupoService(user.tenantId, user.id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao criar subgrupo' });
  }
};

export const updateSubgrupoController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await updateSubgrupoService(user.tenantId, user.id, req.params.id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao atualizar subgrupo' });
  }
};

export const deleteSubgrupoController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    await deleteSubgrupoService(user.tenantId, user.id, req.params.id);
    return res.status(200).json({ success: true, message: 'Subgrupo excluído com sucesso' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao excluir subgrupo' });
  }
};

export const listSubgrupoMedicosController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await listSubgrupoMedicosService(user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao listar médicos do subgrupo' });
  }
};

export const addMedicoToSubgrupoController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await addMedicoToSubgrupoService(user.tenantId, user.id, req.params.id, req.body.medicoId);
    return res.status(201).json({ success: true, data, message: 'Médico vinculado ao subgrupo' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao vincular médico ao subgrupo' });
  }
};

export const removeMedicoFromSubgrupoController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    await removeMedicoFromSubgrupoService(user.tenantId, user.id, req.params.id, req.params.medicoId);
    return res.status(200).json({ success: true, message: 'Médico removido do subgrupo' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao remover médico do subgrupo' });
  }
};

export const listEquipesController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const subgrupoId = (req.query.subgrupoId as string)?.trim() || undefined;
    const data = await listEquipesService(user.tenantId, subgrupoId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao listar equipes' });
  }
};

export const createEquipeController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await createEquipeService(user.tenantId, user.id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao criar equipe' });
  }
};

export const updateEquipeController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await updateEquipeService(user.tenantId, user.id, req.params.id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao atualizar equipe' });
  }
};

export const deleteEquipeController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    await deleteEquipeService(user.tenantId, user.id, req.params.id);
    return res.status(200).json({ success: true, message: 'Equipe excluída com sucesso' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao excluir equipe' });
  }
};

export const listEquipeMedicosController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await listEquipeMedicosService(user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao listar médicos da equipe' });
  }
};

export const addMedicoToEquipeController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await addMedicoToEquipeService(user.tenantId, user.id, req.params.id, req.body.medicoId);
    return res.status(201).json({ success: true, data, message: 'Médico vinculado à equipe' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao vincular médico à equipe' });
  }
};

export const removeMedicoFromEquipeController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    await removeMedicoFromEquipeService(user.tenantId, user.id, req.params.id, req.params.medicoId);
    return res.status(200).json({ success: true, message: 'Médico removido da equipe' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao remover médico da equipe' });
  }
};

export const listEscalaSubgruposController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await listEscalaSubgruposService(user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao listar subgrupos da escala' });
  }
};

export const addSubgrupoToEscalaController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await addSubgrupoToEscalaService(user.tenantId, user.id, req.params.id, req.body.subgrupoId);
    return res.status(201).json({ success: true, data, message: 'Subgrupo vinculado à escala' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao vincular subgrupo à escala' });
  }
};

export const removeSubgrupoFromEscalaController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    await removeSubgrupoFromEscalaService(user.tenantId, user.id, req.params.id, req.params.subgrupoId);
    return res.status(200).json({ success: true, message: 'Subgrupo removido da escala' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao remover subgrupo da escala' });
  }
};

export const listEscalaEquipesController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await listEscalaEquipesService(user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao listar equipes da escala' });
  }
};

export const addEquipeToEscalaController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    const data = await addEquipeToEscalaService(user.tenantId, user.id, req.params.id, req.body.equipeId);
    return res.status(201).json({ success: true, data, message: 'Equipe vinculada à escala' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao vincular equipe à escala' });
  }
};

export const removeEquipeFromEscalaController = async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req);
    await removeEquipeFromEscalaService(user.tenantId, user.id, req.params.id, req.params.equipeId);
    return res.status(200).json({ success: true, message: 'Equipe removida da escala' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erro ao remover equipe da escala' });
  }
};
