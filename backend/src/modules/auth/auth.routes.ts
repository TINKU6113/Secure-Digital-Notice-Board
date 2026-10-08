import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { loginSchema } from './auth.schema.js';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// POST /api/auth/login - Rate limited, validated
router.post(
  '/login',
  authLimiter,
  validateRequest({ body: loginSchema }),
  AuthController.login
);

// POST /api/auth/logout - Requires authenticated session
router.post('/logout', authenticate, AuthController.logout);

// GET /api/auth/me - Retrieve current authenticated user profile
router.get('/me', authenticate, AuthController.me);

export default router;
