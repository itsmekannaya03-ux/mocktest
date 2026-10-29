import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function WebcamPreview() {
  return (
    <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-lg">
      <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Proctor Sentinel Active (No Camera Required)</span>
      </div>
    </div>
  );
}
