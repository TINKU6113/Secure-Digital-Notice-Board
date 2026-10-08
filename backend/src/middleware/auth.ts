import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { query } from '../db/pool.js';
import { AuthenticatedRequest, UserRole } from '../types/index.js';
import { AuditService } from '../modules/audit/audit.service.js';

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is missing or malformed',
        },
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is empty',
        },
      });
      return;
    }

    let decoded: any;
    try {
      decoded = verifyToken(token);
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
        },
      });
      return;
    }

    // Verify user identity in DB and ensure account is active
    const userRes = await query(
      'SELECT id, email, full_name, role, department, is_active FROM users WHERE id = $1',
      [decoded.sub]
    );

    if (userRes.rowCount === 0 || !userRes.rows[0].is_active) {
      res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'User account is disabled or does not exist',
        },
      });
      return;
    }

    const dbUser = userRes.rows[0];
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      full_name: dbUser.full_name,
      role: dbUser.role as UserRole,
      department: dbUser.department,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-Based Access Control (RBAC) middleware.
 * Validates that authenticated user has one of the required roles.
 * Logs unauthorized attempts to audit trail.
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for this resource',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Record unauthorized access attempt in audit log
      AuditService.record({
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'UNAUTHORIZED_ACCESS',
        resourceType: 'AUTH',
        resourceId: req.originalUrl,
        status: 'FAILURE',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: {
          attemptedUrl: req.originalUrl,
          method: req.method,
          requiredRoles: allowedRoles,
          actualRole: req.user.role,
        },
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: You do not possess the required permissions',
        },
      });
      return;
    }

    next();
  };
}
