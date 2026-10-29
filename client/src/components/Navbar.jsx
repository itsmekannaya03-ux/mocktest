import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  Shield, 
  ShieldAlert, 
  Terminal, 
  LogOut, 
  Activity, 
  FileText, 
  Award, 
  Zap,
  BookOpen,
  Play,
  Square,
  Sparkles
} from 'lucide-react';

export default function Navbar({ currentView, setView, adminTab = 'overview', setAdminTab, onStartQuiz, onStopQuiz, isQuizLive }) {
  const { user, logout, isAdmin } = useAuth();
  const { connected } = useSocket();

  return (
    <header className="sticky top-0 z-40 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Room Badge */}
        <div className="flex items-center space-x-4">
          <div 
            onClick={() => setView(isAdmin ? 'admin-dashboard' : 'common-room')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-[#0a0f1d] rounded-[10px] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              {/* Online heartbeat dot */}
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? 'bg-cyan-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${connected ? 'bg-cyan-500' : 'bg-amber-500'}`}></span>
              </span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent">
                  MOCK EXAM
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono font-semibold bg-cyan-950/80 border border-cyan-800 text-cyan-300">
                  PROCTOR v2.4
                </span>
              </div>
              <p className="text-[10px] text-slate-400 tracking-tight">
                Secure Mock Examination & Proctor Engine
              </p>
            </div>
          </div>

          {/* Room Pill */}
          <div className="hidden md:flex items-center pl-3 border-l border-slate-800">
            {isAdmin ? (
              <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>ADMIN ROOM (COMMAND BRIDGE)</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>COMMON ROOM (CANDIDATES)</span>
              </span>
            )}
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          {isAdmin ? (
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* 1. Overview Button */}
              <button
                onClick={() => {
                  if (setAdminTab) setAdminTab('overview');
                  setView('admin-dashboard');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                  currentView === 'admin-dashboard' && adminTab === 'overview'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Overview</span>
              </button>

              {/* 2. Questions Block Button */}
              <button
                onClick={() => {
                  if (setAdminTab) setAdminTab('questions');
                  setView('admin-dashboard');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                  currentView === 'admin-dashboard' && adminTab === 'questions'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Questions</span>
                <span className="hidden sm:inline text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  AI
                </span>
              </button>

              {/* 3. Results Block Button */}
              <button
                onClick={() => {
                  if (setAdminTab) setAdminTab('results');
                  setView('admin-dashboard');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                  currentView === 'admin-dashboard' && adminTab === 'results'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-cyan-400" />
                <span>Results</span>
              </button>

              {/* 4. Start / Stop Quiz Action Button */}
              {isQuizLive ? (
                <button
                  onClick={onStopQuiz}
                  className="ml-1 sm:ml-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white flex items-center space-x-1.5 shadow-lg shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
                  title="Stop quiz and auto-submit all candidates' answers"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Quiz</span>
                </button>
              ) : (
                <button
                  onClick={onStartQuiz}
                  className="ml-1 sm:ml-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center space-x-1.5 shadow-md shadow-emerald-500/25 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                  title="Start quiz for team operatives"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Quiz</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => setView('common-room')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
                  currentView === 'common-room' 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Available Mock Tests</span>
              </button>

              <button
                onClick={() => setView('member-dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
                  currentView === 'member-dashboard' 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>My Performance & Trends</span>
              </button>
            </>
          )}
        </nav>

        {/* User Identity & Logout */}
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-200">
              {user?.name}
            </p>
            <p className="text-[10px] font-mono text-cyan-400">
              {user?.badgeId || (isAdmin ? 'ADMIN' : 'OPERATIVE')}
            </p>
          </div>

          <button
            onClick={logout}
            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 transition-colors flex items-center space-x-1.5 text-xs font-medium"
            title="Logout of Examination Platform"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

      </div>
    </header>
  );
}
