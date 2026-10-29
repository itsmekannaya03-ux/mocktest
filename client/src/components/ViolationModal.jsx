import React from 'react';
import { AlertTriangle, ShieldX, Skull, ArrowRight } from 'lucide-react';

export default function ViolationModal({
  isOpen,
  violationCount = 1,
  threshold = 3,
  violationType = 'Tab Switch / Window Blur',
  details = 'Browser focus was lost.',
  isTerminated = false,
  onAcknowledge,
  onGoToResults
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative w-full max-w-lg rounded-2xl p-6 shadow-2xl border text-center transition-all ${
        isTerminated 
          ? 'bg-rose-950/90 border-rose-600 shadow-rose-900/50 glow-red' 
          : 'bg-[#0f172a] border-amber-500 shadow-amber-900/40 glow-gold'
      }`}>
        
        {/* Pulsing Icon */}
        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform animate-bounce">
          {isTerminated ? (
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center">
              <Skull className="w-9 h-9 text-rose-500" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center">
              <AlertTriangle className="w-9 h-9 text-amber-400" />
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-extrabold uppercase tracking-wide text-white mb-2">
          {isTerminated ? 'EXAMINATION TERMINATED' : 'PROCTOR INTEGRITY WARNING'}
        </h2>

        {/* Strike Gauge */}
        <div className="my-4 px-4 py-3 rounded-xl bg-black/40 border border-slate-800">
          <div className="flex items-center justify-between text-xs font-mono font-bold mb-2">
            <span className="text-slate-400">SECURITY STRIKE LEVEL</span>
            <span className={isTerminated ? 'text-rose-400' : 'text-amber-400'}>
              {violationCount} OF {threshold} ALLOWED
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
            {Array.from({ length: threshold }).map((_, i) => (
              <div
                key={i}
                className={`h-full flex-1 border-r border-slate-900 transition-all ${
                  i < violationCount 
                    ? isTerminated ? 'bg-rose-500' : 'bg-amber-400' 
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Violation Description */}
        <div className="text-sm text-slate-300 space-y-2 mb-6">
          <p className="font-semibold text-white">
            Detected: <span className="text-amber-300 font-mono">{violationType}</span>
          </p>
          <p className="text-xs text-slate-400">
            {details}
          </p>
          {isTerminated ? (
            <div className="p-3 rounded-lg bg-rose-900/40 border border-rose-700/60 text-xs text-rose-200 mt-2 text-left">
              <p className="font-bold mb-1">Session Locked:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>You have exceeded the maximum violation threshold ({threshold} strikes).</li>
                <li>Your current answers have been securely captured and locked on the server.</li>
                <li>Administrators Tony Stark & Captain America have received this incident alert.</li>
              </ul>
            </div>
          ) : (
            <p className="text-xs text-amber-200/90 font-medium bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              Notice: Repeated tab switching, leaving fullscreen, or copying text will immediately disqualify and terminate your exam session.
            </p>
          )}
        </div>

        {/* Action Button */}
        <div>
          {isTerminated ? (
            <button
              onClick={onGoToResults}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-lg shadow-rose-900/40 transition-all flex items-center justify-center space-x-2"
            >
              <span>View Examination Record & Mistakes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onAcknowledge}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-900/30 transition-all"
            >
              I Understand — Return to Fullscreen Examination
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
