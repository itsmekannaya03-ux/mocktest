const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Deterministic shuffle using student seed so each candidate gets a different question order
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

// POST /api/exams/ai-parse - Bulk paste questions & intelligent auto-formatter
router.post('/ai-parse', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide raw questions text to parse.' });
    }

    const lines = rawText.split('\n');
    const questions = [];
    let currentQ = null;

    function finalizeCurrentQ() {
      if (currentQ && (currentQ.questionText || currentQ.prompt) && (currentQ.questionText.trim() || currentQ.prompt.trim())) {
        const text = (currentQ.questionText || currentQ.prompt).trim();
        // Ensure options array has at least 4 options
        while (currentQ.options.length < 4) {
          currentQ.options.push(`Option ${String.fromCharCode(65 + currentQ.options.length)}`);
        }
        currentQ.options = currentQ.options.slice(0, 4);
        questions.push({
          id: uuidv4(),
          questionText: text,
          prompt: text,
          options: currentQ.options,
          correctOptionIndex: currentQ.correctOptionIndex,
          explanation: currentQ.explanation.trim() || 'No technical explanation provided.',
          revisionConcept: currentQ.revisionConcept.trim() || 'Team Knowledge'
        });
      }
    }

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Check for Answer line: e.g. "Answer: B", "Ans: C", "Correct: A", "Key: B"
      const ansMatch = line.match(/^(?:(?:[Aa]nswer|[Aa]ns|[Cc]orrect|[Kk]ey)[\s.:-]+)\s*\(?([A-Da-d1-4])\)?/i);

      // Check for Explanation line: e.g. "Explanation: ...", "Rationale: ..."
      const expMatch = line.match(/^(?:(?:[Ee]xplanation|[Rr]ationale|[Nn]ote|[Rr]eason)[\s.:-]+)(.*)/i);

      // Check for Concept line: e.g. "Concept: ...", "Topic: ..."
      const conceptMatch = line.match(/^(?:(?:[Cc]oncept|[Tt]opic|[Rr]evise)[\s.:-]+)(.*)/i);

      // Check for Option start: strictly letters A-D / a-d: e.g. "A)", "A.", "(A)", "[A]", "A - "
      const optMatch = line.match(/^(?:(?:\(?([A-Da-d])\)?[.:\s-]+)|(?:\[([A-Da-d])\][\s.:-]*))(.*)/i);

      // Check for Question start: e.g. "1.", "1)", "Q1:", "Question 1:", "1 - "
      const qStartMatch = line.match(/^(?:(?:[Qq]uestion\s*\d+|Q\d+|\d+)[\s.:)-]+)(.*)/i);

      if (ansMatch && currentQ) {
        const val = ansMatch[1].toUpperCase();
        let idx = 0;
        if (['A', '1'].includes(val)) idx = 0;
        else if (['B', '2'].includes(val)) idx = 1;
        else if (['C', '3'].includes(val)) idx = 2;
        else if (['D', '4'].includes(val)) idx = 3;
        currentQ.correctOptionIndex = idx;
      } else if (expMatch && currentQ) {
        currentQ.explanation = expMatch[1].trim();
      } else if (conceptMatch && currentQ) {
        currentQ.revisionConcept = conceptMatch[1].trim();
      } else if (optMatch && currentQ) {
        let optText = (optMatch[3] !== undefined ? optMatch[3] : '').trim();
        // Check if option line has an indicator like (Correct) or *
        if (optText.includes('(Correct)') || optText.includes('*') || optText.startsWith('*')) {
          currentQ.correctOptionIndex = currentQ.options.length;
          optText = optText.replace(/\(Correct\)/gi, '').replace(/\*/g, '').trim();
        }
        currentQ.options.push(optText || `Option ${String.fromCharCode(65 + currentQ.options.length)}`);
      } else if (qStartMatch) {
        finalizeCurrentQ();
        currentQ = {
          questionText: qStartMatch[1].trim(),
          prompt: qStartMatch[1].trim(),
          options: [],
          correctOptionIndex: 0,
          explanation: '',
          revisionConcept: ''
        };
      } else {
        // Continuation of current question or explanation
        if (currentQ) {
          if (currentQ.options.length === 0) {
            currentQ.questionText += ' ' + line;
            currentQ.prompt = currentQ.questionText;
          } else if (currentQ.explanation) {
            currentQ.explanation += ' ' + line;
          }
        }
      }
    }

    finalizeCurrentQ();

    if (questions.length === 0) {
      // Fallback: create at least 1 question from text
      questions.push({
        id: uuidv4(),
        questionText: rawText.slice(0, 150).trim(),
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctOptionIndex: 0,
        explanation: 'Auto-formatted question block.',
        revisionConcept: 'Team Knowledge'
      });
    }

    res.json({
      success: true,
      count: questions.length,
      questions
    });
  } catch (err) {
    console.error('AI question parse error:', err);
    res.status(500).json({ error: 'Failed to parse raw questions text.' });
  }
});

