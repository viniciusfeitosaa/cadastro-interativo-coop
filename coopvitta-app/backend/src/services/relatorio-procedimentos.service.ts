import { prisma } from '../config/database';

let tableEnsured = false;

const ensureTable = async () => {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS relatorio_procedimentos_mes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      mes_ref VARCHAR(7) NOT NULL,
      dados JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, mes_ref)
    );
  `);
  tableEnsured = true;
};

const validarMesRef = (mesRef: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesRef)) {
    throw { statusCode: 400, message: 'Parâmetro de mês inválido. Use YYYY-MM.' };
  }
};

export async function getRelatorioProcedimentosMesService(tenantId: string, mesRef: string) {
  validarMesRef(mesRef);
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<{ dados: unknown }[]>(
    `
      SELECT dados
      FROM relatorio_procedimentos_mes
      WHERE tenant_id = $1::uuid
        AND mes_ref = $2
      LIMIT 1
    `,
    tenantId,
    mesRef
  );
  return rows[0]?.dados ?? null;
}

export async function upsertRelatorioProcedimentosMesService(
  tenantId: string,
  mesRef: string,
  dados: unknown
) {
  validarMesRef(mesRef);
  if (dados == null || typeof dados !== 'object') {
    throw { statusCode: 400, message: 'Payload inválido: envie um objeto em "dados".' };
  }
  await ensureTable();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO relatorio_procedimentos_mes (tenant_id, mes_ref, dados, created_at, updated_at)
      VALUES ($1::uuid, $2, $3::jsonb, NOW(), NOW())
      ON CONFLICT (tenant_id, mes_ref)
      DO UPDATE SET
        dados = EXCLUDED.dados,
        updated_at = NOW()
    `,
    tenantId,
    mesRef,
    JSON.stringify(dados)
  );
}
