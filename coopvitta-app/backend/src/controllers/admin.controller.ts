import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { getFotoCheckinRegistroForAdmin } from '../services/ponto.service';
import {
  createTipoPlantaoService,
  deleteTipoPlantaoService,
  listTiposPlantaoService,
  updateTipoPlantaoService,
} from '../services/tipo-plantao.service';
import {
  addContratoEquipeService,
  addContratoSubgrupoService,
  alocarMedicoEscalaService,
  createEscalaService,
  createContratoAtivoService,
  createEscalaPlantaoService,
  replicarEscalaPlantoesMesService,
  createMedicoService,
  deleteEscalaService,
  deleteContratoAtivoService,
  getConfigPontoService,
  getValoresPlantaoService,
  listAdicionaisPlantaoService,
  inviteMedicoService,
  getMedicoDocusealDocumentosService,
  enviarDocusealTemplateMedicoService,
  listContratoEquipesService,
  listContratoSubgruposService,
  listEscalaMedicosService,
  listEscalaPlantoesService,
  listHistoricoTrocasPlantaoEscalaService,
  listEquipePlantoesService,
  listEquipeEscalasService,
  listEscalasService,
  listRegistrosPontoAdminService,
  listContratosAtivosService,
  listMedicosService,
  removerEscalaPlantaoService,
  removerMedicoEscalaService,
  removeContratoEquipeService,
  removeContratoSubgrupoService,
  setConfigPontoService,
  removerAdicionalPlantaoService,
  upsertAdicionalPlantaoService,
  setValorPlantaoService,
  toggleMedicoAtivoService,
  updateEscalaService,
  updateContratoAtivoService,
  updateMedicoService,
} from '../services/admin.service';
import {
  getMatrizAcessosModulosService,
  salvarMatrizAcessosModulosService,
} from '../services/acesso-modulo.service';
import { listEquipesService, listSubgruposService } from '../services/grupo-equipe.service';
import {
  listDocumentosEnviadosAdmin,
  uploadAndSendDocumento,
  deleteDocumentoEnviado,
} from '../services/documentosenviados.service';
import {
  docusealResendEmailSubmitterService,
  docusealResumoPorEmailsService,
  listDocusealPendentesAssinaturaService,
} from '../services/docuseal.service';
import {
  aprovarCadastroPendenteService,
  downloadCadastroPendenteDocumentoService,
  getCadastroPendenteDetalheService,
  listCadastrosPendentesService,
  rejeitarCadastroPendenteService,
} from '../services/cadastro-pendente.service';
import {
  getRelatorioProcedimentosMesService,
  upsertRelatorioProcedimentosMesService,
} from '../services/relatorio-procedimentos.service';
import { ModuloSistema, UserRole } from '@prisma/client';

export const listMedicosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const search = req.query.search ? String(req.query.search) : undefined;
    const ativo = req.query.ativo === 'true' ? true : req.query.ativo === 'false' ? false : undefined;

    const result = await listMedicosService({
      tenantId: req.user.tenantId,
      page,
      limit,
      search,
      ativo,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar médicos',
    });
  }
};

/** DocuSeal: pedidos de assinatura pendentes (env opcional). */
export const listDocusealPendentesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await listDocusealPendentesAssinaturaService();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao consultar DocuSeal',
    });
  }
};

/** DocuSeal: pendentes por e-mail (lista Médicos — coluna por profissional). */
export const docusealResumoPorEmailsController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const emails = req.body?.emails;
    if (!Array.isArray(emails) || emails.some((e: unknown) => typeof e !== 'string')) {
      return res.status(400).json({ success: false, error: 'Envie JSON { "emails": string[] }' });
    }
    if (emails.length > 150) {
      return res.status(400).json({ success: false, error: 'Máximo de 150 e-mails por pedido.' });
    }
    const data = await docusealResumoPorEmailsService(emails as string[]);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao consultar DocuSeal',
    });
  }
};

/** DocuSeal: modelos obrigatórios + estado (enviar / pendente) para um médico. */
export const getMedicoDocusealDocumentosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const medicoId = req.params.id;
    const data = await getMedicoDocusealDocumentosService(req.user.tenantId, medicoId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao consultar documentos DocuSeal',
    });
  }
};

