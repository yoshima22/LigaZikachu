"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Megaphone, Sparkles } from "lucide-react";
import { SimpleFormattedText } from "@/components/ui/simple-formatted-text";

type PatchNote = { title: string; content: string };
const PAGE_SIZE = 1800;

function splitPages(content: string): string[] {
  const blocks = content.split(/(\n\s*\n)/);
  const pages: string[] = [];
  let current = "";
  for (const block of blocks) {
    if ((current + block).length <= PAGE_SIZE) { current += block; continue; }
    if (current.trim()) pages.push(current.trim());
    current = block;
    while (current.length > PAGE_SIZE) {
      let cut = current.lastIndexOf("\n", PAGE_SIZE);
      if (cut < PAGE_SIZE * 0.6) cut = current.lastIndexOf(" ", PAGE_SIZE);
      if (cut < PAGE_SIZE * 0.6) cut = PAGE_SIZE;
      pages.push(current.slice(0, cut).trim());
      current = current.slice(cut).trimStart();
    }
  }
  if (current.trim()) pages.push(current.trim());
  return pages.length ? pages : [content];
}

export function PatchNotesCard({ notes, version }: { notes: PatchNote[]; version: string }) {
  const [noteIndex, setNoteIndex] = useState(0);
  const [contentPage, setContentPage] = useState(0);
  const [unread, setUnread] = useState(false);
  const pagesByNote = useMemo(() => notes.map((note) => splitPages(note.content)), [notes]);
  const note = notes[Math.min(noteIndex, notes.length - 1)];
  const pages = pagesByNote[Math.min(noteIndex, pagesByNote.length - 1)] ?? [];
  const page = Math.min(contentPage, Math.max(0, pages.length - 1));

  useEffect(() => setUnread(window.localStorage.getItem("liga:patch-notes-read") !== version), [version]);
  const markRead = () => { window.localStorage.setItem("liga:patch-notes-read", version); setUnread(false); };
  const changeNote = (next: number) => { setNoteIndex(next); setContentPage(0); };
  if (!note) return null;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 via-slate-950/90 to-purple-500/10 shadow-[0_22px_70px_-42px_rgba(34,211,238,0.75)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-purple-500/10 blur-3xl" />
      <header className="border-b border-white/10 bg-slate-950/35 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-200"><Megaphone size={20}/>{unread && <i className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-slate-950 bg-red-500"/>}</span>
            <div><div className="flex items-center gap-2"><h3 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">Patch notes</h3><Sparkles size={14} className="text-[#FFCB05]"/></div><p className="mt-0.5 text-xs text-slate-500">Mudanças e melhorias recentes da Liga</p></div>
          </div>
          {unread ? <button onClick={markRead} className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold text-red-200"><span className="h-2 w-2 rounded-full bg-red-500"/> Novo · marcar como lido</button> : <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><Check size={12}/> Lido</span>}
        </div>
      </header>

      <div className="relative flex h-[34rem] flex-col px-5 py-5 sm:px-7 sm:py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>{notes.length > 1 && <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-purple-300">Atualização {noteIndex + 1} de {notes.length}</p>}{note.title && <h2 className="text-xl font-black leading-tight text-white sm:text-2xl">{note.title}</h2>}</div>
          {notes.length > 1 && <div className="flex items-center gap-1"><button onClick={() => changeNote(noteIndex <= 0 ? notes.length - 1 : noteIndex - 1)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Atualização anterior"><ChevronLeft size={15}/></button><button onClick={() => changeNote(noteIndex >= notes.length - 1 ? 0 : noteIndex + 1)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Próxima atualização"><ChevronRight size={15}/></button></div>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-black/15 p-4 sm:p-5"><SimpleFormattedText text={pages[page] ?? ""} comfortable className="space-y-2 text-sm leading-7 text-slate-300 sm:text-[15px]"/></div>
        <footer className="mt-4 flex min-h-12 flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-[11px] font-semibold text-slate-500">Página {page + 1} de {pages.length}</span>
          {pages.length > 1 && <div className="flex items-center gap-2"><button disabled={page === 0} onClick={() => setContentPage((p) => p - 1)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-30"><ChevronLeft size={14} className="mr-1 inline"/>Anterior</button><button disabled={page === pages.length - 1} onClick={() => setContentPage((p) => p + 1)} className="rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200 disabled:opacity-30">Próxima<ChevronRight size={14} className="ml-1 inline"/></button></div>}
        </footer>
      </div>
    </section>
  );
}
