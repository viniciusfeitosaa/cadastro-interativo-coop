import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { publicFormLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.post(
  '/',
  publicFormLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 200 }),
    body('role').optional().trim().isLength({ max: 200 }),
    body('institution').optional().trim().isLength({ max: 200 }),
    body('city').optional().trim().isLength({ max: 200 }),
    body('whatsapp').optional().trim().isLength({ max: 30 }),
    body('source').optional().trim().isLength({ max: 100 }),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const payload = {
      name: req.body.name,
      role: req.body.role,
      institution: req.body.institution,
      city: req.body.city,
      whatsapp: req.body.whatsapp,
      source: req.body.source || 'landing',
      at: new Date().toISOString(),
    };

    console.log('[LEAD]', JSON.stringify(payload));

    return res.status(201).json({
      success: true,
      message: 'Recebemos seu contato. Nossa equipe entrará em breve.',
    });
  }
);

export default router;
