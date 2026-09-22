import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import {
  getFormularioPublicoController,
  submitFormularioPublicoController,
} from '../controllers/formulario.controller';
import { uploadFormularioResposta } from '../middleware/upload.middleware';
import { getRedisClient } from '../config/redis';
import { clientIpKey } from '../middleware/rate-limit.middleware';

const router = Router();

function formularioSubmitStore() {
  const redis = getRedisClient();
  if (!redis) return undefined;
  return new RedisStore({
    prefix: 'rl:formulario-submit:',
    sendCommand: (...args: string[]) =>
      redis.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
  });
}

/** Limite alto: muitos candidatos partilham CGNAT (mesmo IP de operadora). */
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(50, parseInt(process.env.RATE_LIMIT_FORMULARIO_SUBMIT_MAX || '200', 10)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  store: formularioSubmitStore(),
  message: {
    success: false,
    error:
      'Muitos envios a partir desta rede. Aguarde alguns minutos e tente novamente. Se o problema continuar, use outra conexão (dados móveis/Wi‑Fi).',
  },
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
