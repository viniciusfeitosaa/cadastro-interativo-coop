import {
  BlogCommentStatus,
  BlogPostStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/database';
import { formatPostPublic, markdownToHtml, slugify } from '../utils/blog.util';
import { getDefaultTenant } from '../utils/tenant.util';

const postInclude = {
  category: { select: { id: true, slug: true, nome: true } },
  autor: { select: { id: true, nome: true } },
} as const;

const commentIncludePublic = {
  respondidoPor: { select: { id: true, nome: true } },
} as const;

export const listPublicCategoriesService = async () => {
  const tenant = await getDefaultTenant();

  const [categories, posts] = await Promise.all([
    prisma.blogCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: { id: true, slug: true, nome: true },
    }),
    prisma.blogPost.findMany({
      where: {
        tenantId: tenant.id,
        status: BlogPostStatus.PUBLICADO,
      },
      orderBy: { publicadoEm: 'desc' },
      select: {
        slug: true,
        titulo: true,
        resumo: true,
        capaUrl: true,
        publicadoEm: true,
        categoryId: true,
      },
    }),
  ]);

  const postsByCategory = new Map<string, typeof posts>();
  for (const post of posts) {
    const list = postsByCategory.get(post.categoryId);
    if (list) list.push(post);
    else postsByCategory.set(post.categoryId, [post]);
  }

  return categories.map((cat) => ({
    slug: cat.slug,
    nome: cat.nome,
    posts: (postsByCategory.get(cat.id) || []).map((p) => ({
      slug: p.slug,
      titulo: p.titulo,
      resumo: p.resumo,
      capaUrl: p.capaUrl,
      publicadoEm: p.publicadoEm,
    })),
  }));
};

export const listPublicPostsService = async (params: {
  categoria?: string;
  page?: number;
  limit?: number;
}) => {
  const tenant = await getDefaultTenant();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.BlogPostWhereInput = {
    tenantId: tenant.id,
    status: BlogPostStatus.PUBLICADO,
    ...(params.categoria
      ? { category: { slug: params.categoria, tenantId: tenant.id } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publicadoEm: 'desc' },
      skip,
      take: limit,
      include: { category: { select: { slug: true, nome: true } } },
    }),
    prisma.blogPost.count({ where }),
  ]);

  return {
    items: items.map((p) => formatPostPublic({ ...p, category: p.category })),
    pagination: { page, limit, total },
  };
};

export const getPublicPostBySlugService = async (slug: string) => {
  const tenant = await getDefaultTenant();
  const post = await prisma.blogPost.findFirst({
    where: {
      tenantId: tenant.id,
      slug,
      status: BlogPostStatus.PUBLICADO,
    },
    include: postInclude,
  });

  if (!post) {
    throw { statusCode: 404, message: 'Artigo não encontrado' };
  }

  const comentarios = await prisma.blogComment.findMany({
    where: {
      tenantId: tenant.id,
      postId: post.id,
      status: BlogCommentStatus.APROVADO,
    },
    orderBy: { createdAt: 'asc' },
    include: commentIncludePublic,
  });

  return {
    post: formatPostPublic(post),
    comentarios: comentarios.map((c) => ({
      id: c.id,
      autorNome: c.autorNome,
      conteudo: c.conteudo,
      createdAt: c.createdAt,
      resposta:
        c.respostaTexto && c.respondidoEm
          ? {
              texto: c.respostaTexto,
              respondidoEm: c.respondidoEm,
              autor: c.respondidoPor?.nome ?? 'Equipe Viva Saúde',
            }
          : null,
    })),
  };
};

export const createPublicCommentService = async (
  slug: string,
  input: {
    autorNome: string;
    autorEmail: string;
    conteudo: string;
    consentimentoLgpd: boolean;
  }
) => {
  const tenant = await getDefaultTenant();
  const post = await prisma.blogPost.findFirst({
    where: {
      tenantId: tenant.id,
      slug,
      status: BlogPostStatus.PUBLICADO,
    },
    select: { id: true },
  });

  if (!post) {
    throw { statusCode: 404, message: 'Artigo não encontrado' };
  }

  if (!input.consentimentoLgpd) {
    throw { statusCode: 400, message: 'É necessário aceitar a política de privacidade' };
  }

  const comment = await prisma.blogComment.create({
    data: {
      tenantId: tenant.id,
      postId: post.id,
      autorNome: input.autorNome.trim(),
      autorEmail: input.autorEmail.trim().toLowerCase(),
      conteudo: input.conteudo.trim(),
      consentimentoLgpd: true,
      status: BlogCommentStatus.PENDENTE,
    },
  });

  return { id: comment.id };
};

// --- Admin ---