/** DocuSeal: enviar um modelo ao médico (cria submissão na API). */
export const postMedicoDocusealEnviarTemplateController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const medicoId = req.params.id;
    const templateId = Number(req.body?.templateId);
    if (!Number.isFinite(templateId)) {
      return res.status(400).json({ success: false, error: 'Envie JSON { "templateId": number }' });
    }
    const result = await enviarDocusealTemplateMedicoService(
      req.user.tenantId,
      req.user.id,
      medicoId,
      templateId
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao enviar documento DocuSeal',
    });
  }
};

/** DocuSeal: reenviar e-mail de assinatura a um signatário (PUT submitter + send_email). */
export const docusealResendSubmitterController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const id = parseInt(String(req.params.submitterId), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'submitterId inválido' });
    }
    await docusealResendEmailSubmitterService(id);
    return res.status(200).json({ success: true, message: 'Pedido de reenvio registado no DocuSeal.' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao reenviar e-mail DocuSeal',
    });
  }
};

export const createMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const medico = await createMedicoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      data: medico,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao criar médico',
    });
  }
};

export const updateMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const medico = await updateMedicoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      medicoId: req.params.id,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      data: medico,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar médico',
    });
  }
};

export const toggleMedicoAtivoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Campo "ativo" deve ser boolean',
      });
    }

    const medico = await toggleMedicoAtivoService(
      req.user.tenantId,
      req.user.id,
      req.params.id,
      ativo
    );

    return res.status(200).json({
      success: true,
      data: medico,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao alterar status do médico',
    });
  }
};

// Relatório de procedimentos (Lançamentos do mês) — persistência por mês no backend
export const getRelatorioProcedimentosMesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const mesRef = String(req.params.mesRef || '');
    const dados = await getRelatorioProcedimentosMesService(req.user.tenantId, mesRef);
    return res.status(200).json({ success: true, data: dados });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao buscar relatório de procedimentos',
    });
  }
};

export const upsertRelatorioProcedimentosMesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const mesRef = String(req.params.mesRef || '');
    await upsertRelatorioProcedimentosMesService(req.user.tenantId, mesRef, req.body?.dados);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao salvar relatório de procedimentos',
    });
  }
};

export const inviteMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const result = await inviteMedicoService(
      req.user.tenantId,
      req.user.id,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Convite gerado com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao gerar convite',
    });
  }
};

export const listContratosAtivosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await listContratosAtivosService({
      tenantId: req.user.tenantId,
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar contratos ativos',
    });
  }
};

export const createContratoAtivoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const contrato = await createContratoAtivoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      data: contrato,
      message: 'Contrato ativo criado com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao criar contrato ativo',
    });
  }
};

export const updateContratoAtivoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const contrato = await updateContratoAtivoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      contratoId: req.params.id,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      data: contrato,
      message: 'Contrato ativo atualizado com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar contrato ativo',
    });
  }
};

export const deleteContratoAtivoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    await deleteContratoAtivoService(req.user.tenantId, req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Contrato ativo excluído com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao excluir contrato ativo',
    });
  }
};

export const listContratoSubgruposController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const data = await listContratoSubgruposService(req.user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('[listContratoSubgrupos]', error?.message ?? error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar subgrupos do contrato',
    });
  }
};

export const addContratoSubgrupoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const { subgrupoId } = req.body;
    if (!subgrupoId || typeof subgrupoId !== 'string') {
      return res.status(400).json({ success: false, error: 'subgrupoId é obrigatório' });
    }
    const data = await addContratoSubgrupoService(
      req.user.tenantId,
      req.user.id,
      req.params.id,
      subgrupoId.trim()
    );
    return res.status(201).json({ success: true, data, message: 'Subgrupo associado ao contrato' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao associar subgrupo',
    });
  }
};

export const removeContratoSubgrupoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    await removeContratoSubgrupoService(
      req.user.tenantId,
      req.user.id,
      req.params.id,
      req.params.subgrupoId
    );
    return res.status(200).json({ success: true, message: 'Subgrupo desassociado do contrato' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao desassociar subgrupo',
    });
  }
};

export const listContratoEquipesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const data = await listContratoEquipesService(req.user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('[listContratoEquipes]', error?.message ?? error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar equipes do contrato',
    });
  }
};

