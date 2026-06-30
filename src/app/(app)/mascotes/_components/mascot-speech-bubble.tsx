"use client";

import { generateMascotSpeech, type MascotSpeechParams } from "@/lib/mascot-data";

type Props = MascotSpeechParams;

export function MascotSpeechBubble(params: Props) {
  const speech = generateMascotSpeech(params);

  return (
    <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 w-max max-w-[180px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-[11px] text-slate-200 shadow-xl leading-snug text-center">
        {speech}
      </div>
      {/* Seta apontando para baixo */}
      <div className="flex justify-center">
        <div className="border-8 border-transparent border-t-slate-900 -mt-px" />
      </div>
    </div>
  );
}
