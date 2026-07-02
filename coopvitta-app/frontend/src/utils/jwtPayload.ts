/**
 * Decodifica o payload de um JWT (sem verificar assinatura).
 * Uso no cliente: apenas para alinhar UI ao token já validado pelo backend nas APIs.
 */
export function decodeJwtPayloadUnsafe<T extends Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const json = atob(padded);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
