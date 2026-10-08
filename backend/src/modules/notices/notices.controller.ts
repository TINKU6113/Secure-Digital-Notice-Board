import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/index.js';
import { NoticesService } from './notices.service.js';

export class NoticesController {
  static async getNotices(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const {
        search,
        department,
        category,
        priority,
        status,
        scope,
        limit,
        offset,
      } = req.query as any;

      const result = await NoticesService.getNotices(user, {
        search,
        department,
        category,
        priority,
        status,
        scope,
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getNoticeById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const id = req.params.id as string;

      const notice = await NoticesService.getNoticeById(id, user);

      res.status(200).json({
        success: true,
        data: notice,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createNotice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const meta = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const created = await NoticesService.createNotice(req.body, user, meta);

      res.status(201).json({
        success: true,
        message: 'Notice created successfully',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateNotice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const meta = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const updated = await NoticesService.updateNotice(id, req.body, user, meta);

      res.status(200).json({
        success: true,
        message: 'Notice updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteNotice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const meta = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      await NoticesService.deleteNotice(id, user, meta);

      res.status(200).json({
        success: true,
        message: 'Notice deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async scheduleNotice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const meta = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const scheduled = await NoticesService.scheduleNotice(id, req.body, user, meta);

      res.status(200).json({
        success: true,
        message: 'Notice scheduled successfully',
        data: scheduled,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await NoticesService.getSystemStatistics();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}
