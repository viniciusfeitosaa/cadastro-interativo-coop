import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getFormularioPublicoController,
  submitFormularioPublicoController,
} from '../controllers/formulario.controller';
import { uploadFormularioResposta } from '../middleware/upload.middleware';

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados envios. Tente novamente mais tarde.' },
});

router.get('/:slug', getFormularioPublicoController);
router.post(
  '/:slug/respostas',
  submitLimiter,
  (req, res, next) => {
    uploadFormularioResposta.single('curriculo')(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'Erro no upload';
        res.status(400).json({ success: false, error: msg });
        return;
      }
      next();
    });
  },
  submitFormularioPublicoController
);

export default router;
