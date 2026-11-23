"use client";

import { ShieldCheck } from "lucide-react";
import { formatRemaining, useTimerExpiry } from "@/hooks/use-timer-expiry";

/** Selo de proteção (Zona de Neutralização) com contagem regressiva. Some sozinho ao expirar. */
export function NeutralizedBadge({ until, own = false }: { until: string | Date | null | undefined; own?: boolean }) {
  const { expired, remaining } = useTimerExpiry(until);
  if (!until || expired) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-cyan-400/70 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
      title={own ? "Você está protegido: ninguém ataca suas equipes no PvP (e você também não ataca)." : "Protegido pela Zona de Neutralização: não pode ser atacado no PvP."}
    >
      <ShieldCheck size={11} />
      {own ? "Você está protegido" : "Protegido"} · {formatRemaining(remaining)}
    </span>
  );
}
