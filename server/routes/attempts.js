const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

// Deterministic shuffle for each student so question allocation is unique per person
function shuffleForUser(array, seedStr = '') {
  const arr = [...array];
  if (!seedStr) seedStr = Math.random().toString();
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) % 2147483647;
  }
  function pseudoRandom() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(pseudoRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// POST /api/attempts/start - Start or resume examination
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { examId } = req.body;
    if (!examId) {
      return res.status(400).json({ error: 'Exam ID is required.' });
    }

    const exam = await db.Exams.findById(examId);
    if (!exam) {
      return res.status(404).json({ error: 'Examination protocol not found.' });
    }

    // Check for existing attempt
    const existingAttempt = await db.Attempts.findOne({
      userId: req.user.id,
      examId: examId
    });

    if (existingAttempt) {
      if (existingAttempt.status === 'submitted' || existingAttempt.status === 'terminated') {
        return res.status(400).json({
          error: existingAttempt.isCheated 
            ? 'Access Denied: You were caught cheating or switching tabs and have been blocked from this exam.'
            : 'You have already completed or finalized this examination.',
          attemptId: existingAttempt._id,
          status: existingAttempt.status,
          isCheated: existingAttempt.isCheated
        });
      }

      // Resume active attempt
      const orderedQuestions = [];
      const qMap = new Map((exam.questions || []).map(q => [q.id, q]));
      if (Array.isArray(existingAttempt.questionOrder) && existingAttempt.questionOrder.length > 0) {
        for (const qid of existingAttempt.questionOrder) {
          if (qMap.has(qid)) orderedQuestions.push(qMap.get(qid));
        }
      }
      for (const q of (exam.questions || [])) {
        if (!orderedQuestions.some(oq => oq.id === q.id)) orderedQuestions.push(q);
      }

      const sanitizedResumed = orderedQuestions.map((q, idx) => ({
        id: q.id || `q_${idx}`,
        questionText: q.questionText,
        options: q.options || ['Option A', 'Option B', 'Option C', 'Option D']
      }));

      return res.json({
        attempt: existingAttempt,
        resumed: true,
        exam: {
          _id: exam._id,
          title: exam.title,
          code: exam.code,
          durationMinutes: exam.durationMinutes,
          marksPerQuestion: exam.marksPerQuestion,
          questions: sanitizedResumed
        }
      });
    }

    // Allocate questions in a unique randomized sequence for this candidate
    const candidateQuestions = shuffleForUser(exam.questions || [], req.user.id);
    const questionOrder = candidateQuestions.map(q => q.id);

    // Create fresh attempt
    const newAttempt = await db.Attempts.create({
      userId: req.user.id,
      userName: req.user.name,
      userBadgeId: req.user.badgeId,
      examId: exam._id,
      examTitle: exam.title,
      examCode: exam.code,
      status: 'in_progress', // 'in_progress', 'submitted', 'terminated'
      isCheated: false,
      questionOrder: questionOrder, // Unique allocation per person
      startedAt: new Date().toISOString(),
      submittedAt: null,
      answers: {}, // { [questionId]: selectedOptionIndex }
      flagged: [], // [questionId] marked for review
      violationsCount: 0,
      violationsLog: [],
      score: 0,
      maxMarks: (exam.questions ? exam.questions.length : 0) * (exam.marksPerQuestion || 4),
      timeSpentSeconds: 0,
      terminatedReason: null
    });

    // Notify connected admin bridge through socket if available
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('exam_started', {
        attemptId: newAttempt._id,
        user: { name: req.user.name, badgeId: req.user.badgeId, id: req.user.id },
        exam: { title: exam.title, id: exam._id, durationMinutes: exam.durationMinutes },
        startedAt: newAttempt.startedAt
      });
    }

    const sanitizedQuestions = candidateQuestions.map((q, idx) => ({
      id: q.id || `q_${idx}`,
      questionText: q.questionText,
      options: q.options || ['Option A', 'Option B', 'Option C', 'Option D']
    }));

    res.status(201).json({
      attempt: newAttempt,
      resumed: false,
      exam: {
        _id: exam._id,
        title: exam.title,
        code: exam.code,
        durationMinutes: exam.durationMinutes,
        marksPerQuestion: exam.marksPerQuestion,
        questions: sanitizedQuestions
      }
    });
  } catch (err) {
    console.error('Start attempt error:', err);
    res.status(500).json({ error: 'Failed to initialize exam session.' });
  }
});

