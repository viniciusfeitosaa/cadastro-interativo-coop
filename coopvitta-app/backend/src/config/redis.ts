import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL?.trim() || '';

let client: Redis | null = null;

/** Cliente Redis partilhado (rate limit + filas). Null se REDIS_URL não configurado. */
export function getRedisClient(): Redis | null {
  if (!REDIS_URL) return null;
  if (!client) {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    client.on('error', (err) => {
      console.error('[redis] erro:', err.message);
    });
  }
  return client;
}

export async function connectRedis(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn('[redis] REDIS_URL não definido — rate limit em memória; filas desativadas.');
    return false;
  }
  try {
    if (redis.status === 'wait') await redis.connect();
    await redis.ping();
    console.log('[redis] conectado');
    return true;
  } catch (err) {
    console.error('[redis] falha ao conectar:', (err as Error).message);
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
