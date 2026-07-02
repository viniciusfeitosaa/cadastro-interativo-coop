import { PrismaClient } from '@prisma/client';

function parseDatabaseUrl(raw: string): { port: number; isSupabasePoolerHost: boolean } {
  if (!raw) return { port: 5432, isSupabasePoolerHost: false };
  try {
    const normalized = raw.replace(/^postgresql:\/\//i, 'postgres://');
    const u = new URL(normalized);
    const port = parseInt(u.port || '5432', 10);
    const host = (u.hostname || '').toLowerCase();
    const isSupabasePoolerHost = host.includes('pooler.supabase.com');
    return { port, isSupabasePoolerHost };
  } catch {
    return {
      port: /:6543\b/.test(raw) ? 6543 : 5432,
      isSupabasePoolerHost: /pooler\.supabase\.com/i.test(raw),
    };
  }
}

const dbUrlRaw = process.env.DATABASE_URL || '';
const dbParsed = parseDatabaseUrl(dbUrlRaw);
/** Session pooler Supabase (porta 5432): 1 conexão — filas enormes no dashboard (várias dezenas de queries em paralelo). */
const isSupabaseSessionPool = dbParsed.isSupabasePoolerHost && dbParsed.port === 5432;
/** Transaction pooler (porta 6543): Prisma pode usar várias conexões; exige `pgbouncer=true` na URL. */
const isSupabaseTransactionPool = dbParsed.isSupabasePoolerHost && dbParsed.port === 6543;

const explicitPool = parseInt(process.env.DATABASE_POOL_SIZE || '', 10);

let resolvedPool: number;
if (Number.isFinite(explicitPool) && explicitPool > 0) {
  resolvedPool = explicitPool;
} else if (isSupabaseSessionPool) {
  resolvedPool = 1;
} else if (isSupabaseTransactionPool) {
  resolvedPool = process.env.NODE_ENV === 'production' ? 10 : 5;
} else {
  resolvedPool = process.env.NODE_ENV === 'production' ? 10 : 3;
}

/** Session pooler não suporta várias conexões Prisma; ignora DATABASE_POOL_SIZE > 1. */
let connectionLimit = Math.min(Math.max(1, resolvedPool), 20);
if (isSupabaseSessionPool) {
  connectionLimit = 1;
}
const CONNECTION_LIMIT = connectionLimit;

const SLOW_QUERY_MS = Math.max(1, parseInt(process.env.PRISMA_SLOW_QUERY_MS || '', 10) || 250);

/** Garante connection_limit, pool_timeout e (Supabase :6543) pgbouncer=true na URL. */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || '';
  if (!url) return url;
  let u = url
    .replace(/connection_limit=\d+/g, `connection_limit=${CONNECTION_LIMIT}`)
    .replace(/pool_timeout=\d+/g, 'pool_timeout=30');
  if (!u.includes('connection_limit=')) u += (u.includes('?') ? '&' : '?') + `connection_limit=${CONNECTION_LIMIT}`;
  if (!u.includes('pool_timeout=')) u += (u.includes('?') ? '&' : '?') + 'pool_timeout=30';
  if (isSupabaseTransactionPool && !/pgbouncer=true/i.test(u)) {
    u += (u.includes('?') ? '&' : '?') + 'pgbouncer=true';
  }
  return u;
}

