import React from 'react';
import { Bookmark, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

export default function QuestionPalette({
  questions = [],
  currentIndex = 0,
  onSelectQuestion,
  answers = {},
  flagged = [],
  visited = {}
}) {
  const total = questions.length;
  
  // Calculate statistics
  let answeredCount = 0;
  let flaggedCount = 0;
  let answeredAndFlaggedCount = 0;

  questions.forEach(q => {
    const isAns = answers[q.id] !== undefined && answers[q.id] !== null;
    const isFlag = flagged.includes(q.id);
    if (isAns && isFlag) answeredAndFlaggedCount++;
    else if (isAns) answeredCount++;
    else if (isFlag) flaggedCount++;
  });

  const totalAnswered = answeredCount + answeredAndFlaggedCount;
  const unansweredCount = total - totalAnswered;

  return (
    <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-full">
      
      {/* Header and Counters */}
      <div className="border-b border-slate-800 pb-3 mb-4">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
          <span>Question Palette</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
            {currentIndex + 1} / {total}
          </span>
        </h3>

        {/* Mini stats badges */}
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-lg p-2 flex items-center justify-between">
            <span className="text-emerald-400 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>Answered</span>
            </span>
            <span className="font-bold font-mono text-emerald-300">{totalAnswered}</span>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 flex items-center justify-between">
            <span className="text-slate-400 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block"></span>
              <span>Unanswered</span>
            </span>
            <span className="font-bold font-mono text-slate-300">{unansweredCount}</span>
          </div>

          <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg p-2 flex items-center justify-between">
            <span className="text-purple-300 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
              <span>Review</span>
            </span>
            <span className="font-bold font-mono text-purple-200">{flaggedCount + answeredAndFlaggedCount}</span>
          </div>

          <div className="bg-cyan-950/40 border border-cyan-800/40 rounded-lg p-2 flex items-center justify-between">
            <span className="text-cyan-400 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span>
              <span>Total</span>
            </span>
            <span className="font-bold font-mono text-cyan-300">{total}</span>
          </div>
        </div>
      </div>

      {/* Grid of question buttons */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-5 gap-2.5">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null;
            const isFlagged = flagged.includes(q.id);
            const isVisited = visited[idx];

            let buttonClass = 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500';

            if (isAnswered && isFlagged) {
              buttonClass = 'bg-purple-700 text-white border-purple-400 ring-2 ring-emerald-400';
            } else if (isFlagged) {
              buttonClass = 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/20';
            } else if (isAnswered) {
              buttonClass = 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/20';
            } else if (isVisited) {
              buttonClass = 'bg-slate-700/90 text-slate-200 border-rose-500/50';
            }

            return (
              <button
                key={q.id || idx}
                onClick={() => onSelectQuestion(idx)}
                className={`relative h-10 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center border ${buttonClass} ${
                  isCurrent ? 'ring-2 ring-cyan-400 scale-105 z-10' : ''
                }`}
                title={`Question ${idx + 1}: ${isAnswered ? 'Answered' : 'Unanswered'}${isFlagged ? ' (Marked for Review)' : ''}`}
              >
                <span>{idx + 1}</span>

                {/* Small indicator dot for review flag */}
                {isFlagged && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-emerald-600 inline-block"></span>
          <span>Answered</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-purple-600 inline-block"></span>
          <span>Marked for Review</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-purple-700 ring-1 ring-emerald-400 inline-block"></span>
          <span>Answered & Marked for Review</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700 inline-block"></span>
          <span>Not Answered</span>
        </div>
      </div>

    </div>
  );
}