export const addContratoEquipeController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    const { equipeId } = req.body;
    if (!equipeId || typeof equipeId !== 'string') {
      return res.status(400).json({ success: false, error: 'equipeId é obrigatório' });
    }
    const data = await addContratoEquipeService(
      req.user.tenantId,
      req.user.id,
      req.params.id,
      equipeId.trim()
    );
    return res.status(201).json({ success: true, data, message: 'Equipe associada ao contrato' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao associar equipe',
    });
  }
};

export const removeContratoEquipeController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
    await removeContratoEquipeService(
      req.user.tenantId,
      req.user.id,
      req.params.id,
      req.params.equipeId
    );
    return res.status(200).json({ success: true, message: 'Equipe desassociada do contrato' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao desassociar equipe',
    });
  }
};

export const listEscalasController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await listEscalasService({
      tenantId: req.user.tenantId,
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar escalas',
    });
  }
};

export const createEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { nome, contratoAtivoId, descricao, dataInicio, dataFim, ativo } = req.body;
    const ativoBool =
      ativo === undefined ? undefined : ativo === true || ativo === 'true' ? true : ativo === false || ativo === 'false' ? false : undefined;

    const escala = await createEscalaService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      nome,
      contratoAtivoId,
      descricao,
      dataInicio,
      dataFim,
      ativo: ativoBool,
    });

    return res.status(201).json({
      success: true,
      data: escala,
      message: 'Escala criada com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao criar escala',
    });
  }
};

export const updateEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { contratoAtivoId, nome, descricao, dataInicio, dataFim, ativo } = req.body;
    const ativoBool =
      ativo === undefined ? undefined : ativo === true || ativo === 'true' ? true : ativo === false || ativo === 'false' ? false : undefined;

    const escala = await updateEscalaService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      escalaId: req.params.id,
      contratoAtivoId,
      nome,
      descricao,
      dataInicio,
      dataFim,
      ativo: ativoBool,
    });

    return res.status(200).json({
      success: true,
      data: escala,
      message: 'Escala atualizada com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar escala',
    });
  }
};

export const deleteEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    await deleteEscalaService(req.user.tenantId, req.user.id, req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Escala excluída com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao excluir escala',
    });
  }
};

export const listEscalaMedicosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const data = await listEscalaMedicosService(req.user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar alocações da escala',
    });
  }
};

export const alocarMedicoEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { medicoId, cargo, valorHora } = req.body;
    const valorHoraNum = valorHora != null && valorHora !== '' ? Number(valorHora) : null;

    const data = await alocarMedicoEscalaService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      escalaId: req.params.id,
      medicoId,
      cargo: cargo != null && cargo !== '' ? String(cargo) : null,
      valorHora: valorHoraNum,
    });
    return res.status(201).json({ success: true, data, message: 'Médico alocado com sucesso' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao alocar médico na escala',
    });
  }
};

export const removerMedicoEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    await removerMedicoEscalaService(req.user.tenantId, req.user.id, req.params.id, req.params.medicoId);
    return res.status(200).json({ success: true, message: 'Médico removido da escala' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao remover médico da escala',
    });
  }
};

export const listEscalaPlantoesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const dataInicio = req.query.dataInicio ? String(req.query.dataInicio) : undefined;
    const dataFim = req.query.dataFim ? String(req.query.dataFim) : undefined;
    const data = await listEscalaPlantoesService(req.user.tenantId, req.params.id, { dataInicio, dataFim });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro ao listar plantões da escala';
    if (statusCode === 500) console.error('[listEscalaPlantoes]', error);
    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
};

export const listHistoricoTrocasPlantaoEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await listHistoricoTrocasPlantaoEscalaService(req.user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro ao listar histórico de trocas de plantão';
    if (statusCode === 500) console.error('[listHistoricoTrocasPlantaoEscala]', error);
    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
};

export const listEquipePlantoesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const dataInicio = req.query.dataInicio ? String(req.query.dataInicio) : undefined;
    const dataFim = req.query.dataFim ? String(req.query.dataFim) : undefined;
    const modoRaw = req.query.modo ? String(req.query.modo).toLowerCase() : undefined;
    const modo = modoRaw === 'fixa' || modoRaw === 'dinamica' ? modoRaw : undefined;
    const data = await listEquipePlantoesService(req.user.tenantId, req.params.id, { dataInicio, dataFim, modo });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro ao listar plantões da equipe';
    if (statusCode === 500) console.error('[listEquipePlantoes]', error);
    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
};

