import { Router } from 'express';
import {
  alocarMedicoEscalaController,
  addContratoEquipeController,
  addContratoSubgrupoController,
  createContratoAtivoController,
  createEscalaController,
  createEscalaPlantaoController,
  replicarEscalaPlantoesMesController,
  createMedicoController,
  getRelatorioProcedimentosMesController,
  deleteEscalaController,
  deleteContratoAtivoController,
  listAdicionaisPlantaoController,
  getConfigPontoController,
  getConfigPontoOpcoesController,
  getValoresPlantaoOpcoesController,
  getValoresPlantaoController,
  listTiposPlantaoController,
  createTipoPlantaoController,
  updateTipoPlantaoController,
  deleteTipoPlantaoController,
  inviteMedicoController,
  listContratoEquipesController,
  listContratoSubgruposController,
  listEscalaMedicosController,
  listEscalaPlantoesController,
  listHistoricoTrocasPlantaoEscalaController,
  listEquipePlantoesController,
  listEquipeEscalasController,
  listEscalasController,
  listRegistrosPontoAdminController,
  downloadRegistroPontoFotoAdminController,
  getMatrizAcessosModulosController,
  salvarMatrizAcessosModulosController,
  listContratosAtivosController,
  listMedicosController,
  listDocusealPendentesController,
  docusealResumoPorEmailsController,
  docusealResendSubmitterController,
  getMedicoDocusealDocumentosController,
  postMedicoDocusealEnviarTemplateController,
  listDocumentosEnviadosController,
  uploadDocumentoEnviadoController,
  deleteDocumentoEnviadoController,
  listCadastrosPendentesController,
  getCadastroPendenteDetalheController,
  downloadCadastroPendenteDocumentoController,
  aprovarCadastroPendenteController,
  rejeitarCadastroPendenteController,
  removerEscalaPlantaoController,
  removerMedicoEscalaController,
  removeContratoEquipeController,
  removeContratoSubgrupoController,
  removerAdicionalPlantaoController,
  setConfigPontoController,
  upsertAdicionalPlantaoController,
  setValorPlantaoController,
  toggleMedicoAtivoController,
  updateEscalaController,
  updateContratoAtivoController,
  updateMedicoController,
  upsertRelatorioProcedimentosMesController,
} from '../controllers/admin.controller';
import {
  addEquipeToEscalaController,
  addMedicoToEquipeController,
  addMedicoToSubgrupoController,
  addSubgrupoToEscalaController,
  createEquipeController,
  createSubgrupoController,
  deleteEquipeController,
  deleteSubgrupoController,
  listEquipeMedicosController,
  listEquipesController,
  listEscalaEquipesController,
  listEscalaSubgruposController,
  listSubgrupoMedicosController,
  listSubgruposController,
  removeEquipeFromEscalaController,
  removeMedicoFromEquipeController,
  removeMedicoFromSubgrupoController,
  removeSubgrupoFromEscalaController,
  updateEquipeController,
  updateSubgrupoController,
} from '../controllers/grupo-equipe.controller';
import { authenticateToken, requireAnyModuleAccess, requireModuleAccess, requireRole } from '../middleware/auth.middleware';
import { uploadDocumentoEnviado } from '../middleware/upload.middleware';
import { ModuloSistema, UserRole } from '@prisma/client';
import { validateUUIDParam, validateCreateEscala, validateUpdateEscala, validateCreateEscalaPlantao, validateReplicarPlantoesMes, validateAlocarMedicoEscala, validateUpsertAdicionalPlantao, validateListAdicionaisPlantao, validateRemoverAdicionalPlantao, validateCreateTipoPlantao, validateUpdateTipoPlantao, validateSetConfigPonto } from '../middleware/validation.middleware';
import blogAdminRoutes from './blog-admin.routes';

const router = Router();

router.use(authenticateToken);
router.use(requireRole([UserRole.MASTER]));

