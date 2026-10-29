const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('auth_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  entryLogin: (input) => apiRequest('/auth/entry', { method: 'POST', body: JSON.stringify({ input }) }),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => apiRequest('/auth/me'),

  // Exams
  getExams: () => apiRequest('/exams'),
  getExamById: (id) => apiRequest(`/exams/${id}`),
  getAdminExams: () => apiRequest('/exams/admin/all'),
  getAdminExamById: (id) => apiRequest(`/exams/${id}/full`),
  parseAiQuestions: (rawText) => apiRequest('/exams/ai-parse', { method: 'POST', body: JSON.stringify({ rawText }) }),
  createExam: (examData) => apiRequest('/exams', { method: 'POST', body: JSON.stringify(examData) }),
  updateExam: (id, examData) => apiRequest(`/exams/${id}`, { method: 'PUT', body: JSON.stringify(examData) }),
  deleteExam: (id) => apiRequest(`/exams/${id}`, { method: 'DELETE' }),
  toggleReleaseKeys: (id) => apiRequest(`/exams/${id}/toggle-release`, { method: 'PATCH' }),
  startQuiz: (id) => apiRequest(id ? `/exams/${id}/start-quiz` : '/exams/start-latest', { method: 'POST' }),
  stopQuiz: (id) => apiRequest(id ? `/exams/${id}/stop-quiz` : '/exams/stop-latest', { method: 'POST' }),

  // Attempts
  startAttempt: (examId) => apiRequest('/attempts/start', { method: 'POST', body: JSON.stringify({ examId }) }),
  saveAnswer: (attemptId, payload) => apiRequest(`/attempts/${attemptId}/save-answer`, { method: 'POST', body: JSON.stringify(payload) }),
  recordViolation: (attemptId, payload) => apiRequest(`/attempts/${attemptId}/violation`, { method: 'POST', body: JSON.stringify(payload) }),
  submitAttempt: (attemptId, payload) => apiRequest(`/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify(payload) }),
  getAttemptResult: (attemptId) => apiRequest(`/attempts/${attemptId}/result`),
  getMemberAnalytics: () => apiRequest('/attempts/member/analytics'),

  // Admin Room
  getAdminOverview: () => apiRequest('/admin/overview'),
  getAdminReports: () => apiRequest('/admin/reports'),
  getTerminatedAttempts: () => apiRequest('/admin/terminated'),
  getViolationsLog: () => apiRequest('/admin/violations-log'),
  forceTerminate: (attemptId, reason) => apiRequest('/admin/force-terminate', { method: 'POST', body: JSON.stringify({ attemptId, reason }) }),
  warnStudent: (attemptId, message) => apiRequest('/admin/warn-student', { method: 'POST', body: JSON.stringify({ attemptId, message }) }),
  resetAttempt: (attemptId) => apiRequest('/admin/reset-attempt', { method: 'POST', body: JSON.stringify({ attemptId }) })
};
