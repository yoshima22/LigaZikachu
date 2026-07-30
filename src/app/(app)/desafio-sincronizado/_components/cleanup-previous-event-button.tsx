"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { adminClearPreviousSyncEventsAction, type SyncCleanupResult } from "../cleanup-actions";

export function CleanupPreviousEventButton({ scheduledDate }: { scheduledDate: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncCleanupResult | null>(null);

  const run = () => {
    const label = scheduledDate ? `Tudo anterior a ${scheduledDate}` : "Todo conteúdo anterior";
    if (!window.confirm(`${label} será apagado permanentemente: salas, duplas, escalações, seleções, resultados e replays. O evento agendado será preservado. Continuar?`)) return;
    setResult(null);
    startTransition(async () => {
      const response = await adminClearPreviousSyncEventsAction();
      setResult(response);
      if (!response.error) router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending || !scheduledDate}
        onClick={run}
        className="inline-flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        {pending ? "Limpando…" : "Limpar eventos anteriores"}
      </button>
      <p className="text-xs text-slate-500">
        {scheduledDate
          ? `Preserva salas e duplas do evento agendado para ${scheduledDate}, além de configurações, prêmios, modificadores e tickets.`
          : "Defina a data da primeira rodada para habilitar esta limpeza segura."}
      </p>
      {result?.error && <p className="flex items-center gap-2 text-xs text-red-300"><AlertTriangle size={13} /> {result.error}</p>}
      {result && !result.error && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={14} /> Limpeza concluída.</p>
          <p className="mt-1 text-emerald-100/80">
            {result.rooms} sala(s), {result.teams} dupla(s), {result.lineups} escalação(ões), {result.selections} seleção(ões), {result.matches} combate(s)/replay(s) e {result.scores} placar(es) removidos.
          </p>
        </div>
      )}
    </div>
  );
}
