/** Erro de coluna inexistente no Postgres / Prisma (ex.: migração ainda não aplicada). */
export function isMissingDatabaseColumnError(e: unknown, columnSqlName?: string): boolean {
  const err = e as { code?: string; message?: string };
  const msg = String(err?.message ?? e ?? '');
  if (err?.code === 'P2022') return true;
  if (/column .* does not exist/i.test(msg)) return true;
  if (/Unknown column/i.test(msg)) return true;
  if (columnSqlName && msg.toLowerCase().includes(columnSqlName.toLowerCase()) && /does not exist/i.test(msg)) {
    return true;
  }
  return false;
}