// POST /api/attempts/:id/save-answer - Save answer or toggle review flag
router.post('/:id/save-answer', authenticateToken, async (req, res) => {
  try {
    const attempt = await db.Attempts.findById(req.params.id);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    if (attempt.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied to this attempt.' });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: `Cannot modify answers. Exam status is ${attempt.status}.` });
    }

    const { questionId, selectedOptionIndex, flagged, timeSpentSeconds } = req.body;

    const updatedAnswers = { ...attempt.answers };
    if (questionId !== undefined) {
      if (selectedOptionIndex === null || selectedOptionIndex === undefined) {
        delete updatedAnswers[questionId];
      } else {
        updatedAnswers[questionId] = parseInt(selectedOptionIndex, 10);
      }
    }

    let updatedFlagged = attempt.flagged || [];
    if (Array.isArray(flagged)) {
      updatedFlagged = flagged;
    }

    const updated = await db.Attempts.updateOne(attempt._id, {
      answers: updatedAnswers,
      flagged: updatedFlagged,
      timeSpentSeconds: timeSpentSeconds !== undefined ? timeSpentSeconds : attempt.timeSpentSeconds
    });

    // Real-time broadcast to admin bridge
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('student_progress', {
        attemptId: attempt._id,
        userId: attempt.userId,
        answeredCount: Object.keys(updatedAnswers).length,
        timeSpentSeconds: updated.timeSpentSeconds
      });
    }

    res.json({ success: true, answers: updated.answers, flagged: updated.flagged });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save answer.' });
  }
});

// POST /api/attempts/:id/violation - Record proctoring violation event
router.post('/:id/violation', authenticateToken, async (req, res) => {
  try {
    const attempt = await db.Attempts.findById(req.params.id);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    if (attempt.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: `Exam already ${attempt.status}.` });
    }

    const exam = await db.Exams.findById(attempt.examId);
    const threshold = (exam && exam.violationThreshold) || 3;

    const { type, details } = req.body; // e.g. 'tab_switch', 'fullscreen_exit', 'copy_paste_attempt'
    const newViolationCount = (attempt.violationsCount || 0) + 1;
    const violationEntry = {
      type: type || 'suspicious_activity',
      details: details || 'Browser integrity violation detected',
      timestamp: new Date().toISOString(),
      count: newViolationCount
    };

    const violationsLog = [...(attempt.violationsLog || []), violationEntry];

    // Log in central violations table for administrative audit trail
    await db.Violations.create({
      attemptId: attempt._id,
      userId: attempt.userId,
      userName: attempt.userName,
      examId: attempt.examId,
      examTitle: attempt.examTitle,
      type: violationEntry.type,
      details: violationEntry.details,
      count: newViolationCount,
      timestamp: violationEntry.timestamp
    });

    // Strict Policy: Immediately catch, block, and disqualify on tab switch, AI use, or window defocus
    const isTerminated = true;
    const isCheated = true;
    const reason = details || `Cheating detected: ${violationEntry.type}. Switched tabs, exited fullscreen, or used external assistant.`;

    // Automatically evaluate completed answers up to this moment
    const scoreResult = calculateScore(exam, attempt.answers || {});

    const updateData = {
      status: 'terminated',
      isCheated: true,
      terminatedReason: reason,
      violationsCount: newViolationCount,
      violationsLog: violationsLog,
      submittedAt: new Date().toISOString(),
      score: scoreResult.score,
      percentage: scoreResult.percentage,
      accuracy: scoreResult.accuracy,
      correctCount: scoreResult.correctCount,
      incorrectCount: scoreResult.incorrectCount,
      unansweredCount: scoreResult.unansweredCount
    };

    const updated = await db.Attempts.updateOne(attempt._id, updateData);

    // Notify administrators in real time via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('student_cheated', {
        attemptId: attempt._id,
        userName: attempt.userName,
        userBadgeId: attempt.userBadgeId,
        examTitle: attempt.examTitle,
        type: violationEntry.type,
        details: reason,
        violationsCount: newViolationCount,
        blocked: true,
        timestamp: violationEntry.timestamp
      });
      io.to('admin_room').emit('violation_alert', {
        attemptId: attempt._id,
        userName: attempt.userName,
        userBadgeId: attempt.userBadgeId,
        examTitle: attempt.examTitle,
        type: violationEntry.type,
        details: reason,
        violationsCount: newViolationCount,
        threshold: 1,
        terminated: true,
        timestamp: violationEntry.timestamp
      });
      // Lock student screen immediately
      io.to(`attempt_${attempt._id}`).emit('admin_force_terminated', {
        reason: reason,
        admin: 'IRIS Proctor Sentinel'
      });
    }

    res.json({
      violationsCount: newViolationCount,
      threshold: 1,
      terminated: true,
      isCheated: true,
      terminatedReason: reason
    });
  } catch (err) {
    console.error('Record violation error:', err);
    res.status(500).json({ error: 'Failed to record violation event.' });
  }
});

