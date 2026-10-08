import bcrypt from 'bcryptjs';
import { query } from '../../db/pool.js';
import { generateToken } from '../../utils/jwt.js';
import { AuthUser } from '../../types/index.js';
import { AuditService } from '../audit/audit.service.js';

// Dummy hash to prevent timing attacks when an email does not exist
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export class AuthService {
  /**
   * Authenticate user with constant-time password verification.
   * Defends against CWE-208 (Information Exposure Through Timing Discrepancy)
   * and CWE-204 (Observable Response Discrepancy / Username Enumeration).
   */
  static async login(
    email: string,
    plainPassword: string,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<{ token: string; user: AuthUser }> {
    const userRes = await query(
      `
      SELECT id, email, password_hash, full_name, role, department, is_active
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    const user = userRes.rows[0];

    // Always perform bcrypt compare to maintain constant execution time
    const hashToCompare = user ? user.password_hash : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(plainPassword, hashToCompare);

    if (!user || !user.is_active || !isPasswordValid) {
      await AuditService.record({
        userId: user ? user.id : null,
        userEmail: email,
        userRole: user ? user.role : null,
        action: 'LOGIN_FAILURE',
        resourceType: 'AUTH',
        resourceId: email,
        status: 'FAILURE',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          reason: !user ? 'USER_NOT_FOUND' : !user.is_active ? 'ACCOUNT_INACTIVE' : 'PASSWORD_MISMATCH',
        },
      });

      // Generic message to prevent username enumeration
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      department: user.department,
    };

    const token = generateToken(authUser);

    await AuditService.record({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'LOGIN_SUCCESS',
      resourceType: 'AUTH',
      resourceId: user.id,
      status: 'SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        role: user.role,
        department: user.department,
      },
    });

    return { token, user: authUser };
  }

  static async logout(
    user: AuthUser,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await AuditService.record({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'LOGOUT',
      resourceType: 'AUTH',
      resourceId: user.id,
      status: 'SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}
