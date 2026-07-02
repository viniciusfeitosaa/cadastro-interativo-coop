import type { Request, Response, NextFunction } from 'express';

const SKIP_KEYS = new Set([
  'password',
  'confirmPassword',
  'senha',
  'senhaHash',
  'token',
  'refreshToken',
]);

/** Remove null bytes e tags script óbvias em strings do body JSON (camada extra além do express-validator). */
function sanitizeValue(key: string, value: unknown): unknown {
  if (SKIP_KEYS.has(key)) return value;
  if (typeof value === 'string') {
    return value
      .replace(/\0/g, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => sanitizeValue(String(i), item));
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = sanitizeValue(k, v);
  }
  return out;
}

export function sanitizeBodyMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeObject(req.body as Record<string, unknown>);
  }
  next();
}
