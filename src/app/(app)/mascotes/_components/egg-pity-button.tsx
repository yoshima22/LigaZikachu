"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { getEggPityProgressAction } from "../actions";

type Progress = NonNullable<Awaited<ReturnType<typeof getEggPityProgressAction>>["progress"]>;

export function EggPityButton() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [, startTransition] = useTransition();

  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  // Celular: janela fixa logo abaixo do botão, com a largura/posição travadas dentro da tela.
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(288, window.innerWidth - 32);
    setPos({ width, top: r.bottom, left: Math.max(16, Math.min(r.left, window.innerWidth - width - 16)) });
  };

  // Fixa na tela: ao rolar, fecha para não ficar solta longe do botão.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, [open]);

  const load = () => startTransition(async () => {
    const result = await getEggPityProgressAction();
    if (result.progress) setProgress(result.progress);
  });

  return (
    <div
      className="relative"
      // Hover só para mouse: no toque o mouseenter emulado abria e o click seguinte fechava.
      onPointerEnter={(e) => { if (e.pointerType === "mouse") { setOpen(true); load(); } }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={() => { const next = !open; if (next) place(); setOpen(next); if (next) load(); }}
        className="flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/[.06] px-3 py-2 text-[11px] font-semibold text-amber-200 transition hover:border-amber-400/40"
      >
        <ShieldCheck size={13} /> Garantia de raros
      </button>
      {open && (
        <div className="fixed z-50 pt-2 sm:absolute sm:!left-auto sm:!top-full sm:right-0 sm:z-30" style={pos ?? undefined}>
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