export const listEquipeEscalasController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await listEquipeEscalasService(req.user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro ao listar escalas da equipe';
    if (statusCode === 500) console.error('[listEquipeEscalas]', error);
    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
};

export const createEscalaPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await createEscalaPlantaoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      escalaId: req.params.id,
      ...req.body,
    });
    return res.status(201).json({ success: true, data, message: 'Plantão atribuído com sucesso' });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro ao atribuir plantão';
    if (statusCode === 500) console.error('[createEscalaPlantao]', error);
    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
};

export const replicarEscalaPlantoesMesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await replicarEscalaPlantoesMesService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      escalaId: req.params.id,
      mesOrigem: String(req.body.mesOrigem ?? '').trim(),
      mesDestino: String(req.body.mesDestino ?? '').trim(),
    });
    return res.status(200).json({ success: true, data, message: 'Replicação concluída' });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro ao replicar plantões do mês';
    if (statusCode === 500) console.error('[replicarEscalaPlantoesMes]', error);
    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
};

export const removerEscalaPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    await removerEscalaPlantaoService(req.user.tenantId, req.user.id, req.params.plantaoId);
    return res.status(200).json({ success: true, message: 'Plantão removido' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao remover plantão',
    });
  }
};

export const getValoresPlantaoOpcoesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const tenantId = req.user.tenantId;
    const [contratosResult, subgrupos, equipes, contratoSubgrupos, contratoEquipes] = await Promise.all([
      listContratosAtivosService({ tenantId, page: 1, limit: 500 }),
      listSubgruposService(tenantId),
      listEquipesService(tenantId, null),
      prisma.contratoSubgrupo.findMany({
        where: { tenantId },
        select: { contratoAtivoId: true, subgrupoId: true },
      }),
      prisma.contratoEquipe.findMany({
        where: { tenantId },
        select: { contratoAtivoId: true, equipeId: true },
      }),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        contratos: contratosResult.items,
        subgrupos: subgrupos.map((s) => ({
          id: s.id,
          nome: s.nome,
          ativo: s.ativo,
          usaEscala: s.usaEscala,
          usaPonto: s.usaPonto,
        })),
        equipes: equipes.map((e) => ({
          id: e.id,
          nome: e.nome,
          ativo: e.ativo,
          subgrupoId: e.subgrupoId ?? null,
        })),
        contratoSubgrupos,
        contratoEquipes,
      },
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar opções',
    });
  }
};

export const getValoresPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const contratoId = (req.query.contratoId as string)?.trim();
    const subgrupoId = (req.query.subgrupoId as string)?.trim();
    const equipeId = (req.query.equipeId as string)?.trim();
    if (!contratoId) {
      return res.status(400).json({
        success: false,
        error: 'contratoId é obrigatório na query',
      });
    }
    const data = await getValoresPlantaoService(
      req.user.tenantId,
      contratoId,
      subgrupoId || undefined,
      equipeId || undefined
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar valores de plantão',
    });
  }
};

export const listTiposPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const contratoAtivoId = (req.query.contratoAtivoId as string)?.trim();
    if (!contratoAtivoId) {
      return res.status(400).json({ success: false, error: 'contratoAtivoId é obrigatório' });
    }
    const data = await listTiposPlantaoService(req.user.tenantId, contratoAtivoId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar tipos de plantão',
    });
  }
};

export const createTipoPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { contratoAtivoId, nome, horaInicio, horaFim, cruzaMeiaNoite } = req.body;
    const row = await createTipoPlantaoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      contratoAtivoId,
      nome,
      horaInicio,
      horaFim,
      cruzaMeiaNoite,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao criar tipo de plantão',
    });
  }
};

export const updateTipoPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { id } = req.params;
    const { nome, horaInicio, horaFim, cruzaMeiaNoite } = req.body;
    const row = await updateTipoPlantaoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      id,
      nome,
      horaInicio,
      horaFim,
      cruzaMeiaNoite,
    });
    return res.status(200).json({ success: true, data: row });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar tipo de plantão',
    });
  }
};