export const listAdminCategoriesService = async (tenantId: string) => {
  const items = await prisma.blogCategory.findMany({
    where: { tenantId },
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: { _count: { select: { posts: true } } },
  });

  return items.map((c) => ({
    id: c.id,
    slug: c.slug,
    nome: c.nome,
    ordem: c.ordem,
    postsCount: c._count.posts,
  }));
};

export const createAdminCategoryService = async (
  tenantId: string,
  input: { nome: string; slug?: string; ordem?: number }
) => {
  const nome = input.nome.trim();
  if (!nome) throw { statusCode: 400, message: 'Nome da categoria é obrigatório' };

  const baseSlug = slugify(input.slug?.trim() || nome);
  let slug = baseSlug || `categoria-${Date.now()}`;
  let suffix = 1;
  while (
    await prisma.blogCategory.findFirst({
      where: { tenantId, slug },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const maxOrdem = await prisma.blogCategory.aggregate({
    where: { tenantId },
    _max: { ordem: true },
  });
  const ordem = input.ordem ?? (maxOrdem._max.ordem ?? 0) + 1;

  return prisma.blogCategory.create({
    data: { tenantId, slug, nome, ordem },
  });
};

export const deleteAdminCategoryService = async (tenantId: string, id: string) => {
  const category = await prisma.blogCategory.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { posts: true } } },
  });
  if (!category) throw { statusCode: 404, message: 'Categoria não encontrada' };
  if (category._count.posts > 0) {
    throw {
      statusCode: 409,
      message: 'Não é possível excluir: categoria possui artigos vinculados',
    };
  }

  await prisma.blogCategory.delete({ where: { id } });
  return { id };
};

