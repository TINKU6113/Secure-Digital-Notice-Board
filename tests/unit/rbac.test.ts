import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoticeSchema } from '../../backend/src/modules/notices/notices.schema.js';

test('Unit Test - RBAC & Notice Schema Validation', async (t) => {
  await t.test('accepts valid notice data', () => {
    const valid = createNoticeSchema.safeParse({
      title: 'Valid Notice Title',
      content: 'Comprehensive notice body exceeding minimum characters.',
      department: 'CSE',
      category: 'Academic',
      priority: 'Important',
      status: 'PUBLISHED',
    });
    assert.equal(valid.success, true);
  });

  await t.test('rejects title shorter than 3 characters', () => {
    const invalid = createNoticeSchema.safeParse({
      title: 'No',
      content: 'Comprehensive notice body.',
      department: 'CSE',
      category: 'Academic',
    });
    assert.equal(invalid.success, false);
  });

  await t.test('rejects invalid department enum', () => {
    const invalid = createNoticeSchema.safeParse({
      title: 'Valid Title',
      content: 'Comprehensive notice body.',
      department: 'INVALID_DEPT',
      category: 'Academic',
    });
    assert.equal(invalid.success, false);
  });

  await t.test('rejects expiry date earlier than scheduled date', () => {
    const invalid = createNoticeSchema.safeParse({
      title: 'Valid Title',
      content: 'Comprehensive notice body.',
      department: 'CSE',
      category: 'Academic',
      scheduled_at: '2026-11-20T10:00:00.000Z',
      expires_at: '2026-11-10T10:00:00.000Z', // 10 days before scheduled
    });
    assert.equal(invalid.success, false);
  });
});
