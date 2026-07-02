import { BlogPostStatus, PrismaClient, UserRole } from '@prisma/client';
import env from '../src/config/env';
import { hashPassword } from '../src/utils/password.util';

const prisma = new PrismaClient();

const SEED_ARTICLE_CONTENT = `Improviso na escala custa caro: sobrecarga da equipe, risco assistencial e desgaste do gestor. Este guia apresenta um fluxo estruturado para planejar cobertura com antecedência, alinhar especialidades e criar protocolos claros de substituição.

## 1. Mapeie a demanda real

Volume de atendimentos, picos de demanda, especialidades críticas e legislação aplicável devem estar documentados antes de abrir a planilha.

## 2. Defina regras transparentes

Critérios de distribuição de plantões, limites de carga horária e canais de comunicação reduzem conflitos e última hora.

## 3. Use tecnologia e parceiros especializados

Ferramentas digitais e gestão profissional de escalas transformam o processo em rotina previsível — é o que fazemos na Viva Saúde todos os dias.`;

async function seedBlog(tenantId: string, autorId: string) {
  const categories = [
    { slug: 'gestao-escalas', nome: 'Gestão de Escalas', ordem: 0 },
    { slug: 'gestao-hospitalar', nome: 'Gestão Hospitalar', ordem: 1 },
    { slug: 'carreira-medica', nome: 'Carreira Médica', ordem: 2 },
  ];

  const categoryIds: Record<string, string> = {};

  for (const cat of categories) {
    const row = await prisma.blogCategory.upsert({
      where: { tenantId_slug: { tenantId, slug: cat.slug } },
      update: { nome: cat.nome, ordem: cat.ordem },
      create: { tenantId, slug: cat.slug, nome: cat.nome, ordem: cat.ordem },
    });
    categoryIds[cat.slug] = row.id;
  }

  await prisma.blogPost.upsert({
    where: { tenantId_slug: { tenantId, slug: 'escala-sem-improviso' } },
    update: {
      titulo: 'Como montar uma escala médica sem improviso: guia passo a passo',
      resumo: 'Guia passo a passo para gestores montarem escalas com previsibilidade, regras claras e apoio tecnológico.',
      conteudo: SEED_ARTICLE_CONTENT,
      status: BlogPostStatus.PUBLICADO,
      publicadoEm: new Date('2025-06-01T12:00:00.000Z'),
      categoryId: categoryIds['gestao-escalas'],
      autorId,
      seoTitle: 'Como montar uma escala médica sem improviso | Blog Viva Saúde',
      seoDescription:
        'Guia passo a passo para gestores hospitalares montarem escalas médicas com previsibilidade e segurança assistencial.',
    },
    create: {
      tenantId,
      categoryId: categoryIds['gestao-escalas'],
      slug: 'escala-sem-improviso',
      titulo: 'Como montar uma escala médica sem improviso: guia passo a passo',
      resumo: 'Guia passo a passo para gestores montarem escalas com previsibilidade, regras claras e apoio tecnológico.',
      conteudo: SEED_ARTICLE_CONTENT,
      status: BlogPostStatus.PUBLICADO,
      publicadoEm: new Date('2025-06-01T12:00:00.000Z'),
      autorId,
      seoTitle: 'Como montar uma escala médica sem improviso | Blog Viva Saúde',
      seoDescription:
        'Guia passo a passo para gestores hospitalares montarem escalas médicas com previsibilidade e segurança assistencial.',
    },
  });

  console.log('Blog: categorias e artigo inicial prontos');
}

async function main() {
  if (!env.MASTER_INITIAL_PASSWORD) {
    throw new Error(
      'MASTER_INITIAL_PASSWORD não definido. Configure a variável para criar o usuário master inicial.'
    );
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: env.TENANT_DEFAULT_SLUG },
    update: {
      nome: 'Seja Viva Saúde',
      ativo: true,
    },
    create: {
      nome: 'Seja Viva Saúde',
      slug: env.TENANT_DEFAULT_SLUG,
      ativo: true,
    },
  });

  const senhaHash = await hashPassword(env.MASTER_INITIAL_PASSWORD);

  const master = await prisma.usuarioMaster.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: env.MASTER_INITIAL_EMAIL.toLowerCase(),
      },
    },
    update: {
      nome: env.MASTER_INITIAL_NAME,
      senhaHash,
      ativo: true,
      role: UserRole.MASTER,
    },
    create: {
      tenantId: tenant.id,
      nome: env.MASTER_INITIAL_NAME,
      email: env.MASTER_INITIAL_EMAIL.toLowerCase(),
      senhaHash,
      role: UserRole.MASTER,
      ativo: true,
    },
  });

  await seedBlog(tenant.id, master.id);

  console.log('Seed executado com sucesso');
  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);
  console.log(`Master: ${master.email} (${master.id})`);
}

main()
  .catch((error) => {
    console.error('Erro no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
