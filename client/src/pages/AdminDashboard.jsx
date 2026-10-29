import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  ShieldAlert, 
  Users, 
  Activity, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Download, 
  Skull, 
  Radio, 
  Search, 
  Plus, 
  Sparkles, 
  FileText, 
  BookOpen, 
  Trash2, 
  Eye, 
  RefreshCw,
  Flame,
  Check,
  Zap,
  Play,
  Square,
  Award,
  X,
  UserCheck,
  SlidersHorizontal
} from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';

export default function AdminDashboard({ 
  adminTab: propAdminTab, 
  setAdminTab: propSetAdminTab, 
  onNavigate, 
  onViewResult, 
  onStartQuiz,
  onStopQuiz,
  isQuizLive,
  setIsQuizLive
}) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [internalTab, setInternalTab] = useState('overview');
  const activeTab = propAdminTab || internalTab;
  const setActiveTab = propSetAdminTab || setInternalTab;

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, attending, cheated, passed, failed

  // Modals & Forms
  const [parsingAi, setParsingAi] = useState(false);
  const [rawText, setRawText] = useState('');
  const [examForm, setExamForm] = useState({
    title: 'Team Mock Assessment',
    subject: 'Core Engineering & Protocol',
    description: 'Timed assessment with anti-cheat protection and per-candidate question randomization.',
    durationMinutes: 15,
    marksPerQuestion: 4,
    negativeMarkPerQuestion: 1,
    passingPercentage: 50,
    questions: []
  });

  const [terminateModal, setTerminateModal] = useState({ isOpen: false, attemptId: null, studentName: '', reason: '' });
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [publishedExams, setPublishedExams] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, examsList] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminExams().catch(() => [])
      ]);
      setOverview(data);
      setPublishedExams(examsList || []);
      if (data?.isQuizLive !== undefined && setIsQuizLive) {
        setIsQuizLive(data.isQuizLive);
      }
    } catch (err) {
      console.error('Failed to fetch admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await api.deleteExam(id);
      setActionSuccessMsg(`Exam "${title}" removed.`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
      loadData();
    } catch (err) {
      alert(`Failed to delete exam: ${err.message}`);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Socket.IO real-time event listeners
  useEffect(() => {
    if (!socket) return;

    socket.emit('join_admin_bridge', {
      name: user?.name,
      badgeId: user?.badgeId
    });

    const handleExamStarted = () => loadData();
    const handleStudentCheated = (data) => {
      loadData();
      setActionSuccessMsg(`🚨 CHEATING DETECTED: ${data.userName} has been caught and blocked (${data.type})`);
      setTimeout(() => setActionSuccessMsg(''), 8000);
    };
    const handleViolationAlert = () => loadData();
    const handleExamSubmitted = () => loadData();
    const handleStudentHeartbeat = (data) => {
      setOverview(prev => {
        if (!prev) return prev;
        const updatedActive = (prev.activeAttempts || []).map(s => {
          if (s.id === data.attemptId) {
            return {
              ...s,
              answeredCount: data.answeredCount,
              timeRemainingSeconds: data.timeRemainingSeconds,
              violationsCount: data.violationsCount
            };
          }
          return s;
        });
        return { ...prev, activeAttempts: updatedActive };
      });
    };

    socket.on('exam_started', handleExamStarted);
    socket.on('student_cheated', handleStudentCheated);
    socket.on('violation_alert', handleViolationAlert);
    socket.on('exam_submitted', handleExamSubmitted);
    socket.on('student_heartbeat', handleStudentHeartbeat);

    return () => {
      socket.off('exam_started', handleExamStarted);
      socket.off('student_cheated', handleStudentCheated);
      socket.off('violation_alert', handleViolationAlert);
      socket.off('exam_submitted', handleExamSubmitted);
      socket.off('student_heartbeat', handleStudentHeartbeat);
    };
  }, [socket, user]);

  // AI Question Parser handler
  const handleParseAiQuestions = async () => {
    if (!rawText.trim()) {
      alert('Please paste questions text first.');
      return;
    }
    setParsingAi(true);
    try {
      const res = await api.parseAiQuestions(rawText);
      if (res.questions && res.questions.length > 0) {
        setExamForm(prev => ({
          ...prev,
          questions: res.questions
        }));
        setActionSuccessMsg(`✨ AI successfully parsed and formatted ${res.questions.length} questions into ordered rows!`);
        setTimeout(() => setActionSuccessMsg(''), 6000);
      } else {
        alert('Could not find questions in the pasted text. Please verify formatting.');
      }
    } catch (err) {
      alert(`AI parsing failed: ${err.message}`);
    } finally {
      setParsingAi(false);
    }
  };

  // Publish newly parsed exam
  const handlePublishExam = async (e) => {
    e.preventDefault();
    if (!examForm.title || examForm.questions.length === 0) {
      alert('Please provide an exam title and at least one formatted question.');
      return;
    }
    try {
      await api.createExam({
        ...examForm,
        violationThreshold: 1, // Strict 1-strike immediate block
        instructions: [
          'Fullscreen mode is strictly enforced.',
          'Tab switching, external AI usage, or losing window focus results in immediate disqualification and blocking.',
          'Questions are uniquely allocated per candidate.'
        ]
      });
      alert(`Exam "${examForm.title}" published successfully! Questions will be uniquely allocated per person.`);
      setRawText('');
      loadData();
      setActiveTab('overview');
    } catch (err) {
      alert(`Failed to publish exam: ${err.message}`);
    }
  };

  // Reset attempt (unblock / give another chance)
  const handleResetAttempt = async (attemptId, studentName) => {
    if (!confirm(`Are you sure you want to unblock/reset the exam session for ${studentName}?`)) return;
    try {
      await api.resetAttempt(attemptId);
      setActionSuccessMsg(`Session for ${studentName} reset. Candidate can now re-enter.`);
      setTimeout(() => setActionSuccessMsg(''), 5000);
      loadData();
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  // Force terminate student
  const handleForceTerminate = async (e) => {
    e.preventDefault();
    if (!terminateModal.attemptId) return;
    try {
      await api.forceTerminate(terminateModal.attemptId, terminateModal.reason || 'Manually blocked by Administrator.');
      setTerminateModal({ isOpen: false, attemptId: null, studentName: '', reason: '' });
      loadData();
    } catch (err) {
      alert(`Termination failed: ${err.message}`);
    }
  };

  // Remove player / candidate from roster
  const handleRemovePlayer = async (playerId, playerName) => {
    if (!window.confirm(`Are you sure you want to remove player "${playerName}" from the roster?`)) {
      return;
    }
    try {
      await api.removePlayer(playerId);
      await loadData();
    } catch (err) {
      alert(`Could not remove player: ${err.message}`);
    }
  };

  // Export CSV of all results
  const handleExportCSV = () => {
    const list = overview?.allResults || [];
    if (list.length === 0) return;
    const headers = ['Candidate Name', 'Badge ID', 'Exam Title', 'Status', 'Score', 'Max Marks', 'Percentage', 'Accuracy', 'Violations', 'Date'];
    const rows = list.map(r => [
      `"${r.studentName}"`,
      `"${r.studentBadgeId}"`,
      `"${r.examTitle}"`,
      `"${r.calculatedStatus?.toUpperCase() || r.status}"`,
      r.score,
      r.maxMarks,
      `${r.percentage}%`,
      `${r.accuracy}%`,
      r.violationsCount,
      `"${r.submittedAt || r.startedAt || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `TEAM_RESULTS_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const counts = overview?.counts || { attending: 0, cheated: 0, passed: 0, failed: 0, totalCandidates: 0 };
  const cheatedList = overview?.cheatedList || [];
  const activeAttempts = overview?.activeAttempts || [];
  const allResults = overview?.allResults || [];
  const failedList = allResults.filter(r => r && r.calculatedStatus === 'failed');

  // Filtered candidate results (bulletproof against null, undefined, or missing properties)
  const filteredResults = allResults.filter(r => {
    if (!r) return false;
    const sName = (r.studentName || r.userName || '').toString().toLowerCase();
    const eTitle = (r.examTitle || '').toString().toLowerCase();
    const bId = (r.studentBadgeId || r.userBadgeId || '').toString().toLowerCase();
    const q = (search || '').toString().trim().toLowerCase();

    const matchesSearch = !q || sName.includes(q) || eTitle.includes(q) || bId.includes(q);

    let matchesStatus = true;
    if (statusFilter === 'attending') matchesStatus = r.status === 'in_progress';
    else if (statusFilter === 'cheated') matchesStatus = Boolean(r.isCheated || r.status === 'terminated');
    else if (statusFilter === 'passed') matchesStatus = r.calculatedStatus === 'passed';
    else if (statusFilter === 'failed') matchesStatus = r.calculatedStatus === 'failed';

    return matchesSearch && matchesStatus;
  });

  // Registered players roster list and search filter
  const registeredPlayers = overview?.registeredPlayers || [];
  const filteredPlayers = registeredPlayers.filter(p => {
    const q = (playerSearch || '').trim().toLowerCase();
    if (!q) return true;
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.badgeId || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Alert toast if action succeeded */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-cyan-950/90 border border-cyan-400 text-cyan-200 text-xs font-semibold flex items-center justify-between shadow-2xl animate-in slide-in-from-top-2">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg('')} className="text-cyan-400 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Unified Command Bridge Header */}
      <div className="rounded-3xl bg-gradient-to-r from-[#170a0a] via-[#1a0f1c] to-[#0a0f1d] border border-amber-500/30 p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-400 mb-2">
            <Radio className="w-4 h-4 animate-pulse text-amber-400" />
            <span>UNIFIED COMMAND DASHBOARD</span>
            <span className="text-slate-500">•</span>
            <span>REAL-TIME ANTI-CHEAT SENTINEL</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Administrator Bridge: <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">{user?.name}</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Real-time candidate telemetry, instant AI & tab-switch cheat blocking, bulk AI question creator, and candidate score results.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isQuizLive ? (
            <button
              onClick={onStopQuiz}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white flex items-center space-x-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
              title="Stop quiz and auto-submit all candidates"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>⏹ Stop Quiz Now</span>
            </button>
          ) : (
            <button
              onClick={onStartQuiz}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center space-x-2 shadow-lg shadow-emerald-500/25 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>▶ Start Quiz</span>
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh Live Data"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Admin Action Bar (Overview, Questions, Results, Start / Stop Quiz) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#0b1329] border border-slate-800 shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Button 1: Overview */}
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'overview'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>1. Overview</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {counts.attending} Attending
            </span>
          </button>

          {/* Button 2: Questions Block */}
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'questions'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>2. Questions Block (AI)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
              {publishedExams.length} Active
            </span>
          </button>

          {/* Button 3: Results Block */}
          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'results'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Award className="w-4 h-4 text-cyan-400" />
            <span>3. Results Block</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {allResults.length} Marks
            </span>
          </button>
        </div>

        {/* Start / Stop Quiz Action Button */}
        {isQuizLive ? (
          <button
            onClick={onStopQuiz}
            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white flex items-center space-x-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>⏹ Stop Quiz</span>
          </button>
        ) : (
          <button
            onClick={onStartQuiz}
            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center space-x-2 shadow-lg shadow-emerald-500/25 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>▶ Start Quiz</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW BLOCK */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Overview Stat Cards: Number of Players & Results Counts */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Total Players (Clickable Card) */}
            <div 
              onClick={() => setShowPlayersModal(true)}
              className="p-4 rounded-2xl bg-[#0f172a]/90 border border-slate-800 hover:border-cyan-500/70 hover:bg-[#121e38] transition-all cursor-pointer transform hover:scale-[1.02] active:scale-95 shadow-md group relative"
              title="Click to view all registered players"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider group-hover:text-cyan-300 transition-colors">
                  Total Players
                </span>
                <Users className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                {counts.totalCandidates || allResults.length}
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px]">
                <span className="text-slate-500 group-hover:text-slate-400">Total registered</span>
                <span className="font-semibold text-cyan-400 flex items-center space-x-0.5 opacity-90 group-hover:opacity-100">
                  <span>View list</span>
                  <span>→</span>
                </span>
              </div>
            </div>

            {/* Attending Card */}
            <div className="p-4 rounded-2xl bg-[#08182b]/90 border border-cyan-800/50">
              <div className="flex items-center justify-between text-cyan-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">People Attending</span>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-cyan-300">
                {counts.attending}
              </div>
              <p className="text-[10px] text-cyan-400/80 mt-1">Live active in exam room</p>
            </div>

            {/* Cheated & Blocked Card */}
            <div className="p-4 rounded-2xl bg-[#1c080d]/90 border border-rose-800/50">
              <div className="flex items-center justify-between text-rose-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Cheated & Blocked</span>
                <Skull className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-rose-400">
                {counts.cheated}
              </div>
              <p className="text-[10px] text-rose-300/80 mt-1">Caught tab switch / AI</p>
            </div>

            {/* Passed Card */}
            <div className="p-4 rounded-2xl bg-[#081a11]/90 border border-emerald-800/50">
              <div className="flex items-center justify-between text-emerald-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">People Passed</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-emerald-300">
                {counts.passed}
              </div>
              <p className="text-[10px] text-emerald-400/80 mt-1">Scored ≥ 50% pass mark</p>
            </div>

            {/* Failed Card */}
            <div className="p-4 rounded-2xl bg-[#1a1407]/90 border border-amber-800/50 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-amber-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">People Failed</span>
                <XCircle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-amber-300">
                {counts.failed}
              </div>
              <p className="text-[10px] text-amber-400/80 mt-1">Below pass mark or blocked</p>
            </div>
          </div>

          {/* Cheated & Disqualified Prominent Alert Box */}
          <div className="rounded-2xl bg-gradient-to-r from-rose-950/90 to-[#1c0a10] border-2 border-rose-600/80 p-6 shadow-2xl space-y-4 glow-red">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-rose-400">
                <Skull className="w-5 h-5 text-rose-500 animate-pulse" />
                <h2 className="text-base font-extrabold uppercase tracking-wider text-white">
                  Cheated & Blocked List ({cheatedList.length})
                </h2>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-rose-900/60 text-rose-200 border border-rose-700 font-bold">
                LOCKED BY SENTINEL
              </span>
            </div>

            <p className="text-xs text-rose-200/90 leading-relaxed">
              Candidates caught switching browser tabs, using external AI models (Google Assistant, ChatGPT, Copilot), or defocusing the locked examination window. Their exam was terminated on the spot:
            </p>

            {cheatedList.length === 0 ? (
              <div className="p-4 rounded-xl bg-black/40 border border-rose-900/40 text-xs text-rose-300/70 text-center">
                No candidates caught cheating so far. Anti-cheat sentinel is actively monitoring.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {cheatedList.map((ch, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl bg-black/60 border border-rose-700/60 space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">{ch.studentName}</h3>
                        <p className="text-[10px] font-mono text-cyan-400">{ch.studentBadgeId}</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        DISQUALIFIED
                      </span>
                    </div>

                    <p className="text-xs text-rose-300 font-medium">
                      {ch.reason}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-rose-900/60 text-[10px] text-slate-400 font-mono">
                      <span>Score: {ch.score} pts ({ch.percentage}%)</span>
                      <button
                        onClick={() => handleResetAttempt(ch.attemptId, ch.studentName)}
                        className="text-cyan-400 hover:text-cyan-300 font-semibold underline"
                        title="Allow candidate another chance"
                      >
                        Reset & Unblock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Failed Candidates List Box */}
          {failedList.length > 0 && (
            <div className="rounded-2xl bg-[#141008] border border-amber-800/60 p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-400">
                  <XCircle className="w-5 h-5 text-amber-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Failed Candidates List ({failedList.length})
                  </h2>
                </div>
                <span className="text-xs font-mono text-amber-400 font-bold">Scored &lt; 50%</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {failedList.map((f, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-900 border border-amber-900/40 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{f.studentName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{f.examTitle}</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-amber-400 font-bold">{f.score} / {f.maxMarks} pts</p>
                      <p className="text-[10px] text-slate-500">({f.percentage}%)</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Attending Candidates Table */}
          <div className="rounded-2xl bg-[#0f172a]/95 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white">
                  Currently Attending Candidates ({activeAttempts.length})
                </h2>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                Live Proctor Stream
              </span>
            </div>

            {activeAttempts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 rounded-xl bg-slate-900/40 border border-slate-800/80">
                No candidates are currently taking exams. Click "Start Quiz" above to let your team enter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Candidate Name</th>
                      <th className="py-3 px-4">Exam Protocol</th>
                      <th className="py-3 px-4">Questions Answered</th>
                      <th className="py-3 px-4">Time Left</th>
                      <th className="py-3 px-4">Integrity Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {activeAttempts.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-sans font-bold text-white">
                          <div>{s.studentName}</div>
                          <div className="text-[10px] font-mono text-cyan-400">{s.studentBadgeId}</div>
                        </td>

                        <td className="py-3.5 px-4 font-sans text-slate-200">
                          {s.examTitle}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-emerald-400">{s.answeredCount || 0}</span>
                          <span className="text-slate-500"> / {s.totalQuestions} answered</span>
                        </td>

                        <td className="py-3.5 px-4 text-cyan-300 font-bold">
                          {s.timeRemainingSeconds !== undefined ? `${Math.floor(s.timeRemainingSeconds / 60)}m ${s.timeRemainingSeconds % 60}s` : 'Active'}
                        </td>

                        <td className="py-3.5 px-4 font-sans">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center space-x-1.5 w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                            <span>ATTENDING</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-sans">
                          <button
                            onClick={() => setTerminateModal({
                              isOpen: true,
                              attemptId: s.id,
                              studentName: s.studentName,
                              reason: 'Manual Disqualification by Administrator.'
                            })}
                            className="px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold"
                          >
                            Block Candidate
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
      )}

      {/* ========================================================================= */}
      {/* 2. QUESTIONS BLOCK (AI BULK CREATOR & ACTIVE EXAMS) */}
      {/* ========================================================================= */}
      {activeTab === 'questions' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Active Team Exams Manager */}
          <div className="rounded-2xl bg-[#0f172a]/95 border border-slate-800 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-bold text-white">
                  Current Active Team Exams ({publishedExams.length})
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Operatives can take these when Quiz is Started
              </span>
            </div>

            {publishedExams.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 text-center space-y-2">
                <p className="font-semibold text-slate-300">No questions published yet.</p>
                <p>Paste your questions in the box below and click "⚡ AI Parse & Arrange Questions" to publish an exam for your team.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {publishedExams.map((ex) => (
                  <div 
                    key={ex._id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                          {ex.code}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {ex.durationMinutes} mins
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white line-clamp-1">{ex.title}</h3>
                      <p className="text-[11px] text-cyan-400">{ex.subject}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {ex.questions ? ex.questions.length : (ex.questionsCount || 0)} MCQs • +{ex.marksPerQuestion}/-{ex.negativeMarkPerQuestion}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Ready For Team</span>
                      </span>
                      <button
                        onClick={() => handleDeleteExam(ex._id, ex.title)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/50 transition-all"
                        title="Delete this exam completely"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete Exam</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Bulk Question Pasting Studio */}
          <div className="rounded-3xl bg-[#0f172a] border-2 border-cyan-500/50 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5">
                  <div className="w-full h-full bg-[#070b14] rounded-[10px] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                    <span>AI Question Creator & Bulk Pasting Studio</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Auto-Randomized Per Person
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Paste raw questions and options from anywhere. The AI formats them into ordered rows with 4 options and answers.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Exam Metadata */}
              <div className="grid sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Exam Title</label>
                  <input
                    type="text"
                    value={examForm.title}
                    onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    placeholder="e.g. Core Team Assessment"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Subject / Domain</label>
                  <input
                    type="text"
                    value={examForm.subject}
                    onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    placeholder="e.g. Core Knowledge"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={examForm.durationMinutes}
                    onChange={(e) => setExamForm({ ...examForm, durationMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Marks (+Correct / -Wrong)</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={examForm.marksPerQuestion}
                      onChange={(e) => setExamForm({ ...examForm, marksPerQuestion: Number(e.target.value) })}
                      className="w-1/2 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      title="Marks per correct answer"
                    />
                    <input
                      type="number"
                      value={examForm.negativeMarkPerQuestion}
                      onChange={(e) => setExamForm({ ...examForm, negativeMarkPerQuestion: Number(e.target.value) })}
                      className="w-1/2 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      title="Negative mark per incorrect answer"
                    />
                  </div>
                </div>
              </div>

              {/* Paste Box */}
              <div>
                <label className="block text-xs font-semibold text-cyan-300 mb-1.5 flex items-center justify-between">
                  <span>Paste All Questions & Options Here:</span>
                  <span className="text-[11px] text-slate-400">Accepts any raw list (1. Question, A, B, C, D, Answer)</span>
                </label>

                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`1. What is the primary function of an operating system?
A. Compiling source code
B. Managing hardware and software resources
C. Designing graphic user interfaces
D. Browsing the internet
Answer: B
Explanation: The OS manages hardware, memory, and CPU resources.

2. Which protocol provides encrypted communication over the web?
A. HTTP
B. HTTPS
C. FTP
D. Telnet
Answer: B`}
                  className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={parsingAi || !rawText.trim()}
                  onClick={handleParseAiQuestions}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 flex items-center space-x-2 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{parsingAi ? 'AI Formatting...' : '⚡ AI Parse & Arrange Questions'}</span>
                </button>

                <span className="text-xs text-slate-400">
                  {examForm.questions.length} question{examForm.questions.length === 1 ? '' : 's'} ready
                </span>
              </div>

              {/* Structured Ordered Questions Table */}
              {examForm.questions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Structured & Ordered Questions ({examForm.questions.length})</span>
                  </h3>

                  <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                    {examForm.questions.map((q, qIdx) => (
                      <div 
                        key={qIdx} 
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-cyan-400">Question {qIdx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setExamForm(prev => ({
                                ...prev,
                                questions: prev.questions.filter((_, i) => i !== qIdx)
                              }));
                            }}
                            className="text-rose-400 hover:text-rose-300 text-xs"
                          >
                            Delete
                          </button>
                        </div>

                        <input
                          type="text"
                          value={q.questionText}
                          onChange={(e) => {
                            const updated = [...examForm.questions];
                            updated[qIdx].questionText = e.target.value;
                            setExamForm({ ...examForm, questions: updated });
                          }}
                          className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-medium"
                          placeholder="Question prompt"
                        />

                        {/* 4 Options in a Row */}
                        <div className="grid sm:grid-cols-4 gap-2">
                          {q.options.map((opt, oIdx) => (
                            <div 
                              key={oIdx} 
                              className={`p-2 rounded-lg border flex items-center space-x-2 ${
                                q.correctOptionIndex === oIdx 
                                  ? 'bg-emerald-950/40 border-emerald-500' 
                                  : 'bg-slate-950 border-slate-800'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct_${qIdx}`}
                                checked={q.correctOptionIndex === oIdx}
                                onChange={() => {
                                  const updated = [...examForm.questions];
                                  updated[qIdx].correctOptionIndex = oIdx;
                                  setExamForm({ ...examForm, questions: updated });
                                }}
                                title="Mark as correct answer"
                                className="text-emerald-500 focus:ring-0"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-slate-400 font-bold mr-1">
                                  {String.fromCharCode(65 + oIdx)}:
                                </span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const updated = [...examForm.questions];
                                    updated[qIdx].options[oIdx] = e.target.value;
                                    setExamForm({ ...examForm, questions: updated });
                                  }}
                                  className="w-full bg-transparent text-white text-xs border-0 p-0 focus:outline-none"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Explanation */}
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={(e) => {
                            const updated = [...examForm.questions];
                            updated[qIdx].explanation = e.target.value;
                            setExamForm({ ...examForm, questions: updated });
                          }}
                          placeholder="Technical rationale / explanation"
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <p className="text-xs text-cyan-300/80">
                      🔒 Questions are automatically allocated in different orders for each person upon starting.
                    </p>
                    <button
                      onClick={handlePublishExam}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                    >
                      Publish Assessment for Team
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. RESULTS BLOCK (INDIVIDUAL MARKS & LEADERBOARD) */}
      {/* ========================================================================= */}
      {activeTab === 'results' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div className="rounded-2xl bg-[#0f172a]/95 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span>All Candidates & Results Master List</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Individual marks, percentages, and performance details of all team members.
                </p>
              </div>

              {/* Action Buttons: Export CSV & Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-all shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      statusFilter === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ({allResults.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('attending')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      statusFilter === 'attending' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Attending ({counts.attending})
                  </button>
                  <button
                    onClick={() => setStatusFilter('cheated')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      statusFilter === 'cheated' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Cheated ({counts.cheated})
                  </button>
                  <button
                    onClick={() => setStatusFilter('passed')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      statusFilter === 'passed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Passed ({counts.passed})
                  </button>
                  <button
                    onClick={() => setStatusFilter('failed')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      statusFilter === 'failed' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Failed ({counts.failed})
                  </button>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidate name or exam..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              {filteredResults.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No candidate records matching selected criteria.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Candidate Name</th>
                      <th className="py-3 px-4">Exam Title</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Individual Marks</th>
                      <th className="py-3 px-4">Percentage</th>
                      <th className="py-3 px-4">Integrity / Reason</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredResults.map((r) => {
                      const isCheated = r.isCheated || r.status === 'terminated';
                      const isAttending = r.status === 'in_progress';
                      const isPassed = !isCheated && !isAttending && r.calculatedStatus === 'passed';

                      return (
                        <tr key={r.attemptId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-sans font-bold text-white">
                            <div>{r.studentName}</div>
                            <div className="text-[10px] font-mono text-cyan-400">{r.studentBadgeId}</div>
                          </td>

                          <td className="py-3.5 px-4 font-sans text-slate-200">
                            {r.examTitle}
                          </td>

                          <td className="py-3.5 px-4 font-sans">
                            {isCheated ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center space-x-1 w-max">
                                <Skull className="w-3 h-3 text-rose-400" />
                                <span>CHEATED / BLOCKED</span>
                              </span>
                            ) : isAttending ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center space-x-1 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                                <span>ATTENDING</span>
                              </span>
                            ) : isPassed ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center space-x-1 w-max">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>PASSED</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center space-x-1 w-max">
                                <XCircle className="w-3 h-3 text-amber-400" />
                                <span>FAILED</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-white text-sm">{r.score}</span>
                            <span className="text-slate-400"> / {r.maxMarks} pts</span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`font-bold ${r.percentage >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {r.percentage}%
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-sans text-slate-400">
                            {isCheated ? (
                              <span className="text-rose-400 font-semibold">{r.terminatedReason || 'Cheating detected'}</span>
                            ) : (
                              <span className="text-slate-400">{r.violationsCount} strikes logged</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-sans space-x-2">
                            {r.status !== 'in_progress' && (
                              <button
                                onClick={() => onViewResult && onViewResult(r.attemptId)}
                                className="px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold"
                                title="Inspect mistake analysis breakdown"
                              >
                                Review
                              </button>
                            )}

                            <button
                              onClick={() => handleResetAttempt(r.attemptId, r.studentName)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                              title="Reset attempt and give another chance"
                            >
                              Reset
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Force Block Modal */}
      {terminateModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleForceTerminate} className="w-full max-w-md rounded-2xl bg-rose-950/95 border border-rose-600 p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Skull className="w-4 h-4 text-rose-400" />
              <span>Block & Disqualify Candidate: {terminateModal.studentName}</span>
            </h3>

            <p className="text-xs text-rose-200">
              This will immediately lock the candidate's exam screen, record the cheating violation, and display them as CHEATED on the board.
            </p>

            <input
              type="text"
              value={terminateModal.reason}
              onChange={(e) => setTerminateModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Disqualification reason..."
              className="w-full p-2.5 rounded-xl bg-black/60 border border-rose-700 text-white text-xs placeholder-rose-300/50 focus:outline-none"
              required
            />

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setTerminateModal({ isOpen: false, attemptId: null, studentName: '', reason: '' })}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-900/50"
              >
                Confirm Block
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Registered Players Roster Modal */}
      {showPlayersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-3xl rounded-3xl bg-[#0f172a] border border-cyan-500/40 p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-md shadow-cyan-500/20">
                  <div className="w-full h-full bg-[#070b14] rounded-[10px] flex items-center justify-center text-cyan-400">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                    <span>Registered Players Roster</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {registeredPlayers.length} Total
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    All candidates and team members registered in the examination system.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowPlayersModal(false);
                  setPlayerSearch('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search within Players */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="Search by player name, badge ID, or email..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                autoFocus
              />
            </div>

            {/* Players Table / List */}
            <div className="flex-1 overflow-y-auto pr-1">
              {filteredPlayers.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  No registered players matching "{playerSearch}".
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/90 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Player Name</th>
                        <th className="py-2.5 px-3">Badge ID</th>
                        <th className="py-2.5 px-3">Current Status</th>
                        <th className="py-2.5 px-3">Clearance / Role</th>
                        <th className="py-2.5 px-3">Joined</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {filteredPlayers.map((player) => {
                        const isCheated = player.status === 'cheated';
                        const isAttending = player.status === 'attending';
                        const isCompleted = player.status === 'completed';

                        return (
                          <tr key={player.id} className="hover:bg-slate-800/40 transition-colors font-sans">
                            <td className="py-3 px-3 font-semibold text-white">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-300 text-xs font-bold font-mono">
                                  {player.name ? player.name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-white">{player.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{player.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3 font-mono text-cyan-400 text-xs">
                              {player.badgeId || 'MEMBER'}
                            </td>

                            <td className="py-3 px-3">
                              {isCheated ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center space-x-1 w-max">
                                  <Skull className="w-3 h-3 text-rose-400" />
                                  <span>Cheated / Blocked</span>
                                </span>
                              ) : isAttending ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center space-x-1 w-max animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                  <span>Attending Now</span>
                                </span>
                              ) : isCompleted ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center space-x-1 w-max">
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Completed</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center space-x-1 w-max">
                                  <UserCheck className="w-3 h-3 text-slate-400" />
                                  <span>Ready to Take</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-[11px] text-slate-400">
                              {player.clearance || 'Level 3 - Operative'}
                            </td>

                            <td className="py-3 px-3 font-mono text-[10px] text-slate-500">
                              {player.createdAt ? new Date(player.createdAt).toLocaleDateString() : 'N/A'}
                            </td>

                            <td className="py-3 px-3 text-right">
                              {player.role !== 'admin' && (
                                <button
                                  onClick={() => handleRemovePlayer(player.id, player.name)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white transition-all inline-flex items-center space-x-1 shadow-sm"
                                  title={`Remove ${player.name} from roster`}
                                >
                                  <Trash2 className="w-3 h-3 text-rose-400" />
                                  <span>Remove</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Showing {filteredPlayers.length} of {registeredPlayers.length} registered candidates</span>
              <button
                onClick={() => {
                  setShowPlayersModal(false);
                  setPlayerSearch('');
                }}
                className="px-4 py-2 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Close Roster
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
