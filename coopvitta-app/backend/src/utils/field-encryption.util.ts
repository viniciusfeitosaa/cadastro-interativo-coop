import crypto from 'crypto';
import env from '../config/env';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey(): Buffer | null {
  const raw = env.FIELD_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, raw.length === 64 ? 'hex' : 'base64');
  if (key.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY deve ter 32 bytes (hex 64 chars ou base64).');
  }
  return key;
}

/** Criptografa texto sensível em repouso (AES-256-GCM). Retorna null se chave não configurada. */
export function encryptField(plain: string): string | null {
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/** Descriptografa valor produzido por encryptField. */
export function decryptField(payload: string): string {
  const key = getKey();
  if (!key) throw new Error('FIELD_ENCRYPTION_KEY não configurada.');
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Payload criptografado inválido.');
  }
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function isFieldEncryptionEnabled(): boolean {
  return Boolean(env.FIELD_ENCRYPTION_KEY?.trim());
}
