import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Bookmark, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Maximize2, 
  ShieldAlert, 
  Send,
  Eye,
  Info,
  Loader2
} from 'lucide-react';
import QuestionPalette from '../components/QuestionPalette';
import ViolationModal from '../components/ViolationModal';

export default function ExamRoom({ exam, attempt, onExamFinished }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  // Questions and active index
  const [examData, setExamData] = useState(exam);
  const questions = examData.questions || exam.questions || [];
  const totalQuestions = questions.length;
  const [currentIndex, setCurrentIndex] = useState(0);

  // Self-healing: if questions not passed in, load them immediately from API
  useEffect(() => {
    if (!questions || questions.length === 0) {
      api.getExamById(exam._id || attempt.examId)
        .then(full => {
          if (full && Array.isArray(full.questions) && full.questions.length > 0) {
            setExamData(full);
          }
        })
        .catch(err => console.warn('ExamRoom fallback question load error:', err.message));
    }
  }, [exam._id, attempt.examId, questions.length]);

  // Examination state
  const [answers, setAnswers] = useState(attempt.answers || {});
  const [flagged, setFlagged] = useState(attempt.flagged || []);
  const [visited, setVisited] = useState({ 0: true });

  // Timer: calculate remaining seconds
  const totalSecondsAllocated = (exam.durationMinutes || 15) * 60;
  const initialSecondsSpent = attempt.timeSpentSeconds || 0;
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.max(0, totalSecondsAllocated - initialSecondsSpent)
  );

  // Proctoring & Violations state
  const [violationsCount, setViolationsCount] = useState(attempt.violationsCount || 0);
  const [violationModal, setViolationModal] = useState({
    isOpen: false,
    type: '',
    details: '',
    count: attempt.violationsCount || 0,
    threshold: exam.violationThreshold || 3,
    isTerminated: false
  });

  // Submission state
  const [confirmSubmitModal, setConfirmSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminNotice, setAdminNotice] = useState(null);

  // Time spent tracker ref
  const timeSpentRef = useRef(initialSecondsSpent);
  const fullscreenActiveRef = useRef(false);

  // Enter Fullscreen on mount
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => {
          fullscreenActiveRef.current = true;
        })
        .catch(() => {
          console.warn('Fullscreen request rejected or requires user gesture');
        });
    }

    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Connect student to dedicated Socket.IO exam session room
  useEffect(() => {
    if (!socket || !attempt._id) return;

    socket.emit('join_exam_session', {
      attemptId: attempt._id,
      userName: user.name,
      badgeId: user.badgeId,
      examTitle: exam.title
    });

    // Listen for live admin warnings or direct admin terminations
    socket.on('admin_warning', (data) => {
      setAdminNotice(data);
    });

    socket.on('admin_force_terminated', (data) => {
      setViolationModal({
        isOpen: true,
        type: 'Administrator Direct Intervention',
        details: data.reason || 'Exam terminated by Command Bridge Administrator.',
        count: exam.violationThreshold || 3,
        threshold: exam.violationThreshold || 3,
        isTerminated: true
      });
    });

    // Auto-submit when admin clicks "Stop Quiz"
    const handleQuizStopped = (data) => {
      alert(`⏹ ASSESSMENT CONCLUDED: ${data.message || 'The administrator has concluded the examination session. Your attempted answers have been automatically submitted.'}`);
      handleFinalSubmit(true);
    };

    socket.on('quiz_stopped', handleQuizStopped);

    return () => {
      socket.off('admin_warning');
      socket.off('admin_force_terminated');
      socket.off('quiz_stopped', handleQuizStopped);
    };
  }, [socket, attempt._id, user, exam.title, exam.violationThreshold]);

  // Submit exam handler
  const handleFinalSubmit = useCallback(async (isAutoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.submitAttempt(attempt._id, {
        answers,
        timeSpentSeconds: timeSpentRef.current
      });
      if (onExamFinished) {
        onExamFinished(attempt._id);
      }
    } catch (err) {
      console.error('Final submit failed:', err);
      // Even if network blips, redirect to results
      if (onExamFinished) onExamFinished(attempt._id);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, attempt._id, answers, onExamFinished]);

  // Countdown timer effect
  useEffect(() => {
    if (secondsRemaining <= 0) {
      handleFinalSubmit(true);
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(true);
          return 0;
        }
        timeSpentRef.current += 1;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, handleFinalSubmit]);

  // Periodic heartbeat to admin room (every 10s)
  useEffect(() => {
    if (!socket || !attempt._id) return;
    const heartbeatTimer = setInterval(() => {
      socket.emit('exam_heartbeat', {
        attemptId: attempt._id,
        answeredCount: Object.keys(answers).length,
        timeRemainingSeconds: secondsRemaining,
        violationsCount
      });
    }, 8000);

    return () => clearInterval(heartbeatTimer);
  }, [socket, attempt._id, answers, secondsRemaining, violationsCount]);

  // Proctoring trigger handler
  const triggerViolation = useCallback(async (type, details) => {
    if (violationModal.isOpen && violationModal.isTerminated) return;

    try {
      const res = await api.recordViolation(attempt._id, { type, details });
      const currentCount = res.violationsCount;
      const isTerminated = res.terminated;

      setViolationsCount(currentCount);

      // Play audio beep tone simulation via Web Audio API if available
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = isTerminated ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(isTerminated ? 300 : 600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch (e) {}

      setViolationModal({
        isOpen: true,
        type,
        details,
        count: currentCount,
        threshold: res.threshold || 3,
        isTerminated
      });
    } catch (err) {
      console.error('Failed to log violation on server:', err);
    }
  }, [attempt._id, violationModal.isOpen, violationModal.isTerminated]);

  // Proctoring Event Listeners (Tab switch, Fullscreen exit, Blur, Copy/Paste)
  useEffect(() => {
    let blurTimer = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation('Tab Switch Detected', 'The exam window was hidden or another application tab was selected.');
      }
    };

    const handleWindowBlur = () => {
      // Avoid immediate termination on quick OS key events or input blur; confirm window focus loss
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (!document.hasFocus() || document.hidden) {
          triggerViolation('Window Focus Lost', 'The cursor left the examination environment or an external overlay gained focus.');
        }
      }, 2000);
    };

    const handleWindowFocus = () => {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        fullscreenActiveRef.current = true;
      } else if (fullscreenActiveRef.current && !violationModal.isTerminated) {
        triggerViolation('Fullscreen Exited', 'Full-screen examination mode was exited. Fullscreen is strictly enforced.');
      }
    };

    const handleCopyPaste = (e) => {
      e.preventDefault();
      triggerViolation('Clipboard Operation Blocked', `Attempted clipboard ${e.type} operation inside test environment.`);
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleKeyDown = (e) => {
      // Prevent dev tools inspection shortcuts ONLY:
      // F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        triggerViolation('Developer Inspection Attempt', 'Devtools and source inspection shortcuts are strictly prohibited.');
      }
      // Allow all normal typing, question navigation, numbers 1-4, arrow keys, etc.
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (blurTimer) clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerViolation, violationModal.isTerminated]);

  // Answer selection handler
  const handleSelectOption = async (optionIdx) => {
    if (violationModal.isTerminated || attempt.isCheated || attempt.status === 'terminated') return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const newAnswers = { ...answers, [currentQ.id]: optionIdx };
    setAnswers(newAnswers);

    // Save to server asynchronously
    try {
      await api.saveAnswer(attempt._id, {
        questionId: currentQ.id,
        selectedOptionIndex: optionIdx,
        timeSpentSeconds: timeSpentRef.current
      });
    } catch (err) {
      console.warn('Failed to persist answer:', err.message);
    }
  };

  // Clear answer
  const handleClearAnswer = async () => {
    if (violationModal.isTerminated || attempt.isCheated || attempt.status === 'terminated') return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const newAnswers = { ...answers };
    delete newAnswers[currentQ.id];
    setAnswers(newAnswers);

    try {
      await api.saveAnswer(attempt._id, {
        questionId: currentQ.id,
        selectedOptionIndex: null,
        timeSpentSeconds: timeSpentRef.current
      });
    } catch (err) {
      console.warn('Failed to clear answer:', err.message);
    }
  };

  // Toggle Mark for Review
  const handleToggleFlag = async () => {
    if (violationModal.isTerminated || attempt.isCheated || attempt.status === 'terminated') return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    let newFlagged = [...flagged];
    if (newFlagged.includes(currentQ.id)) {
      newFlagged = newFlagged.filter(id => id !== currentQ.id);
    } else {
      newFlagged.push(currentQ.id);
    }
    setFlagged(newFlagged);

    try {
      await api.saveAnswer(attempt._id, {
        flagged: newFlagged,
        timeSpentSeconds: timeSpentRef.current
      });
    } catch (err) {}
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setVisited(prev => ({ ...prev, [nextIdx]: true }));
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setVisited(prev => ({ ...prev, [prevIdx]: true }));
    }
  };

  const handleJumpToQuestion = (idx) => {
    setCurrentIndex(idx);
    setVisited(prev => ({ ...prev, [idx]: true }));
  };

  // Format time remaining MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Current question object
  const currentQ = questions[currentIndex] || {};
  const currentSelectedOption = answers[currentQ.id];
  const isCurrentFlagged = flagged.includes(currentQ.id);

  // Time styling: amber when < 5m, red pulsing when < 1m
  const isTimeCritical = secondsRemaining <= 60;
  const isTimeWarning = secondsRemaining <= 300 && !isTimeCritical;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col select-none">
      
      {/* Top Proctor Bar */}
      <header className="bg-[#0b1120] border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-lg">
        
        {/* Left: Exam Info */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
              {exam.title}
            </h1>
            <p className="text-[10px] text-cyan-400 font-mono">
              Operative: {user?.name} ({user?.badgeId})
            </p>
          </div>
        </div>

        {/* Center: Live Countdown Timer */}
        <div className="flex items-center space-x-2">
          <div className={`px-4 py-1.5 rounded-xl border flex items-center space-x-2 font-mono font-extrabold text-sm sm:text-base transition-all ${
            isTimeCritical 
              ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse glow-red' 
              : isTimeWarning 
                ? 'bg-amber-950/70 border-amber-500 text-amber-300' 
                : 'bg-slate-900 border-cyan-900/60 text-cyan-300'
          }`}>
            <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-rose-400' : isTimeWarning ? 'text-amber-400' : 'text-cyan-400'}`} />
            <span>{formatTime(secondsRemaining)}</span>
          </div>
        </div>

        {/* Right: Submit Button & Strike Indicator */}
        <div className="flex items-center space-x-3">
          {/* Strikes Counter */}
          <div className="hidden sm:flex items-center space-x-1.5 text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400">Strikes:</span>
            <span className={`font-bold ${violationsCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {violationsCount}/{exam.violationThreshold || 3}
            </span>
          </div>

          <button
            onClick={() => setConfirmSubmitModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 flex items-center space-x-1.5 transition-all"
          >
            <span>Submit Exam</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

      </header>

      {/* Admin Live Warning Banner (if Tony Stark or Cap dispatched one) */}
      {adminNotice && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              DIRECT NOTICE FROM {adminNotice.from.toUpperCase()} ({adminNotice.alias}): "{adminNotice.message}"
            </span>
          </div>
          <button
            onClick={() => setAdminNotice(null)}
            className="text-[10px] underline ml-4 hover:opacity-80 font-mono"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Main Examination Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Question Area (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
          
          <div className="rounded-2xl bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 p-6 sm:p-8 shadow-xl flex-1 flex flex-col">
            
            {totalQuestions === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center my-auto">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                <h3 className="text-sm font-bold text-white mb-1">Loading Examination Questions...</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Synchronizing allocated questions with the assessment engine. If questions do not appear within a few seconds, click below to refresh.
                </p>
                <button
                  onClick={() => {
                    api.getExamById(exam._id || attempt.examId)
                      .then(full => full?.questions && setExamData(full))
                      .catch(() => {});
                  }}
                  className="mt-4 px-4 py-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 text-xs font-bold hover:bg-cyan-900 transition-colors"
                >
                  Force Reload Questions
                </button>
              </div>
            ) : (
              <>
                {/* Question Header & Action bar */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono font-bold text-xs">
                      Question {currentIndex + 1}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      of {totalQuestions}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleToggleFlag}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                        isCurrentFlagged 
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{isCurrentFlagged ? 'Flagged for Review' : 'Mark for Review'}</span>
                    </button>

                    {currentSelectedOption !== undefined && (
                      <button
                        onClick={handleClearAnswer}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                        title="Clear selected answer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <div className="mb-8">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-100 leading-relaxed">
                    {currentQ.questionText}
                  </h2>
                </div>

                {/* 4 Multiple Choice Options */}
                <div className="space-y-3 flex-1">
                  {(currentQ.options || []).map((opt, optIdx) => {
                    const isSelected = currentSelectedOption === optIdx;
                    const optionLetter = String.fromCharCode(65 + optIdx); // A, B, C, D

                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleSelectOption(optIdx)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start space-x-3.5 group ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                            : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-all ${
                          isSelected
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200'
                        }`}>
                          {optionLetter}
                        </div>

                        <div className="text-xs sm:text-sm font-medium pt-0.5 leading-relaxed">
                          {opt}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Navigation & Submit Buttons */}
            <div className="pt-6 mt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentIndex === 0}
                  onClick={handlePrev}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    currentIndex === 0
                      ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  disabled={currentIndex === totalQuestions - 1}
                  onClick={handleNext}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    currentIndex === totalQuestions - 1
                      ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  }`}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Prominent Submit Exam Button */}
              <button
                onClick={() => setConfirmSubmitModal(true)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center space-x-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer transform hover:scale-105 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Exam</span>
              </button>
            </div>

          </div>

        </div>

        {/* Sidebar: Palette & Proctoring Camera (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Question Palette */}
          <div className="h-[430px]">
            <QuestionPalette
              questions={questions}
              currentIndex={currentIndex}
              onSelectQuestion={handleJumpToQuestion}
              answers={answers}
              flagged={flagged}
              visited={visited}
            />
          </div>

          {/* Anti-Cheat Proctor Sentinel Card (Zero Camera Required) */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Anti-Cheat Sentinel Active</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Monitoring active window state. Tab switches and loss of focus are automatically logged and will terminate unauthorized attempts.
            </p>
          </div>

        </div>

      </div>

      {/* Violation Alert Modal */}
      <ViolationModal
        isOpen={violationModal.isOpen}
        violationCount={violationModal.count}
        threshold={violationModal.threshold}
        violationType={violationModal.type}
        details={violationModal.details}
        isTerminated={violationModal.isTerminated}
        onAcknowledge={() => {
          setViolationModal(prev => ({ ...prev, isOpen: false }));
          // Re-request fullscreen
          const el = document.documentElement;
          if (el.requestFullscreen && !document.fullscreenElement) {
            el.requestFullscreen().catch(() => {});
          }
        }}
        onGoToResults={() => {
          if (onExamFinished) onExamFinished(attempt._id);
        }}
      />

      {/* Final Submission Confirmation Modal */}
      {confirmSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-slate-700 p-6 shadow-2xl space-y-4">
            
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Confirm Examination Submission</span>
            </h3>

            <p className="text-xs text-slate-300">
              Are you sure you want to finalize and submit your assessment? Once submitted, answers are permanently locked for grading.
            </p>

            {/* Submission Summary Table */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Total Questions:</span>
                <span className="font-bold text-white font-mono">{totalQuestions}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Answered:</span>
                <span className="font-bold font-mono">{Object.keys(answers).length}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Unanswered:</span>
                <span className="font-bold font-mono">{totalQuestions - Object.keys(answers).length}</span>
              </div>
              <div className="flex justify-between text-purple-300">
                <span>Marked for Review:</span>
                <span className="font-bold font-mono">{flagged.length}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSubmitModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                Back to Exam
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFinalSubmit(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-1.5"
              >
                <span>{submitting ? 'Submitting...' : 'Yes, Submit Exam'}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
