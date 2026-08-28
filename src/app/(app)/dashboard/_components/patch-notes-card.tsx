"use client";

import { useState } from "react";
import { Megaphone, ChevronLeft, ChevronRight } from "lucide-react";

type PatchNote = { title: string; content: string };

export function PatchNotesCard({ notes }: { notes: PatchNote[] }) {
  const [page, setPage] = useState(0);
  if (!notes || notes.length === 0) return null;
  const total = notes.length;
  const current = Math.min(page, total - 1);
  const note = notes[current];

  return (
    <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/5 via-slate-950/40 to-purple-500/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone size={15} className="text-cyan-300" />
          <h3 className="text-xs font-black uppercase tracking-widest text-cyan-300">Novidades</h3>
        </div>
        {total > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => (p <= 0 ? total - 1 : p - 1))}
              className="rounded-lg border border-slate-700 p-1 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200"
              aria-label="Anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] font-semibold text-slate-400">{current + 1}/{total}</span>
            <button
              type="button"
              onClick={() => setPage((p) => (p >= total - 1 ? 0 : p + 1))}
              className="rounded-lg border border-slate-700 p-1 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200"
              aria-label="Próxima"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      {note.title && <p className="text-sm font-bold text-white">{note.title}</p>}
      <div className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap pr-1 text-xs leading-relaxed text-slate-300">
        {note.content}
      </div>
      {total > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {notes.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              aria-label={`Página ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === current ? "w-4 bg-cyan-300" : "w-1.5 bg-slate-600 hover:bg-slate-500"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
