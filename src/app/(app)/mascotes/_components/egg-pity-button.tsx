"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { getEggPityProgressAction } from "../actions";

type Progress = NonNullable<Awaited<ReturnType<typeof getEggPityProgressAction>>["progress"]>;

export function EggPityButton() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [, startTransition] = useTransition();

  const load = () => startTransition(async () => {
    const result = await getEggPityProgressAction();
    if (result.progress) setProgress(result.progress);
  });

  return (
    <div
      className="relative"
      onMouseEnter={() => { setOpen(true); load(); }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (next) load(); }}
        className="flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/[.06] px-3 py-2 text-[11px] font-semibold text-amber-200 transition hover:border-amber-400/40"
      >
        <ShieldCheck size={13} /> Garantia de raros
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 w-72 pt-2">
          <div className="space-y-2 rounded-xl border border-border bg-slate-950 p-3 shadow-xl">
            <p className="text-[11px] text-slate-400">
              Ovos seguidos sem nascer um mascote de raridade aumentada. Ao completar, o próximo ovo daquele tipo vem garantido. Se sair um antes, o contador zera.
            </p>
            {(progress ?? []).map((p) => (
              <div key={p.key}>
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>{p.label}</span>
                  <span className="font-mono">{p.count}/{p.threshold}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-amber-400" style={{ width: `${(p.count / p.threshold) * 100}%` }} />
                </div>
              </div>
            ))}
            {!progress && <p className="text-[11px] text-slate-500">Carregando…</p>}
          </div>
        </div>
      )}
    </div>
  );
}