// Singleton do Prisma Client
const prismaClientSingleton = () => {
  const client = new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    // Log de cada SQL no terminal deixa o dev 5–20× mais lento; use PRISMA_LOG_QUERIES=1 só ao depurar.
    log:
      process.env.PRISMA_LOG_QUERIES === '1'
        ? ['query', 'error', 'warn']
        : process.env.NODE_ENV === 'development'
          ? ['error', 'warn']
          : ['error'],
  });

  const queryTimeoutMs = Math.max(
    1000,
    parseInt(process.env.PRISMA_QUERY_TIMEOUT_MS || '10000', 10)
  );
  if (process.env.SKIP_PRISMA_QUERY_TIMEOUT !== '1') {
    client.$use(async (params, next) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Query timeout (${queryTimeoutMs}ms): ${params.model}.${params.action}`)),
          queryTimeoutMs
        );
      });
      try {
        return await Promise.race([next(params), timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    });
  }

  // Logar queries lentas (instrumentação para reduzir “delay” percebido no app).
  if (process.env.PRISMA_LOG_SLOW_QUERIES === '1') {
    client.$use(async (params, next) => {
      const start = Date.now();
      try {
        return await next(params);
      } finally {
        const ms = Date.now() - start;
        if (ms >= SLOW_QUERY_MS) {
          // Não loga args/values (pode conter dados sensíveis). Só modelo/ação/tempo.
          console.warn(`[Prisma] Slow query ${ms}ms`, { model: params.model, action: params.action });
        }
      }
    });
  }

  const poolerHint = isSupabaseSessionPool
    ? ' — AVISO: Session pooler (:5432) = 1 conexão; queries paralelas enfileiram (dashboard lento). Use Transaction pooler porta 6543 + pgbouncer=true (Settings → Database no Supabase).'
    : isSupabaseTransactionPool
      ? ' (Supabase Transaction pooler :6543)'
      : '';
  console.log(`[DB] Prisma connection_limit=${CONNECTION_LIMIT}${poolerHint}`);
  if (isSupabaseSessionPool) {
    console.warn(
      '[DB] Dashboard / medico fazem Promise.all com muitas queries. Com connection_limit=1 o tempo vira a soma das filas. Corrija DATABASE_URL para o host pooler porta 6543 (Transaction mode).'
    );
  }

  return client;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

/**
 * Após `prisma generate`, o singleton em memória pode ficar desatualizado (delegate ausente).
 * Recria o client se o modelo esperado não existir (evita "Cannot read properties of undefined (reading 'findMany')").
 */
function resolvePrismaClient(): PrismaClient {
  let client = globalThis.prismaGlobal ?? prismaClientSingleton();
  const delegate = (client as unknown as { notificacaoMedico?: { findMany: unknown } }).notificacaoMedico;
  if (typeof delegate?.findMany !== 'function') {
    void client.$disconnect().catch(() => {});
    client = prismaClientSingleton();
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Prisma] Cliente recriado (schema mudou). Reinicie o servidor após `prisma generate` se o aviso persistir.');
    }
  }
  globalThis.prismaGlobal = client;
  return client;
}

export const prisma = resolvePrismaClient();

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

/**
 * Garante colunas usadas por ponto/repasse/relatórios (schema Prisma vs DB legado sem `migrate deploy`).
 * Idempotente (IF NOT EXISTS). Falha silenciosa com log se o usuário do banco não tiver permissão de DDL.
 */
export async function ensureCriticalPontoSchemaPatches(): Promise<void> {
  if (process.env.SKIP_AUTO_SCHEMA_PATCH === '1') return;
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "escala_plantoes" ADD COLUMN IF NOT EXISTS "horas_turno_snapshot" DECIMAL(10,4)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "registros_ponto" ADD COLUMN IF NOT EXISTS "repasse_valor_congelado" DECIMAL(12,2)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "config_ponto_eletronico" ADD COLUMN IF NOT EXISTS "valor_hora_por_dia" JSONB`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "config_ponto_eletronico" ADD COLUMN IF NOT EXISTS "valor_hora_cobranca_por_dia" JSONB`
    );
    if (process.env.NODE_ENV === 'development') {
      console.log('[DB] Colunas críticas ponto/repasse alinhadas ao schema.');
    }
  } catch (e) {
    console.warn(
      '[DB] Patch opcional de colunas (ponto/repasse) não aplicado:',
      (e as Error)?.message ?? e
    );
  }
}

/** Conecta ao banco com retry (útil para Render + Supabase: cold start / rede). */
export async function connectDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.$connect();
      await ensureCriticalPontoSchemaPatches();
      console.log('✅ Conectado ao banco de dados PostgreSQL');
      return;
    } catch (error) {
      console.error(`❌ Tentativa ${attempt}/${MAX_RETRIES} de conexão ao banco:`, (error as Error)?.message ?? error);
      if (attempt === MAX_RETRIES) throw error;
      console.log(`⏳ Nova tentativa em ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

// Função para desconectar do banco
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    console.log('✅ Desconectado do banco de dados');
  } catch (error) {
    console.error('❌ Erro ao desconectar do banco de dados:', error);
  }
}
