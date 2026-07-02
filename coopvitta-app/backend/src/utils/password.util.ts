import bcrypt from 'bcryptjs';
import env from '../config/env';

/** OWASP: BCrypt com custo ≥ 12 (Argon2id seria alternativa; BCrypt já atende). */
const SALT_ROUNDS = Math.max(12, parseInt(env.BCRYPT_ROUNDS, 10) || 12);

/**
 * Gera hash da senha
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compara senha com hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
