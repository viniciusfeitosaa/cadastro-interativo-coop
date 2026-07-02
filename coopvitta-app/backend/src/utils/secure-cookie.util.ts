import type { CookieOptions } from 'express';
import env from '../config/env';

const isProd = env.NODE_ENV === 'production';

/** Opções seguras para cookies de sessão (caso a app passe a usá-los). Auth atual: JWT no header Authorization. */
export function secureCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: maxAgeMs,
    path: '/',
  };
}
