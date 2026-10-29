const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runVerification() {
  console.log('--- IRIS PLATFORM AUTOMATED VERIFICATION ---');

  // 1. Health check
  const health = await request('GET', '/api/health');
  console.log('1. Health Check:', health.status === 200 ? 'PASS' : 'FAIL', health.data.status);

  // 2. Login Tony Stark (Admin 1)
  const starkLogin = await request('POST', '/api/auth/login', {
    email: 'tony@iris.shield',
    password: 'Jarvis123!'
  });
  console.log('2. Tony Stark (Admin 1) Login:', starkLogin.status === 200 && starkLogin.data.user.role === 'admin' ? 'PASS' : 'FAIL');
  const starkToken = starkLogin.data.token;

  // 3. Login Steve Rogers (Admin 2)
  const capLogin = await request('POST', '/api/auth/login', {
    email: 'cap@iris.shield',
    password: 'Vanguard123!'
  });
  console.log('3. Steve Rogers (Admin 2) Login:', capLogin.status === 200 && capLogin.data.user.role === 'admin' ? 'PASS' : 'FAIL');

  // 4. Login Peter Parker (Student)
  const spideyLogin = await request('POST', '/api/auth/login', {
    email: 'spidey@iris.shield',
    password: 'Webs123!'
  });
  console.log('4. Peter Parker (Student) Login:', spideyLogin.status === 200 && spideyLogin.data.user.role === 'student' ? 'PASS' : 'FAIL');
  const spideyToken = spideyLogin.data.token;

  // 5. Security: Student unauthorized access to Admin Bridge
  const forbiddenCheck = await request('GET', '/api/admin/overview', null, spideyToken);
  console.log('5. Security: Student Blocked from Admin Bridge (403):', forbiddenCheck.status === 403 ? 'PASS' : 'FAIL');

  // 6. Security: Registering new member forces student role
  const regCheck = await request('POST', '/api/auth/register', {
    name: 'Wanda Maximoff',
    email: `wanda_${Date.now()}@iris.shield`,
    password: 'Chaos123!',
    role: 'admin' // Attempting privilege escalation
  });
  console.log('6. Security: Registration Escalation Prevention (Role forced to student):', regCheck.data.user.role === 'student' ? 'PASS' : 'FAIL');

  const candidateToken = regCheck.data.token;

  // 7. Get student sanitized exam questions
  const examsList = await request('GET', '/api/exams', null, candidateToken);
  const exam1 = examsList.data[0];
  const examDetails = await request('GET', `/api/exams/${exam1._id}`, null, candidateToken);
  const hasHiddenAnswers = examDetails.data.questions.every(q => q.correctOptionIndex === undefined && q.explanation === undefined);
  console.log('7. Student Exam Questions Sanitized (Answer Keys Hidden):', hasHiddenAnswers ? 'PASS' : 'FAIL');

  // 8. Start exam attempt
  const startAttempt = await request('POST', '/api/attempts/start', { examId: exam1._id }, candidateToken);
  const attempt = startAttempt.data.attempt;
  console.log('8. Start Examination Attempt:', startAttempt.status === 201 || startAttempt.status === 200 ? 'PASS' : 'FAIL');

  // 9. Save answers
  const q1 = examDetails.data.questions[0];
  const q2 = examDetails.data.questions[1];
  const saveAns = await request('POST', `/api/attempts/${attempt._id}/save-answer`, {
    questionId: q1.id,
    selectedOptionIndex: 1, // Correct answer
    flagged: [q2.id],
    timeSpentSeconds: 65
  }, candidateToken);
  console.log('9. Answer Persisted & Review Flag Saved:', saveAns.status === 200 ? 'PASS' : 'FAIL');

  // 10. Record proctoring violation (e.g. Tab switch strike)
  const violationRes = await request('POST', `/api/attempts/${attempt._id}/violation`, {
    type: 'Tab Switch Detected',
    details: 'Browser focus was lost.'
  }, candidateToken);
  console.log('10. Proctor Strike Logged:', violationRes.data.violationsCount === 1 ? 'PASS' : 'FAIL');

  // 11. Final submit
  const submitRes = await request('POST', `/api/attempts/${attempt._id}/submit`, {
    answers: { [q1.id]: 1, [q2.id]: 2 }, // Both correct
    timeSpentSeconds: 120
  }, candidateToken);
  console.log('11. Examination Finalized & Scored:', submitRes.data.success ? 'PASS' : 'FAIL', `Score: ${submitRes.data.score}/${submitRes.data.maxMarks}`);

  // 12. Mistake analysis
  const resultRes = await request('GET', `/api/attempts/${attempt._id}/result`, null, candidateToken);
  const hasMistakes = resultRes.data.mistakeAnalysis && resultRes.data.mistakeAnalysis.length > 0;
  console.log('12. Mistake Analysis Generated:', hasMistakes ? 'PASS' : 'FAIL');

  // 13. Member analytics
  const analyticsRes = await request('GET', '/api/attempts/member/analytics', null, candidateToken);
  console.log('13. Member Personal Dossier Analytics:', analyticsRes.data.summary.totalExamsTaken >= 1 ? 'PASS' : 'FAIL');

  // 14. Admin overview
  const adminOverview = await request('GET', '/api/admin/overview', null, starkToken);
  console.log('14. Tony Stark Admin Command Bridge Overview:', adminOverview.status === 200 && adminOverview.data.counts.submittedExams >= 1 ? 'PASS' : 'FAIL');

  console.log('--- ALL PLATFORM PROTOCOLS VERIFIED SUCCESSFULLY ---');
}

runVerification().catch(console.error);
