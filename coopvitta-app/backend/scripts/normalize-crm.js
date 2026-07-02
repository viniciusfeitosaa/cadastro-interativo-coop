const { PrismaClient } = require('@prisma/client');

function normalizeCRM(crm) {
  if (!crm) return null;
  const clean = String(crm)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CRM:?/, '');

  const match = clean.match(/^(\d{4,6})[-/]?([A-Z]{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const medicos = await prisma.medico.findMany({
      select: { id: true, crm: true },
    });

    let updated = 0;
    for (const medico of medicos) {
      const normalized = normalizeCRM(medico.crm);
      if (normalized && normalized !== medico.crm) {
        await prisma.medico.update({
          where: { id: medico.id },
          data: { crm: normalized },
        });
        updated++;
      }
    }

    console.log(`CRMs normalizados: ${updated}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
