import test from 'node:test';
import assert from 'node:assert/strict';

test('E2E System Test - Faculty Publishes Notice -> Student Views Notice', async () => {
  const base = 'http://localhost:5000/api';

  // Step 1: Faculty logs in
  const facultyLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty.cys@college.edu', password: 'Faculty@123' }),
  });
  assert.equal(facultyLogin.status, 200);
  const facultyToken = (await facultyLogin.json()).data.token;

  // Step 2: Faculty publishes new notice
  const e2eTitle = `E2E Announcement ${Date.now()}`;
  const noticeRes = await fetch(`${base}/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      title: e2eTitle,
      content: 'This announcement must be visible to students upon immediate publication.',
      department: 'CYS',
      category: 'Workshop',
      priority: 'Important',
      status: 'PUBLISHED',
    }),
  });
  assert.equal(noticeRes.status, 201);
  const publishedId = (await noticeRes.json()).data.id;

  // Step 3: Student logs in
  const studentLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student.cys@college.edu', password: 'Student@123' }),
  });
  assert.equal(studentLogin.status, 200);
  const studentToken = (await studentLogin.json()).data.token;

  // Step 4: Student queries notice board
  const studentViewRes = await fetch(`${base}/notices?search=${encodeURIComponent(e2eTitle)}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(studentViewRes.status, 200);
  const studentData = await studentViewRes.json();
  const foundNotice = studentData.data.notices.find((n: any) => n.id === publishedId);

  // Step 5: Verification that student sees the published notice
  assert.ok(foundNotice, 'Student should see the newly published notice on the board');
  assert.equal(foundNotice.title, e2eTitle);
  assert.equal(foundNotice.status, 'PUBLISHED');
  assert.equal(foundNotice.department, 'CYS');
});