// GET /api/exams - List available exams for students
router.get('/', authenticateToken, async (req, res) => {
  try {
    const allExams = await db.Exams.find({ status: 'published' });
    
    // Check if current user has completed attempts for these exams
    const userAttempts = await db.Attempts.find({ userId: req.user.id });
    
    const formatted = allExams.map(exam => {
      const attempt = userAttempts.find(a => a.examId === exam._id);
      return {
        _id: exam._id,
        title: exam.title,
        code: exam.code,
        subject: exam.subject,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        questionsCount: exam.questions ? exam.questions.length : 0,
        marksPerQuestion: exam.marksPerQuestion,
        negativeMarkPerQuestion: exam.negativeMarkPerQuestion,
        totalMarks: (exam.questions ? exam.questions.length : 0) * (exam.marksPerQuestion || 4),
        violationThreshold: exam.violationThreshold || 3,
        answerKeyRelease: exam.answerKeyRelease || 'immediate',
        userAttempt: attempt ? {
          attemptId: attempt._id,
          status: attempt.status,
          score: attempt.score,
          percentage: attempt.percentage,
          submittedAt: attempt.submittedAt
        } : null
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Fetch exams error:', err);
    res.status(500).json({ error: 'Failed to retrieve available exams.' });
  }
});

// GET /api/exams/admin/all - Admin exam management list
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allExams = await db.Exams.find();
    res.json(allExams);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin exam repository.' });
  }
});

// GET /api/exams/:id - Get student exam interface (SANITIZED - ALLOCATED UNIQUELY PER PERSON)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ error: 'Examination protocol not found.' });
    }

    // Check if user has an attempt with saved question order; otherwise shuffle based on candidate user ID
    let rawQuestions = [...(exam.questions || [])];
    const attempt = await db.Attempts.findOne({
      userId: req.user.id,
      examId: req.params.id
    });

    if (attempt && Array.isArray(attempt.questionOrder) && attempt.questionOrder.length > 0) {
      const qMap = new Map(rawQuestions.map(q => [q.id, q]));
      const ordered = [];
      for (const qid of attempt.questionOrder) {
        if (qMap.has(qid)) ordered.push(qMap.get(qid));
      }
      for (const q of rawQuestions) {
        if (!attempt.questionOrder.includes(q.id)) ordered.push(q);
      }
      rawQuestions = ordered;
    } else {
      // Allocate differently from person to person using candidate ID seed
      rawQuestions = shuffleForUser(rawQuestions, req.user.id);
    }

    // Sanitize questions to protect answer keys
    const sanitizedQuestions = rawQuestions.map((q, idx) => ({
      id: q.id || `q_${idx}`,
      questionText: q.questionText,
      options: q.options
      // OMIT correctOptionIndex, explanation, revisionConcept
    }));

    res.json({
      _id: exam._id,
      title: exam.title,
      code: exam.code,
      subject: exam.subject,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      marksPerQuestion: exam.marksPerQuestion,
      negativeMarkPerQuestion: exam.negativeMarkPerQuestion,
      violationThreshold: 1, // Strict 1-infraction block as requested
      instructions: exam.instructions || [],
      questions: sanitizedQuestions,
      answerKeyRelease: exam.answerKeyRelease
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve examination content.' });
  }
});

