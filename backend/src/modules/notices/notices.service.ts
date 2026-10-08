import { query } from '../../db/pool.js';
import { AuthUser, Notice } from '../../types/index.js';
import { AuditService } from '../audit/audit.service.js';

export class NoticesService {
  /**
   * Helper to evaluate lifecycle updates dynamically.
   * Promotes mature SCHEDULED notices to PUBLISHED and marks past-expiry notices as ARCHIVED.
   */
  static async refreshNoticeLifecycles(): Promise<void> {
    const now = new Date();
    // Auto-promote scheduled notices whose scheduled_at has arrived
    await query(
      `
      UPDATE notices
      SET status = 'PUBLISHED', updated_at = NOW()
      WHERE status = 'SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at <= $1;
      `,
      [now]
    );

    // Auto-archive notices whose expires_at has passed
    await query(
      `
      UPDATE notices
      SET status = 'ARCHIVED', updated_at = NOW()
      WHERE status IN ('PUBLISHED', 'SCHEDULED') AND expires_at IS NOT NULL AND expires_at <= $1;
      `,
      [now]
    );
  }

  /**
   * Query notices with lifecycle enforcement according to user role.
   * Parameterized queries protect completely against SQL Injection.
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
    await this.refreshNoticeLifecycles();

    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const offset = Math.max(filters.offset || 0, 0);

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    // Role-based lifecycle enforcement
    if (user.role === 'STUDENT') {
      // Students can ONLY view active PUBLISHED notices
      conditions.push(`n.status = 'PUBLISHED'`);
      conditions.push(`(n.scheduled_at IS NULL OR n.scheduled_at <= NOW())`);
      conditions.push(`(n.expires_at IS NULL OR n.expires_at > NOW())`);
    } else if (user.role === 'FACULTY') {
      if (filters.scope === 'my') {
        // Faculty viewing their own management dashboard
        conditions.push(`n.author_id = $${pIdx++}`);
        params.push(user.id);
        if (filters.status) {
          conditions.push(`n.status = $${pIdx++}`);
          params.push(filters.status);
        }
      } else {
        // Faculty viewing general board: published notices + their own notices
        if (filters.status && filters.status !== 'PUBLISHED') {
          // If filtering non-published on general board, only their own
          conditions.push(`(n.author_id = $${pIdx++} AND n.status = $${pIdx++})`);
          params.push(user.id, filters.status);
        } else {
          conditions.push(
            `(n.status = 'PUBLISHED' OR n.author_id = $${pIdx++})`
          );
          params.push(user.id);
        }
      }
    } else if (user.role === 'ADMIN') {
      // Admin has complete visibility across all statuses
      if (filters.status) {
        conditions.push(`n.status = $${pIdx++}`);
        params.push(filters.status);
      }
      if (filters.scope === 'my') {
        conditions.push(`n.author_id = $${pIdx++}`);
        params.push(user.id);
      }
    }

    // Common search & filters
    if (filters.search) {
      // Parameterized ILIKE query against title and content
      conditions.push(`(n.title ILIKE $${pIdx} OR n.content ILIKE $${pIdx})`);
      params.push(`%${filters.search}%`);
      pIdx++;
    }

    if (filters.department) {
      conditions.push(`n.department = $${pIdx++}`);
      params.push(filters.department);
    }

    if (filters.category) {
      conditions.push(`n.category = $${pIdx++}`);
      params.push(filters.category);
    }

    if (filters.priority) {
      conditions.push(`n.priority = $${pIdx++}`);
      params.push(filters.priority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `
      SELECT COUNT(*) as total
      FROM notices n
      ${whereClause};
      `,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    params.push(limit);
    const limitClause = `$${pIdx++}`;
    params.push(offset);
    const offsetClause = `$${pIdx++}`;

    const selectResult = await query(
      `
      SELECT n.id, n.title, n.content, n.author_id, n.department, n.category,
             n.priority, n.status, n.scheduled_at, n.expires_at, n.created_at, n.updated_at,
             u.full_name as author_name, u.email as author_email
      FROM notices n
      JOIN users u ON n.author_id = u.id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ${limitClause} OFFSET ${offsetClause};
      `,
      params
    );

    return {
      notices: selectResult.rows,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get single notice by ID with authorization and lifecycle checks.
   */
  static async getNoticeById(id: string, user: AuthUser): Promise<Notice> {
    await this.refreshNoticeLifecycles();

    const result = await query(
      `
      SELECT n.id, n.title, n.content, n.author_id, n.department, n.category,
             n.priority, n.status, n.scheduled_at, n.expires_at, n.created_at, n.updated_at,
             u.full_name as author_name, u.email as author_email
      FROM notices n
      JOIN users u ON n.author_id = u.id
      WHERE n.id = $1;
      `,
      [id]
    );

    if (result.rowCount === 0) {
      const error: any = new Error('Notice not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const notice = result.rows[0];

    // Lifecycle check for Student
    if (user.role === 'STUDENT') {
      const isVisible =
        notice.status === 'PUBLISHED' &&
        (!notice.scheduled_at || new Date(notice.scheduled_at) <= new Date()) &&
        (!notice.expires_at || new Date(notice.expires_at) > new Date());

      if (!isVisible) {
        // Return 404 to avoid leaking existence of draft or scheduled notices
        const error: any = new Error('Notice not found');
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
        throw error;
      }
    } else if (user.role === 'FACULTY') {
      // Faculty can view published notices or their own notices
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
    // If scheduling, ensure status is SCHEDULED if scheduled_at is in the future
    let initialStatus = data.status || 'DRAFT';
    if (data.scheduled_at && new Date(data.scheduled_at) > new Date()) {
      initialStatus = 'SCHEDULED';
    }

    const result = await query(
      `
      INSERT INTO notices (
        title, content, author_id, department, category, priority, status, scheduled_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
      `,
      [
        data.title,
        data.content,
        user.id,
        data.department,
        data.category,
        data.priority,
        initialStatus,
        data.scheduled_at ? new Date(data.scheduled_at) : null,
        data.expires_at ? new Date(data.expires_at) : null,
      ]
    );

    const created = result.rows[0];

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
   * Update notice with strict horizontal ownership validation.
   * Faculty may ONLY modify their own notices. Admin may modify any notice.
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
    // Retrieve existing notice to check ownership
    const existing = await query('SELECT * FROM notices WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      const error: any = new Error('Notice not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const notice = existing.rows[0];

    // Horizontal authorization check
    if (user.role === 'FACULTY' && notice.author_id !== user.id) {
      await AuditService.record({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'UNAUTHORIZED_ACCESS',
        resourceType: 'NOTICE',
        resourceId: id,
        status: 'FAILURE',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          reason: 'HORIZONTAL_AUTHORIZATION_VIOLATION',
          targetNoticeAuthorId: notice.author_id,
          attemptedByUserId: user.id,
        },
      });

      const error: any = new Error('Forbidden: You can only modify notices authored by yourself');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Determine lifecycle status update
    let updatedStatus = data.status !== undefined ? data.status : notice.status;
    const scheduledAt = data.scheduled_at !== undefined ? data.scheduled_at : notice.scheduled_at;
    if (scheduledAt && new Date(scheduledAt) > new Date() && updatedStatus !== 'DRAFT') {
      updatedStatus = 'SCHEDULED';
    }

    const result = await query(
      `
      UPDATE notices
      SET title = COALESCE($1, title),
          content = COALESCE($2, content),
          department = COALESCE($3, department),
          category = COALESCE($4, category),
          priority = COALESCE($5, priority),
          status = COALESCE($6, status),
          scheduled_at = $7,
          expires_at = $8,
          updated_at = NOW()
      WHERE id = $9
      RETURNING *;
      `,
      [
        data.title || null,
        data.content || null,
        data.department || null,
        data.category || null,
        data.priority || null,
        updatedStatus,
        scheduledAt ? new Date(scheduledAt) : null,
        data.expires_at !== undefined ? (data.expires_at ? new Date(data.expires_at) : null) : notice.expires_at,
        id,
      ]
    );

    const updated = result.rows[0];

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
   * Delete notice with strict horizontal ownership validation.
   */
  static async deleteNotice(
    id: string,
    user: AuthUser,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    const existing = await query('SELECT * FROM notices WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      const error: any = new Error('Notice not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const notice = existing.rows[0];

    // Horizontal authorization check
    if (user.role === 'FACULTY' && notice.author_id !== user.id) {
      await AuditService.record({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'UNAUTHORIZED_ACCESS',
        resourceType: 'NOTICE',
        resourceId: id,
        status: 'FAILURE',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          reason: 'HORIZONTAL_AUTHORIZATION_DELETE_VIOLATION',
          targetNoticeAuthorId: notice.author_id,
          attemptedByUserId: user.id,
        },
      });

      const error: any = new Error('Forbidden: You can only delete notices authored by yourself');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    await query('DELETE FROM notices WHERE id = $1', [id]);

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
        deletedNoticeTitle: notice.title,
      },
    });
  }

  /**
   * Dedicated schedule notice endpoint.
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
   * System summary statistics (for Admin Dashboard).
   */
  static async getSystemStatistics(): Promise<{
    totalNotices: number;
    published: number;
    scheduled: number;
    draft: number;
    archived: number;
    totalUsers: number;
    totalAuditEvents: number;
  }> {
    await this.refreshNoticeLifecycles();

    const statsRes = await query(`
      SELECT
        COUNT(*) as total_notices,
        COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published,
        COUNT(*) FILTER (WHERE status = 'SCHEDULED') as scheduled,
        COUNT(*) FILTER (WHERE status = 'DRAFT') as draft,
        COUNT(*) FILTER (WHERE status = 'ARCHIVED') as archived
      FROM notices;
    `);

    const usersRes = await query('SELECT COUNT(*) as total_users FROM users;');
    const auditRes = await query('SELECT COUNT(*) as total_audit FROM audit_logs;');

    const n = statsRes.rows[0];
    return {
      totalNotices: parseInt(n.total_notices, 10),
      published: parseInt(n.published, 10),
      scheduled: parseInt(n.scheduled, 10),
      draft: parseInt(n.draft, 10),
      archived: parseInt(n.archived, 10),
      totalUsers: parseInt(usersRes.rows[0].total_users, 10),
      totalAuditEvents: parseInt(auditRes.rows[0].total_audit, 10),
    };
  }
}
