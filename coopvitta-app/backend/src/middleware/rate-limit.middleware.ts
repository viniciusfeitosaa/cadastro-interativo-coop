import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';

function buildStore(prefix: string) {
  const redis = getRedisClient();
  if (!redis) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) =>
      redis.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
  });
}

function createLimiter(prefix: string, overrides: Partial<Options>): RateLimitRequestHandler {
  const windowMs = overrides.windowMs ?? 60_000;
  const max = overrides.max ?? 100;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Muitas requisições. Aguarde um momento e tente novamente.',
    },
    store: buildStore(prefix),
    ...overrides,
  });
}

/** Limite global /api — janela longa, teto alto (dashboard paralelo). */
export function globalApiLimiter(windowMs: number, max: number): RateLimitRequestHandler {
  return createLimiter('global', {
    windowMs,
    max,
    message: {
      success: false,
      error: 'Muitas requisições deste IP, tente novamente mais tarde.',
    },
  });
}

/** Rotas sensíveis: 100 req/min por IP (login, cadastro, reset). */
export const authStrictLimiter = createLimiter('auth', {
  windowMs: 60_000,
  max: Math.max(10, parseInt(process.env.RATE_LIMIT_AUTH_MAX_PER_MIN || '100', 10)),
});

/** Leads / formulários públicos. */
export const publicFormLimiter = createLimiter('public-form', {
  windowMs: 60_000,
  max: Math.max(5, parseInt(process.env.RATE_LIMIT_PUBLIC_FORM_MAX_PER_MIN || '30', 10)),
});
