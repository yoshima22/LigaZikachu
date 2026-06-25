"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { settleAllPendingLeagueBets } from "../actions";

export function SettleLeagueBetsButton() {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
      <p className="text-xs font-bold text-yellow-300">Liquidar apostas da Liga Semanal</p>
      <p className="text-[10px] text-slate-400 mt-1">Distribui ganhos/perdas de todas as apostas em combates já resolvidos.</p>
      <button
        onClick={() => {
          startTransition(async () => {
            try {
              const res = await settleAllPendingLeagueBets();
              if (res.error) { toast.error(res.error); return; }
              toast.success(`${res.settled ?? 0} combate(s) liquidado(s)!`);
            } catch (err) { toast.error(`Erro: ${String(err).slice(0, 150)}`); }
          });
        }}
        disabled={pending}
        className="mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-40 transition-colors"
      >
        {pending ? "Liquidando..." : "Liquidar todas as apostas pendentes"}
      </button>
    </div>
  );
}