// GET /api/exams/:id/full - Admin inspect exam with answers
router.get('/:id/full', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch full exam specification.' });
  }
});

// POST /api/exams - Create new exam (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      code,
      subject,
      description,
      durationMinutes,
      marksPerQuestion,
      negativeMarkPerQuestion,
      violationThreshold,
      answerKeyRelease,
      instructions,
      questions
    } = req.body;

    if (!title || !subject || !durationMinutes || !questions || questions.length === 0) {
      return res.status(400).json({ error: 'Title, subject, duration, and at least one question are required.' });
    }

    const validatedQuestions = questions.map((q, i) => ({
      id: q.id || uuidv4(),
      questionText: q.questionText,
      options: q.options,
      correctOptionIndex: parseInt(q.correctOptionIndex, 10),
      explanation: q.explanation || 'No rationale provided.',
      revisionConcept: q.revisionConcept || subject
    }));

    const newExam = await db.Exams.create({
      title: title.trim(),
      code: code ? code.trim() : `IRIS-${Math.floor(100 + Math.random() * 900)}`,
      subject: subject.trim(),
      description: description || '',
      durationMinutes: Number(durationMinutes),
      marksPerQuestion: Number(marksPerQuestion) || 4,
      negativeMarkPerQuestion: Number(negativeMarkPerQuestion) || 0,
      violationThreshold: Number(violationThreshold) || 3,
      answerKeyRelease: answerKeyRelease || 'immediate',
      status: 'published',
      instructions: instructions || [
        'Complete all questions within the allocated time.',
        'Fullscreen mode is required and monitored.',
        'Browser tab switching or exiting will trigger violation strikes.'
      ],
      questions: validatedQuestions,
      createdBy: req.user.name
    });

    res.status(201).json(newExam);
  } catch (err) {
    console.error('Create exam error:', err);
    res.status(500).json({ error: 'Failed to create examination protocol.' });
  }
});

// PUT /api/exams/:id - Update exam (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = await db.Exams.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    const updated = await db.Exams.updateOne(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update examination protocol.' });
  }
});

// DELETE /api/exams/:id - Delete exam (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const success = await db.Exams.deleteOne(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Exam not found.' });
    }
    res.json({ message: 'Exam protocol removed from database.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete exam.' });
  }
});

// PATCH /api/exams/:id/toggle-release - Toggle or release answer key
router.patch('/:id/toggle-release', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    const currentMode = exam.answerKeyRelease || 'immediate';
    const nextMode = currentMode === 'immediate' ? 'admin_released' : 'immediate';
    const updated = await db.Exams.updateOne(req.params.id, { answerKeyRelease: nextMode });
    res.json({ message: `Answer key status updated to: ${nextMode}`, exam: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update answer key release state.' });
  }
});

// Helper function: calculate score for submitted attempts
function calculateAttemptScore(exam, answers) {
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

// POST /api/exams/start-latest - Start the most recent exam for the team
router.post('/start-latest', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exams = await db.Exams.find();
    if (!exams || exams.length === 0) {
      return res.status(400).json({ error: 'No examination found. Please create questions first.' });
    }
    const latestExam = exams[exams.length - 1];
    const updatedExam = await db.Exams.updateOne(latestExam._id, { isLive: true, startedAt: new Date().toISOString() });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('quiz_live_started', {
        examId: latestExam._id,
        title: latestExam.title,
        durationMinutes: latestExam.durationMinutes,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: `Quiz "${latestExam.title}" is now LIVE for all team members!`, exam: updatedExam });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start quiz.' });
  }
});

