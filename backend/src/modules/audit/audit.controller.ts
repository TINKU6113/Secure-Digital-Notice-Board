import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/index.js';
import { AuditService } from './audit.service.js';

export class AuditController {
  static async getLogs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { limit, offset, action, status } = req.query as any;

      const result = await AuditService.getLogs({
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
        action,
        status,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
