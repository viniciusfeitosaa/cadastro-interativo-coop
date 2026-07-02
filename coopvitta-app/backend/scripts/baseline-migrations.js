/**
 * Marca todas as pastas em prisma/migrations como já aplicadas, sem rodar o SQL.
 * Use quando `prisma migrate deploy` falha com P3005 (banco já tem schema, mas
 * _prisma_migrations está vazio ou dessincronizado).
 *
 * ATENÇÃO: só rode se o Supabase já reflete o que essas migrações fariam.
 * Depois: npm run prisma:migrate:deploy (deve dizer "No pending migrations").
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
const cwd = path.join(__dirname, '..');

const dirs = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (dirs.length === 0) {
  console.error('Nenhuma pasta de migração encontrada.');
  process.exit(1);
}

console.log(`Baseline: ${dirs.length} migrações (ordem cronológica).\n`);

for (const name of dirs) {
  const cmd = `npx prisma migrate resolve --applied "${name}"`;
  try {
    execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    const combined = `${stderr}${stdout}${e.message || ''}`;
    if (/already recorded|already been applied|P3008/i.test(combined)) {
      console.log(`[pulando] ${name} — já consta como aplicada.\n`);
      continue;
    }
    console.error(`Falhou em: ${name}`);
    process.exit(e.status || 1);
  }
}

console.log('\nPronto. Rode: npm run prisma:migrate:deploy');
