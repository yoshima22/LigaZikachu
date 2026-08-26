"use client";

import { useState, useTransition } from "react";
import { acknowledgeNoticeAction } from "./ack-notice-actions";

// Modal de aviso importante: aparece uma única vez em qualquer página até o
// jogador ler e confirmar. Reaparece só quando o admin publica uma nova versão.
export function AcknowledgeNoticeModal({
  version,
  title,
  content,
  buttonText,
}: {
  version: number;
  title: string;
  content: string;
  buttonText: string;
}) {
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();
  if (!open) return null;

  const confirm = () => start(async () => { await acknowledgeNoticeAction(version); setOpen(false); });

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border-2 border-[#FFCB05]/50 bg-gradient-to-b from-[#201747] via-[#20183c] to-[#100b20] shadow-[0_0_60px_rgba(255,203,5,0.22)]">
        <div className="border-b border-white/10 bg-white/[0.05] px-5 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FFCB05]/80">Aviso importante</p>
          <h2 className="mt-1 text-lg font-black leading-tight text-white">{title}</h2>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{content}</p>
        </div>
        <div className="border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="w-full rounded-xl bg-[#FFCB05] py-2.5 text-sm font-black text-[#1A1A2E] transition hover:bg-[#FFD700] disabled:opacity-60"
          >
            {pending ? "Confirmando…" : (buttonText || "Entendi")}
          </button>
        </div>
      </div>
    </div>
  );
}
