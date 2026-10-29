import React from 'react';
import { Info, ShieldAlert } from 'lucide-react';

export default function DisclaimerBanner() {
  return (
    <div className="rounded-xl bg-slate-900/80 border border-slate-700/60 p-3 text-xs text-slate-400 flex items-start space-x-2.5">
      <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="font-semibold text-slate-300">
          Proctoring & Monitoring Transparency Notice
        </p>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Browser-based activity monitoring tracks tab switching, window focus loss, fullscreen states, and clipboard operations. Technical safeguards have inherent boundaries and cannot inspect secondary external devices, separate screens, or unmonitored external network services. Logged events provide telemetry for administrative review by Tony Stark and Captain America, and are evaluated in fair operational context.
        </p>
      </div>
    </div>
  );
}
