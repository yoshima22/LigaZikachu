"use client";

import { useState } from "react";
import { Megaphone, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { SimpleFormattedText } from "@/components/ui/simple-formatted-text";

type PatchNote = { title: string; content: string };

export function PatchNotesCard({ notes }: { notes: PatchNote[] }) {
  const [page, setPage] = useState(0);
  if (!notes || notes.length === 0) return null;
  const total = notes.length;
  const current = Math.min(page, total - 1);
  const note = notes[current];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 via-slate-950/90 to-purple-500/10 shadow-[0_22px_70px_-42px_rgba(34,211,238,0.75)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="border-b border-white/10 bg-slate-950/35 px-5 py-4 sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
              <Megaphone size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">Patch notes</h3>
                <Sparkles size={14} className="text-[#FFCB05]" />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Mudanças e melhorias recentes da Liga</p>
            </div>
          </div>
          {total > 1 && (
            <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-400 sm:inline-flex">
              Nota {current + 1} de {total}
            </span>
          )}
        </div>
      </div>

      <div className="relative px-5 py-5 sm:px-7 sm:py-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          {note.title && <h2 className="text-xl font-black leading-tight text-white sm:text-2xl">{note.title}</h2>}
          {total > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => (p <= 0 ? total - 1 : p - 1))}
                className="rounded-xl border border-slate-700 bg-slate-950/50 p-2 text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-200"
                aria-label="Anterior"
              >
                <ChevronLeft size={17} />
              </button>
              <span className="min-w-9 text-center text-xs font-bold text-slate-400">{current + 1}/{total}</span>
              <button
                type="button"
                onClick={() => setPage((p) => (p >= total - 1 ? 0 : p + 1))}
                className="rounded-xl border border-slate-700 bg-slate-950/50 p-2 text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-200"
                aria-label="Próxima"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </div>
        <SimpleFormattedText
          text={note.content}
          comfortable
          className="max-h-[28rem] space-y-2 overflow-y-auto pr-2 text-sm leading-7 text-slate-300 scrollbar-thin sm:text-[15px]"
        />

        {total > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/10 pt-4">
            {notes.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-label={`Página ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === current ? "w-7 bg-cyan-300" : "w-2 bg-slate-700 hover:bg-slate-500"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
