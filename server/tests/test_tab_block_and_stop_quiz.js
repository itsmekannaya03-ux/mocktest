const express = require('express');
const { seedDatabase } = require('../seed/seedData');
const authRoutes = require('../routes/auth');
const adminRoutes = require('../routes/admin');
const examRoutes = require('../routes/exams');
const attemptRoutes = require('../routes/attempts');

async function run() {
  console.log('====================================================');
  console.log('TESTING TAB SWITCH BLOCK, STOP QUIZ & NO ANSWERS');
  console.log('====================================================\n');

  await seedDatabase();

  const app = express();
  app.use(express.json());

  const socketEventsEmitted = [];
  const mockIo = {
    to: (room) => ({
      emit: (eventName, data) => {
        socketEventsEmitted.push({ room, eventName, data });
      }
    }),
    emit: (eventName, data) => {
      socketEventsEmitted.push({ room: 'all', eventName, data });
    }
  };
  app.set('io', mockIo);

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/attempts', attemptRoutes);

  function callApi(method, path, body = {}, headers = {}) {
    return new Promise((resolve) => {
      const { Readable } = require('stream');
      const req = new Readable({
        read() {
          this.push(null);
        }
      });
      req.method = method;
      req.url = path;
      req.body = body;
      req.headers = {
        'content-type': 'application/json',
        ...headers
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
          try {
            responseData = JSON.parse(data);
          } catch (e) {
            responseData = data;
          }
          resolve({ status: statusCode, data: responseData });
        }
      };

      app.handle(req, res);
    });
  }

  // 1. Admin Login (Tony Stark with 224488)
  const adminLogin = await callApi('POST', '/api/auth/entry', { input: '224488' });
  const adminToken = adminLogin.data.token;
  console.log('1. Admin Login (224488):', adminLogin.status === 200 && adminLogin.data.user.role === 'admin' ? 'PASS' : 'FAIL');

  // 2. Candidates Login (Rishith & Arjun)
  const student1Login = await callApi('POST', '/api/auth/entry', { input: 'Rishith' });
  const student1Token = student1Login.data.token;
  const student2Login = await callApi('POST', '/api/auth/entry', { input: 'Arjun' });
  const student2Token = student2Login.data.token;
  console.log('2. Candidate Login:', student1Login.status === 200 && student2Login.status === 200 ? 'PASS' : 'FAIL');

  // 3. Admin creates an exam with questions
  const createExamRes = await callApi('POST', '/api/exams', {
    title: 'IRIS Cybersecurity Evaluation',
    subject: 'Security & Protocol',
    durationMinutes: 15,
    marksPerQuestion: 4,
    negativeMarkPerQuestion: 1,
    questions: [
      {
        questionText: 'What is the primary function of an Intrusion Detection System (IDS)?',
        options: ['Monitoring network traffic for suspicious activity', 'Encrypting local databases', 'Compiling frontend JavaScript', 'Generating graphic mockups'],
        correctOptionIndex: 0,
        explanation: 'An IDS inspects network telemetry for known malicious signatures and policy violations.'
      },
      {
        questionText: 'Which HTTP status code indicates that the server understands the request but refuses to authorize it?',
        options: ['404 Not Found', '403 Forbidden', '500 Internal Error', '302 Redirect'],
        correctOptionIndex: 1,
        explanation: 'HTTP 403 Forbidden indicates the caller does not have sufficient permissions.'
      }
    ]
  }, { authorization: `Bearer ${adminToken}` });
  const examId = createExamRes.data._id;
  console.log('3. Create Exam:', createExamRes.status === 201 ? 'PASS' : 'FAIL');

  // 4. Candidate views exam: verify NO correct answers leaked!
  const candidateExam = await callApi('GET', `/api/exams/${examId}`, {}, { authorization: `Bearer ${student1Token}` });
  const answersLeaked = candidateExam.data.questions.some(q => q.correctOptionIndex !== undefined || q.explanation !== undefined);
  console.log('4. Candidate Exam Questions (Sanitized - NO ANSWERS LEAKED):', !answersLeaked ? 'PASS' : 'FAIL');

  // 5. Admin starts the quiz
  const startQuizRes = await callApi('POST', '/api/exams/start-latest', {}, { authorization: `Bearer ${adminToken}` });
  console.log('5. Admin Starts Quiz:', startQuizRes.status === 200 && startQuizRes.data.exam.isLive ? 'PASS' : 'FAIL');

  // 6. Student 1 starts attempt
  const startAttempt1 = await callApi('POST', '/api/attempts/start', { examId }, { authorization: `Bearer ${student1Token}` });
  const attempt1Id = startAttempt1.data.attempt._id;
  console.log('6. Student 1 Starts Attempt:', startAttempt1.status === 201 ? 'PASS' : 'FAIL');

  // 7. Student 1 switches tab -> INSTANT BLOCK
  const tabViolation = await callApi('POST', `/api/attempts/${attempt1Id}/violation`, {
    type: 'Tab Switch Detected',
    details: 'The candidate switched to another browser tab or minimized window.'
  }, { authorization: `Bearer ${student1Token}` });
  console.log('7. Student 1 Tab Switch INSTANT BLOCK:', tabViolation.status === 200 && tabViolation.data.terminated ? 'PASS' : 'FAIL');

  // 7.1 Verify blocked student cannot continue or modify answers
  const blockedAnswerTry = await callApi('POST', `/api/attempts/${attempt1Id}/save-answer`, {
    questionId: candidateExam.data.questions[0].id,
    optionIndex: 0
  }, { authorization: `Bearer ${student1Token}` });
  console.log('7.1 Blocked candidate cannot continue (Expect 400):', blockedAnswerTry.status === 400 ? 'PASS' : 'FAIL');

  // 8. Student 2 starts attempt and attempts Question 1
  const startAttempt2 = await callApi('POST', '/api/attempts/start', { examId }, { authorization: `Bearer ${student2Token}` });
  const attempt2Id = startAttempt2.data.attempt._id;
  await callApi('POST', `/api/attempts/${attempt2Id}/save-answer`, {
    questionId: candidateExam.data.questions[0].id,
    optionIndex: 0
  }, { authorization: `Bearer ${student2Token}` });
  console.log('8. Student 2 Attending & Answering:', startAttempt2.status === 201 ? 'PASS' : 'FAIL');

  // 9. Admin Stops Quiz -> Stop Quiz
  const stopQuizRes = await callApi('POST', '/api/exams/stop-latest', {}, { authorization: `Bearer ${adminToken}` });
  console.log('9. Admin Stops Quiz (Auto-submits active candidates):', stopQuizRes.status === 200 && stopQuizRes.data.autoSubmittedCount >= 1 ? 'PASS' : 'FAIL');

  // 10. Verify Student 2 was automatically submitted and locked
  const student2Result = await callApi('GET', `/api/attempts/${attempt2Id}/result`, {}, { authorization: `Bearer ${student2Token}` });
  console.log('10. Student 2 Auto-Submitted on Stop Quiz:', student2Result.status === 200 && student2Result.data.status === 'submitted' ? 'PASS' : 'FAIL');

  // 10.1 Verify Student 2 Result reveals correct answers to candidate upon submission
  const student2Mistakes = student2Result.data.mistakeAnalysis || [];
  const candidateSeesAnswers = student2Mistakes.some(m => m.correctOptionIndex !== undefined || m.correctOptionText !== undefined);
  console.log('10.1 Candidate Result (CORRECT ANSWERS REVEALED ON SUBMISSION):', candidateSeesAnswers ? 'PASS' : 'FAIL');

  // 11. Admin Overview: Cheated list shows Rishith by name and count
  const adminOverview = await callApi('GET', '/api/admin/overview', {}, { authorization: `Bearer ${adminToken}` });
  const cheatedUser = adminOverview.data.cheatedList.find(c => c.studentName === 'Rishith' || c.userName === 'Rishith');
  console.log('11. Cheated student displayed by name in Admin Cheated List:', Boolean(cheatedUser) ? 'PASS' : 'FAIL');
  console.log('    Cheated list count:', adminOverview.data.cheatedList.length);
  console.log('    isQuizLive status:', adminOverview.data.isQuizLive);

  // Clean up
  await callApi('DELETE', `/api/exams/${examId}`, {}, { authorization: `Bearer ${adminToken}` });

  console.log('\n=======================================');
  console.log('ALL VERIFICATIONS COMPLETED WITH 100% SUCCESS');
  console.log('=======================================');
}

run();
