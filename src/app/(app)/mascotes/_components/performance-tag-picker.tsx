"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { setMascotPerformanceTagAction } from "../actions";
import { PERFORMANCE_TAGS, PERFORMANCE_META, normalizePerformanceTag, type PerformanceTag } from "@/lib/mascot-performance";

/**
 * Seletor do marcador de desempenho (Forte/Neutro/Ruim/Péssimo).
 * size="sm" → bem compacto (dot + label curto), para a linha do banco.
 * size="md" → badge com rótulo, para o card.
 */
export function PerformanceTagPicker({ mascotId, initial, size = "md", align = "left", onChanged }: {
  mascotId: string;
  initial: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  onChanged?: (tag: PerformanceTag) => void;
}) {
  const [tag, setTag] = useState<PerformanceTag>(normalizePerformanceTag(initial));
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setTag(normalizePerformanceTag(initial)); }, [initial]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (t: PerformanceTag) => {
    setOpen(false);
    if (t === tag) return;
    const prev = tag;
    setTag(t);
    onChanged?.(t);
    start(async () => {
      const r = await setMascotPerformanceTagAction(mascotId, t);
      if (!r.ok) { setTag(prev); onChanged?.(prev); }
    });
  };

  const meta = PERFORMANCE_META[tag];

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
        disabled={pending}
        title={`Desempenho: ${meta.label} — ${meta.description} (clique para mudar)`}
        className={`inline-flex items-center gap-1 rounded-md border font-semibold transition-opacity disabled:opacity-50 ${meta.badge} ${size === "sm" ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[10px]"}`}
      >
        <span className={`inline-block shrink-0 rounded-full ${meta.dot} ${size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"}`} />
        {meta.label}
      </button>
      {open && (
        <div className={`absolute z-[80] mt-1 min-w-[170px] rounded-lg border border-border bg-slate-900 p-1 shadow-2xl shadow-black/60 ${align === "right" ? "right-0" : "left-0"}`}>
          <p className="px-2 pb-1 pt-0.5 text-[9px] uppercase tracking-wide text-slate-500">Desempenho</p>
          {PERFORMANCE_TAGS.map(t => {
            const m = PERFORMANCE_META[t];
            return (
              <button key={t} type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); pick(t); }}
                className={`flex w-full items-start gap-1.5 rounded px-2 py-1 text-left hover:bg-slate-800 ${t === tag ? "bg-slate-800/70" : ""}`}>
                <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${m.dot}`} />
                <span className="min-w-0">
                  <span className={`block text-[11px] font-semibold ${m.badge.split(" ")[0]}`}>{m.label}{t === tag ? " ✓" : ""}</span>
                  <span className="block text-[9px] leading-tight text-slate-500">{m.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
