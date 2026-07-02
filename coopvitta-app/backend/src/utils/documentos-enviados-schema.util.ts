import { prisma } from '../config/database';

/** Cache por processo: evita ir à information_schema em cada pedido. */
let aceitoEmColumnCache: boolean | undefined;

/**
 * Indica se a coluna `aceito_em` existe em `documentos_enviados` (migração aplicada).
 * Em bases antigas sem migração, Prisma falha ao referenciar o campo — usamos isto para
 * escolher o `select` e evitar 500 até `prisma migrate deploy`.
 */
export async function documentosEnviadosHasAceitoEmColumn(): Promise<boolean> {
  if (aceitoEmColumnCache !== undefined) return aceitoEmColumnCache;
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'documentos_enviados'
          AND column_name = 'aceito_em'
      ) AS "exists"
    `;
    aceitoEmColumnCache = Boolean(rows[0]?.exists);
  } catch {
    aceitoEmColumnCache = true;
  }
  return aceitoEmColumnCache;
}
