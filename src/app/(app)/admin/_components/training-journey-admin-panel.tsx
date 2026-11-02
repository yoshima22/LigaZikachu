"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { adminCompleteTrainingJourneyAction } from "../training-journey-actions";

export type AdminTrainingJourneyRow = {
  id: string;
  stanceKey: string;
  startedAt: Date;
  mascot: { id: string; nickname: string | null; pokemonId: number; player: { displayName: string } };
  milestones: { milestoneKey: string; value: number; target: number; detailsJson: unknown }[];
};

function labelFor(milestone: AdminTrainingJourneyRow["milestones"][number]) {
  const details = milestone.detailsJson && typeof milestone.detailsJson === "object" && !Array.isArray(milestone.detailsJson)
    ? milestone.detailsJson as { label?: unknown }
    : null;
  return typeof details?.label === "string" ? details.label : milestone.milestoneKey;
}

export function TrainingJourneyAdminPanel({ journeys }: { journeys: AdminTrainingJourneyRow[] }) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return journeys;
    return journeys.filter((journey) => [journey.mascot.player.displayName, journey.mascot.nickname ?? "", journey.stanceKey, String(journey.mascot.pokemonId)].join(" ").toLocaleLowerCase("pt-BR").includes(normalized));
  }, [journeys, query]);

  function complete(journey: AdminTrainingJourneyRow, milestoneKey: string) {
    const label = milestoneKey === "ALL" ? "todos os objetivos e liberar a postura" : "este objetivo";
    if (!window.confirm(`Concluir ${label} para ${journey.mascot.nickname ?? `#${journey.mascot.pokemonId}`} de ${journey.mascot.player.displayName}? Esta ação será registrada na auditoria.`)) return;
    startTransition(async () => {
      const result = await adminCompleteTrainingJourneyAction(journey.id, milestoneKey);
      if (result.error) { toast.error(result.error); return; }
      toast.success(result.completedJourney ? "Jornada concluída e postura liberada." : "Objetivo concluído.");
      window.location.reload();
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-400/35 bg-amber-950/15 p-4">
      <div>
        <h2 className="text-sm font-black text-amber-100">⚔️ Admin — Jornadas de Postura</h2>
        <p className="mt-1 text-xs text-amber-50/70">Conclua uma missão específica ou toda a jornada de qualquer jogador. Todas as ações ficam no log de auditoria.</p>
      </div>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jogador, mascote, #Pokédex ou postura…" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100" />
      <p className="text-[10px] text-slate-500">{filtered.length} jornada(s) ativa(s)</p>
      <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
        {filtered.map((journey) => (
          <div key={journey.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-slate-100">{journey.mascot.nickname ?? `#${journey.mascot.pokemonId}`} · {journey.stanceKey}</p><p className="text-[10px] text-slate-400">{journey.mascot.player.displayName} · iniciado em {new Date(journey.startedAt).toLocaleDateString("pt-BR")}</p></div><button type="button" disabled={pending} onClick={() => complete(journey, "ALL")} className="rounded bg-amber-300 px-2 py-1 text-[10px] font-black text-slate-950 disabled:opacity-40">Concluir jornada</button></div>
            <div className="mt-2 space-y-1">{journey.milestones.map((milestone) => <div key={milestone.milestoneKey} className="flex items-center gap-2 rounded border border-slate-800 px-2 py-1 text-[10px]"><span className="min-w-0 flex-1 text-slate-300">{labelFor(milestone)}</span><span className="font-bold text-amber-200">{milestone.value}/{milestone.target}</span><button type="button" disabled={pending || milestone.value >= milestone.target} onClick={() => complete(journey, milestone.milestoneKey)} className="rounded border border-cyan-400/35 px-1.5 py-0.5 text-[9px] font-bold text-cyan-100 disabled:opacity-30">Concluir</button></div>)}</div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Nenhuma jornada ativa encontrada.</p>}
      </div>
    </section>
  );
}
