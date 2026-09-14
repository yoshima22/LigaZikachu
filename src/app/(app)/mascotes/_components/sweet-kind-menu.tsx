"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export const RARE_SWEET_IMAGE_URL =
  "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/shop/Items/DoceRaro.png";

export type SweetKind = "FEED_SWEET" | "FEED_RARE_SWEET";

/**
 * Setinha ao lado do botão de doce: escolhe entre Doce comum e Doce Raro sem
 * ocupar um segundo botão na grade de ações (o card e a linha do banco já estão
 * no limite de largura). O botão principal continua dando o doce comum em um
 * clique — a seta é só o caminho para o raro.
 */
export function SweetKindMenu({
  onPick,
  hasSweet,
  hasRareSweet,
  disabled,
  size = "md",
}: {
  onPick: (kind: SweetKind) => void;
  hasSweet: boolean;
  hasRareSweet: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc — o menu vive dentro de cards clicáveis,
  // então o clique de fora não pode vazar para o card por trás.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (e: React.MouseEvent, kind: SweetKind) => {
    e.stopPropagation();
    setOpen(false);
    onPick(kind);
  };

  const pad = size === "sm" ? "px-1 py-1" : "px-1.5 py-2";

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label="Escolher tipo de doce"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`flex h-full items-center justify-center rounded-r-xl border border-l-0 border-border text-slate-400 hover:border-slate-500 hover:text-[#FFCB05] disabled:opacity-30 disabled:cursor-not-allowed ${pad}`}
      >
        <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-slate-900 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!hasSweet}
            onClick={(e) => pick(e, "FEED_SWEET")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-sm">🍬</span>
            <span className="min-w-0">
              <span className="block font-semibold">Doce</span>
              <span className="block text-[9px] text-slate-500">{hasSweet ? "EXP padrão" : "Sem estoque"}</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!hasRareSweet}
            onClick={(e) => pick(e, "FEED_RARE_SWEET")}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <img src={RARE_SWEET_IMAGE_URL} alt="" aria-hidden className="h-4 w-4 shrink-0 object-contain" />
            <span className="min-w-0">
              <span className="block font-semibold text-[#FFCB05]">Doce Raro</span>
              <span className="block text-[9px] text-slate-500">{hasRareSweet ? "EXP de 8 doces" : "Sem estoque"}</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
