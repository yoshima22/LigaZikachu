"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Tip = { text: string; x: number; y: number };

/**
 * Tooltips de toque para o atributo `title`.
 *
 * No desktop o `title` já aparece no hover do mouse — este componente NÃO altera
 * esse comportamento. Em telas de toque (`pointer: coarse`), onde não existe
 * hover, ao tocar num elemento que tenha `title` mostramos o texto numa bolha
 * flutuante por alguns segundos. Assim as dicas (posturas, abreviações de stats,
 * cabeçalhos, etc.) ficam acessíveis no celular sem mudar nada na versão de PC.
 */
export function MobileTitleTooltips() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const coarse = typeof window !== "undefined"
      && window.matchMedia?.("(pointer: coarse)")?.matches;
    if (!coarse) return; // desktop/mouse: mantém o tooltip nativo, nada a fazer.

    let timer: number | undefined;

    const onTap = (event: MouseEvent) => {
      const start = event.target as HTMLElement | null;
      const el = start?.closest?.("[title]") as HTMLElement | null;
      const text = el?.getAttribute("title")?.trim();
      if (!el || !text) {
        setTip(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = Math.min(Math.max(rect.left + rect.width / 2, 16), window.innerWidth - 16);
      const y = Math.min(rect.bottom + 8, window.innerHeight - 16);
      setTip({ text, x, y });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTip(null), 3200);
    };

    document.addEventListener("click", onTap, true);
    return () => {
      document.removeEventListener("click", onTap, true);
      window.clearTimeout(timer);
    };
  }, []);

  if (!tip || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{ position: "fixed", left: tip.x, top: tip.y, transform: "translateX(-50%)", zIndex: 100000, pointerEvents: "none" }}
      className="max-w-[80vw] rounded-lg border border-[#FFCB05]/40 bg-slate-900/95 px-3 py-1.5 text-xs leading-snug text-slate-100 shadow-xl backdrop-blur-sm"
    >
      {tip.text}
    </div>,
    document.body,
  );
}