// POST /api/exams/stop-latest - Stop the live exam, auto-submit all candidates' answers and lock them
router.post('/stop-latest', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exams = await db.Exams.find();
    if (!exams || exams.length === 0) {
      return res.status(400).json({ error: 'No examination found.' });
    }
    // Set all live exams to stopped
    for (const ex of exams.filter(e => e.isLive)) {
      await db.Exams.updateOne(ex._id, { isLive: false, stoppedAt: new Date().toISOString() });
    }
    // Target exam
    const liveExam = exams.slice().reverse().find(e => e.isLive) || exams[exams.length - 1];
    const updatedExam = await db.Exams.updateOne(liveExam._id, { isLive: false, stoppedAt: new Date().toISOString() });

    // Find all in-progress attempts for this exam (or any in_progress attempt) and auto-submit them with whatever answers they have attempted
    const allAttempts = await db.Attempts.find({ status: 'in_progress' });
    let autoSubmittedCount = 0;

    for (const attempt of allAttempts) {
      const examForAttempt = exams.find(e => e._id === attempt.examId) || liveExam;
      const scoreResult = calculateAttemptScore(examForAttempt, attempt.answers || {});
      await db.Attempts.updateOne(attempt._id, {
        status: 'submitted',
        stoppedByAdmin: true,
        submittedAt: new Date().toISOString(),
        score: scoreResult.score,
        percentage: scoreResult.percentage,
        accuracy: scoreResult.accuracy,
        correctCount: scoreResult.correctCount,
        incorrectCount: scoreResult.incorrectCount,
        unansweredCount: scoreResult.unansweredCount
      });
      autoSubmittedCount++;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('quiz_stopped', {
        examId: liveExam._id,
        title: liveExam.title,
        message: 'The examination has been concluded by the Administrator. All attempted answers have been automatically finalized and submitted.'
      });
      io.to('admin_room').emit('exam_submitted', { stoppedByAdmin: true, count: autoSubmittedCount });
    }

    res.json({ 
      success: true, 
      message: `Quiz "${liveExam.title}" has been STOPPED. ${autoSubmittedCount} candidate attempts submitted automatically.`,
      autoSubmittedCount,
      exam: updatedExam 
    });
  } catch (err) {
    console.error('Stop quiz error:', err);
    res.status(500).json({ error: 'Failed to stop quiz.' });
  }
});

// POST /api/exams/:id/start-quiz - Start specific exam
router.post('/:id/start-quiz', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    await db.Exams.updateOne(req.params.id, { isLive: true, startedAt: new Date().toISOString() });

    const io = req.app.get('io');
    if (io) {
      io.emit('quiz_live_started', {
        examId: exam._id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: `Quiz "${exam.title}" is now LIVE for all team members!`, exam });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start quiz.' });
  }
});

// POST /api/exams/:id/stop-quiz - Stop specific exam
router.post('/:id/stop-quiz', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    await db.Exams.updateOne(req.params.id, { isLive: false, stoppedAt: new Date().toISOString() });

    const allAttempts = await db.Attempts.find({ examId: req.params.id, status: 'in_progress' });
    let autoSubmittedCount = 0;

    for (const attempt of allAttempts) {
      const scoreResult = calculateAttemptScore(exam, attempt.answers || {});
      await db.Attempts.updateOne(attempt._id, {
        status: 'submitted',
        stoppedByAdmin: true,
        submittedAt: new Date().toISOString(),
        score: scoreResult.score,
        percentage: scoreResult.percentage,
        accuracy: scoreResult.accuracy,
        correctCount: scoreResult.correctCount,
        incorrectCount: scoreResult.incorrectCount,
        unansweredCount: scoreResult.unansweredCount
      });
      autoSubmittedCount++;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('quiz_stopped', {
        examId: exam._id,
        title: exam.title,
        message: 'The examination has been concluded by the Administrator. All attempted answers have been automatically finalized and submitted.'
      });
      io.to('admin_room').emit('exam_submitted', { stoppedByAdmin: true, count: autoSubmittedCount });
    }

    res.json({ 
      success: true, 
      message: `Quiz "${exam.title}" has been STOPPED. ${autoSubmittedCount} candidate attempts submitted automatically.`,
      autoSubmittedCount,
      exam 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop quiz.' });
  }
});

module.exports = router;
