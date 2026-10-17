"use client";

import { X, Film } from "lucide-react";
import { ReplayCanvas, type ReplayData } from "./replay-canvas";

export function ModernReplayModal({
  data, title, subtitle, onClose, onUseClassic,
}: {
  data: ReplayData;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onUseClassic?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/80 p-2 sm:p-3" onClick={onClose}>
      <div className="my-auto w-full max-w-4xl rounded-2xl border border-slate-700 bg-[#0b1020] p-3 shadow-2xl sm:p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-white"><Film size={16} className="text-[#FFCB05]" /> {title}</p>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {onUseClassic && (
              <button onClick={onUseClassic} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                Modo clássico
              </button>
            )}
            <button onClick={onClose} aria-label="Fechar" className="rounded-lg border border-slate-600 p-1.5 text-slate-300 hover:bg-slate-800"><X size={16} /></button>
          </div>
        </div>
        <ReplayCanvas data={data} />
      </div>
    </div>
  );
}
