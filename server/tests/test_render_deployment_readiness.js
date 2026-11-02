const http = require('http');
const path = require('path');
const fs = require('fs');

// Set test environment variables
process.env.PORT = '5099';
process.env.HOST = '0.0.0.0';
process.env.JWT_SECRET = 'TEST_RENDER_DEPLOYMENT_SECRET_KEY_2026';
process.env.CORS_ORIGIN = '*';

const { app, server } = require('../server');

function makeRequest(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      ...headers
    };

    const req = http.request({
      hostname: '127.0.0.1',
      port: 5099,
      path: urlPath,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runDeploymentReadinessTests() {
  console.log('===============================================================');
  console.log('  RENDER DEPLOYMENT READINESS & E2E PROTOCOL VERIFICATION      ');
  console.log('===============================================================\n');

  // Allow server startup if not yet listening
  await new Promise(r => setTimeout(r, 600));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Root / endpoint check
    const rootRes = await makeRequest('GET', '/');
    assert(rootRes.status === 200, `1. GET / returns HTTP 200 OK (Status: ${rootRes.status})`);

    // 2. Health check /api/health
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.status === 200, `2. GET /api/health returns HTTP 200 (Status: ${healthRes.status})`);
    assert(healthRes.data && healthRes.data.status === 'online', '   Health endpoint returns status: online');

    // 3. CORS Preflight on /api/auth/entry
    const preflightRes = await makeRequest('OPTIONS', '/api/auth/entry', null, {
      'Origin': 'https://mocktest-client.onrender.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, Authorization'
    });
    assert([200, 204].includes(preflightRes.status), `3. OPTIONS /api/auth/entry preflight returns 200/204 (Status: ${preflightRes.status})`);
    assert(Boolean(preflightRes.headers['access-control-allow-origin']), '   Access-Control-Allow-Origin header is present');

    // 4. HTTP Method Not Allowed (405) Guard
    const methodNotAllowedRes = await makeRequest('GET', '/api/auth/entry');
    assert(methodNotAllowedRes.status === 405, `4. GET /api/auth/entry returns HTTP 405 Method Not Allowed (Status: ${methodNotAllowedRes.status})`);
    assert(methodNotAllowedRes.data && methodNotAllowedRes.data.error.includes('Method GET not allowed'), '   Returns descriptive 405 JSON error');

    // 5. Room Entry: Admin Login (Tony Stark - 224488)
    const tonyRes = await makeRequest('POST', '/api/auth/entry', { input: '224488' }, {
      'Origin': 'https://mocktest-client.onrender.com'
    });
    assert(tonyRes.status === 200, `5. Admin Room Entry (Tony Stark): Status 200`);
    assert(tonyRes.data.room === 'admin-room' && tonyRes.data.user.role === 'admin', '   Route successfully resolved to admin-room with admin role');
    const adminToken = tonyRes.data.token;

    // 6. Room Entry: Admin Login (Steve Rogers - 1941)
    const capRes = await makeRequest('POST', '/api/auth/entry', { input: '1941' });
    assert(capRes.status === 200, `6. Admin Room Entry (Steve Rogers): Status 200`);
    assert(capRes.data.room === 'admin-room' && capRes.data.user.name === 'Steve Rogers', '   Route successfully resolved to Steve Rogers in admin-room');

    // 7. Room Entry: Common Room (Student - Rishith)
    const studentRes = await makeRequest('POST', '/api/auth/entry', { input: 'Rishith' });
    assert(studentRes.status === 200, `7. Candidate Room Entry (Rishith): Status 200`);
    assert(studentRes.data.room === 'common-room' && studentRes.data.user.role === 'student', '   Route resolved to common-room with student role');
    const studentToken = studentRes.data.token;

    // 8. Room Entry Security: Typing Admin Name "Tony Stark" forces student role
    const spoofRes = await makeRequest('POST', '/api/auth/entry', { input: 'Tony Stark' });
    assert(spoofRes.status === 200, `8. Admin Name Spoof Defense: Status 200`);
    assert(spoofRes.data.room === 'common-room' && spoofRes.data.user.role === 'student', '   Role strictly forced to student in common-room');

    // 9. Unauthorized code rejection (1234)
    const unauthRes = await makeRequest('POST', '/api/auth/entry', { input: '1234' });
    assert(unauthRes.status === 401, `9. Unauthorized numeric code (1234): HTTP 401 Access Denied`);

    // 10. Exam Retrieval & Anti-Leak Sanitization
    const examsRes = await makeRequest('GET', '/api/exams', null, { 'Authorization': `Bearer ${studentToken}` });
    assert(examsRes.status === 200, `10. Candidate GET /api/exams: Status 200`);
    const examId = examsRes.data[0]._id;
    const examDetailRes = await makeRequest('GET', `/api/exams/${examId}`, null, { 'Authorization': `Bearer ${studentToken}` });
    const noAnswersLeaked = examDetailRes.data.questions.every(q => q.correctOptionIndex === undefined);
    assert(noAnswersLeaked, '    Candidate questions are strictly sanitized (No correct answers leaked)');

    // 10b. Admin Starts Quiz (sets isLive: true)
    const startQuizRes = await makeRequest('POST', `/exams/${examId}/start-quiz`, {}, { 'Authorization': `Bearer ${adminToken}` });
    // Also try /api/exams/start-latest
    await makeRequest('POST', '/api/exams/start-latest', {}, { 'Authorization': `Bearer ${adminToken}` });

    // 11. Start Attempt
    const attemptRes = await makeRequest('POST', '/api/attempts/start', { examId }, { 'Authorization': `Bearer ${studentToken}` });
    assert([200, 201].includes(attemptRes.status), `11. Start Exam Attempt: Status ${attemptRes.status}`);
    const attemptId = attemptRes.data.attempt._id;

    // 12. Save Answer
    const q1 = examDetailRes.data.questions[0];
    const saveAnsRes = await makeRequest('POST', `/api/attempts/${attemptId}/save-answer`, {
      questionId: q1.id,
      selectedOptionIndex: 3,
      flagged: [],
      timeSpentSeconds: 40
    }, { 'Authorization': `Bearer ${studentToken}` });
    assert(saveAnsRes.status === 200, `12. Save Answer to Attempt: Status 200`);

    // 13. Submit Attempt & Score Calculation
    const submitRes = await makeRequest('POST', `/api/attempts/${attemptId}/submit`, {
      answers: { [q1.id]: 3 },
      timeSpentSeconds: 85
    }, { 'Authorization': `Bearer ${studentToken}` });
    assert(submitRes.status === 200 && submitRes.data.success, `13. Final Exam Submission: Score ${submitRes.data.score}/${submitRes.data.maxMarks}`);

    // 14. Retrieve Mistake Analysis
    const resultRes = await makeRequest('GET', `/api/attempts/${attemptId}/result`, null, { 'Authorization': `Bearer ${studentToken}` });
    assert(resultRes.status === 200, `14. Examination Result Retrieval: Status 200`);
    assert(Boolean(resultRes.data.mistakeAnalysis), '    Mistake analysis and concept breakdown returned');

    // 15. Admin Command Bridge Overview
    const adminOverviewRes = await makeRequest('GET', '/api/admin/overview', null, { 'Authorization': `Bearer ${adminToken}` });
    assert(adminOverviewRes.status === 200, `15. Admin Command Bridge Overview: Status 200`);
    assert(adminOverviewRes.data.counts && adminOverviewRes.data.counts.totalExams >= 1, '    Admin telemetry verified');

    console.log('\n===============================================================');
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('===============================================================');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runDeploymentReadinessTests();
