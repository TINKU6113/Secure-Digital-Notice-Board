import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthUser } from '../types/index.js';

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      fullName: user.full_name,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN as any,
      algorithm: 'HS256',
    }
  );
}

export function verifyToken(token: string): any {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
}
