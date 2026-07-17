"use client";

import { useState, useEffect } from "react";

/**
 * Retorna { expired, remaining } baseado em uma data alvo.
 * Atualiza automaticamente quando o timer chega a zero.
 *
 * @param target - Data/string de expiração (null = nunca expira)
 * @param tickMs - Intervalo de atualização do display (padrão 1000ms)
 */
export function useTimerExpiry(
  target: Date | string | null | undefined,
  tickMs = 1000
): { expired: boolean; remaining: number } {
  const targetMs = target ? new Date(target).getTime() : null;
  const now = typeof window !== "undefined" ? Date.now() : (targetMs ?? 0) + 1;
  const initialRemaining = targetMs ? Math.max(0, targetMs - now) : 0;

  const [remaining, setRemaining] = useState(initialRemaining);
  const [expired, setExpired] = useState(initialRemaining === 0 && targetMs !== null);

  useEffect(() => {
    if (!targetMs) { setRemaining(0); setExpired(false); return; }

    const update = () => {
      const rem = Math.max(0, targetMs - Date.now());
      setRemaining(rem);
      // Uma nova data futura pode substituir um timer que já havia expirado.
      // Recalcular nos dois sentidos evita manter `expired=true` até remontar a página.
      setExpired(rem === 0);
    };

    update(); // executa imediatamente após montar

    if (targetMs <= Date.now()) { setExpired(true); return; }

    const interval = setInterval(update, tickMs);
    // Timeout preciso para o momento exato da expiração
    const exact = setTimeout(() => { setExpired(true); setRemaining(0); }, targetMs - Date.now());

    return () => { clearInterval(interval); clearTimeout(exact); };
  }, [targetMs, tickMs]);

  return { expired, remaining };
}

/** Formata milissegundos em string legível: "2h 15m 30s" */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "Pronto!";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
  if (m > 0) return `${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
  return `${s}s`;
}
