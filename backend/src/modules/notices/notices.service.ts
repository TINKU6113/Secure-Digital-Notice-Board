import { AuthUser, Notice } from '../../types/index.js';
import { AuditService } from '../audit/audit.service.js';
import { NoticesRepository } from './notices.repository.js';

export class NoticesService {
  /**
   * Centralized horizontal ownership verification.
   * If a non-admin user attempts to alter a notice authored by someone else,
   * an UNAUTHORIZED_ACCESS event is written to the audit log and an HTTP 403 error is thrown.
   */
  private static async assertNoticeOwnership(
    notice: Notice,
    user: AuthUser,
    action: string,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    if (user.role === 'ADMIN') {
      return; // Admins possess global management privileges
    }

    if (user.role === 'FACULTY' && notice.author_id !== user.id) {
      await AuditService.record({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'UNAUTHORIZED_ACCESS',
        resourceType: 'NOTICE',
        resourceId: notice.id,
        status: 'FAILURE',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          reason: 'HORIZONTAL_AUTHORIZATION_VIOLATION',
          attemptedAction: action,
          targetNoticeAuthorId: notice.author_id,
          attemptedByUserId: user.id,
        },
      });

      const error: any = new Error(
        `Forbidden: You can only ${action.toLowerCase()} notices authored by yourself`
      );
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }
  }

  /**
   * Query notices with role-based lifecycle filtering.
   */
  static async getNotices(
    user: AuthUser,
    filters: {
      search?: string;
      department?: string;
      category?: string;
      priority?: string;
      status?: string;
      scope?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ notices: Notice[]; total: number; limit: number; offset: number }> {
    await NoticesRepository.refreshLifecycles();

    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const offset = Math.max(filters.offset || 0, 0);

    const { notices, total } = await NoticesRepository.findMany({
      role: user.role,
      userId: user.id,
      search: filters.search,
      department: filters.department,
      category: filters.category,
      priority: filters.priority,
      status: filters.status,
      scope: filters.scope,
      limit,
      offset,
    });

    return { notices, total, limit, offset };
  }

  /**
   * Get single notice by ID with role-based visibility checks.
   */
  static async getNoticeById(id: string, user: AuthUser): Promise<Notice> {
    await NoticesRepository.refreshLifecycles();

    const notice = await NoticesRepository.findById(id);
    if (!notice) {
      const error: any = new Error('Notice not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Lifecycle check for Student
    if (user.role === 'STUDENT') {
      const isVisible =
        notice.status === 'PUBLISHED' &&
        (!notice.scheduled_at || new Date(notice.scheduled_at) <= new Date()) &&
        (!notice.expires_at || new Date(notice.expires_at) > new Date());

      if (!isVisible) {
        const error: any = new Error('Notice not found');
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
        throw error;
      }
    } else if (user.role === 'FACULTY') {
      const isAuthorized = notice.status === 'PUBLISHED' || notice.author_id === user.id;
      if (!isAuthorized) {
        const error: any = new Error('Notice not found');
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
        throw error;
      }
    }

    return notice;
  }

  /**
   * Create notice (Faculty, Admin only).
   */
  static async createNotice(
    data: {
      title: string;
      content: string;
      department: string;
      category: string;
      priority: string;
      status: string;
      scheduled_at?: string | null;
      expires_at?: string | null;
    },
    user: AuthUser,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<Notice> {
    let initialStatus = data.status || 'DRAFT';
    if (data.scheduled_at && new Date(data.scheduled_at) > new Date()) {
      initialStatus = 'SCHEDULED';
    }

    const created = await NoticesRepository.create({
      title: data.title,
      content: data.content,
      authorId: user.id,
      department: data.department,
      category: data.category,
      priority: data.priority,
      status: initialStatus,
      scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : null,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    });

    await AuditService.record({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: initialStatus === 'SCHEDULED' ? 'NOTICE_SCHEDULE' : 'NOTICE_CREATE',
      resourceType: 'NOTICE',
      resourceId: created.id,
      status: 'SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        title: created.title,
        status: created.status,
        department: created.department,
      },
    });

    return created;
  }

  /**
   * Update notice with horizontal ownership verification.
   */
  static async updateNotice(
    id: string,
    data: {
      title?: string;
      content?: string;
      department?: string;
      category?: string;
      priority?: string;
      status?: string;
      scheduled_at?: string | null;
      expires_at?: string | null;
    },
    user: AuthUser,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<Notice> {
    const existing = await NoticesRepository.findById(id);
    if (!existing) {
      const error: any = new Error('Notice not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Enforce horizontal authorization
    await this.assertNoticeOwnership(existing, user, 'MODIFY', meta);

    // Compute lifecycle status update
    let updatedStatus = data.status !== undefined ? data.status : existing.status;
    const scheduledAt =
      data.scheduled_at !== undefined ? data.scheduled_at : existing.scheduled_at;
    if (scheduledAt && new Date(scheduledAt) > new Date() && updatedStatus !== 'DRAFT') {
      updatedStatus = 'SCHEDULED';
    }

    const updated = await NoticesRepository.update(id, {
      title: data.title,
      content: data.content,
      department: data.department,
      category: data.category,
      priority: data.priority,
      status: updatedStatus,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      expiresAt:
        data.expires_at !== undefined
          ? data.expires_at
            ? new Date(data.expires_at)
            : null
          : existing.expires_at
          ? new Date(existing.expires_at)
          : null,
    });

    await AuditService.record({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'NOTICE_UPDATE',
      resourceType: 'NOTICE',
      resourceId: id,
      status: 'SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        updatedFields: Object.keys(data),
      },
    });

    return updated;
  }

  /**
   * Delete notice with horizontal ownership verification.
   */
  static async deleteNotice(
    id: string,
    user: AuthUser,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    const existing = await NoticesRepository.findById(id);
    if (!existing) {
      const error: any = new Error('Notice not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Enforce horizontal authorization
    await this.assertNoticeOwnership(existing, user, 'DELETE', meta);

    await NoticesRepository.delete(id);

    await AuditService.record({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'NOTICE_DELETE',
      resourceType: 'NOTICE',
      resourceId: id,
      status: 'SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        deletedNoticeTitle: existing.title,
      },
    });
  }

  /**
   * Schedule notice endpoint.
   */
  static async scheduleNotice(
    id: string,
    data: { scheduled_at: string; expires_at?: string | null },
    user: AuthUser,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<Notice> {
    return this.updateNotice(
      id,
      {
        status: 'SCHEDULED',
        scheduled_at: data.scheduled_at,
        expires_at: data.expires_at,
      },
      user,
      meta
    );
  }

  /**
   * Retrieve system statistics for Admin console.
   */
  static async getSystemStatistics() {
    await NoticesRepository.refreshLifecycles();
    return NoticesRepository.getStatistics();
  }
}
