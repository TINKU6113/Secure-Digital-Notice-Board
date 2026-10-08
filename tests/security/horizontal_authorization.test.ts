import test from 'node:test';
import assert from 'node:assert/strict';

test('Security E2E Test - Horizontal Authorization Defense & Audit Trail', async () => {
  const base = 'http://localhost:5000/api';

  // 1. Faculty CSE (Author) logs in
  const loginAuthor = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty.cse@college.edu', password: 'Faculty@123' }),
  });
  const tokenAuthor = (await loginAuthor.json()).data.token;

  // 2. Author creates notice
  const createRes = await fetch(`${base}/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAuthor}`,
    },
    body: JSON.stringify({
      title: 'Protected Notice for Horizontal Authorization Test',
      content: 'This notice is authored by Faculty CSE and must not be editable by Faculty CYS.',
      department: 'CSE',
      category: 'Academic',
      priority: 'Important',
      status: 'PUBLISHED',
    }),
  });
  const noticeId = (await createRes.json()).data.id;
  assert.ok(noticeId);

  // 3. Faculty CYS (Attacker / Peer) logs in
  const loginAttacker = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty.cys@college.edu', password: 'Faculty@123' }),
  });
  const tokenAttacker = (await loginAttacker.json()).data.token;

  // 4. Peer faculty attempts unauthorized modification
  const tamperRes = await fetch(`${base}/notices/${noticeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAttacker}`,
    },
    body: JSON.stringify({
      title: 'Tampered Notice by Unauthorized Faculty CYS',
    }),
  });

  // Verification 1: Server must return 403 Forbidden
  assert.equal(tamperRes.status, 403, 'Cross-user modification must return 403 Forbidden');
  const tamperData = await tamperRes.json();
  assert.equal(tamperData.error?.code, 'FORBIDDEN');

  // 5. Admin logs in and checks audit trail
  const adminLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@college.edu', password: 'Admin@123' }),
  });
  const adminToken = (await adminLogin.json()).data.token;

  const auditRes = await fetch(`${base}/audit-logs?action=UNAUTHORIZED_ACCESS`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(auditRes.status, 200);
  const auditData = await auditRes.json();

  // Verification 2: Audit log must record the unauthorized access attempt
  const violationLog = auditData.data.logs.find(
    (l: any) =>
      l.user_email === 'faculty.cys@college.edu' &&
      l.resource_id === noticeId &&
      l.action === 'UNAUTHORIZED_ACCESS'
  );
  assert.ok(violationLog, 'Unauthorized horizontal access must be recorded in audit logs');
  assert.equal(violationLog.status, 'FAILURE');
});
