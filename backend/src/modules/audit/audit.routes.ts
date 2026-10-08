import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// GET /api/audit-logs - Restricted strictly to ADMIN role
router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  AuditController.getLogs
);

export default router;
