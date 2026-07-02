import { Router } from 'express';
import {
  approveAdminCommentController,
  archiveAdminPostController,
  createAdminCategoryController,
  createAdminPostController,
  deleteAdminCategoryController,
  getAdminPostController,
  listAdminCategoriesController,
  listAdminCommentsController,
  listAdminPostsController,
  publishAdminPostController,
  rejectAdminCommentController,
  replyAdminCommentController,
  updateAdminPostController,
} from '../controllers/blog.controller';
import {
  validateCreateBlogPost,
  validateCreateBlogCategory,
  validateReplyBlogComment,
  validateUpdateBlogPost,
  validateUUIDParam,
} from '../middleware/validation.middleware';

const router = Router();

router.get('/categories', listAdminCategoriesController);
router.post('/categories', validateCreateBlogCategory, createAdminCategoryController);
router.delete('/categories/:id', validateUUIDParam('id'), deleteAdminCategoryController);
router.get('/posts', listAdminPostsController);
router.get('/posts/:id', validateUUIDParam('id'), getAdminPostController);
router.post('/posts', validateCreateBlogPost, createAdminPostController);
router.put('/posts/:id', validateUUIDParam('id'), validateUpdateBlogPost, updateAdminPostController);
router.patch('/posts/:id/publicar', validateUUIDParam('id'), publishAdminPostController);
router.patch('/posts/:id/arquivar', validateUUIDParam('id'), archiveAdminPostController);

router.get('/comments', listAdminCommentsController);
router.patch('/comments/:id/aprovar', validateUUIDParam('id'), approveAdminCommentController);
router.patch('/comments/:id/rejeitar', validateUUIDParam('id'), rejectAdminCommentController);
router.post(
  '/comments/:id/responder',
  validateUUIDParam('id'),
  validateReplyBlogComment,
  replyAdminCommentController
);

export default router;
