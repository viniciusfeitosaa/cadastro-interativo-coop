/**
 * Migra dados do Neon para o Supabase.
 * Uso: defina NEON_DATABASE_URL no .env e rode: npx ts-node prisma/migrate-neon-to-supabase.ts
 *
 * NEON_DATABASE_URL="postgresql://neondb_owner:SENHA@ep-xxx.neon.tech/neondb?sslmode=require"
 */

import 'dotenv/config';
import { Client } from 'pg';

const NEON_URL = process.env.NEON_DATABASE_URL;
const SUPABASE_URL = process.env.DATABASE_URL;

if (!NEON_URL || !SUPABASE_URL) {
  console.error('Defina NEON_DATABASE_URL e DATABASE_URL no .env');
  process.exit(1);
}

// Ordem das tabelas (pais antes de filhos) para evitar erro de FK ao inserir
const TABLE_ORDER = [
  'tenants',
  'contratos_ativos',
  'usuarios_master',
  'medicos',
  'medico_documentos',
  'documentos_enviados',
  'reset_senha_tokens',
  'acessos_modulos_perfil',
  'escalas',
  'subgrupos',
  'equipes',
  'contrato_subgrupos',
  'contrato_equipes',
  'subgrupo_medicos',
  'equipe_medicos',
  'escala_subgrupos',
  'escala_equipes',
  'escala_medicos',
  'escala_plantoes',
  'valores_plantao',
  'config_ponto_eletronico',
  'registros_ponto',
  'sessoes',
  'sessoes_master',
  'auditoria',
];

async function main() {
  const neon = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
  });
  const supabase = new Client({
    connectionString: SUPABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await neon.connect();
    console.log('Conectado ao Neon');
    await supabase.connect();
    console.log('Conectado ao Supabase');

    // Limpar Supabase (cascade a partir de tenants)
    console.log('Limpando tabelas no Supabase...');
    await supabase.query('TRUNCATE TABLE tenants CASCADE');
    console.log('Tabelas limpas.');

    for (const table of TABLE_ORDER) {
      try {
        const res = await neon.query(`SELECT * FROM public."${table}"`);
        if (res.rows.length === 0) {
          console.log(`  ${table}: (vazia)`);
          continue;
        }

        const columns = res.fields.map((f: { name: string }) => `"${f.name}"`);
        const colList = columns.join(', ');
        const BATCH = 50;
        let inserted = 0;
        for (let i = 0; i < res.rows.length; i += BATCH) {
          const batch = res.rows.slice(i, i + BATCH);
          const placeholders = batch
            .map(
              (_: unknown, rowIdx: number) =>
                '(' +
                res.fields
                  .map((_: unknown, colIdx: number) => `$${rowIdx * res.fields.length + colIdx + 1}`)
                  .join(',') +
                ')'
            )
            .join(',');
          const values = batch.flatMap((row: Record<string, unknown>) =>
            res.fields.map((f: { name: string }) => row[f.name])
          );
          const query = `INSERT INTO public."${table}" (${colList}) VALUES ${placeholders}`;
          await supabase.query(query, values);
          inserted += batch.length;
        }
        console.log(`  ${table}: ${inserted} linha(s)`);
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err.code === '42P01') {
          console.log(`  ${table}: (não existe no Neon, pulando)`);
        } else {
          console.error(`  ${table}: ERRO`, err.message || err);
        }
      }
    }

    console.log('\nMigração concluída.');
  } finally {
    await neon.end();
    await supabase.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
