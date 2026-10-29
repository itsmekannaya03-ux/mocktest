import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Award, 
  TrendingUp, 
  Percent, 
  CheckCircle2, 
  RotateCcw, 
  ArrowRight, 
  BookOpen, 
  Sparkles,
  Calendar,
  ShieldCheck,
  Zap
} from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';

export default function MemberDashboard({ onViewResult, onTakeExam }) {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMemberAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err.message || 'Failed to load member analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        <div className="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs">Compiling operative personal performance records...</p>
      </div>
    );
  }

  const summary = analytics?.summary || {};
  const trends = analytics?.trends || [];
  const weakTopics = analytics?.weakTopics || [];
  const recentAttempts = analytics?.recentAttempts || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header Profile Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0c1836] via-[#0f2147] to-[#0a1226] border border-cyan-900/40 p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 mb-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>CONFIDENTIAL OPERATIVE DOSSIER</span>
            <span className="text-slate-500">•</span>
            <span>{user?.badgeId}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Performance Analytics: <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">{user?.name}</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Real-time track record, accuracy progression, and targeted concept revision insights.
          </p>
        </div>

        <button
          onClick={loadAnalytics}
          className="self-start md:self-auto text-xs px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center space-x-1.5 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Sync Telemetry</span>
        </button>
      </div>

      <DisclaimerBanner />

      {/* 4 Primary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-[#0f172a]/90 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Total Assessments</span>
            <BookOpen className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
            {summary.totalExamsTaken || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Completed mock examinations</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0f172a]/90 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Best Score</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">
            {summary.bestScore || 0} pts
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Peak assessment result</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0f172a]/90 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Average Score</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-300">
            {summary.avgScore || 0} pts
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Mean points across attempts</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0f172a]/90 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Overall Accuracy</span>
            <Percent className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-300">
            {summary.overallAccuracy || 0}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Correct / total questions attempted</p>
        </div>

      </div>

      {/* Topics Needing Improvement & Performance Trends Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Topics Needing Improvement */}
        <div className="rounded-2xl bg-[#0f172a]/90 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Prioritized Improvement Topics</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Concepts where errors were recorded in prior examinations:
            </p>

            {weakTopics.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                <p className="font-semibold text-slate-200">No recurring mistake patterns detected.</p>
                <p className="text-slate-500 mt-0.5">Maintain vigilance across all upcoming mock assessments.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {weakTopics.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{item.topic}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Recorded {item.mistakes} incorrect choice{item.mistakes > 1 ? 's' : ''}
                      </p>
                    </div>

                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      High Priority
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Visual Score Trends */}
        <div className="rounded-2xl bg-[#0f172a]/90 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Assessment Performance Trends</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Trajectory of scores across recent test attempts:
            </p>

            {trends.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                <p>Complete your first examination to generate performance trend charts.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {trends.map((t, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate max-w-[220px]">
                        {t.examTitle}
                      </span>
                      <span className="font-mono text-cyan-300 font-bold">
                        {t.percentage}% ({t.score}/{t.maxMarks})
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          t.percentage >= 75
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : t.percentage >= 50
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-400'
                              : 'bg-gradient-to-r from-amber-500 to-rose-400'
                        }`}
                        style={{ width: `${Math.min(100, t.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Completed Examinations History Table */}
      <div className="rounded-2xl bg-[#0f172a]/90 border border-slate-800 p-6 shadow-xl">
        <h2 className="text-base font-bold text-white mb-4">
          Examination History & Mistake Reviews
        </h2>

        {recentAttempts.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No completed exams recorded under this member profile yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Exam Code</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentAttempts.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-cyan-300">
                      {att.examCode}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {att.examTitle}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {att.submittedAt ? att.submittedAt.split('T')[0] : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {att.score} / {att.maxMarks} ({att.percentage}%)
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        att.status === 'terminated'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {att.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onViewResult(att.id)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-bold transition-all"
                      >
                        Mistake Analysis
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
