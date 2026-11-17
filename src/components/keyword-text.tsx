"use client";

import { useEffect, useRef, useState } from "react";
import { splitKeywords, type GlossaryEntry } from "@/lib/glossary";

function Keyword({ label, entry }: { label: string; entry: GlossaryEntry }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <span ref={ref} className="relative inline" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className="cursor-help rounded-sm border-b border-dotted border-cyan-300/70 text-inherit hover:text-cyan-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300"
      >
        {label}
      </button>
      {open && (
        <span role="tooltip" className="absolute left-0 top-full z-50 mt-1 block w-64 max-w-[80vw] rounded-lg border border-cyan-300/30 bg-slate-950 p-2.5 text-left text-[11px] font-normal normal-case leading-snug text-slate-200 shadow-xl">
          <b className="mb-0.5 block text-[10px] font-black uppercase tracking-wider text-cyan-300">{entry.term}</b>
          {entry.body}
        </span>
      )}
    </span>
  );
}

/** Texto em que termos do glossário (estados, atributos, crítico, ativação…) viram palavras-chave com explicação ao passar o mouse ou tocar. */
export function KeywordText({ text }: { text: string }) {
  return (
    <>
      {splitKeywords(text).map((part, i) => (part.entry ? <Keyword key={i} label={part.text} entry={part.entry} /> : <span key={i}>{part.text}</span>))}
    </>
  );
}
