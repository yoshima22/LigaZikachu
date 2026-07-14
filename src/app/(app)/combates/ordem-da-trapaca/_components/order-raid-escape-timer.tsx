"use client";

import { useEffect, useMemo, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) return "Tempo esgotado";
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}min`);
  return parts.join(" ");
}

export function OrderRaidEscapeTimer({ raidEndsAt, showSeriousModeMessage = false }: { raidEndsAt: string | null; showSeriousModeMessage?: boolean }) {
  const target = useMemo(() => raidEndsAt ? new Date(raidEndsAt).getTime() : null, [raidEndsAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!target) return null;

  const remaining = target - now;
  const percent = Math.max(0, Math.min(100, (remaining / (7 * 24 * 60 * 60 * 1000)) * 100));

  return (
    <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200">Fuga do chefe</p>
          <p className="mt-1 text-lg font-black text-white">{formatRemaining(remaining)}</p>
        </div>
        <span className="rounded-full border border-red-300/30 bg-red-950/60 px-2 py-1 text-[10px] font-bold text-red-100">
          7 dias
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950 ring-1 ring-red-500/20">
        <div className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-[#FFCB05]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-red-100/75">
        Se a Liga não derrotar a Ordem antes do prazo, o chefe foge com parte dos espólios do esconderijo.
      </p>
      {showSeriousModeMessage && (
        <div className="mt-3 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/10 px-3 py-2 text-sm font-bold text-fuchsia-50 shadow-[0_0_18px_rgba(168,85,247,0.16)]">
          &ldquo;Voc&ecirc;s s&atilde;o mais fortes do que imaginei. Vamos batalhar a s&eacute;rio!&rdquo;
        </div>
      )}
    </div>
  );
}
