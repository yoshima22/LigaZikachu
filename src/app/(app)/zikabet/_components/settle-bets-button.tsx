"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Coins, CheckCircle2 } from "lucide-react";
import { adminSettleWeekBets } from "../actions";

interface Week { id: string; label: string | null; weekNumber: number; pendingBets: number }
interface Props { weeks: Week[] }

export function SettleBetsButton({ weeks }: Props) {
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<Record<string, { settled: number; refunded: number }>>({});

  const hasPending = weeks.some(w => w.pendingBets > 0);

  const handleSettle = (weekId: string, weekLabel: string) => {
    if (!confirm(`Liquidar apostas de "${weekLabel}"? Os vencedores receberão seus ZikaCoins agora.`)) return;
    startTransition(async () => {
      const r = await adminSettleWeekBets(weekId);
      if (r.error) { toast.error(r.error); return; }
      setResults(prev => ({ ...prev, [weekId]: { settled: r.settled, refunded: r.refunded } }));
      toast.success(`${r.settled} apostas liquidadas! Vencedores premiados.`);
    });
  };

  if (!hasPending && Object.keys(results).length === 0) return null;

  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Coins size={15} className="text-[#FFCB05]" />
        <p className="text-sm font-semibold text-slate-200">Liquidar Apostas</p>
        <span className="text-xs text-slate-500">— distribui ZikaCoins para os vencedores</span>
      </div>

      <div className="space-y-2">
        {weeks.map(w => {
          const label = w.label ?? `Semana ${w.weekNumber}`;
          const result = results[w.id];
          return (
            <div key={w.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-slate-900/50 px-3 py-2">
              <div>
                <p className="text-xs font-medium text-slate-300">{label}</p>
                {w.pendingBets > 0 && !result && (
                  <p className="text-[10px] text-amber-400">{w.pendingBets} aposta(s) pendente(s)</p>
                )}
                {result && (
                  <p className="text-[10px] text-green-400 flex items-center gap-1">
                    <CheckCircle2 size={10} /> {result.settled} liquidadas · {result.refunded} reembolsadas
                  </p>
                )}
                {!result && w.pendingBets === 0 && (
                  <p className="text-[10px] text-slate-600">Sem apostas pendentes</p>
                )}
              </div>
              {w.pendingBets > 0 && !result && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleSettle(w.id, label)}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#FFCB05] px-3 py-1.5 text-[11px] font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
                >
                  <Coins size={11} /> Liquidar
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
