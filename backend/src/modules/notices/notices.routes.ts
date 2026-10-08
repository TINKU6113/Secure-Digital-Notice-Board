import { Router } from 'express';
import { NoticesController } from './notices.controller.js';
import {
  createNoticeSchema,
  updateNoticeSchema,
  scheduleNoticeSchema,
  queryNoticeSchema,
  noticeIdParamSchema,
} from './notices.schema.js';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// Notice statistics (Admin only) - Must be defined BEFORE :id route to prevent route collision
router.get(
  '/stats',
  authenticate,
  authorize('ADMIN'),
  NoticesController.getStats
);

// List notices with role-based filtering
router.get(
  '/',
  authenticate,
  authorize('STUDENT', 'FACULTY', 'ADMIN'),
  validateRequest({ query: queryNoticeSchema }),
  NoticesController.getNotices
);

// Get single notice
router.get(
  '/:id',
  authenticate,
  authorize('STUDENT', 'FACULTY', 'ADMIN'),
  validateRequest({ params: noticeIdParamSchema }),
  NoticesController.getNoticeById
);

// Create notice (Faculty & Admin only)
router.post(
  '/',
  authenticate,
  authorize('FACULTY', 'ADMIN'),
  validateRequest({ body: createNoticeSchema }),
  NoticesController.createNotice
);

// Update notice (Faculty & Admin only with author ownership check)
router.put(
  '/:id',
  authenticate,
  authorize('FACULTY', 'ADMIN'),
  validateRequest({ params: noticeIdParamSchema, body: updateNoticeSchema }),
  NoticesController.updateNotice
);

// Delete notice (Faculty & Admin only with author ownership check)
router.delete(
  '/:id',
  authenticate,
  authorize('FACULTY', 'ADMIN'),
  validateRequest({ params: noticeIdParamSchema }),
  NoticesController.deleteNotice
);

// Schedule notice
router.post(
  '/:id/schedule',
  authenticate,
  authorize('FACULTY', 'ADMIN'),
  validateRequest({ params: noticeIdParamSchema, body: scheduleNoticeSchema }),
  NoticesController.scheduleNotice
);

export default router;
