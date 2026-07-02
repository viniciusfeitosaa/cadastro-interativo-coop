import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createPublicCommentController,
  getPublicPostController,
  listPublicCategoriesController,
  listPublicPostsController,
} from '../controllers/blog.controller';
import {
  validateCreateBlogComment,
  validateSlugParam,
} from '../middleware/validation.middleware';

const router = Router();

const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Limite de comentários atingido. Tente novamente mais tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/categories', listPublicCategoriesController);
router.get('/posts', listPublicPostsController);
router.get('/posts/:slug', validateSlugParam('slug'), getPublicPostController);
router.post(
  '/posts/:slug/comments',
  commentLimiter,
  validateSlugParam('slug'),
  validateCreateBlogComment,
  createPublicCommentController
);

export default router;
