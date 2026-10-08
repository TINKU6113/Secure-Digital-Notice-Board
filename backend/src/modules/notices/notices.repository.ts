import { query } from '../../db/pool.js';
import { Notice } from '../../types/index.js';

export interface NoticeFilterOptions {
  role: string;
  userId: string;
  search?: string;
  department?: string;
  category?: string;
  priority?: string;
  status?: string;
  scope?: string;
  limit: number;
  offset: number;
}

export class NoticesRepository {
  /**
   * Promotes mature scheduled notices and archives expired notices.
   */
  static async refreshLifecycles(): Promise<void> {
    const now = new Date();
    await query(
      `
      UPDATE notices
      SET status = 'PUBLISHED', updated_at = NOW()
      WHERE status = 'SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at <= $1;
      `,
      [now]
    );

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
   * Query notices using safe parameterized SQL with dynamic filter bindings.
   */
  static async findMany(
    options: NoticeFilterOptions
  ): Promise<{ notices: Notice[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    // Role-based filtering conditions
    if (options.role === 'STUDENT') {
      conditions.push(`n.status = 'PUBLISHED'`);
      conditions.push(`(n.scheduled_at IS NULL OR n.scheduled_at <= NOW())`);
      conditions.push(`(n.expires_at IS NULL OR n.expires_at > NOW())`);
    } else if (options.role === 'FACULTY') {
      if (options.scope === 'my') {
        conditions.push(`n.author_id = $${pIdx++}`);
        params.push(options.userId);
        if (options.status) {
          conditions.push(`n.status = $${pIdx++}`);
          params.push(options.status);
        }
      } else {
        if (options.status && options.status !== 'PUBLISHED') {
          conditions.push(`(n.author_id = $${pIdx++} AND n.status = $${pIdx++})`);
          params.push(options.userId, options.status);
        } else {
          conditions.push(`(n.status = 'PUBLISHED' OR n.author_id = $${pIdx++})`);
          params.push(options.userId);
        }
      }
    } else if (options.role === 'ADMIN') {
      if (options.status) {
        conditions.push(`n.status = $${pIdx++}`);
        params.push(options.status);
      }
      if (options.scope === 'my') {
        conditions.push(`n.author_id = $${pIdx++}`);
        params.push(options.userId);
      }
    }

    // Common search filter (parameterized ILIKE to prevent SQL injection)
    if (options.search) {
      conditions.push(`(n.title ILIKE $${pIdx} OR n.content ILIKE $${pIdx})`);
      params.push(`%${options.search}%`);
      pIdx++;
    }

    if (options.department) {
      conditions.push(`n.department = $${pIdx++}`);
      params.push(options.department);
    }

    if (options.category) {
      conditions.push(`n.category = $${pIdx++}`);
      params.push(options.category);
    }

    if (options.priority) {
      conditions.push(`n.priority = $${pIdx++}`);
      params.push(options.priority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) as total FROM notices n ${whereClause};`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    params.push(options.limit);
    const limitClause = `$${pIdx++}`;
    params.push(options.offset);
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

    return { notices: selectResult.rows, total };
  }

  /**
   * Fetch single notice by primary key ID.
   */
  static async findById(id: string): Promise<Notice | null> {
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

    return result.rowCount && result.rowCount > 0 ? result.rows[0] : null;
  }

  /**
   * Insert a new notice record.
   */
  static async create(data: {
    title: string;
    content: string;
    authorId: string;
    department: string;
    category: string;
    priority: string;
    status: string;
    scheduledAt: Date | null;
    expiresAt: Date | null;
  }): Promise<Notice> {
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
        data.authorId,
        data.department,
        data.category,
        data.priority,
        data.status,
        data.scheduledAt,
        data.expiresAt,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update an existing notice by ID.
   */
  static async update(
    id: string,
    data: {
      title?: string;
      content?: string;
      department?: string;
      category?: string;
      priority?: string;
      status?: string;
      scheduledAt: Date | null;
      expiresAt: Date | null;
    }
  ): Promise<Notice> {
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
        data.status || null,
        data.scheduledAt,
        data.expiresAt,
        id,
      ]
    );

    return result.rows[0];
  }

  /**
   * Delete an existing notice by ID.
   */
  static async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM notices WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Retrieve aggregated system notice metrics.
   */
  static async getStatistics() {
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
