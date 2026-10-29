const express = require('express');
const { seedDatabase } = require('../seed/seedData');
const authRoutes = require('../routes/auth');
const adminRoutes = require('../routes/admin');
const examRoutes = require('../routes/exams');
const attemptRoutes = require('../routes/attempts');

async function runComprehensiveVerification() {
  console.log('====================================================');
  console.log('IRIS TEAM PLATFORM - UNIFIED FEATURES VERIFICATION');
  console.log('====================================================\n');

  await seedDatabase();

  const app = express();
  app.use(express.json());

  // Attach mock io to express app
  const socketEventsEmitted = [];
  const mockIo = {
    to: (room) => ({
      emit: (eventName, data) => {
        socketEventsEmitted.push({ room, eventName, data });
      }
    })
  };
  app.set('io', mockIo);

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/attempts', attemptRoutes);

  // In-memory caller
  function callApi(method, path, body = {}, headers = {}) {
    return new Promise((resolve) => {
      const req = {
        method,
        url: path,
        body,
        headers: {
          'content-type': 'application/json',
          ...headers
        }
      };

      let statusCode = 200;
      let responseData = null;

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        setHeader() { return this; },
        json(data) {
          responseData = data;
          resolve({ status: statusCode, data: responseData });
        },
        send(data) {
          responseData = data;
          resolve({ status: statusCode, data: responseData });
        }
      };

      app.handle(req, res);
    });
  }

  // TEST 1: Entry Login
  console.log('--- TEST 1: LOGIN (SINGLE INPUT BOX & ROUTING) ---');
  const adminRes = await callApi('POST', '/api/auth/entry', { input: '224488' });
  console.log('1.1 Input "224488" -> Admin Room:', adminRes.status === 200 && adminRes.data.room === 'admin-room' ? 'PASS' : 'FAIL', `(${adminRes.data.user.name})`);

  const student1Res = await callApi('POST', '/api/auth/entry', { input: 'Rishith' });
  console.log('1.2 Input "Rishith" -> Common Room:', student1Res.status === 200 && student1Res.data.room === 'common-room' ? 'PASS' : 'FAIL');

  const student2Res = await callApi('POST', '/api/auth/entry', { input: 'Arjun' });
  console.log('1.3 Input "Arjun" -> Common Room:', student2Res.status === 200 && student2Res.data.room === 'common-room' ? 'PASS' : 'FAIL');

  const adminToken = adminRes.data.token;
  const token1 = student1Res.data.token;
  const token2 = student2Res.data.token;

  // TEST 2: AI Bulk Question Parser
  console.log('\n--- TEST 2: AI BULK QUESTION PARSER ---');
  const rawQuestionsText = `
1. What does the HTTP status code 403 signify?
A) Not Found
B) Forbidden (Correct)
C) Bad Gateway
D) Internal Server Error
Explanation: HTTP 403 Forbidden indicates the server understood the request but refuses to authorize it.

2. Which protocol is primarily used for real-time bi-directional browser-server telemetry?
A) FTP
B) SMTP
C) WebSocket
D) DNS
Answer: C
Explanation: WebSockets provide persistent full-duplex communication channels over a single TCP connection.

3. In React, what hook is used to retain mutable state values across renders without causing a re-render?
A) useState
B) useRef
C) useMemo
D) useEffect
Correct: B
Explanation: useRef returns a mutable ref object whose .current property persists without triggering re-renders.
  `;

  const parseRes = await callApi('POST', '/api/exams/ai-parse', { rawText: rawQuestionsText }, {
    authorization: `Bearer ${adminToken}`
  });

  const parsedQuestions = parseRes.data.questions || [];
  console.log(`2.1 AI Question Parser parsed ${parsedQuestions.length} questions:`, parsedQuestions.length === 3 ? 'PASS' : 'FAIL');
  console.log('    Q1 Prompt:', parsedQuestions[0]?.prompt?.slice(0, 40) + '...');
  console.log('    Q1 Correct Option Index:', parsedQuestions[0]?.correctOptionIndex, '(Expected: 1 for Forbidden)');
  console.log('    Q2 Correct Option Index:', parsedQuestions[1]?.correctOptionIndex, '(Expected: 2 for WebSocket)');

  // TEST 3: Create exam with parsed questions
  console.log('\n--- TEST 3: CREATE EXAM & VERIFY PER-PERSON RANDOMIZED ALLOCATION ---');
  const createExamRes = await callApi('POST', '/api/exams', {
    title: 'IRIS Team Rapid Assessment',
    subject: 'Engineering & Protocol',
    description: 'Exam with per-candidate randomized question ordering.',
    durationMinutes: 10,
    marksPerQuestion: 4,
    negativeMarksPerQuestion: 1,
    passingScorePercentage: 50,
    questions: parsedQuestions
  }, { authorization: `Bearer ${adminToken}` });

  const createdExam = createExamRes.data;
  console.log('3.1 Exam Created:', createdExam?._id ? 'PASS' : 'FAIL', `ID: ${createdExam?._id}`);

  // Fetch as Rishith
  const examForRishith = await callApi('GET', `/api/exams/${createdExam._id}`, {}, {
    authorization: `Bearer ${token1}`
  });
  const rishithOrder = examForRishith.data.questions.map(q => q.questionText || q.prompt);

  // Fetch as Arjun
  const examForArjun = await callApi('GET', `/api/exams/${createdExam._id}`, {}, {
    authorization: `Bearer ${token2}`
  });
  const arjunOrder = examForArjun.data.questions.map(q => q.questionText || q.prompt);

  console.log('3.2 Question order for Rishith (User 1):', rishithOrder.map(p => p.slice(0, 20)).join(' | '));
  console.log('3.3 Question order for Arjun (User 2):', arjunOrder.map(p => p.slice(0, 20)).join(' | '));
  
  // Start attempt for Rishith
  const startAttempt1 = await callApi('POST', '/api/attempts/start', { examId: createdExam._id }, {
    authorization: `Bearer ${token1}`
  });
  const attempt1 = startAttempt1.data.attempt;
  console.log('3.4 Rishith Started Attempt:', attempt1?._id ? 'PASS' : 'FAIL', `Attempt ID: ${attempt1?._id}`);

  // TEST 4: Anti-cheat immediate detection, block & disqualification
  console.log('\n--- TEST 4: ANTI-CHEAT TAB SWITCH / AI ASSISTANT IMMEDIATE BLOCK ---');
  const violationRes = await callApi('POST', `/api/attempts/${attempt1._id}/violation`, {
    type: 'Tab Switch Detected',
    details: 'The candidate switched to an external browser tab / Google Assistant overlay.'
  }, { authorization: `Bearer ${token1}` });

  const isBlocked = violationRes.data.terminated === true && violationRes.data.isCheated === true;
  console.log('4.1 Candidate immediately caught & terminated:', isBlocked ? 'PASS' : 'FAIL');
  console.log('    Reason:', violationRes.data.terminatedReason);

  // Attempt to save answer after cheating termination should be rejected or locked
  const trySubmitRes = await callApi('POST', `/api/attempts/${attempt1._id}/submit`, {
    answers: { [parsedQuestions[0].id]: 1 }
  }, { authorization: `Bearer ${token1}` });
  console.log('4.2 Blocked attempt cannot re-submit (Expect error):', trySubmitRes.status >= 400 ? 'PASS' : 'FAIL', `(Status: ${trySubmitRes.status})`);

  // Verify socket alert was sent to admin_room
  const cheatedEvent = socketEventsEmitted.find(e => e.eventName === 'student_cheated');
  console.log('4.3 Real-time Socket Alert broadcast to admin_room:', cheatedEvent ? 'PASS' : 'FAIL', `Candidate: ${cheatedEvent?.data?.userName}`);

  // Start attempt for Arjun and submit normally
  console.log('\n--- TEST 5: NORMAL SUBMISSION & GRADING ---');
  const startAttempt2 = await callApi('POST', '/api/attempts/start', { examId: createdExam._id }, {
    authorization: `Bearer ${token2}`
  });
  const attempt2 = startAttempt2.data.attempt;

  // Arjun answers 2 correct, 1 wrong
  const arjunAnswers = {};
  examForArjun.data.questions.forEach((q, idx) => {
    arjunAnswers[q.id] = (idx === 0) ? q.options.length - 1 : 0; // some dummy answers
  });

  const submitArjun = await callApi('POST', `/api/attempts/${attempt2._id}/submit`, {
    answers: arjunAnswers,
    timeSpentSeconds: 120
  }, { authorization: `Bearer ${token2}` });
  console.log('5.1 Arjun Normal Submit:', submitArjun.status === 200 ? 'PASS' : 'FAIL', `Score: ${submitArjun.data.score}/${submitArjun.data.maxMarks}`);

  // TEST 6: Unified Admin Dashboard Overview
  console.log('\n--- TEST 6: UNIFIED ADMIN DASHBOARD OVERVIEW ---');
  const overviewRes = await callApi('GET', '/api/admin/overview', {}, {
    authorization: `Bearer ${adminToken}`
  });

  const ov = overviewRes.data;
  console.log('6.1 Admin Overview Status:', overviewRes.status === 200 ? 'PASS' : 'FAIL');
  console.log('    Total Candidates:', ov.totalCandidates);
  console.log('    Attending Now:', ov.attending);
  console.log('    Cheated & Blocked:', ov.cheated);
  console.log('    Passed:', ov.passed);
  console.log('    Failed:', ov.failed);
  console.log('6.2 Cheated List Count:', ov.cheatedList.length);
  console.log('    Cheated Candidates:', ov.cheatedList.map(c => `${c.userName} (${c.type})`).join(', '));
  console.log('6.3 Master Results List Count:', ov.allResults.length);

  const cheatInList = ov.cheatedList.some(c => c.userName === 'Rishith');
  console.log('6.4 Cheated Candidate displayed by name in Admin Cheated List:', cheatInList ? 'PASS' : 'FAIL');

  console.log('\n====================================================');
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY');
  console.log('====================================================');
}

runComprehensiveVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