router.get('/medicos', requireModuleAccess(ModuloSistema.MEDICOS), listMedicosController);
// Relatório de procedimentos (Lançamentos do mês): persistência por mês no backend.
// Mantemos apenas autenticação + role MASTER (sem gate por módulo) para evitar "parece que salvou mas some" em outros PCs.
router.get('/relatorios/procedimentos/:mesRef', getRelatorioProcedimentosMesController);
router.put('/relatorios/procedimentos/:mesRef', upsertRelatorioProcedimentosMesController);
router.get(
  '/integrations/docuseal/pending-submissions',
  requireModuleAccess(ModuloSistema.MEDICOS),
  listDocusealPendentesController
);
router.post(
  '/integrations/docuseal/resumo-por-emails',
  requireModuleAccess(ModuloSistema.MEDICOS),
  docusealResumoPorEmailsController
);
router.post(
  '/integrations/docuseal/submitters/:submitterId/resend-email',
  requireModuleAccess(ModuloSistema.MEDICOS),
  docusealResendSubmitterController
);
router.post('/medicos', requireModuleAccess(ModuloSistema.MEDICOS), createMedicoController);
router.put('/medicos/:id', requireModuleAccess(ModuloSistema.MEDICOS), updateMedicoController);
router.patch('/medicos/:id/ativo', requireModuleAccess(ModuloSistema.MEDICOS), toggleMedicoAtivoController);
router.post('/medicos/:id/invite', requireModuleAccess(ModuloSistema.MEDICOS), validateUUIDParam('id'), inviteMedicoController);
router.get(
  '/medicos/:id/docuseal/documentos',
  requireModuleAccess(ModuloSistema.MEDICOS),
  validateUUIDParam('id'),
  getMedicoDocusealDocumentosController
);
router.post(
  '/medicos/:id/docuseal/enviar-template',
  requireModuleAccess(ModuloSistema.MEDICOS),
  validateUUIDParam('id'),
  postMedicoDocusealEnviarTemplateController
);

router.get('/contratos-ativos', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), listContratosAtivosController);
router.post('/contratos-ativos', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), createContratoAtivoController);
router.put('/contratos-ativos/:id', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), updateContratoAtivoController);
router.delete('/contratos-ativos/:id', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), deleteContratoAtivoController);
router.get('/contratos-ativos/:id/subgrupos', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), listContratoSubgruposController);
router.post('/contratos-ativos/:id/subgrupos', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), addContratoSubgrupoController);
router.delete('/contratos-ativos/:id/subgrupos/:subgrupoId', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), removeContratoSubgrupoController);
router.get('/contratos-ativos/:id/equipes', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), listContratoEquipesController);
router.post('/contratos-ativos/:id/equipes', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), addContratoEquipeController);
router.delete('/contratos-ativos/:id/equipes/:equipeId', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), removeContratoEquipeController);

router.get('/escalas', requireModuleAccess(ModuloSistema.ESCALAS), listEscalasController);
router.post('/escalas', requireModuleAccess(ModuloSistema.ESCALAS), validateCreateEscala, createEscalaController);
router.put('/escalas/:id', requireModuleAccess(ModuloSistema.ESCALAS), validateUUIDParam('id'), validateUpdateEscala, updateEscalaController);
router.delete('/escalas/:id', requireModuleAccess(ModuloSistema.ESCALAS), validateUUIDParam('id'), deleteEscalaController);
router.get('/escalas/:id/medicos', requireModuleAccess(ModuloSistema.ESCALAS), listEscalaMedicosController);
router.post(
  '/escalas/:id/medicos',
  requireModuleAccess(ModuloSistema.ESCALAS),
  validateUUIDParam('id'),
  validateAlocarMedicoEscala,
  alocarMedicoEscalaController
);
router.delete(
  '/escalas/:id/medicos/:medicoId',
  requireModuleAccess(ModuloSistema.ESCALAS),
  validateUUIDParam('id'),
  validateUUIDParam('medicoId'),
  removerMedicoEscalaController
);
router.get('/escalas/:id/plantoes', requireModuleAccess(ModuloSistema.ESCALAS), listEscalaPlantoesController);
router.get(
  '/escalas/:id/trocas-plantao-historico',
  requireModuleAccess(ModuloSistema.ESCALAS),
  validateUUIDParam('id'),
  listHistoricoTrocasPlantaoEscalaController
);
router.post(
  '/escalas/:id/plantoes/replicar-mes',
  requireModuleAccess(ModuloSistema.ESCALAS),
  validateUUIDParam('id'),
  validateReplicarPlantoesMes,
  replicarEscalaPlantoesMesController
);
router.post('/escalas/:id/plantoes', requireModuleAccess(ModuloSistema.ESCALAS), validateUUIDParam('id'), validateCreateEscalaPlantao, createEscalaPlantaoController);
router.delete('/escalas/:id/plantoes/:plantaoId', requireModuleAccess(ModuloSistema.ESCALAS), validateUUIDParam('id'), validateUUIDParam('plantaoId'), removerEscalaPlantaoController);

