"use client";

import { useState } from "react";

type HistoryEntry = {
  id: string;
  category: string;
  intensity: number;
  title: string;
  description: string;
  participants: string;
  when: string;
};

const PAGE_SIZE = 6;

export function RefugeRecentHistory({ entries }: { entries: HistoryEntry[] }) {
  const [page, setPage] = useState(1);
  const pages = Math.ceil(entries.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(pages, 1));
  const start = (safePage - 1) * PAGE_SIZE;

  if (entries.length === 0) {
    return <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">Simule um momento no Refúgio para iniciar o diário.</div>;
  }

  return (
    <div>
      <div className="relative space-y-3 border-l border-fuchsia-400/20 pl-4">
        {entries.slice(start, start + PAGE_SIZE).map((entry) => (
          <article key={entry.id} className="relative rounded-xl border border-white/10 bg-slate-950/70 p-3 before:absolute before:-left-[21px] before:top-5 before:h-2 before:w-2 before:rounded-full before:bg-fuchsia-400">
            <p className="text-[10px] uppercase tracking-wider text-fuchsia-300">{entry.category} · intensidade {entry.intensity}</p>
            <h3 className="mt-1 text-sm font-bold text-white">{entry.title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">{entry.description}</p>
            <div className="mt-2 rounded-lg bg-white/[.025] px-2 py-1.5 text-[10px] text-slate-500">{entry.participants} · {entry.when}</div>
          </article>
        ))}
      </div>
      {pages > 1 && (
        <nav aria-label="Páginas das histórias recentes" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>Exibindo {start + 1}–{Math.min(start + PAGE_SIZE, entries.length)} de {entries.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-200 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
            <span aria-live="polite">{safePage} / {pages}</span>
            <button type="button" disabled={safePage === pages} onClick={() => setPage(safePage + 1)} className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-200 disabled:cursor-not-allowed disabled:opacity-40">Próxima</button>
          </div>
        </nav>
      )}
    </div>
  );
}