export const deleteTipoPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { id } = req.params;
    await deleteTipoPlantaoService(req.user.tenantId, req.user.id, id);
    return res.status(200).json({ success: true, message: 'Tipo removido' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao excluir tipo de plantão',
    });
  }
};

export const listAdicionaisPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const contratoAtivoId = (req.query.contratoAtivoId as string)?.trim();
    if (!contratoAtivoId) {
      return res.status(400).json({ success: false, error: 'contratoAtivoId é obrigatório' });
    }
    const dataInicioStr = req.query.dataInicio ? String(req.query.dataInicio) : undefined;
    const dataFimStr = req.query.dataFim ? String(req.query.dataFim) : undefined;
    const dataInicio = dataInicioStr ? new Date(dataInicioStr) : undefined;
    const dataFim = dataFimStr ? new Date(dataFimStr) : undefined;
    const data = await listAdicionaisPlantaoService({
      tenantId: req.user.tenantId,
      contratoAtivoId,
      dataInicio,
      dataFim,
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar adicionais de plantão',
    });
  }
};

export const upsertAdicionalPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { contratoAtivoId, data, gradeId, percentual } = req.body;
    if (!contratoAtivoId || typeof contratoAtivoId !== 'string') {
      return res.status(400).json({ success: false, error: 'contratoAtivoId é obrigatório' });
    }
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ success: false, error: 'data é obrigatória' });
    }
    if (!gradeId || typeof gradeId !== 'string') {
      return res.status(400).json({ success: false, error: 'gradeId é obrigatório' });
    }
    const nPercentual = Number(percentual);
    if (!Number.isFinite(nPercentual)) {
      return res.status(400).json({ success: false, error: 'percentual inválido' });
    }
    const row = await upsertAdicionalPlantaoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      contratoAtivoId: String(contratoAtivoId).trim(),
      data: new Date(String(data)),
      gradeId: String(gradeId).trim(),
      percentual: nPercentual,
    });
    return res.status(200).json({ success: true, data: row, message: 'Adicional atualizado' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao salvar adicional de plantão',
    });
  }
};

export const removerAdicionalPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const contratoAtivoId = (req.query.contratoAtivoId as string)?.trim();
    const dataStr = req.query.data ? String(req.query.data) : '';
    const gradeId = (req.query.gradeId as string)?.trim();
    if (!contratoAtivoId) {
      return res.status(400).json({ success: false, error: 'contratoAtivoId é obrigatório' });
    }
    if (!dataStr) {
      return res.status(400).json({ success: false, error: 'data é obrigatória' });
    }
    if (!gradeId) {
      return res.status(400).json({ success: false, error: 'gradeId é obrigatório' });
    }
    await removerAdicionalPlantaoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      contratoAtivoId,
      data: new Date(dataStr),
      gradeId,
    });
    return res.status(200).json({ success: true, message: 'Adicional removido' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao remover adicional de plantão',
    });
  }
};

export const getConfigPontoOpcoesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const tenantId = req.user.tenantId;
    const [contratosResult, subgrupos, equipes, contratoSubgrupos] = await Promise.all([
      listContratosAtivosService({ tenantId, page: 1, limit: 500 }),
      listSubgruposService(tenantId),
      listEquipesService(tenantId, null),
      prisma.contratoSubgrupo.findMany({
        where: { tenantId },
        select: { contratoAtivoId: true, subgrupoId: true },
      }),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        contratos: contratosResult.items,
        subgrupos: subgrupos.map((s) => ({
          id: s.id,
          nome: s.nome,
          ativo: s.ativo,
          usaEscala: s.usaEscala,
          usaPonto: s.usaPonto,
        })),
        equipes: equipes.map((e) => ({
          id: e.id,
          nome: e.nome,
          ativo: e.ativo,
          subgrupoId: e.subgrupoId ?? null,
        })),
        contratoSubgrupos,
      },
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar opções',
    });
  }
};

export const getConfigPontoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const contratoId = (req.query.contratoId as string)?.trim();
    const subgrupoId = (req.query.subgrupoId as string)?.trim();
    const equipeId = (req.query.equipeId as string)?.trim() || null;
    if (!contratoId || !subgrupoId) {
      return res.status(400).json({
        success: false,
        error: 'contratoId e subgrupoId são obrigatórios na query',
      });
    }
    const data = await getConfigPontoService(req.user.tenantId, contratoId, subgrupoId, equipeId);
    return res.status(200).json({ success: true, data: data ?? null });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar configuração de ponto',
    });
  }
};

