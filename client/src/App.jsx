import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import ExamInstructions from './pages/ExamInstructions';
import ExamRoom from './pages/ExamRoom';
import ExamResult from './pages/ExamResult';
import MemberDashboard from './pages/MemberDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminExamManager from './pages/AdminExamManager';
import AdminReports from './pages/AdminReports';
import { api } from './services/api';

function MainApp() {
  const { user, loading, isAdmin } = useAuth();

  // Navigation states
  const [currentView, setCurrentView] = useState('common-room');
  const [adminTab, setAdminTab] = useState('overview'); // 'overview' | 'questions' | 'results'
  const [selectedExam, setSelectedExam] = useState(null);
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [activeResultId, setActiveResultId] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [startingExam, setStartingExam] = useState(false);
  const [isQuizLive, setIsQuizLive] = useState(false);

  // If loading user session
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400">
        <div className="text-center space-y-3">
          <div className="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono">Initializing Security Bridge...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <Login
        onLoginSuccess={(loggedUser, targetRoom) => {
          if (targetRoom === 'admin-room' || loggedUser.role === 'admin') {
            setCurrentView('admin-dashboard');
          } else {
            setCurrentView('common-room');
          }
        }}
      />
    );
  }

  // Handler: When user selects an exam from the dashboard
  const handleSelectExam = async (exam) => {
    setSelectedExam(exam);
    setCurrentView('exam-instructions');
  };

  // Handler: Start examination
  const handleStartExam = async () => {
    if (!selectedExam) return;
    try {
      setStartingExam(true);
      const res = await api.startAttempt(selectedExam._id);
      setActiveAttempt(res.attempt);
      setCurrentView('exam-room');
    } catch (err) {
      alert(`Could not start exam: ${err.message}`);
    } finally {
      setStartingExam(false);
    }
  };

  // Handler: Exam finished
  const handleExamFinished = (attemptId) => {
    setActiveResultId(attemptId);
    setCurrentView('exam-result');
  };

  // Handler: View result
  const handleViewResult = (attemptId) => {
    setActiveResultId(attemptId);
    setCurrentView('exam-result');
  };

  // Handler: Start Quiz for Team
  const handleStartQuiz = async () => {
    try {
      const res = await api.startQuiz();
      setIsQuizLive(true);
      alert(`🚀 ${res.message || 'Quiz is now live for team members!'}`);
      setAdminTab('overview');
      setCurrentView('admin-dashboard');
    } catch (err) {
      alert(`⚠️ Could not start quiz: ${err.message}. If no questions exist, please add questions in the Questions block.`);
      setAdminTab('questions');
      setCurrentView('admin-dashboard');
    }
  };

  // Handler: Stop Quiz & Auto-submit All Candidates
  const handleStopQuiz = async () => {
    if (!window.confirm('Are you sure you want to STOP the examination? All attending students will have their current answers submitted automatically and will not be able to continue.')) {
      return;
    }
    try {
      const res = await api.stopQuiz();
      setIsQuizLive(false);
      alert(`⏹ ${res.message || 'Quiz stopped and candidate answers submitted.'}`);
      setAdminTab('overview');
      setCurrentView('admin-dashboard');
    } catch (err) {
      alert(`⚠️ Could not stop quiz: ${err.message}`);
    }
  };

  // In active exam room, hide the navigation bar for strict fullscreen immersion
  const isExamRoom = currentView === 'exam-room';

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      {!isExamRoom && (
        <Navbar 
          currentView={currentView} 
          setView={setCurrentView} 
          adminTab={adminTab} 
          setAdminTab={setAdminTab} 
          onStartQuiz={handleStartQuiz} 
          onStopQuiz={handleStopQuiz}
          isQuizLive={isQuizLive}
        />
      )}

      <main className="flex-1">
        {/* Student Common Room Views */}
        {currentView === 'common-room' && (
          <StudentDashboard
            onSelectExam={handleSelectExam}
            onViewResult={handleViewResult}
          />
        )}

        {currentView === 'exam-instructions' && selectedExam && (
          <ExamInstructions
            exam={selectedExam}
            loading={startingExam}
            onBack={() => setCurrentView('common-room')}
            onStartExam={handleStartExam}
          />
        )}

        {currentView === 'exam-room' && selectedExam && activeAttempt && (
          <ExamRoom
            exam={selectedExam}
            attempt={activeAttempt}
            onExamFinished={handleExamFinished}
          />
        )}

        {currentView === 'exam-result' && activeResultId && (
          <ExamResult
            attemptId={activeResultId}
            onBackToDashboard={() => setCurrentView(isAdmin ? 'admin-dashboard' : 'common-room')}
          />
        )}

        {currentView === 'member-dashboard' && (
          <MemberDashboard
            onViewResult={handleViewResult}
            onTakeExam={() => setCurrentView('common-room')}
          />
        )}

        {/* Admin Room Views (Strictly guarded by isAdmin) */}
        {currentView === 'admin-dashboard' && (
          isAdmin ? (
            <AdminDashboard 
              adminTab={adminTab} 
              setAdminTab={setAdminTab} 
              onNavigate={setCurrentView} 
              onViewResult={handleViewResult} 
              onStartQuiz={handleStartQuiz} 
              onStopQuiz={handleStopQuiz}
              isQuizLive={isQuizLive}
              setIsQuizLive={setIsQuizLive}
            />
          ) : (
            <StudentDashboard
              onSelectExam={handleSelectExam}
              onViewResult={handleViewResult}
            />
          )
        )}

        {currentView === 'admin-exams' && (
          isAdmin ? (
            <AdminExamManager />
          ) : (
            <StudentDashboard
              onSelectExam={handleSelectExam}
              onViewResult={handleViewResult}
            />
          )
        )}

        {currentView === 'admin-reports' && (
          isAdmin ? (
            <AdminReports onViewAttemptResult={handleViewResult} />
          ) : (
            <StudentDashboard
              onSelectExam={handleSelectExam}
              onViewResult={handleViewResult}
            />
          )
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <MainApp />
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
