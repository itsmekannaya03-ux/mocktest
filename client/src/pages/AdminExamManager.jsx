import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Lock, 
  Unlock, 
  Clock, 
  CheckCircle2, 
  X, 
  RotateCcw,
  BookOpen
} from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';

export default function AdminExamManager() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingExam, setEditingExam] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state for creating new exam
  const [form, setForm] = useState({
    title: '',
    code: '',
    subject: '',
    description: '',
    durationMinutes: 15,
    marksPerQuestion: 4,
    negativeMarkPerQuestion: 1,
    violationThreshold: 3,
    answerKeyRelease: 'immediate',
    questions: [
      {
        questionText: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        explanation: '',
        revisionConcept: ''
      }
    ]
  });

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminExams();
      setExams(data || []);
    } catch (err) {
      alert(`Failed to load admin exams: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  // Toggle answer key release
  const handleToggleRelease = async (examId) => {
    try {
      const res = await api.toggleReleaseKeys(examId);
      alert(res.message);
      loadExams();
    } catch (err) {
      alert(`Failed to toggle release: ${err.message}`);
    }
  };

  // Delete exam
  const handleDeleteExam = async (examId, title) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) return;
    try {
      await api.deleteExam(examId);
      loadExams();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Add question to form
  const handleAddQuestion = () => {
    setForm(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          questionText: '',
          options: ['', '', '', ''],
          correctOptionIndex: 0,
          explanation: '',
          revisionConcept: prev.subject || ''
        }
      ]
    }));
  };

  // Remove question from form
  const handleRemoveQuestion = (idx) => {
    if (form.questions.length <= 1) return;
    setForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx)
    }));
  };

  // Submit create exam form
  const handleCreateExam = async (e) => {
    e.preventDefault();
    try {
      await api.createExam(form);
      alert('Examination protocol created successfully.');
      setShowCreateModal(false);
      loadExams();
    } catch (err) {
      alert(`Creation failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-[#170a0a] via-[#1a0f1c] to-[#0a0f1d] border border-amber-500/30 p-6 sm:p-8 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Examination Protocol Management
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Author and configure mock assessments, question banks, negative marking rules, and answer key releases.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center space-x-2 shadow-lg shadow-amber-900/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Assessment</span>
        </button>
      </div>

      <DisclaimerBanner />

      {/* Exam Protocols Repository */}
      <div className="rounded-2xl bg-[#0f172a]/95 border border-slate-800 p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <span>Active & Published Examination Protocols</span>
        </h2>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading exams...</div>
        ) : exams.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No exams authored yet.</div>
        ) : (
          <div className="space-y-4">
            {exams.map((exam) => {
              const isReleased = exam.answerKeyRelease === 'immediate';

              return (
                <div
                  key={exam._id}
                  className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {exam.code}
                      </span>
                      <span className="text-xs text-slate-400">
                        {exam.subject}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs font-mono text-slate-400">
                        {(exam.questions || []).length} Questions
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white">
                      {exam.title}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-2xl line-clamp-1">
                      {exam.description}
                    </p>

                    {/* Meta stats */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                      <span>Duration: {exam.durationMinutes}m</span>
                      <span>•</span>
                      <span>Marking: +{exam.marksPerQuestion} / -{exam.negativeMarkPerQuestion}</span>
                      <span>•</span>
                      <span>Strike Threshold: {exam.violationThreshold}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Toggle Release */}
                    <button
                      onClick={() => handleToggleRelease(exam._id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                        isReleased
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                          : 'bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900'
                      }`}
                      title="Toggle answer key availability for student review"
                    >
                      {isReleased ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{isReleased ? 'Keys Released' : 'Keys Restricted'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteExam(exam._id, exam.title)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Exam"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create New Exam Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-3xl my-8 rounded-3xl bg-[#0f172a] border border-slate-700 shadow-2xl p-6 sm:p-8 space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Create New Mock Assessment</h3>
                <p className="text-xs text-slate-400">Configure parameters, questions, answers, and revision concepts.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-6">
              
              {/* Basic Details */}
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Exam Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Quantum Encryption Exam"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Subject / Domain</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="e.g. Cryptography"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description of the examination goals..."
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Numerical Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Marks / Question</label>
                  <input
                    type="number"
                    min="1"
                    value={form.marksPerQuestion}
                    onChange={(e) => setForm({ ...form, marksPerQuestion: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Negative Penalty</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={form.negativeMarkPerQuestion}
                    onChange={(e) => setForm({ ...form, negativeMarkPerQuestion: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Strike Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={form.violationThreshold}
                    onChange={(e) => setForm({ ...form, violationThreshold: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* Answer Key Release Policy */}
              <div className="text-xs">
                <label className="block text-slate-300 font-semibold mb-1">Answer Key Release Mode</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="answerKeyRelease"
                      value="immediate"
                      checked={form.answerKeyRelease === 'immediate'}
                      onChange={() => setForm({ ...form, answerKeyRelease: 'immediate' })}
                    />
                    <span>Immediate (operatives inspect mistake analysis right after submitting)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="answerKeyRelease"
                      value="admin_released"
                      checked={form.answerKeyRelease === 'admin_released'}
                      onChange={() => setForm({ ...form, answerKeyRelease: 'admin_released' })}
                    />
                    <span>Admin Release (held until Stark/Cap unlocks)</span>
                  </label>
                </div>
              </div>

              {/* Questions Editor */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">
                    Questions & Answer Keys ({form.questions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {form.questions.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300 font-mono">Q{qIdx + 1}</span>
                        {form.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIdx)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Question prompt..."
                        value={q.questionText}
                        onChange={(e) => {
                          const updated = [...form.questions];
                          updated[qIdx].questionText = e.target.value;
                          setForm({ ...form, questions: updated });
                        }}
                        className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                        required
                      />

                      {/* 4 Options */}
                      <div className="grid sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={q.correctOptionIndex === oIdx}
                              onChange={() => {
                                const updated = [...form.questions];
                                updated[qIdx].correctOptionIndex = oIdx;
                                setForm({ ...form, questions: updated });
                              }}
                              title="Mark as correct answer"
                            />
                            <input
                              type="text"
                              placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                              value={opt}
                              onChange={(e) => {
                                const updated = [...form.questions];
                                updated[qIdx].options[oIdx] = e.target.value;
                                setForm({ ...form, questions: updated });
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white"
                              required
                            />
                          </div>
                        ))}
                      </div>

                      {/* Explanation & Revision Concept */}
                      <div className="grid sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Detailed technical explanation..."
                          value={q.explanation}
                          onChange={(e) => {
                            const updated = [...form.questions];
                            updated[qIdx].explanation = e.target.value;
                            setForm({ ...form, questions: updated });
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"
                        />
                        <input
                          type="text"
                          placeholder="Related concept to revise..."
                          value={q.revisionConcept}
                          onChange={(e) => {
                            const updated = [...form.questions];
                            updated[qIdx].revisionConcept = e.target.value;
                            setForm({ ...form, questions: updated });
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-900/30"
                >
                  Publish Examination Protocol
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
