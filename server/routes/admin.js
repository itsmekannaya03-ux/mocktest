const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes here strictly require admin role
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/overview - Unified live dashboard summary
router.get('/overview', async (req, res) => {
  try {
    const attempts = await db.Attempts.find();
    const exams = await db.Exams.find();
    const users = await db.Users.find({ role: 'student' });
    const violations = await db.Violations.find();

    const activeAttempts = attempts.filter(a => a.status === 'in_progress');
    const submittedAttempts = attempts.filter(a => a.status === 'submitted');
    const cheatedAttempts = attempts.filter(a => a.isCheated || a.status === 'terminated');
    
    // Pass/Fail calculations (passing threshold >= 50%)
    const passedAttempts = attempts.filter(a => a.status === 'submitted' && !a.isCheated && (a.percentage || 0) >= 50);
    const failedAttempts = attempts.filter(a => (a.status === 'submitted' || a.status === 'terminated') && (a.isCheated || (a.percentage || 0) < 50));

    // Cheated students list with prominent details
    const cheatedList = cheatedAttempts.map(a => ({
      attemptId: a._id,
      studentName: a.userName,
      userName: a.userName,
      studentBadgeId: a.userBadgeId,
      examTitle: a.examTitle,
      type: (a.violationsLog && a.violationsLog.length > 0)
        ? a.violationsLog[a.violationsLog.length - 1].type
        : 'Tab Switch / External AI Assistant',
      reason: a.terminatedReason || 'Cheating detected: Switched tabs / External assistant / Window defocused',
      timestamp: a.submittedAt || a.startedAt,
      violationsCount: a.violationsCount || 1,
      score: a.score || 0,
      percentage: a.percentage || 0
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Unified results list of all candidates (active attending, cheated, submitted)
    const allResults = attempts.map(a => {
      const exam = exams.find(e => e._id === a.examId);
      let calculatedStatus = 'attending';
      if (a.isCheated || a.status === 'terminated') {
        calculatedStatus = 'cheated';
      } else if (a.status === 'submitted') {
        calculatedStatus = (a.percentage || 0) >= 50 ? 'passed' : 'failed';
      }

      return {
        attemptId: a._id,
        studentName: a.userName,
        studentBadgeId: a.userBadgeId,
        examTitle: a.examTitle,
        examCode: a.examCode,
        status: a.status,
        calculatedStatus, // 'attending' | 'cheated' | 'passed' | 'failed'
        isCheated: Boolean(a.isCheated || a.status === 'terminated'),
        terminatedReason: a.terminatedReason,
        score: a.score || 0,
        maxMarks: a.maxMarks || (exam ? (exam.questions?.length || 0) * (exam.marksPerQuestion || 4) : 0),
        percentage: a.percentage || 0,
        accuracy: a.accuracy || 0,
        violationsCount: a.violationsCount || 0,
        timeSpentSeconds: a.timeSpentSeconds || 0,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt
      };
    }).sort((a, b) => new Date(b.submittedAt || b.startedAt) - new Date(a.submittedAt || a.startedAt));

    // Recent violations log
    const recentViolations = violations
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20);

    // Class average among non-cheated completed exams
    const totalScore = submittedAttempts.filter(a => !a.isCheated).reduce((acc, a) => acc + (a.score || 0), 0);
    const validCount = submittedAttempts.filter(a => !a.isCheated).length;
    const avgScore = validCount > 0 ? (totalScore / validCount).toFixed(1) : 0;
    const isQuizLive = exams.some(e => e.isLive) || activeAttempts.length > 0;

    // Detailed roster of all registered candidates / players
    const registeredPlayers = users.map(u => {
      const active = activeAttempts.find(a => a.userId === u._id);
      const cheated = cheatedAttempts.find(a => a.userId === u._id);
      const submitted = submittedAttempts.find(a => a.userId === u._id);

      let currentStatus = 'ready';
      if (cheated) currentStatus = 'cheated';
      else if (active) currentStatus = 'attending';
      else if (submitted) currentStatus = 'completed';

      return {
        id: u._id,
        name: u.name,
        alias: u.alias || 'Candidate',
        badgeId: u.badgeId || 'MEMBER',
        email: u.email || 'N/A',
        clearance: u.clearance || 'Level 3 - Operative',
        status: currentStatus, // 'ready' | 'attending' | 'cheated' | 'completed'
        createdAt: u.createdAt
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.json({
      admin: {
        name: req.user.name,
        alias: req.user.alias,
        badgeId: req.user.badgeId,
        clearance: req.user.clearance
      },
      isQuizLive: Boolean(isQuizLive),
      attending: activeAttempts.length,
      cheated: cheatedAttempts.length,
      passed: passedAttempts.length,
      failed: failedAttempts.length,
      totalCandidates: users.length || attempts.length,
      registeredPlayers,
      counts: {
        attending: activeAttempts.length,
        cheated: cheatedAttempts.length,
        passed: passedAttempts.length,
        failed: failedAttempts.length,
        totalCandidates: users.length || attempts.length,
        totalExams: exams.length,
        avgScore: Number(avgScore)
      },
      cheatedList,
      allResults,
      activeAttempts: activeAttempts.map(a => {
        const exam = exams.find(e => e._id === a.examId);
        return {
          id: a._id,
          studentName: a.userName,
          studentBadgeId: a.userBadgeId,
          examTitle: a.examTitle,
          examId: a.examId,
          durationMinutes: exam ? exam.durationMinutes : 15,
          startedAt: a.startedAt,
          answeredCount: a.answers ? Object.keys(a.answers).length : 0,
          totalQuestions: exam && exam.questions ? exam.questions.length : 0,
          violationsCount: a.violationsCount || 0,
          violationThreshold: 1,
          latestViolation: a.violationsLog && a.violationsLog.length > 0
            ? a.violationsLog[a.violationsLog.length - 1]
            : null
        };
      }),
      recentViolations
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to compile admin telemetry.' });
  }
});

// GET /api/admin/reports - Student scores & performance reports
router.get('/reports', async (req, res) => {
  try {
    const attempts = await db.Attempts.find();
    const exams = await db.Exams.find();

    const reports = attempts
      .filter(a => a.status === 'submitted' || a.status === 'terminated')
      .map(a => {
        const exam = exams.find(e => e._id === a.examId);
        return {
          attemptId: a._id,
          studentName: a.userName,
          studentBadgeId: a.userBadgeId,
          userId: a.userId,
          examTitle: a.examTitle,
          examCode: a.examCode,
          examId: a.examId,
          status: a.status,
          terminatedReason: a.terminatedReason,
          score: a.score || 0,
          maxMarks: a.maxMarks || 0,
          percentage: a.percentage || 0,
          accuracy: a.accuracy || 0,
          correctCount: a.correctCount || 0,
          incorrectCount: a.incorrectCount || 0,
          unansweredCount: a.unansweredCount || 0,
          violationsCount: a.violationsCount || 0,
          timeSpentSeconds: a.timeSpentSeconds || 0,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt
        };
      })
      .sort((a, b) => new Date(b.submittedAt || b.startedAt) - new Date(a.submittedAt || a.startedAt));

    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve performance reports.' });
  }
});

// GET /api/admin/terminated - Terminated exams list with detailed audit reasons
router.get('/terminated', async (req, res) => {
  try {
    const terminated = await db.Attempts.find({ status: 'terminated' });
    res.json(terminated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch terminated sessions.' });
  }
});

// GET /api/admin/violations-log - Complete proctoring event history
router.get('/violations-log', async (req, res) => {
  try {
    const violations = await db.Violations.find();
    violations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(violations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch proctoring logs.' });
  }
});

// POST /api/admin/force-terminate - Admin manual intervention to terminate exam
router.post('/force-terminate', async (req, res) => {
  try {
    const { attemptId, reason } = req.body;
    if (!attemptId) {
      return res.status(400).json({ error: 'Attempt ID is required.' });
    }

    const attempt = await db.Attempts.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    const exam = await db.Exams.findById(attempt.examId);
    const terminateReason = reason || `Manually terminated by Administrator ${req.user.name} (${req.user.alias}).`;

    // Calculate score on current answers
    let score = 0, percentage = 0, accuracy = 0;
    if (exam) {
      const { calculateScore } = require('./attempts'); // Or inline calculation
      const marksPerQ = Number(exam.marksPerQuestion) || 4;
      const negMark = Number(exam.negativeMarkPerQuestion) || 0;
      let corr = 0, incorr = 0;
      (exam.questions || []).forEach(q => {
        const a = attempt.answers ? attempt.answers[q.id] : undefined;
        if (a !== undefined && a !== null) {
          if (Number(a) === Number(q.correctOptionIndex)) corr++;
          else incorr++;
        }
      });
      score = Math.max(0, (corr * marksPerQ) - (incorr * negMark));
      const maxMarks = (exam.questions || []).length * marksPerQ;
      percentage = maxMarks > 0 ? Math.round((score / maxMarks) * 1000) / 10 : 0;
      accuracy = (corr + incorr) > 0 ? Math.round((corr / (corr + incorr)) * 1000) / 10 : 0;
    }

    const updated = await db.Attempts.updateOne(attempt._id, {
      status: 'terminated',
      terminatedReason: terminateReason,
      submittedAt: new Date().toISOString(),
      score,
      percentage,
      accuracy
    });

    // Broadcast immediate termination to student socket & admin bridge
    const io = req.app.get('io');
    if (io) {
      io.to(`attempt_${attempt._id}`).emit('admin_force_terminated', {
        reason: terminateReason,
        admin: req.user.name
      });
      io.to('admin_room').emit('session_force_terminated', {
        attemptId: attempt._id,
        userName: attempt.userName,
        adminName: req.user.name,
        reason: terminateReason
      });
    }

    res.json({ success: true, message: 'Examination session terminated.', attempt: updated });
  } catch (err) {
    console.error('Force terminate error:', err);
    res.status(500).json({ error: 'Failed to execute termination protocol.' });
  }
});

// POST /api/admin/warn-student - Send live warning notice to student
router.post('/warn-student', async (req, res) => {
  try {
    const { attemptId, message } = req.body;
    if (!attemptId || !message) {
      return res.status(400).json({ error: 'Attempt ID and warning message are required.' });
    }

    const attempt = await db.Attempts.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`attempt_${attempt._id}`).emit('admin_warning', {
        from: req.user.name,
        alias: req.user.alias,
        message: message.trim(),
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: `Warning dispatched to ${attempt.userName}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dispatch warning.' });
  }
});

// POST /api/admin/reset-attempt - Admin can allow a member to retake if technical fault
router.post('/reset-attempt', async (req, res) => {
  try {
    const { attemptId } = req.body;
    const attempt = await db.Attempts.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    await db.Attempts.deleteOne(attemptId);
    res.json({ success: true, message: `Session reset. ${attempt.userName} may now restart the exam.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset session.' });
  }
});

// DELETE /api/admin/players/:id - Remove player / candidate from the roster
router.delete('/players/:id', async (req, res) => {
  try {
    const playerId = req.params.id;
    const player = await db.Users.findById(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player record not found.' });
    }

    // Protect administrator command accounts
    if (player.role === 'admin' || player.email === 'tony@iris.shield' || player.email === 'cap@iris.shield') {
      return res.status(403).json({ error: 'Command Bridge Administrator accounts cannot be removed.' });
    }

    // Delete user
    await db.Users.deleteOne(playerId);

    // Clean up attempts and violations for this candidate
    const attempts = await db.Attempts.find({ userId: playerId });
    for (const a of attempts) {
      await db.Attempts.deleteOne(a._id);
    }
    const violations = await db.Violations.find({ userId: playerId });
    for (const v of violations) {
      await db.Violations.deleteOne(v._id);
    }

    res.json({
      success: true,
      message: `Player "${player.name}" has been removed from the examination roster.`,
      playerId
    });
  } catch (err) {
    console.error('Delete player error:', err);
    res.status(500).json({ error: 'Failed to remove player.' });
  }
});

module.exports = router;
