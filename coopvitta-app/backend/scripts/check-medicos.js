const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'seja-viva-saude' },
    });

    const medicos = await prisma.medico.findMany({
      where: {
        tenantId: tenant?.id,
        ativo: true,
      },
      select: {
        nomeCompleto: true,
        cpf: true,
        crm: true,
      },
      take: 10,
      orderBy: { nomeCompleto: 'asc' },
    });

    console.log(JSON.stringify({
      tenant: tenant?.slug,
      tenantId: tenant?.id,
      totalSample: medicos.length,
      medicos,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
