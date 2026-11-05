"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Entrada suave ao rolar a página. Sem JavaScript ou com "reduzir movimento", o conteúdo aparece direto
 * (nunca fica escondido). `delay` em ms escalona cartões vizinhos.
 */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { setShown(true); return; }
    // Já visível ao carregar: não esconde para depois mostrar (evita piscar).
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95) { setShown(true); return; }
    setArmed(true);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined }}
      className={`${className} ${armed && !shown ? "translate-y-5 opacity-0" : "translate-y-0 opacity-100"} transition-all duration-700 ease-out motion-reduce:transition-none`}
    >
      {children}
    </div>
  );
}