export const listAdminPostsService = async (params: {
  tenantId: string;
  status?: BlogPostStatus;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;
  const includeTotal = params.page !== undefined;

  const where: Prisma.BlogPostWhereInput = {
    tenantId: params.tenantId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { titulo: { contains: params.search, mode: 'insensitive' } },
            { slug: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const items = await prisma.blogPost.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    skip,
    take: limit,
    select: {
      id: true,
      slug: true,
      titulo: true,
      status: true,
      category: { select: { nome: true } },
    },
  });

  const mapped = items.map((p) => ({
    id: p.id,
    slug: p.slug,
    titulo: p.titulo,
    status: p.status,
    categoria: p.category,
  }));

  if (!includeTotal) {
    return { items: mapped, pagination: null };
  }

  const total = await prisma.blogPost.count({ where });
  return {
    items: mapped,
    pagination: { page, limit, total },
  };
};

export const getAdminPostService = async (tenantId: string, id: string) => {
  const post = await prisma.blogPost.findFirst({
    where: { id, tenantId },
    include: postInclude,
  });
  if (!post) throw { statusCode: 404, message: 'Artigo não encontrado' };
  return {
    ...post,
    conteudoHtml: markdownToHtml(post.conteudo),
  };
};

export const createAdminPostService = async (
  tenantId: string,
  autorId: string,
  input: {
    titulo: string;
    slug?: string;
    categoryId: string;
    resumo: string;
    conteudo: string;
    capaUrl?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    status?: BlogPostStatus;
  }
) => {
  const category = await prisma.blogCategory.findFirst({
    where: { id: input.categoryId, tenantId },
  });
  if (!category) throw { statusCode: 400, message: 'Categoria inválida' };

  const baseSlug = slugify(input.slug?.trim() || input.titulo);
  let slug = baseSlug || `artigo-${Date.now()}`;
  let suffix = 1;
  while (
    await prisma.blogPost.findFirst({
      where: { tenantId, slug },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const status = input.status ?? BlogPostStatus.RASCUNHO;
  const publicadoEm = status === BlogPostStatus.PUBLICADO ? new Date() : null;

  return prisma.blogPost.create({
    data: {
      tenantId,
      categoryId: input.categoryId,
      slug,
      titulo: input.titulo.trim(),
      resumo: input.resumo.trim(),
      conteudo: input.conteudo.trim(),
      capaUrl: input.capaUrl?.trim() || null,
      seoTitle: input.seoTitle?.trim() || null,
      seoDescription: input.seoDescription?.trim() || null,
      status,
      publicadoEm,
      autorId,
    },
    include: postInclude,
  });
};

export const updateAdminPostService = async (
  tenantId: string,
  id: string,
  input: {
    titulo?: string;
    slug?: string;
    categoryId?: string;
    resumo?: string;
    conteudo?: string;
    capaUrl?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    status?: BlogPostStatus;
  }
) => {
  const existing = await prisma.blogPost.findFirst({ where: { id, tenantId } });
  if (!existing) throw { statusCode: 404, message: 'Artigo não encontrado' };

  if (input.categoryId) {
    const category = await prisma.blogCategory.findFirst({
      where: { id: input.categoryId, tenantId },
    });
    if (!category) throw { statusCode: 400, message: 'Categoria inválida' };
  }

  let slug = existing.slug;
  if (input.slug !== undefined) {
    const nextSlug = slugify(input.slug.trim() || existing.titulo);
    if (nextSlug && nextSlug !== existing.slug) {
      const conflict = await prisma.blogPost.findFirst({
        where: { tenantId, slug: nextSlug, NOT: { id } },
      });
      if (conflict) throw { statusCode: 409, message: 'Slug já em uso' };
      slug = nextSlug;
    }
  }

  let publicadoEm = existing.publicadoEm;
  const status = input.status ?? existing.status;
  if (status === BlogPostStatus.PUBLICADO && !existing.publicadoEm) {
    publicadoEm = new Date();
  }
  if (status !== BlogPostStatus.PUBLICADO && input.status === BlogPostStatus.RASCUNHO) {
    publicadoEm = null;
  }

  return prisma.blogPost.update({
    where: { id },
    data: {
      ...(input.titulo !== undefined ? { titulo: input.titulo.trim() } : {}),
      slug,
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.resumo !== undefined ? { resumo: input.resumo.trim() } : {}),
      ...(input.conteudo !== undefined ? { conteudo: input.conteudo.trim() } : {}),
      ...(input.capaUrl !== undefined ? { capaUrl: input.capaUrl?.trim() || null } : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle?.trim() || null } : {}),
      ...(input.seoDescription !== undefined
        ? { seoDescription: input.seoDescription?.trim() || null }
        : {}),
      ...(input.status !== undefined ? { status, publicadoEm } : {}),
    },
    include: postInclude,
  });
};

export const publishAdminPostService = async (tenantId: string, id: string) => {
  const existing = await prisma.blogPost.findFirst({ where: { id, tenantId } });
  if (!existing) throw { statusCode: 404, message: 'Artigo não encontrado' };

  return prisma.blogPost.update({
    where: { id },
    data: {
      status: BlogPostStatus.PUBLICADO,
      publicadoEm: existing.publicadoEm ?? new Date(),
    },
    include: postInclude,
  });
};

export const archiveAdminPostService = async (tenantId: string, id: string) => {
  const existing = await prisma.blogPost.findFirst({ where: { id, tenantId } });
  if (!existing) throw { statusCode: 404, message: 'Artigo não encontrado' };

  return prisma.blogPost.update({
    where: { id },
    data: { status: BlogPostStatus.ARQUIVADO },
    include: postInclude,
  });
};

export const listAdminCommentsService = async (params: {
  tenantId: string;
  status?: BlogCommentStatus;
  postId?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 30));
  const skip = (page - 1) * limit;

  const where: Prisma.BlogCommentWhereInput = {
    tenantId: params.tenantId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.postId ? { postId: params.postId } : {}),
  };

  const [items, total, pendentes] = await Promise.all([
    prisma.blogComment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        post: { select: { id: true, slug: true, titulo: true } },
        respondidoPor: { select: { id: true, nome: true } },
      },
    }),
    prisma.blogComment.count({ where }),
    prisma.blogComment.count({
      where: { tenantId: params.tenantId, status: BlogCommentStatus.PENDENTE },
    }),
  ]);

  return {
    items,
    pendentes,
    pagination: { page, limit, total },
  };
};

export const approveAdminCommentService = async (tenantId: string, id: string) => {
  const comment = await prisma.blogComment.findFirst({ where: { id, tenantId } });
  if (!comment) throw { statusCode: 404, message: 'Comentário não encontrado' };

  return prisma.blogComment.update({
    where: { id },
    data: { status: BlogCommentStatus.APROVADO },
  });
};

export const rejectAdminCommentService = async (tenantId: string, id: string) => {
  const comment = await prisma.blogComment.findFirst({ where: { id, tenantId } });
  if (!comment) throw { statusCode: 404, message: 'Comentário não encontrado' };

  return prisma.blogComment.update({
    where: { id },
    data: { status: BlogCommentStatus.REJEITADO },
  });
};

export const replyAdminCommentService = async (
  tenantId: string,
  masterId: string,
  id: string,
  respostaTexto: string
) => {
  const comment = await prisma.blogComment.findFirst({ where: { id, tenantId } });
  if (!comment) throw { statusCode: 404, message: 'Comentário não encontrado' };

  const texto = respostaTexto.trim();
  if (!texto) throw { statusCode: 400, message: 'Resposta não pode ser vazia' };

  return prisma.blogComment.update({
    where: { id },
    data: {
      respostaTexto: texto,
      respondidoPorId: masterId,
      respondidoEm: new Date(),
      status: BlogCommentStatus.APROVADO,
    },
    include: {
      post: { select: { slug: true, titulo: true } },
      respondidoPor: { select: { nome: true } },
    },
  });
};
