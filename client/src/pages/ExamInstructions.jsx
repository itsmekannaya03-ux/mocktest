import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  HelpCircle, 
  Award, 
  AlertTriangle, 
  Maximize2, 
  Check, 
  ArrowLeft, 
  ArrowRight,
  ShieldCheck,
  Eye
} from 'lucide-react';
import WebcamPreview from '../components/WebcamPreview';
import DisclaimerBanner from '../components/DisclaimerBanner';

export default function ExamInstructions({ exam, onBack, onStartExam, loading }) {
  const [agreed, setAgreed] = useState(false);
  const [enableCamera, setEnableCamera] = useState(false);

  if (!exam) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-200">
      
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-xs text-slate-400 hover:text-cyan-400 flex items-center space-x-1.5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Common Room</span>
      </button>

      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0c1836] to-[#0a1226] border border-cyan-800/40 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <span className="text-xs font-mono font-bold px-3 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
            {exam.code}
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Strict Proctoring Active
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          {exam.title}
        </h1>
        <p className="text-sm text-cyan-400 font-medium mt-1">
          {exam.subject}
        </p>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          {exam.description}
        </p>

        {/* Vital Parameters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Duration</span>
            <span className="text-sm font-bold text-white flex items-center space-x-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{exam.durationMinutes} Minutes</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Question Count</span>
            <span className="text-sm font-bold text-white mt-0.5 block">
              {exam.questionsCount || (exam.questions ? exam.questions.length : 0)} MCQs
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Marking Scheme</span>
            <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
              +{exam.marksPerQuestion} / -{exam.negativeMarkPerQuestion} pts
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Violation Limit</span>
            <span className="text-sm font-bold text-rose-400 mt-0.5 block">
              {exam.violationThreshold || 3} Strikes Max
            </span>
          </div>
        </div>
      </div>

      <DisclaimerBanner />

      {/* Rules & Instructions */}
      <div className="rounded-2xl bg-[#0f172a]/90 border border-slate-800 p-6 space-y-4 shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <span>Operational Protocols & Proctoring Rules</span>
        </h2>

        <div className="space-y-2.5 text-xs text-slate-300">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start space-x-3">
            <Maximize2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">1. Enforced Fullscreen Mode</p>
              <p className="text-slate-400 mt-0.5">
                The exam room operates exclusively in fullscreen mode. Exiting fullscreen prompts an immediate security strike.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start space-x-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">2. Tab Switching & Window Focus</p>
              <p className="text-slate-400 mt-0.5">
                Leaving the browser window, minimizing, or switching application tabs triggers an immediate violation alert to Tony Stark and Captain America.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start space-x-3">
            <Clock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">3. Automatic Timer Finalization</p>
              <p className="text-slate-400 mt-0.5">
                When the countdown timer reaches zero, all current answers are instantly evaluated and submitted on the server.
              </p>
            </div>
          </div>
        </div>

        {/* Custom Exam Instructions */}
        {exam.instructions && exam.instructions.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
              Specific Exam Guidelines:
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400">
              {exam.instructions.map((inst, i) => (
                <li key={i}>{inst}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Optional Webcam Preview Check */}
      <div className="rounded-2xl bg-[#0f172a]/90 border border-slate-800 p-6 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Optional Proctor Camera Preview
            </h3>
          </div>
          <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={enableCamera}
              onChange={(e) => setEnableCamera(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span>Enable Camera Test</span>
          </label>
        </div>

        {enableCamera && (
          <div className="max-w-xs mt-3">
            <WebcamPreview />
          </div>
        )}
      </div>

      {/* Agreement & Start Button */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-[#0c1836] border border-cyan-800/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
          />
          <span className="text-xs text-slate-300">
            I confirm I am seated in an isolated testing environment and accept the security monitoring policies.
          </span>
        </label>

        <button
          disabled={!agreed || loading}
          onClick={onStartExam}
          className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
            agreed && !loading
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/25 cursor-pointer'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
          }`}
        >
          <span>{loading ? 'Initializing Session...' : 'Enter Fullscreen Examination'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