router.get('/valores-plantao/opcoes', requireModuleAccess(ModuloSistema.VALORES_PLANTAO), getValoresPlantaoOpcoesController);
router.get('/valores-plantao', requireAnyModuleAccess([ModuloSistema.VALORES_PLANTAO, ModuloSistema.ESCALAS]), getValoresPlantaoController);
router.put('/valores-plantao', requireModuleAccess(ModuloSistema.VALORES_PLANTAO), setValorPlantaoController);

router.get(
  '/tipos-plantao',
  requireAnyModuleAccess([ModuloSistema.VALORES_PLANTAO, ModuloSistema.ESCALAS]),
  listTiposPlantaoController
);
router.post(
  '/tipos-plantao',
  requireModuleAccess(ModuloSistema.VALORES_PLANTAO),
  validateCreateTipoPlantao,
  createTipoPlantaoController
);
router.put(
  '/tipos-plantao/:id',
  requireModuleAccess(ModuloSistema.VALORES_PLANTAO),
  validateUUIDParam('id'),
  validateUpdateTipoPlantao,
  updateTipoPlantaoController
);
router.delete(
  '/tipos-plantao/:id',
  requireModuleAccess(ModuloSistema.VALORES_PLANTAO),
  validateUUIDParam('id'),
  deleteTipoPlantaoController
);

router.get('/adicionais-plantao', requireAnyModuleAccess([ModuloSistema.VALORES_PLANTAO, ModuloSistema.ESCALAS]), validateListAdicionaisPlantao, listAdicionaisPlantaoController);
router.put('/adicionais-plantao', requireModuleAccess(ModuloSistema.VALORES_PLANTAO), validateUpsertAdicionalPlantao, upsertAdicionalPlantaoController);
router.delete('/adicionais-plantao', requireModuleAccess(ModuloSistema.VALORES_PLANTAO), validateRemoverAdicionalPlantao, removerAdicionalPlantaoController);

router.get('/config-ponto/opcoes', requireModuleAccess(ModuloSistema.PONTO_ELETRONICO), getConfigPontoOpcoesController);
router.get('/config-ponto', requireModuleAccess(ModuloSistema.PONTO_ELETRONICO), getConfigPontoController);
router.put('/config-ponto', requireModuleAccess(ModuloSistema.PONTO_ELETRONICO), validateSetConfigPonto, setConfigPontoController);

router.get('/registros-ponto', requireModuleAccess(ModuloSistema.RELATORIOS), listRegistrosPontoAdminController);
router.get(
  '/registros-ponto/:id/foto-checkin',
  requireModuleAccess(ModuloSistema.RELATORIOS),
  validateUUIDParam('id'),
  downloadRegistroPontoFotoAdminController
);
router.get(
  '/cadastros-pendentes',
  requireModuleAccess(ModuloSistema.AVALIACAO),
  listCadastrosPendentesController
);
router.get(
  '/cadastros-pendentes/:medicoId',
  requireModuleAccess(ModuloSistema.AVALIACAO),
  validateUUIDParam('medicoId'),
  getCadastroPendenteDetalheController
);
router.get(
  '/cadastros-pendentes/:medicoId/documentos/:documentoId/download',
  requireModuleAccess(ModuloSistema.AVALIACAO),
  validateUUIDParam('medicoId'),
  validateUUIDParam('documentoId'),
  downloadCadastroPendenteDocumentoController
);
router.post(
  '/cadastros-pendentes/:medicoId/aprovar',
  requireModuleAccess(ModuloSistema.AVALIACAO),
  validateUUIDParam('medicoId'),
  aprovarCadastroPendenteController
);
router.post(
  '/cadastros-pendentes/:medicoId/rejeitar',
  requireModuleAccess(ModuloSistema.AVALIACAO),
  validateUUIDParam('medicoId'),
  rejeitarCadastroPendenteController
);