export const setConfigPontoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const {
      contratoId,
      subgrupoId,
      equipeId,
      horasPrevistasMes,
      valorHora,
      valorHoraCobranca,
      valorHoraPorDia,
      valorHoraCobrancaPorDia,
      horarioEntrada,
      horarioSaida,
      toleranciaMinutos,
      latitude,
      longitude,
      raioMetros,
      enderecoPonto,
    } = req.body;
    if (!contratoId || typeof contratoId !== 'string') {
      return res.status(400).json({ success: false, error: 'contratoId é obrigatório' });
    }
    if (!subgrupoId || typeof subgrupoId !== 'string') {
      return res.status(400).json({ success: false, error: 'subgrupoId é obrigatório' });
    }
    const equipeIdTrimmed = equipeId != null && typeof equipeId === 'string' ? equipeId.trim() || null : null;
    const data = await setConfigPontoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      contratoAtivoId: contratoId.trim(),
      subgrupoId: subgrupoId.trim(),
      equipeId: equipeIdTrimmed,
      horasPrevistasMes: horasPrevistasMes != null ? Number(horasPrevistasMes) : null,
      valorHora: valorHora != null ? Number(valorHora) : null,
      valorHoraCobranca: valorHoraCobranca != null ? Number(valorHoraCobranca) : null,
      valorHoraPorDia: valorHoraPorDia ?? null,
      valorHoraCobrancaPorDia: valorHoraCobrancaPorDia ?? null,
      horarioEntrada: horarioEntrada != null && typeof horarioEntrada === 'string' ? horarioEntrada.trim() || null : null,
      horarioSaida: horarioSaida != null && typeof horarioSaida === 'string' ? horarioSaida.trim() || null : null,
      toleranciaMinutos: toleranciaMinutos != null ? Number(toleranciaMinutos) : null,
      latitude: latitude != null && latitude !== '' ? latitude : null,
      longitude: longitude != null && longitude !== '' ? longitude : null,
      raioMetros: raioMetros != null && raioMetros !== '' ? Number(raioMetros) : null,
      enderecoPonto: enderecoPonto != null && typeof enderecoPonto === 'string' ? enderecoPonto.trim() || null : null,
    });
    return res.status(200).json({ success: true, data, message: 'Configuração salva' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao salvar configuração de ponto',
    });
  }
};

export const setValorPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const {
      contratoId,
      subgrupoId,
      equipeId,
      gradeId,
      valorHora,
      valorHoraCobranca,
      valorHoraPorDia,
      valorHoraCobrancaPorDia,
    } = req.body;
    if (!contratoId || typeof contratoId !== 'string') {
      return res.status(400).json({ success: false, error: 'contratoId é obrigatório' });
    }
    if (!subgrupoId || typeof subgrupoId !== 'string') {
      return res.status(400).json({ success: false, error: 'subgrupoId é obrigatório' });
    }
    if (!equipeId || typeof equipeId !== 'string' || !equipeId.trim()) {
      return res.status(400).json({ success: false, error: 'equipeId é obrigatório' });
    }
    if (!gradeId || typeof gradeId !== 'string') {
      return res.status(400).json({ success: false, error: 'gradeId é obrigatório' });
    }
    const data = await setValorPlantaoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      contratoAtivoId: contratoId.trim(),
      subgrupoId: subgrupoId.trim(),
      equipeId: equipeId.trim(),
      gradeId: gradeId.trim(),
      valorHora: valorHora != null ? Number(valorHora) : null,
      valorHoraCobranca: valorHoraCobranca != null ? Number(valorHoraCobranca) : null,
      valorHoraPorDia: valorHoraPorDia ?? undefined,
      valorHoraCobrancaPorDia: valorHoraCobrancaPorDia ?? undefined,
    });
    return res.status(200).json({ success: true, data, message: 'Valor atualizado' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao salvar valor de plantão',
    });
  }
};

export const downloadRegistroPontoFotoAdminController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const registroId = String(req.params.id);
    const { path: filePath, mimeType } = await getFotoCheckinRegistroForAdmin(req.user.tenantId, registroId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    return res.sendFile(filePath);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao obter foto do check-in',
    });
  }
};

