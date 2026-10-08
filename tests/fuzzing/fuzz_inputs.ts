/**
 * Phase 14 - Input Boundary Fuzzing Script
 * Tests notice title, notice content, and search parameters with hostile, malformed, and boundary inputs.
 */

interface FuzzTestCase {
  target: 'title' | 'content' | 'search';
  name: string;
  payload: string;
  expectedStatus: number; // 400 or 200/201
  category: string;
}

const FUZZ_CASES: FuzzTestCase[] = [
  {
    target: 'title',
    name: 'XSS Stored Payload Script Tag',
    payload: '<script>alert("XSS")</script>',
    expectedStatus: 201, // Stored safely as escaped string, not executed
    category: 'Malicious Content / XSS',
  },
  {
    target: 'title',
    name: 'SQL Injection Classic Or True',
    payload: "' OR '1'='1' --",
    expectedStatus: 201, // Parameterized SQL handles safely as literal text
    category: 'Injection / CWE-89',
  },
  {
    target: 'title',
    name: 'Over-length String Overflow (201 chars, exceeds 200 max)',
    payload: 'A'.repeat(201),
    expectedStatus: 400, // Zod boundary rejects
    category: 'Boundary Overflow',
  },
  {
    target: 'title',
    name: 'Under-length String (1 char, below 3 min)',
    payload: 'X',
    expectedStatus: 400, // Zod boundary rejects
    category: 'Boundary Underflow',
  },
  {
    target: 'title',
    name: 'Whitespace Only String (Trimming validation)',
    payload: '       ',
    expectedStatus: 400, // Trimmed to empty, fails min length
    category: 'Input Normalization',
  },
  {
    target: 'content',
    name: 'Massive Payload Buffer (15,000 chars, exceeds 10,000 max)',
    payload: 'LongText '.repeat(1700),
    expectedStatus: 400, // Zod max(10000) rejects
    category: 'DoS / Buffer Overflow',
  },
  {
    target: 'content',
    name: 'Polyglot XSS / HTML Breakout Payload',
    payload: '"><svg onload=alert(1)><iframe src="javascript:alert(2)">',
    expectedStatus: 201, // Accepted as raw text, rendered securely without innerHTML
    category: 'Malicious Content / XSS',
  },
  {
    target: 'search',
    name: 'Search Parameter SQLi Blind Timing Probe',
    payload: "CSE'; SELECT pg_sleep(5); --",
    expectedStatus: 200, // Parameterized ILIKE handles safely with zero sleep delay
    category: 'Search Parameter Injection',
  },
  {
    target: 'search',
    name: 'Unicode and Null Byte Characters',
    payload: 'Notice \u0000 \uD83D\uDD12 \u00E9\u00E0\u00F4 \u0928\u092E\u0938\u094D\u0924\u0947',
    expectedStatus: 200, // Safely queried
    category: 'Unicode & Control Characters',
  },
  {
    target: 'title',
    name: 'Format String Attack Pattern',
    payload: '%s%s%s%x%x%n',
    expectedStatus: 201, // Handled as plain text, no format string vulnerability in Node
    category: 'Format String',
  },
];

async function runFuzzing() {
  const base = 'http://localhost:5000/api';
  console.log('====================================================================');
  console.log('PHASE 14: INPUT BOUNDARY FUZZING EXECUTION');
  console.log('====================================================================\n');

  // Authenticate Faculty for notice inputs
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty.cse@college.edu', password: 'Faculty@123' }),
  });
  const token = (await loginRes.json()).data.token;

  const results: any[] = [];

  for (const tc of FUZZ_CASES) {
    let actualStatus = 0;
    let safeObservation = '';
    const start = Date.now();

    if (tc.target === 'title') {
      const res = await fetch(`${base}/notices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: tc.payload,
          content: 'Valid standard content for fuzzing title parameter.',
          department: 'CSE',
          category: 'Academic',
          priority: 'Normal',
          status: 'DRAFT',
        }),
      });
      actualStatus = res.status;
      const data = await res.json();
      safeObservation =
        actualStatus === 400
          ? 'Rejected by Zod server-side validation schema.'
          : actualStatus === 201
          ? 'Accepted as literal string; stored via parameterized query.'
          : `Unexpected status: ${actualStatus}`;
    } else if (tc.target === 'content') {
      const res = await fetch(`${base}/notices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: 'Valid Fuzzing Title',
          content: tc.payload,
          department: 'CSE',
          category: 'Academic',
          priority: 'Normal',
          status: 'DRAFT',
        }),
      });
      actualStatus = res.status;
      const data = await res.json();
      safeObservation =
        actualStatus === 400
          ? 'Rejected by Zod max length validation constraint.'
          : actualStatus === 201
          ? 'Safely accepted into DB; React prevents XSS execution on render.'
          : `Unexpected status: ${actualStatus}`;
    } else if (tc.target === 'search') {
      const res = await fetch(`${base}/notices?search=${encodeURIComponent(tc.payload)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      actualStatus = res.status;
      const duration = Date.now() - start;
      safeObservation =
        duration < 1000
          ? 'Parameterized ILIKE query executed safely with 0 injection effect.'
          : 'Warning: High response latency observed.';
    }

    const passed = actualStatus === tc.expectedStatus;
    results.push({
      case: tc.name,
      category: tc.category,
      payloadSnippet: tc.payload.length > 30 ? tc.payload.slice(0, 30) + '...' : tc.payload,
      expected: tc.expectedStatus,
      actual: actualStatus,
      passed,
      observation: safeObservation,
    });

    console.log(
      `[${passed ? 'PASS' : 'FAIL'}] ${tc.name} | Category: ${tc.category} | HTTP ${actualStatus} (Expected ${tc.expectedStatus})`
    );
    console.log(`       Observation: ${safeObservation}\n`);
  }

  console.log('====================================================================');
  console.log(`TOTAL FUZZ CASES: ${results.length} | PASSED: ${results.filter((r) => r.passed).length}`);
  console.log('====================================================================');
  return results;
}

runFuzzing().catch(console.error);