router.get('/documentos-enviados', requireModuleAccess(ModuloSistema.ENVIO_DOCUMENTOS), listDocumentosEnviadosController);
router.post('/documentos-enviados', requireModuleAccess(ModuloSistema.ENVIO_DOCUMENTOS), uploadDocumentoEnviado.single('arquivo'), uploadDocumentoEnviadoController);
router.delete('/documentos-enviados/:id', requireModuleAccess(ModuloSistema.ENVIO_DOCUMENTOS), deleteDocumentoEnviadoController);
router.get('/acessos-modulos', requireModuleAccess(ModuloSistema.CONFIGURACOES), getMatrizAcessosModulosController);
router.put('/acessos-modulos', requireModuleAccess(ModuloSistema.CONFIGURACOES), salvarMatrizAcessosModulosController);
router.get('/subgrupos', requireModuleAccess(ModuloSistema.MEDICOS), listSubgruposController);
router.post('/subgrupos', requireModuleAccess(ModuloSistema.MEDICOS), createSubgrupoController);
router.put('/subgrupos/:id', requireModuleAccess(ModuloSistema.MEDICOS), updateSubgrupoController);
router.delete('/subgrupos/:id', requireModuleAccess(ModuloSistema.MEDICOS), deleteSubgrupoController);
router.get('/subgrupos/:id/medicos', requireModuleAccess(ModuloSistema.MEDICOS), listSubgrupoMedicosController);
router.post('/subgrupos/:id/medicos', requireModuleAccess(ModuloSistema.MEDICOS), addMedicoToSubgrupoController);
router.delete('/subgrupos/:id/medicos/:medicoId', requireModuleAccess(ModuloSistema.MEDICOS), removeMedicoFromSubgrupoController);
router.get('/equipes', requireModuleAccess(ModuloSistema.MEDICOS), listEquipesController);
router.post('/equipes', requireModuleAccess(ModuloSistema.MEDICOS), createEquipeController);
router.put('/equipes/:id', requireModuleAccess(ModuloSistema.MEDICOS), updateEquipeController);
router.delete('/equipes/:id', requireModuleAccess(ModuloSistema.MEDICOS), deleteEquipeController);
router.get('/equipes/:id/medicos', requireModuleAccess(ModuloSistema.MEDICOS), listEquipeMedicosController);
router.get('/equipes/:id/plantoes', requireModuleAccess(ModuloSistema.ESCALAS), listEquipePlantoesController);
router.get('/equipes/:id/escalas', requireModuleAccess(ModuloSistema.ESCALAS), listEquipeEscalasController);
router.post('/equipes/:id/medicos', requireModuleAccess(ModuloSistema.MEDICOS), addMedicoToEquipeController);
router.delete('/equipes/:id/medicos/:medicoId', requireModuleAccess(ModuloSistema.MEDICOS), removeMedicoFromEquipeController);
router.get('/escalas/:id/subgrupos', requireModuleAccess(ModuloSistema.ESCALAS), listEscalaSubgruposController);
router.post('/escalas/:id/subgrupos', requireModuleAccess(ModuloSistema.ESCALAS), addSubgrupoToEscalaController);
router.delete('/escalas/:id/subgrupos/:subgrupoId', requireModuleAccess(ModuloSistema.ESCALAS), removeSubgrupoFromEscalaController);
router.get('/escalas/:id/equipes', requireModuleAccess(ModuloSistema.ESCALAS), listEscalaEquipesController);
router.post('/escalas/:id/equipes', requireModuleAccess(ModuloSistema.ESCALAS), addEquipeToEscalaController);
router.delete('/escalas/:id/equipes/:equipeId', requireModuleAccess(ModuloSistema.ESCALAS), removeEquipeFromEscalaController);

router.use('/blog', blogAdminRoutes);

export default router;
