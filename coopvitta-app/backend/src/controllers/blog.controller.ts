import { Request, Response } from 'express';
import { BlogCommentStatus, BlogPostStatus } from '@prisma/client';
import {
  approveAdminCommentService,
  archiveAdminPostService,
  createAdminPostService,
  createPublicCommentService,
  getAdminPostService,
  getPublicPostBySlugService,
  listAdminCategoriesService,
  listAdminCommentsService,
  listAdminPostsService,
  listPublicCategoriesService,
  listPublicPostsService,
  publishAdminPostService,
  rejectAdminCommentService,
  replyAdminCommentService,
  updateAdminPostService,
  createAdminCategoryService,
  deleteAdminCategoryService,
} from '../services/blog.service';

const handleServiceError = (res: Response, error: unknown) => {
  const err = error as { statusCode?: number; message?: string };
  return res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Erro interno do servidor',
  });
};

const setPublicBlogListCache = (res: Response) => {
  res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
};

export const listPublicCategoriesController = async (_req: Request, res: Response) => {
  try {
    const data = await listPublicCategoriesService();
    setPublicBlogListCache(res);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const listPublicPostsController = async (req: Request, res: Response) => {
  try {
    const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const data = await listPublicPostsService({ categoria, page, limit });
    return res.json({ success: true, ...data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getPublicPostController = async (req: Request, res: Response) => {
  try {
    const data = await getPublicPostBySlugService(req.params.slug);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const createPublicCommentController = async (req: Request, res: Response) => {
  try {
    const data = await createPublicCommentService(req.params.slug, req.body);
    return res.status(201).json({
      success: true,
      data,
      message: 'Comentário recebido. Ele aparecerá após moderação.',
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const listAdminCategoriesController = async (req: Request, res: Response) => {
  try {
    const data = await listAdminCategoriesService(req.user!.tenantId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const createAdminCategoryController = async (req: Request, res: Response) => {
  try {
    const data = await createAdminCategoryService(req.user!.tenantId, req.body);
    return res.status(201).json({ success: true, data, message: 'Categoria criada' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const deleteAdminCategoryController = async (req: Request, res: Response) => {
  try {
    const data = await deleteAdminCategoryService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data, message: 'Categoria excluída' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const listAdminPostsController = async (req: Request, res: Response) => {
  try {
    const status =
      typeof req.query.status === 'string' &&
      Object.values(BlogPostStatus).includes(req.query.status as BlogPostStatus)
        ? (req.query.status as BlogPostStatus)
        : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const result = await listAdminPostsService({
      tenantId: req.user!.tenantId,
      status,
      search,
      page,
      limit,
    });
    return res.json({
      success: true,
      data: result.items,
      ...(result.pagination ? { pagination: result.pagination } : {}),
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getAdminPostController = async (req: Request, res: Response) => {
  try {
    const data = await getAdminPostService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const createAdminPostController = async (req: Request, res: Response) => {
  try {
    const data = await createAdminPostService(req.user!.tenantId, req.user!.id, req.body);
    return res.status(201).json({ success: true, data, message: 'Artigo criado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const updateAdminPostController = async (req: Request, res: Response) => {
  try {
    const data = await updateAdminPostService(req.user!.tenantId, req.params.id, req.body);
    return res.json({ success: true, data, message: 'Artigo atualizado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const publishAdminPostController = async (req: Request, res: Response) => {
  try {
    const data = await publishAdminPostService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data, message: 'Artigo publicado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const archiveAdminPostController = async (req: Request, res: Response) => {
  try {
    const data = await archiveAdminPostService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data, message: 'Artigo arquivado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const listAdminCommentsController = async (req: Request, res: Response) => {
  try {
    const status =
      typeof req.query.status === 'string' &&
      Object.values(BlogCommentStatus).includes(req.query.status as BlogCommentStatus)
        ? (req.query.status as BlogCommentStatus)
        : undefined;
    const postId = typeof req.query.postId === 'string' ? req.query.postId : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const result = await listAdminCommentsService({
      tenantId: req.user!.tenantId,
      status,
      postId,
      page,
      limit,
    });
    return res.json({
      success: true,
      data: result.items,
      pendentes: result.pendentes,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const approveAdminCommentController = async (req: Request, res: Response) => {
  try {
    const data = await approveAdminCommentService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data, message: 'Comentário aprovado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const rejectAdminCommentController = async (req: Request, res: Response) => {
  try {
    const data = await rejectAdminCommentService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data, message: 'Comentário rejeitado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const replyAdminCommentController = async (req: Request, res: Response) => {
  try {
    const data = await replyAdminCommentService(
      req.user!.tenantId,
      req.user!.id,
      req.params.id,
      req.body.respostaTexto
    );
    return res.json({ success: true, data, message: 'Resposta publicada' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
