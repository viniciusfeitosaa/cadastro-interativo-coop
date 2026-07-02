import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  deleteSelfAccountController,
  getPerfilController,
  updatePerfilController,
  listMeusDocumentosController,
  downloadMedicoDocumentoPerfilController,
  downloadDocumentoEnviadoController,
  confirmarCienciaDocumentoEnviadoController,
  listNotificacoesMedicoController,
  marcarNotificacaoLidaMedicoController,
  marcarTodasNotificacoesLidasMedicoController,
  getDashboardMedicoController,
  listVagasMedicoController,
  createVagaMedicoController,
  listMinhasPublicadasVagasController,
  getCandidatosVagaController,
  patchStatusCandidatoVagaController,
  postInteresseVagaController,
  deleteInteresseVagaController,
  deleteVagaMedicoController,
} from '../controllers/medico.controller';
import { UserRole } from '@prisma/client';
import { authenticateToken, requireModuleAccess, requireRole } from '../middleware/auth.middleware';
import {
  validateCreateVaga,
  validateStatusCandidatoVaga,
  validateDeleteSelfAccount,
  validateUpdatePerfil,
  validateUUIDParam,
} from '../middleware/validation.middleware';
import { uploadPerfilDocumentos } from '../middleware/upload.middleware';
import { DOCUMENTOS_PERFIL_FIELDS } from '../constants/documentos.const';
import { ModuloSistema } from '@prisma/client';

const router = Router();

/** Limite extra em mutações de vagas (além do rate limit global em /api). */
const vagasMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 45,
  message: { success: false, error: 'Muitas ações em vagas. Aguarde um instante.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const deleteAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Muitas tentativas de exclusão de conta. Tente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// GET /api/medico/perfil
router.get('/perfil', requireModuleAccess(ModuloSistema.PERFIL), getPerfilController);
router.get(
  '/perfil/documentos/:docId/download',
  requireModuleAccess(ModuloSistema.PERFIL),
  validateUUIDParam('docId'),
  downloadMedicoDocumentoPerfilController
);
// Documentos enviados pelo Master para o profissional
router.get('/documentos-enviados', requireModuleAccess(ModuloSistema.PERFIL), listMeusDocumentosController);
router.get(
  '/documentos-enviados/:id/download',
  requireModuleAccess(ModuloSistema.PERFIL),
  validateUUIDParam('id'),
  downloadDocumentoEnviadoController
);
router.post(
  '/documentos-enviados/:id/confirmar-ciencia',
  requireModuleAccess(ModuloSistema.PERFIL),
  validateUUIDParam('id'),
  confirmarCienciaDocumentoEnviadoController
);

router.get('/notificacoes', requireRole([UserRole.MEDICO]), listNotificacoesMedicoController);
router.patch(
  '/notificacoes/:id/lida',
  requireRole([UserRole.MEDICO]),
  validateUUIDParam('id'),
  marcarNotificacaoLidaMedicoController
);
router.post(
  '/notificacoes/marcar-todas-lidas',
  requireRole([UserRole.MEDICO]),
  marcarTodasNotificacoesLidasMedicoController
);

router.get(
  '/dashboard',
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.DASHBOARD),
  getDashboardMedicoController
);

router.get(
  '/vagas/minhas-publicadas',
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.VAGAS),
  listMinhasPublicadasVagasController
);
router.get(
  '/vagas',
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.VAGAS),
  listVagasMedicoController
);
router.get(
  '/vagas/:vagaId/candidatos',
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.VAGAS),
  validateUUIDParam('vagaId'),
  getCandidatosVagaController
);
router.patch(
  '/vagas/:vagaId/candidatos/:candidatoMedicoId',
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.VAGAS),
  vagasMutationLimiter,
  validateUUIDParam('vagaId'),
  validateUUIDParam('candidatoMedicoId'),
  validateStatusCandidatoVaga,
  patchStatusCandidatoVagaController
);
router.post(
  '/vagas/:vagaId/interesse',
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.VAGAS),
  vagasMutationLimiter,
  validateUUIDParam('vagaId'),
  postInteresseVagaController
);
router.delete(
  '/vagas/:vagaId/interesse',
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.VAGAS),
  vagasMutationLimiter,
  validateUUIDParam('vagaId'),
  deleteInteresseVagaController
);
router.delete(
  '/vagas/:vagaId',
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.VAGAS),
  vagasMutationLimiter,
  validateUUIDParam('vagaId'),
  deleteVagaMedicoController
);
router.post(
  '/vagas',
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.VAGAS),
  vagasMutationLimiter,
  validateCreateVaga,
  createVagaMedicoController
);

const parseEspecialidadesJson = (req: any, _res: any, next: () => void) => {
  if (typeof req.body?.especialidades === 'string') {
    try {
      req.body.especialidades = JSON.parse(req.body.especialidades);
    } catch {
      req.body.especialidades = [];
    }
  }
  next();
};

router.put(
  '/perfil',
  uploadPerfilDocumentos.fields(DOCUMENTOS_PERFIL_FIELDS.map((name) => ({ name, maxCount: 1 }))),
  parseEspecialidadesJson,
  validateUpdatePerfil,
  requireModuleAccess(ModuloSistema.PERFIL),
  updatePerfilController
);

router.delete(
  '/conta',
  deleteAccountLimiter,
  requireRole([UserRole.MEDICO]),
  requireModuleAccess(ModuloSistema.PERFIL),
  validateDeleteSelfAccount,
  deleteSelfAccountController
);

export default router;
