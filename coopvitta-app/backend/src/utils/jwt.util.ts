import jwt from 'jsonwebtoken';
import env from '../config/env';
import { UserRole } from '@prisma/client';

export interface TokenPayload {
  id: string;
  role: UserRole;
  tenantId: string;
  type: 'access' | 'refresh';
}

/**
 * Gera access token e refresh token
 */
export async function generateTokens(
  userId: string,
  role: UserRole,
  tenantId: string
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const accessToken = jwt.sign(
    { id: userId, role, tenantId, type: 'access' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    { id: userId, role, tenantId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );

  return { accessToken, refreshToken };
}

/**
 * Verifica e decodifica access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    if (decoded.type !== 'access') {
      throw new Error('Token inválido');
    }
    return decoded;
  } catch (error) {
    throw new Error('Token inválido ou expirado');
  }
}

/**
 * Verifica e decodifica refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
    if (decoded.type !== 'refresh') {
      throw new Error('Token inválido');
    }
    return decoded;
  } catch (error) {
    throw new Error('Token inválido ou expirado');
  }
}
