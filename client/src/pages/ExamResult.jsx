import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Clock, 
  Percent, 
  TrendingUp, 
  ShieldAlert, 
  ArrowLeft, 
  RotateCcw, 
  Lock, 
  Sparkles,
  BookOpen,
  Filter
} from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';

export default function ExamResult({ attemptId, onBackToDashboard }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'incorrect', 'correct', 'unanswered'

  useEffect(() => {
    async function loadResult() {
      try {
        setLoading(true);
        const data = await api.getAttemptResult(attemptId);
        setResult(data);

        // If score percentage is >= 70%, trigger confetti celebration
        if (data.percentage >= 70 && data.status !== 'terminated') {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      } catch (err) {
        setError(err.message || 'Failed to retrieve assessment score.');
      } finally {
        setLoading(false);
      }
    }

    if (attemptId) {
      loadResult();
    }
  }, [attemptId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        <div className="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm">Calculating server-side examination score & mistake analysis...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-rose-400 font-semibold mb-4">{error || 'Result not found.'}</p>
        <button
          onClick={onBackToDashboard}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isTerminated = result.status === 'terminated';
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  // Filtered mistake analysis list
  const filteredAnalysis = (result.mistakeAnalysis || []).filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          className="text-xs text-slate-400 hover:text-cyan-400 flex items-center space-x-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Member Dashboard</span>
        </button>

        <span className="text-xs font-mono px-3 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
          ID: {result.attemptId.slice(0, 8)}
        </span>
      </div>

      {/* Hero Score Card */}
      <div className={`relative rounded-3xl p-6 sm:p-8 border shadow-2xl overflow-hidden ${
        isTerminated
          ? 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-[#070b14] border-rose-600/60'
          : 'bg-gradient-to-r from-[#0c1836] via-[#0f2147] to-[#070b14] border-cyan-800/50'
      }`}>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono font-bold mb-2">
              <span className={`px-2.5 py-0.5 rounded ${
                isTerminated 
                  ? 'bg-rose-900/80 text-rose-300 border border-rose-700' 
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}>
                {isTerminated ? 'SESSION TERMINATED' : 'EXAMINATION FINALIZED'}
              </span>
              <span className="text-slate-400">{result.examCode}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {result.examTitle}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Member: <strong className="text-cyan-300">{result.studentName}</strong> ({result.studentBadge})
            </p>

            {isTerminated && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200">
                <strong>Termination Cause:</strong> {result.terminatedReason}
              </div>
            )}
          </div>

          {/* Primary Score Ring / Box */}
          <div className="flex items-center gap-4">
            <div className="text-center p-4 sm:p-5 rounded-2xl bg-black/40 border border-slate-800/80 min-w-[130px]">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Score
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-cyan-300 mt-0.5">
                {result.score}
                <span className="text-base text-slate-500 font-normal">/{result.maxMarks}</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 font-mono mt-1 block">
                {result.percentage}% Marks
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Questions</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">{result.totalQuestions}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-emerald-400 block text-[10px] font-semibold uppercase">Correct</span>
            <span className="text-sm font-bold text-emerald-300 font-mono mt-0.5 block">{result.correctCount}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-rose-400 block text-[10px] font-semibold uppercase">Incorrect</span>
            <span className="text-sm font-bold text-rose-300 font-mono mt-0.5 block">{result.incorrectCount}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Unanswered</span>
            <span className="text-sm font-bold text-slate-300 font-mono mt-0.5 block">{result.unansweredCount}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-amber-400 block text-[10px] font-semibold uppercase">Accuracy</span>
            <span className="text-sm font-bold text-amber-300 font-mono mt-0.5 block">{result.accuracy}%</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Time Taken</span>
            <span className="text-sm font-bold text-cyan-300 font-mono mt-0.5 block">{formatTime(result.timeSpentSeconds)}</span>
          </div>
        </div>

      </div>

      <DisclaimerBanner />

      {/* Section 6: Mistake Analysis */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              <span>Comprehensive Mistake Analysis & Revision Roadmap</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review rationale, option breakdown, and core concepts to strengthen.
            </p>
          </div>

          {result.answerKeyReleased && (
            <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filter === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({result.totalQuestions})
              </button>
              <button
                onClick={() => setFilter('incorrect')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filter === 'incorrect' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Incorrect ({result.incorrectCount})
              </button>
              <button
                onClick={() => setFilter('correct')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filter === 'correct' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Correct ({result.correctCount})
              </button>
              <button
                onClick={() => setFilter('unanswered')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filter === 'unanswered' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Unanswered ({result.unansweredCount})
              </button>
            </div>
          )}
        </div>

        {/* If Answer Keys are Locked by Admin */}
        {!result.answerKeyReleased ? (
          <div className="p-8 rounded-2xl bg-[#0f172a] border border-amber-500/30 text-center space-y-3">
            <Lock className="w-10 h-10 mx-auto text-amber-400" />
            <h3 className="text-base font-bold text-white">
              Answer Key & Mistake Analysis Restricted
            </h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              Administrator Tony Stark or Steve Rogers has configured this exam's answer keys to be released manually once all operatives have concluded testing. Your preliminary score has been securely registered.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnalysis.map((item) => {
              const isCorrect = item.status === 'correct';
              const isIncorrect = item.status === 'incorrect';
              const isUnanswered = item.status === 'unanswered';

              return (
                <div
                  key={item.questionId}
                  className={`rounded-2xl border p-5 sm:p-6 transition-all ${
                    isCorrect
                      ? 'bg-[#0b1b24]/60 border-emerald-500/30'
                      : isIncorrect
                        ? 'bg-[#1c0f16]/60 border-rose-500/40'
                        : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  {/* Top Bar: Question Number, Status badge, Marks */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                      Question {item.questionNumber}
                    </span>

                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                        isCorrect
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : isIncorrect
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {isCorrect && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {isIncorrect && <XCircle className="w-3.5 h-3.5" />}
                        {isUnanswered && <MinusCircle className="w-3.5 h-3.5" />}
                        <span className="capitalize">{item.status}</span>
                      </span>

                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        item.marksAwarded > 0 
                          ? 'bg-emerald-900/40 text-emerald-300' 
                          : item.marksAwarded < 0 
                            ? 'bg-rose-900/40 text-rose-300' 
                            : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.marksAwarded > 0 ? `+${item.marksAwarded}` : item.marksAwarded} pts
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <h3 className="text-sm sm:text-base font-semibold text-white mb-4">
                    {item.questionText}
                  </h3>

                  {/* Options Comparison Grid */}
                  <div className={`grid gap-3 mb-4 text-xs ${item.correctOptionText ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                    
                    {/* Selected Answer */}
                    <div className={`p-3 rounded-xl border ${
                      isCorrect 
                        ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200' 
                        : isIncorrect
                          ? 'bg-rose-950/40 border-rose-800/50 text-rose-200'
                          : 'bg-slate-800/40 border-slate-700 text-slate-300'
                    }`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75 mb-1 text-cyan-400">
                        Your Selected Option:
                      </span>
                      <p className="font-medium text-white">
                        {item.selectedOptionText}
                      </p>
                    </div>

                    {/* Official Correct Answer (Admin only) */}
                    {item.correctOptionText && (
                      <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-400 mb-1">
                          Official Correct Answer:
                        </span>
                        <p className="font-medium text-emerald-100">
                          {item.correctOptionText}
                        </p>
                      </div>
                    )}

                  </div>

                  {/* Rationale & Explanation (Admin only or when provided) */}
                  {item.explanation && (
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs space-y-2">
                      <div>
                        <span className="font-bold text-cyan-400 block mb-0.5">
                          Technical Rationale:
                        </span>
                        <p className="text-slate-300 leading-relaxed">
                          {item.explanation}
                        </p>
                      </div>

                      {item.revisionConcept && (
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Related Concept to Revise:</span>
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            {item.revisionConcept}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
