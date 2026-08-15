"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();
  const timerRef = useRef<number | undefined>(undefined);

  const hideTip = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    setTip(null);
  };

  // Fecha imediatamente ao navegar, inclusive quando o layout global permanece montado.
  useEffect(() => {
    hideTip();
  }, [pathname]);

  useEffect(() => {
    const coarse = typeof window !== "undefined"
      && window.matchMedia?.("(pointer: coarse)")?.matches;
    if (!coarse) return; // desktop/mouse: mantém o tooltip nativo, nada a fazer.

    let pointerStart: { x: number; y: number } | null = null;
    let gestureMoved = false;

    const dismiss = () => hideTip();

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      pointerStart = { x: event.clientX, y: event.clientY };
      gestureMoved = false;
      // Uma nova interação nunca deve carregar a bolha do toque anterior.
      dismiss();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerStart || event.pointerType === "mouse") return;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) {
        gestureMoved = true;
        dismiss();
      }
    };

    const onTap = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || gestureMoved) {
        pointerStart = null;
        return;
      }
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
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setTip(null), 3200);
      pointerStart = null;
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onTap, true);
    // `capture` também observa scroll de listas, modais e outros contêineres internos.
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("orientationchange", dismiss);
    document.addEventListener("visibilitychange", dismiss);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onTap, true);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("orientationchange", dismiss);
      document.removeEventListener("visibilitychange", dismiss);
      window.clearTimeout(timerRef.current);
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
