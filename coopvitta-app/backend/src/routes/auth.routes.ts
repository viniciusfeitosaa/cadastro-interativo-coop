import { Router } from 'express';
import {
  acceptInviteController,
  esqueciSenhaController,
  getMeModulosAcessoController,
  loginController,
  loginMasterController,
  loginMedicoController,
  previewResetEmailController,
  redefinirSenhaController,
  registerPublicController,
} from '../controllers/auth.controller';
import {
  validateAcceptInvite,
  validateEmailLogin,
  validateEsqueciSenha,
  validateLogin,
  validateMasterLogin,
  validateMedicoLogin,
  validateRedefinirSenha,
  validateRegisterMedico,
} from '../middleware/validation.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { maybeRegisterPublicUploadMiddleware } from '../middleware/upload.middleware';
import { authStrictLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.post('/login', authStrictLimiter, validateEmailLogin, loginController);
router.post('/login-medico', authStrictLimiter, validateMedicoLogin, loginMedicoController);
router.post('/login-master', authStrictLimiter, validateMasterLogin, loginMasterController);
router.post('/accept-invite', authStrictLimiter, validateAcceptInvite, acceptInviteController);
router.post('/esqueci-senha', authStrictLimiter, validateEsqueciSenha, esqueciSenhaController);
router.post('/redefinir-senha', authStrictLimiter, validateRedefinirSenha, redefinirSenhaController);
router.get('/preview-reset-email', previewResetEmailController);
router.post('/register', authStrictLimiter, maybeRegisterPublicUploadMiddleware, validateRegisterMedico, registerPublicController);
router.get('/modulos-acesso', authenticateToken, getMeModulosAcessoController);

// Compatibilidade explícita para clientes legados CPF/CRM
router.post('/login-legacy', validateLogin, loginMedicoController);

export default router;