// POST /api/attempts/:id/submit - Finalize submission and score
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const attempt = await db.Attempts.findById(req.params.id);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    if (attempt.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (attempt.status === 'submitted') {
      return res.status(400).json({ error: 'Examination has already been submitted.' });
    }

    if (attempt.status === 'terminated' || attempt.isCheated) {
      return res.status(403).json({ error: 'This examination session was disqualified and terminated due to cheating. Submissions are permanently locked.' });
    }

    const exam = await db.Exams.findById(attempt.examId);
    if (!exam) {
      return res.status(404).json({ error: 'Examination data missing.' });
    }

    const answers = req.body.answers || attempt.answers || {};
    const timeSpentSeconds = req.body.timeSpentSeconds || attempt.timeSpentSeconds || 0;

    const scoreResult = calculateScore(exam, answers);

    const updated = await db.Attempts.updateOne(attempt._id, {
      status: 'submitted',
      answers,
      timeSpentSeconds,
      submittedAt: new Date().toISOString(),
      score: scoreResult.score,
      maxMarks: scoreResult.maxMarks,
      percentage: scoreResult.percentage,
      accuracy: scoreResult.accuracy,
      correctCount: scoreResult.correctCount,
      incorrectCount: scoreResult.incorrectCount,
      unansweredCount: scoreResult.unansweredCount
    });

    // Notify administrators
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('exam_submitted', {
        attemptId: attempt._id,
        userName: attempt.userName,
        userBadgeId: attempt.userBadgeId,
        examTitle: attempt.examTitle,
        score: scoreResult.score,
        maxMarks: scoreResult.maxMarks,
        percentage: scoreResult.percentage,
        accuracy: scoreResult.accuracy,
        submittedAt: updated.submittedAt
      });
    }

    res.json({
      success: true,
      message: 'Examination submitted successfully.',
      attemptId: attempt._id,
      score: scoreResult.score,
      maxMarks: scoreResult.maxMarks,
      percentage: scoreResult.percentage,
      accuracy: scoreResult.accuracy
    });
  } catch (err) {
    console.error('Submit exam error:', err);
    res.status(500).json({ error: 'Failed to submit examination.' });
  }
});

