import { Router } from 'express';
import { ModuloSistema, UserRole } from '@prisma/client';
import { authenticateToken, requireModuleAccess, requireRole } from '../middleware/auth.middleware';
import { uploadPontoCheckinMiddleware } from '../middleware/upload.middleware';
import {
  validateCheckinMultipart,
  requireCheckinFoto,
  validateCheckinSemFoto,
  validateCheckout,
  validateUUIDQuery,
  validateEscalaIdQueryPonto,
  validateUUIDParam,
  validateSolicitarTrocaPlantao,
  validateAceitarTrocaPlantao,
  validatePlantoesColegaTrocaQuery,
  validateMeusPlantoesCalendarioQuery,
} from '../middleware/validation.middleware';
import {
  checkInController,
  checkInSemFotoController,
  checkOutController,
  getMeuDiaPontoController,
  getPainelPontoInicialController,
  downloadFotoCheckinMedicoController,
  listMinhasEscalasController,
  listEquipeColegasController,
  listProximosPlantoesController,
  listMeusPlantoesCalendarioController,
  listMinhasEquipesCalendarioController,
  solicitarTrocaPlantaoController,
  listPlantoesColegaParaTrocaController,
  listMeusPlantoesParaTrocaController,
  listTrocasPlantaoPendentesController,
  aceitarTrocaPlantaoController,
  recusarTrocaPlantaoController,
  canCheckInController,
  getHistoricoPontosMedicoController,
} from '../controllers/ponto.controller';

const router = Router();

router.use(authenticateToken);
router.use(requireRole([UserRole.MEDICO]));
router.use(requireModuleAccess(ModuloSistema.PONTO_ELETRONICO));

router.post(
  '/checkin',
  uploadPontoCheckinMiddleware,
  requireCheckinFoto,
  validateCheckinMultipart,
  checkInController
);
/** Check-in quando a câmera não pode ser usada (motivo obrigatório, auditado). */
router.post('/checkin-sem-foto', validateCheckinSemFoto, checkInSemFotoController);
router.post('/checkout', validateCheckout, checkOutController);
router.get('/meu-dia', getMeuDiaPontoController);
router.get('/painel-inicial', getPainelPontoInicialController);
router.get('/minhas-escalas', listMinhasEscalasController);
router.get('/equipe-colegas', validateUUIDQuery('escalaId'), listEquipeColegasController);
router.get(
  '/plantoes-colega-troca',
  validatePlantoesColegaTrocaQuery,
  listPlantoesColegaParaTrocaController
);
router.get('/meus-plantoes-troca', validateUUIDQuery('escalaId'), listMeusPlantoesParaTrocaController);
router.get('/proximos-plantoes', listProximosPlantoesController);
router.get(
  '/meus-plantoes-calendario',
  validateMeusPlantoesCalendarioQuery,
  listMeusPlantoesCalendarioController
);
router.get('/minhas-equipes-calendario', listMinhasEquipesCalendarioController);
router.post('/solicitar-troca-plantao', validateSolicitarTrocaPlantao, solicitarTrocaPlantaoController);
router.get('/trocas-plantao-pendentes', listTrocasPlantaoPendentesController);
router.post(
  '/trocas-plantao/:id/aceitar',
  validateUUIDParam('id'),
  validateAceitarTrocaPlantao,
  aceitarTrocaPlantaoController
);
router.post('/trocas-plantao/:id/recusar', validateUUIDParam('id'), recusarTrocaPlantaoController);
router.get('/can-checkin', validateEscalaIdQueryPonto, canCheckInController);
router.get('/historico', getHistoricoPontosMedicoController);
router.get('/registros/:id/foto-checkin', validateUUIDParam('id'), downloadFotoCheckinMedicoController);

export default router;
