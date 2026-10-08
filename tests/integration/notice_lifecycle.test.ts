import test from 'node:test';
import assert from 'node:assert/strict';

test('Integration Test - Notice Creation and Database Persistence', async () => {
  const base = 'http://localhost:5000/api';

  // 1. Authenticate Faculty CSE
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty.cse@college.edu', password: 'Faculty@123' }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  const token = loginData.data.token;
  assert.ok(token);

  // 2. Post Notice
  const uniqueTitle = `Integration Notice Test ${Date.now()}`;
  const createRes = await fetch(`${base}/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: uniqueTitle,
      content: 'Integration test verifying persistence directly against PostgreSQL database.',
      department: 'CSE',
      category: 'Academic',
      priority: 'Important',
      status: 'PUBLISHED',
    }),
  });

  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  const createdNoticeId = createData.data.id;
  assert.ok(createdNoticeId);
  assert.equal(createData.data.title, uniqueTitle);

  // 3. Fetch notice by ID and verify exact persistence
  const getRes = await fetch(`${base}/notices/${createdNoticeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.data.id, createdNoticeId);
  assert.equal(getData.data.title, uniqueTitle);
  assert.equal(getData.data.status, 'PUBLISHED');
  assert.equal(getData.data.department, 'CSE');
});