// GET /api/attempts/:id/result - Detailed results & mistake analysis
router.get('/:id/result', authenticateToken, async (req, res) => {
  try {
    const attempt = await db.Attempts.findById(req.params.id);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt record not found.' });
    }

    // Members can ONLY view their own results unless admin
    if (attempt.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: You may only view your own examination results.' });
    }

    const exam = await db.Exams.findById(attempt.examId);
    if (!exam) {
      return res.status(404).json({ error: 'Exam information unavailable.' });
    }

    const marksPerQ = exam.marksPerQuestion || 4;
    const negMark = exam.negativeMarkPerQuestion || 0;
    const isAdmin = req.user.role === 'admin';

    let mistakeAnalysis = [];
    if (isAdmin) {
      // Full administrative review for Tony Stark & Captain America
      mistakeAnalysis = (exam.questions || []).map((q, idx) => {
        const selectedIdx = attempt.answers ? attempt.answers[q.id] : undefined;
        const isAnswered = selectedIdx !== undefined && selectedIdx !== null;
        const isCorrect = isAnswered && Number(selectedIdx) === Number(q.correctOptionIndex);

        let status = 'unanswered';
        let marks = 0;

        if (isAnswered) {
          if (isCorrect) {
            status = 'correct';
            marks = marksPerQ;
          } else {
            status = 'incorrect';
            marks = -negMark;
          }
        }

        return {
          questionId: q.id,
          questionNumber: idx + 1,
          questionText: q.questionText,
          options: q.options,
          selectedOptionIndex: isAnswered ? selectedIdx : null,
          selectedOptionText: isAnswered ? q.options[selectedIdx] : 'No answer selected',
          correctOptionIndex: q.correctOptionIndex,
          correctOptionText: q.options[q.correctOptionIndex],
          status,
          marksAwarded: marks,
          explanation: q.explanation || 'No rationale documented.',
          revisionConcept: q.revisionConcept || exam.subject
        };
      });
    } else {
      // For candidates: Show ONLY question and candidate's selected option - DO NOT REVEAL ANSWERS!
      mistakeAnalysis = (exam.questions || []).map((q, idx) => {
        const selectedIdx = attempt.answers ? attempt.answers[q.id] : undefined;
        const isAnswered = selectedIdx !== undefined && selectedIdx !== null;

        return {
          questionId: q.id,
          questionNumber: idx + 1,
          questionText: q.questionText,
          options: q.options,
          selectedOptionIndex: isAnswered ? selectedIdx : null,
          selectedOptionText: isAnswered ? q.options[selectedIdx] : 'No answer selected',
          status: isAnswered ? 'answered' : 'unanswered'
        };
      });
    }

    res.json({
      attemptId: attempt._id,
      examId: exam._id,
      examTitle: exam.title,
      examCode: exam.code,
      subject: exam.subject,
      studentName: attempt.userName,
      studentBadge: attempt.userBadgeId,
      status: attempt.status,
      terminatedReason: attempt.terminatedReason,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      timeSpentSeconds: attempt.timeSpentSeconds || 0,
      totalQuestions: (exam.questions || []).length,
      correctCount: attempt.correctCount || 0,
      incorrectCount: attempt.incorrectCount || 0,
      unansweredCount: attempt.unansweredCount || 0,
      score: attempt.score || 0,
      maxMarks: attempt.maxMarks || 0,
      percentage: attempt.percentage || 0,
      accuracy: attempt.accuracy || 0,
      violationsCount: attempt.violationsCount || 0,
      answerKeyReleased: isAdmin,
      mistakeAnalysis
    });
  } catch (err) {
    console.error('Fetch result error:', err);
    res.status(500).json({ error: 'Failed to generate result report.' });
  }
});

