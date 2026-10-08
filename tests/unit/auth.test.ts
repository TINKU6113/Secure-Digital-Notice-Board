import test from 'node:test';
import assert from 'node:assert/strict';
import { loginSchema } from '../../backend/src/modules/auth/auth.schema.js';
import { generateToken, verifyToken } from '../../backend/src/utils/jwt.js';
import { AuthUser } from '../../backend/src/types/index.js';

test('Unit Test - Auth: loginSchema validation', async (t) => {
  await t.test('accepts valid credentials format', () => {
    const valid = loginSchema.safeParse({
      email: 'student@college.edu',
      password: 'Student@123',
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.email, 'student@college.edu');
    }
  });

  await t.test('rejects malformed email format', () => {
    const invalid = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'Student@123',
    });
    assert.equal(invalid.success, false);
  });

  await t.test('rejects empty password', () => {
    const invalid = loginSchema.safeParse({
      email: 'student@college.edu',
      password: '',
    });
    assert.equal(invalid.success, false);
  });

  await t.test('normalizes email to lowercase', () => {
    const normalized = loginSchema.parse({
      email: 'STUDENT@COLLEGE.EDU',
      password: 'Password123',
    });
    assert.equal(normalized.email, 'student@college.edu');
  });
});

test('Unit Test - Auth: JWT generation and verification', async (t) => {
  const mockUser: AuthUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'faculty.cse@college.edu',
    full_name: 'Dr. Alan Turing',
    role: 'FACULTY',
    department: 'CSE',
  };

  await t.test('generates valid token with claims', () => {
    const token = generateToken(mockUser);
    assert.equal(typeof token, 'string');
    assert.ok(token.length > 20);

    const decoded = verifyToken(token);
    assert.equal(decoded.sub, mockUser.id);
    assert.equal(decoded.email, mockUser.email);
    assert.equal(decoded.role, mockUser.role);
    assert.equal(decoded.department, mockUser.department);
  });

  await t.test('rejects tampered token', () => {
    const token = generateToken(mockUser);
    const tampered = token.slice(0, -5) + 'abcde';
    assert.throws(() => verifyToken(tampered));
  });
});
