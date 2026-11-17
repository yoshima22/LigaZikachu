"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { splitKeywords, type GlossaryEntry } from "@/lib/glossary";

const WIDTH = 256;

/** O balão vai para o body (posição fixa), para não ser cortado por cards com overflow escondido. */
function Keyword({ label, entry }: { label: string; entry: GlossaryEntry }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = Math.min(WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const h = tip.current?.offsetHeight ?? 120;
    const above = r.bottom + h + 12 > window.innerHeight && r.top > h + 12;
    setPos({ left, top: above ? r.top - 6 : r.bottom + 6, above });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !tip.current?.contains(t)) setOpen(false);
    };
    const hide = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className="cursor-help rounded-sm border-b border-dotted border-cyan-300/70 text-inherit hover:text-cyan-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300"
      >
        {label}
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <span
            ref={tip}
            role="tooltip"
            style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: Math.min(WIDTH, (typeof window !== "undefined" ? window.innerWidth : WIDTH) - 16), transform: pos?.above ? "translateY(-100%)" : undefined, zIndex: 9999 }}
            className="pointer-events-none block rounded-lg border border-cyan-300/30 bg-slate-950 p-2.5 text-left text-[11px] font-normal normal-case leading-snug text-slate-200 shadow-xl"
          >
            <b className="mb-0.5 block text-[10px] font-black uppercase tracking-wider text-cyan-300">{entry.term}</b>
            {entry.body}
          </span>,
          document.body,
        )}
    </>
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
