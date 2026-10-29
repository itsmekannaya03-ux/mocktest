import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Award, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Search, 
  Filter,
  Eye,
  RefreshCw
} from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';

export default function AdminReports({ onViewAttemptResult }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminReports();
      setReports(data || []);
    } catch (err) {
      alert(`Failed to load reports: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleResetAttempt = async (attemptId, studentName) => {
    if (!confirm(`Are you sure you want to reset the session for ${studentName}? This allows them to retake the examination.`)) return;
    try {
      await api.resetAttempt(attemptId);
      alert(`Session for ${studentName} reset.`);
      loadReports();
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (reports.length === 0) return;
    const headers = ['Student Name', 'Badge ID', 'Exam Code', 'Exam Title', 'Status', 'Score', 'Max Marks', 'Percentage', 'Accuracy', 'Violations', 'Date'];
    const rows = reports.map(r => [
      `"${r.studentName}"`,
      `"${r.studentBadgeId}"`,
      `"${r.examCode}"`,
      `"${r.examTitle}"`,
      `"${r.status}"`,
      r.score,
      r.maxMarks,
      `${r.percentage}%`,
      `${r.accuracy}%`,
      r.violationsCount,
      `"${r.submittedAt || r.startedAt}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EXAM_REPORTS_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered reports
  const filtered = reports.filter(r => {
    if (!r) return false;
    const sName = (r.studentName || r.userName || '').toString().toLowerCase();
    const eTitle = (r.examTitle || '').toString().toLowerCase();
    const bId = (r.studentBadgeId || r.userBadgeId || '').toString().toLowerCase();
    const q = (search || '').toString().trim().toLowerCase();

    const matchesSearch = !q || sName.includes(q) || eTitle.includes(q) || bId.includes(q);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-[#170a0a] via-[#1a0f1c] to-[#0a0f1d] border border-amber-500/30 p-6 sm:p-8 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Operative Assessment Reports & Audits
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Official records of student mock examination performance, proctoring violations, and score diagnostics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1.5 shadow-md shadow-amber-900/30 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={loadReports}
            className="p-2 rounded-xl bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <DisclaimerBanner />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0f172a] p-4 rounded-2xl border border-slate-800">
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by operative or exam..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-semibold">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Submissions</option>
            <option value="submitted">Completed Normal</option>
            <option value="terminated">Terminated by Policy</option>
          </select>
        </div>

      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[#0f172a]/95 border border-slate-800 p-6 shadow-xl overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Loading audit records...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">No matching records located.</div>
        ) : (
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Operative</th>
                <th className="py-3 px-4">Exam</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Accuracy</th>
                <th className="py-3 px-4">Strikes</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.map((r) => (
                <tr key={r.attemptId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-sans">
                    <div className="font-bold text-white">{r.studentName}</div>
                    <div className="text-[10px] font-mono text-cyan-400">{r.studentBadgeId}</div>
                  </td>

                  <td className="py-3.5 px-4 font-sans">
                    <div className="font-semibold text-slate-200">{r.examTitle}</div>
                    <div className="text-[10px] text-slate-400">{r.examCode}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-bold text-white">{r.score}</span>
                    <span className="text-slate-500">/{r.maxMarks}</span>
                    <span className="text-cyan-300 ml-1.5 font-sans font-semibold">({r.percentage}%)</span>
                  </td>

                  <td className="py-3.5 px-4 text-amber-300 font-bold">
                    {r.accuracy}%
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.violationsCount > 0 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {r.violationsCount} strikes
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-sans">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      r.status === 'terminated'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right space-x-2 font-sans">
                    <button
                      onClick={() => onViewAttemptResult(r.attemptId)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-semibold transition-all"
                    >
                      Mistake Review
                    </button>

                    <button
                      onClick={() => handleResetAttempt(r.attemptId, r.studentName)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                      title="Reset attempt to allow student to retake"
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