export const listRegistrosPontoAdminController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const data = await listRegistrosPontoAdminService(req.user.tenantId, {
      escalaId: req.query.escalaId ? String(req.query.escalaId) : undefined,
      medicoId: req.query.medicoId ? String(req.query.medicoId) : undefined,
      contratoAtivoId: req.query.contratoAtivoId ? String(req.query.contratoAtivoId) : undefined,
      subgrupoId: req.query.subgrupoId ? String(req.query.subgrupoId) : undefined,
      equipeId: req.query.equipeId ? String(req.query.equipeId) : undefined,
      dataInicio: req.query.dataInicio ? String(req.query.dataInicio) : undefined,
      dataFim: req.query.dataFim ? String(req.query.dataFim) : undefined,
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar registros de ponto',
    });
  }
};

export const getMatrizAcessosModulosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await getMatrizAcessosModulosService(req.user.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar matriz de acesso',
    });
  }
};

export const salvarMatrizAcessosModulosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const items: unknown[] = Array.isArray(req.body?.items) ? req.body.items : [];
    const payload = items
      .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item: Record<string, unknown>) => ({
        perfil: item.perfil as UserRole,
        modulo: item.modulo as ModuloSistema,
        permitido: Boolean(item.permitido),
      }))
      .filter(
        (item) =>
          Object.values(UserRole).includes(item.perfil) &&
          Object.values(ModuloSistema).includes(item.modulo)
      );

    const data = await salvarMatrizAcessosModulosService(req.user.tenantId, req.user.id, payload);
    return res.status(200).json({
      success: true,
      data,
      message: 'Permissões de módulos atualizadas com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao salvar matriz de acesso',
    });
  }
};

export const listDocumentosEnviadosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const medicoId = req.query.medicoId ? String(req.query.medicoId) : undefined;
    const data = await listDocumentosEnviadosAdmin(req.user.tenantId, medicoId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar documentos enviados',
    });
  }
};

export const uploadDocumentoEnviadoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
    }
    const medicoId = req.body?.medicoId ? String(req.body.medicoId).trim() : undefined;
    if (!medicoId) {
      return res.status(400).json({ success: false, error: 'Profissional (medicoId) é obrigatório' });
    }
    const titulo = req.body?.titulo != null ? String(req.body.titulo).trim() || null : null;
    const doc = await uploadAndSendDocumento(
      req.user.tenantId,
      req.user.id,
      medicoId,
      file,
      titulo
    );
    return res.status(201).json({ success: true, data: doc, message: 'Documento enviado com sucesso' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao enviar documento',
    });
  }
};

export const deleteDocumentoEnviadoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID do documento é obrigatório' });
    }
    await deleteDocumentoEnviado(req.user.tenantId, id);
    return res.status(200).json({ success: true, message: 'Documento removido' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao remover documento',
    });
  }
};

export const listCadastrosPendentesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await listCadastrosPendentesService(req.user.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar cadastros pendentes',
    });
  }
};

export const getCadastroPendenteDetalheController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const medicoId = req.params.medicoId;
    const data = await getCadastroPendenteDetalheService(req.user.tenantId, medicoId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar cadastro pendente',
    });
  }
};

export const downloadCadastroPendenteDocumentoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { medicoId, documentoId } = req.params;
    const { path: filePath, nomeArquivo, mimeType } = await downloadCadastroPendenteDocumentoService(
      req.user.tenantId,
      medicoId,
      documentoId
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo.replace(/"/g, '\\"')}"`);
    return res.sendFile(filePath);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao baixar documento',
    });
  }
};

export const aprovarCadastroPendenteController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const medicoId = req.params.medicoId;
    const data = await aprovarCadastroPendenteService(req.user.tenantId, req.user.id, medicoId);
    return res.status(200).json({ success: true, data, message: 'Cadastro aprovado' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao aprovar cadastro',
    });
  }
};

export const rejeitarCadastroPendenteController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const medicoId = req.params.medicoId;
    const data = await rejeitarCadastroPendenteService(req.user.tenantId, req.user.id, medicoId);
    return res.status(200).json({ success: true, data, message: 'Cadastro rejeitado' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao rejeitar cadastro',
    });
  }
};
