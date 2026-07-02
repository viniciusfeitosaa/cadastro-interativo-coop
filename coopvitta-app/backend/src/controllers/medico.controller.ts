import { Request, Response } from 'express';
import {
  deleteSelfAccountService,
  getPerfilService,
  getMedicoDocumentoPerfilForDownload,
  updatePerfilService,
} from '../services/medico.service';
import {
  listMeusDocumentos,
  getDocumentoForDownload,
  confirmarCienciaDocumentoEnviado,
} from '../services/documentosenviados.service';
import {
  listNotificacoesMedicoService,
  marcarNotificacaoLidaService,
  marcarTodasNotificacoesLidasService,
} from '../services/notificacao-medico.service';
import {
  atualizarStatusInteresseCandidato,
  createVagaMedico,
  excluirVagaPublicada,
  listarCandidatosVaga,
  listMinhasVagasPublicadas,
  listVagasAtivasParaMedico,
  registrarInteresseVaga,
  removerInteresseVaga,
} from '../services/vaga.service';
import { getDashboardMedicoService } from '../services/dashboard-medico.service';

export const getPerfilController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!medicoId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    const perfil = await getPerfilService(medicoId, tenantId);

    return res.status(200).json({
      success: true,
      data: perfil,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao buscar perfil',
    });
  }
};

export const deleteSelfAccountController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { senha } = req.body as { senha: string };
    const result = await deleteSelfAccountService(medicoId, tenantId, senha, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao excluir conta',
    });
  }
};

export const updatePerfilController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!medicoId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const perfil = await updatePerfilService(medicoId, tenantId, req.body, files);

    return res.status(200).json({
      success: true,
      data: perfil,
      message: 'Perfil atualizado com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar perfil',
    });
  }
};

export const listMeusDocumentosController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await listMeusDocumentos(medicoId, tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar documentos',
    });
  }
};

export const downloadMedicoDocumentoPerfilController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const docId = req.params.docId;
    if (!docId) {
      return res.status(400).json({ success: false, error: 'ID do documento é obrigatório' });
    }
    const { path: filePath, nomeArquivo, mimeType } = await getMedicoDocumentoPerfilForDownload(
      medicoId,
      tenantId,
      docId
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

export const downloadDocumentoEnviadoController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID do documento é obrigatório' });
    }
    const { path: filePath, nomeArquivo, mimeType } = await getDocumentoForDownload(medicoId, tenantId, id);
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

export const confirmarCienciaDocumentoEnviadoController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID do documento é obrigatório' });
    }
    const data = await confirmarCienciaDocumentoEnviado(medicoId, tenantId, id);
    return res.status(200).json({
      success: true,
      data,
      message: data.jaRegistrado ? 'Ciência já estava registrada.' : 'Ciência registrada com sucesso.',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao confirmar ciência',
    });
  }
};

export const listNotificacoesMedicoController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const limit = req.query.limit ? Number(req.query.limit) : 40;
    const data = await listNotificacoesMedicoService(tenantId, medicoId, limit);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar notificações',
    });
  }
};

export const marcarNotificacaoLidaMedicoController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const id = String(req.params.id);
    await marcarNotificacaoLidaService(tenantId, medicoId, id);
    return res.status(200).json({ success: true, message: 'Notificação marcada como lida' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar notificação',
    });
  }
};

export const marcarTodasNotificacoesLidasMedicoController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    await marcarTodasNotificacoesLidasService(tenantId, medicoId);
    return res.status(200).json({ success: true, message: 'Notificações marcadas como lidas' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar notificações',
    });
  }
};

export const listVagasMedicoController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const items = await listVagasAtivasParaMedico(tenantId, medicoId);
    return res.status(200).json({
      success: true,
      data: {
        items,
        mensagem:
          items.length === 0
            ? 'Nenhuma vaga ativa no momento. Em Anunciar você pode publicar uma oportunidade.'
            : null,
      },
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar vagas',
    });
  }
};

export const getDashboardMedicoController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await getDashboardMedicoService(tenantId, medicoId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar dashboard',
    });
  }
};

export const listMinhasPublicadasVagasController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const items = await listMinhasVagasPublicadas(tenantId, medicoId);
    return res.status(200).json({ success: true, data: { items } });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar suas publicações',
    });
  }
};

export const getCandidatosVagaController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const vagaId = req.params.vagaId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const items = await listarCandidatosVaga(tenantId, medicoId, vagaId);
    return res.status(200).json({ success: true, data: { items } });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar candidatos',
    });
  }
};

export const patchStatusCandidatoVagaController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { vagaId, candidatoMedicoId } = req.params;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const status = req.body.status as 'ACEITO' | 'RECUSADO';
    const data = await atualizarStatusInteresseCandidato(tenantId, medicoId, vagaId, candidatoMedicoId, status);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar candidato',
    });
  }
};

export const postInteresseVagaController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const vagaId = req.params.vagaId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await registrarInteresseVaga(tenantId, medicoId, vagaId);
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao registrar interesse',
    });
  }
};

export const deleteInteresseVagaController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const vagaId = req.params.vagaId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    await removerInteresseVaga(tenantId, medicoId, vagaId);
    return res.status(200).json({ success: true, message: 'Interesse removido' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao remover interesse',
    });
  }
};

export const deleteVagaMedicoController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const vagaId = req.params.vagaId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    await excluirVagaPublicada(tenantId, medicoId, vagaId);
    return res.status(200).json({ success: true, message: 'Vaga excluída' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao excluir vaga',
    });
  }
};

export const createVagaMedicoController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const body = req.body;
    const valorACombinar = body.valorACombinar === true;
    const data = await createVagaMedico(tenantId, medicoId, {
      tipoAtendimento: body.tipoAtendimento,
      setor: body.setor,
      valorACombinar,
      valorCentavos: valorACombinar ? null : body.valorCentavos ?? null,
      valorLiquidoBruto: valorACombinar ? null : body.valorLiquidoBruto ?? null,
      pagamento: body.pagamento,
      quantidadeVagas: Number(body.quantidadeVagas),
      prazoPublicacaoDias: Number(body.prazoPublicacaoDias),
      categoriaProfissional: body.categoriaProfissional || 'MEDICO',
      diasVaga: body.diasVaga,
      descricao: body.descricao,
      confirmacaoResponsavel: body.confirmacaoResponsavel === true,
    });
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao publicar vaga',
    });
  }
};