// GET /api/attempts/member/analytics - Member personal dashboard performance
router.get('/member/analytics', authenticateToken, async (req, res) => {
  try {
    const attempts = await db.Attempts.find({ userId: req.user.id });
    const allExams = await db.Exams.find({ status: 'published' });

    const completedAttempts = attempts.filter(a => a.status === 'submitted' || a.status === 'terminated');
    
    let bestScore = 0;
    let totalScore = 0;
    let totalMaxMarks = 0;
    let totalCorrect = 0;
    let totalAttempted = 0;
    const weakTopicsMap = {};

    for (const a of completedAttempts) {
      if (a.score > bestScore) bestScore = a.score;
      totalScore += (a.score || 0);
      totalMaxMarks += (a.maxMarks || 0);
      totalCorrect += (a.correctCount || 0);
      totalAttempted += ((a.correctCount || 0) + (a.incorrectCount || 0));

      // Aggregate mistakes for weak topics
      const exam = allExams.find(e => e._id === a.examId);
      if (exam && exam.questions) {
        exam.questions.forEach(q => {
          const sel = a.answers ? a.answers[q.id] : undefined;
          if (sel !== undefined && sel !== q.correctOptionIndex) {
            const concept = q.revisionConcept || exam.subject;
            weakTopicsMap[concept] = (weakTopicsMap[concept] || 0) + 1;
          }
        });
      }
    }

    const avgScore = completedAttempts.length > 0 ? (totalScore / completedAttempts.length).toFixed(1) : 0;
    const overallPercentage = totalMaxMarks > 0 ? ((totalScore / totalMaxMarks) * 100).toFixed(1) : 0;
    const overallAccuracy = totalAttempted > 0 ? ((totalCorrect / totalAttempted) * 100).toFixed(1) : 0;

    // Sort weak topics descending
    const weakTopics = Object.entries(weakTopicsMap)
      .map(([topic, mistakes]) => ({ topic, mistakes }))
      .sort((a, b) => b.mistakes - a.mistakes)
      .slice(0, 5);

    // Timeline / performance trends
    const trends = completedAttempts
      .map(a => ({
        examTitle: a.examTitle,
        date: a.submittedAt ? a.submittedAt.split('T')[0] : 'N/A',
        percentage: a.percentage || 0,
        score: a.score || 0,
        maxMarks: a.maxMarks || 0,
        status: a.status
      }))
      .slice(-6);

    res.json({
      member: {
        name: req.user.name,
        alias: req.user.alias,
        badgeId: req.user.badgeId,
        clearance: req.user.clearance
      },
      summary: {
        totalExamsTaken: completedAttempts.length,
        bestScore,
        avgScore: Number(avgScore),
        overallPercentage: Number(overallPercentage),
        overallAccuracy: Number(overallAccuracy)
      },
      weakTopics,
      trends,
      recentAttempts: completedAttempts.map(a => ({
        id: a._id,
        examTitle: a.examTitle,
        examCode: a.examCode,
        score: a.score,
        maxMarks: a.maxMarks,
        percentage: a.percentage,
        status: a.status,
        submittedAt: a.submittedAt
      }))
    });
  } catch (err) {
    console.error('Member analytics error:', err);
    res.status(500).json({ error: 'Failed to compile member analytics.' });
  }
});

// Helper for server-side scoring
function calculateScore(exam, answers) {
  const questions = exam.questions || [];
  const marksPerQ = Number(exam.marksPerQuestion) || 4;
  const negMark = Number(exam.negativeMarkPerQuestion) || 0;
  const maxMarks = questions.length * marksPerQ;

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  questions.forEach(q => {
    const userChoice = answers[q.id];
    if (userChoice === undefined || userChoice === null) {
      unansweredCount++;
    } else if (Number(userChoice) === Number(q.correctOptionIndex)) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const rawScore = (correctCount * marksPerQ) - (incorrectCount * negMark);
  const score = Math.max(0, Math.round(rawScore * 100) / 100);
  const percentage = maxMarks > 0 ? Math.round((score / maxMarks) * 1000) / 10 : 0;
  const attempted = correctCount + incorrectCount;
  const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 1000) / 10 : 0;

  return {
    score,
    maxMarks,
    percentage,
    accuracy,
    correctCount,
    incorrectCount,
    unansweredCount
  };
}

module.exports = router;
