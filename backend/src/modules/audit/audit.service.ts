import { query } from '../../db/pool.js';

export interface AuditEventParams {
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  resourceType: 'AUTH' | 'NOTICE' | 'USER' | 'SYSTEM';
  resourceId?: string | null;
  status: 'SUCCESS' | 'FAILURE';
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Asynchronously records an audit event to the audit_logs table.
   * Parameterized queries guarantee that log fields cannot introduce SQL injection.
   */
  static async record(params: AuditEventParams): Promise<void> {
    try {
      // Sanitize metadata to never include sensitive values (passwords, tokens, secrets)
      const safeMetadata = { ...(params.metadata || {}) };
      delete safeMetadata.password;
      delete safeMetadata.token;
      delete safeMetadata.secret;
      delete safeMetadata.authorization;

      await query(
        `
        INSERT INTO audit_logs (
          user_id, user_email, user_role, action, resource_type,
          resource_id, status, ip_address, user_agent, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `,
        [
          params.userId || null,
          params.userEmail || null,
          params.userRole || null,
          params.action,
          params.resourceType,
          params.resourceId || null,
          params.status,
          params.ipAddress || null,
          params.userAgent || null,
          JSON.stringify(safeMetadata),
        ]
      );
    } catch (error) {
      // Audit log recording failure should be logged to stderr but never crash user operations
      console.error('⚠️ Failed to write audit log entry:', error);
    }
  }

  /**
   * Retrieves audit logs with optional filters and pagination (Admin only).
   */
  static async getLogs(options: {
    limit?: number;
    offset?: number;
    action?: string;
    status?: string;
  }) {
    const limit = Math.min(Math.max(options.limit || 50, 1), 100);
    const offset = Math.max(options.offset || 0, 0);

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(options.action);
    }

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    params.push(limit);
    const limitClause = `$${paramIndex++}`;
    params.push(offset);
    const offsetClause = `$${paramIndex++}`;

    const logsResult = await query(
      `
      SELECT id, user_id, user_email, user_role, action, resource_type,
             resource_id, status, ip_address, user_agent, metadata, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitClause} OFFSET ${offsetClause};
      `,
      params
    );

    return {
      total,
      limit,
      offset,
      logs: logsResult.rows,
    };
  }
}
