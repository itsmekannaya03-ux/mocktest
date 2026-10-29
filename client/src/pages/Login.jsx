import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User, ArrowRight, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const { entryLogin } = useAuth();
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) {
      setError('Please enter your name.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const data = await entryLogin(clean);
      if (onLoginSuccess) {
        onLoginSuccess(data.user, data.room);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your entry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#070b14] relative overflow-hidden select-none">
      
      {/* Background Cyber Accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Single Entry Card */}
      <div className="w-full max-w-md rounded-3xl bg-[#0f172a]/95 backdrop-blur-2xl border border-slate-800 shadow-2xl p-8 sm:p-10 z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20 mb-4 group hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#070b14] rounded-[14px] flex items-center justify-center">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          
          <h1 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent">
            MOCK EXAM
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Secure Examination & Monitoring Platform
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Single Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-2">
              Enter your name
            </label>

            <div className="relative">
              <div className="absolute left-3.5 top-3.5 text-slate-400">
                <User className="w-4 h-4 text-cyan-400" />
              </div>

              <input
                type="text"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter your name"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-medium"
                autoFocus
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'Verifying...' : 'Enter Room'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Informative Guidance */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center text-[11px] text-slate-400">
          <span>Enter your name to access the assessment environment.</span>
        </div>

      </div>
    </div>
  );
}
