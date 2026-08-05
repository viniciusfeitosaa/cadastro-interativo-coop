import { Router, type Request, type Response } from 'express';
import { handleEvolutionMessagesUpsert } from '../services/whatsapp-menu.service';

const router = Router();

/**
 * Webhook Evolution API (eventos como MESSAGES_UPSERT).
 * Evolution chama esta rota sem autenticação; garantimos idempotência via state/Redis.
 */
router.post('/evolution', async (req: Request, res: Response) => {
  try {
    await handleEvolutionMessagesUpsert(req.body);
  } catch (err) {
    // Não propagar erro para o Evolution; senão ele pode retry infinito.
    console.error('[whatsapp-menu] webhook erro:', err);
  }
  return res.status(200).json({ ok: true });
});

export default router;

