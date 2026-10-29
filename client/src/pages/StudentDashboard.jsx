import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, 
  HelpCircle, 
  Award, 
  TrendingUp, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  RotateCcw,
  Sparkles,
  BookOpen
} from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';

export default function StudentDashboard({ onSelectExam, onViewResult }) {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [examsData, analyticsData] = await Promise.all([
        api.getExams(),
        api.getMemberAnalytics().catch(() => null)
      ]);
      setExams(examsData || []);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err.message || 'Failed to load examinations data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Operative Welcome & Room Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#0c1836] via-[#0f2147] to-[#0a1226] border border-cyan-900/40 p-6 sm:p-8 shadow-2xl overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 mb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>COMMON EXAMINATION ROOM</span>
              <span className="text-slate-500">•</span>
              <span>{user?.clearance || 'Level 3 Operative'}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome, <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">{user?.name}</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Access official mock evaluations, real-time proctored testing environments, and customized post-exam diagnostic review.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          {analytics && (
            <div className="flex items-center gap-3">
              <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-center min-w-[90px]">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Completed</p>
                <p className="text-xl font-extrabold font-mono text-cyan-300">
                  {analytics.summary?.totalExamsTaken || 0}
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-center min-w-[90px]">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Best Score</p>
                <p className="text-xl font-extrabold font-mono text-emerald-400">
                  {analytics.summary?.bestScore || 0}
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-center min-w-[90px]">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Avg Accuracy</p>
                <p className="text-xl font-extrabold font-mono text-amber-300">
                  {analytics.summary?.overallAccuracy || 0}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <DisclaimerBanner />

      {/* Available Exams Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <span>Available Mock Examinations</span>
            </h2>
            <p className="text-xs text-slate-400">
              Select an exam protocol to inspect guidelines and enter the timed test room.
            </p>
          </div>

          <button
            onClick={loadData}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh Exams</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs">Loading examination protocols...</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-base font-bold text-white">No Exam Scheduled Right Now</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Your administrator has not published the test yet. Once the administrator publishes the examination, click <strong>"Refresh Exams"</strong> above to enter your test.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {exams.map((exam) => {
              const attempt = exam.userAttempt;
              const isCompleted = attempt && (attempt.status === 'submitted' || attempt.status === 'terminated');
              const isInProgress = attempt && attempt.status === 'in_progress';

              return (
                <div
                  key={exam._id}
                  className="rounded-2xl bg-[#0f172a]/80 backdrop-blur-md border border-slate-800 hover:border-cyan-500/40 p-6 flex flex-col justify-between transition-all duration-200 shadow-xl group"
                >
                  <div>
                    {/* Header: Code & Status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-800 text-cyan-300 border border-slate-700">
                        {exam.code}
                      </span>
                      {isCompleted ? (
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                          attempt.status === 'terminated' 
                            ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{attempt.status === 'terminated' ? 'Terminated' : 'Completed'}</span>
                        </span>
                      ) : isInProgress ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                          In Progress
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                          Ready to Take
                        </span>
                      )}
                    </div>

                    {/* Title & Subject */}
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {exam.title}
                    </h3>
                    <p className="text-xs text-cyan-400/90 font-medium mt-0.5 mb-2">
                      {exam.subject}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {exam.description}
                    </p>

                    {/* Meta Parameters Grid */}
                    <div className="grid grid-cols-3 gap-2 py-3 px-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs mb-4">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Duration</span>
                        <span className="font-semibold text-slate-200 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{exam.durationMinutes} mins</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Questions</span>
                        <span className="font-semibold text-slate-200">
                          {exam.questionsCount} MCQs
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Marking</span>
                        <span className="font-semibold text-slate-200">
                          +{exam.marksPerQuestion} / -{exam.negativeMarkPerQuestion}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-2">
                    {isCompleted ? (
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-mono">
                          <span className="text-slate-400">Score: </span>
                          <span className="font-bold text-white">{attempt.score} pts</span>
                          <span className="text-slate-500 ml-1">({attempt.percentage}%)</span>
                        </div>
                        <button
                          onClick={() => onViewResult(attempt.attemptId)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/50 flex items-center space-x-1.5 transition-all"
                        >
                          <span>Review Mistake Analysis</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelectExam(exam)}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-all"
                      >
                        <span>{isInProgress ? 'Resume Examination' : 'Inspect Rules & Start Exam'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Weak Topics / Areas Needing Improvement */}
      {analytics && analytics.weakTopics && analytics.weakTopics.length > 0 && (
        <div className="rounded-2xl bg-[#0f172a]/90 border border-amber-500/30 p-6 shadow-xl">
          <div className="flex items-center space-x-2 text-amber-400 mb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              Areas & Topics Needing Improvement
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Generated from your past mock examination mistakes. Focus revision on these core concepts:
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.weakTopics.map((item, i) => (
              <div 
                key={i} 
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-200">{item.topic}</p>
                  <p className="text-[10px] text-rose-400 font-mono">
                    {item.mistakes} incorrect responses
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Revise
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
