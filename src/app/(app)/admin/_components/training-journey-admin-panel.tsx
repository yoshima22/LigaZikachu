"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  adminCompleteTrainingJourneyAction,
  getAdminTrainingJourneyMilestonesAction,
  listAdminTrainingJourneysAction,
  type AdminTrainingJourneyListRow,
  type AdminTrainingJourneyMilestone,
} from "../training-journey-actions";

function labelFor(milestone: AdminTrainingJourneyMilestone) {
  const details = milestone.detailsJson && typeof milestone.detailsJson === "object" && !Array.isArray(milestone.detailsJson)
    ? milestone.detailsJson as { label?: unknown }
    : null;
  return typeof details?.label === "string" ? details.label : milestone.milestoneKey;
}

export function TrainingJourneyAdminPanel() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: AdminTrainingJourneyListRow[]; total: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, AdminTrainingJourneyMilestone[] | "loading">>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await listAdminTrainingJourneysAction({ page, query: debounced })); setOpen({}); }
    catch { toast.error("Não foi possível carregar as jornadas."); }
    finally { setLoading(false); }
  }, [page, debounced]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(journeyId: string) {
    if (open[journeyId]) { setOpen(({ [journeyId]: _, ...rest }) => rest); return; }
    setOpen((current) => ({ ...current, [journeyId]: "loading" }));
    try {
      const milestones = await getAdminTrainingJourneyMilestonesAction(journeyId);
      setOpen((current) => ({ ...current, [journeyId]: milestones }));
    } catch {
      toast.error("Não foi possível carregar os objetivos.");
      setOpen(({ [journeyId]: _, ...rest }) => rest);
    }
  }

  function complete(journey: AdminTrainingJourneyListRow, milestoneKey: string) {
    const label = milestoneKey === "ALL" ? "todos os objetivos e liberar a postura" : "este objetivo";
    if (!window.confirm(`Concluir ${label} para ${journey.mascot.nickname ?? `#${journey.mascot.pokemonId}`} de ${journey.mascot.player.displayName}? Esta ação será registrada na auditoria.`)) return;
    startTransition(async () => {
      const result = await adminCompleteTrainingJourneyAction(journey.id, milestoneKey);
      if (result.error) { toast.error(result.error); return; }
      toast.success(result.completedJourney ? "Jornada concluída e postura liberada." : "Objetivo concluído.");
      if (result.completedJourney) { await load(); return; }
      setOpen((current) => ({ ...current, [journey.id]: "loading" }));
      const milestones = await getAdminTrainingJourneyMilestonesAction(journey.id);
      setOpen((current) => ({ ...current, [journey.id]: milestones }));
    });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="space-y-3 rounded-2xl border border-amber-400/35 bg-amber-950/15 p-4">
      <div>
        <h2 className="text-sm font-black text-amber-100">⚔️ Admin — Jornadas de Postura</h2>
        <p className="mt-1 text-xs text-amber-50/70">Conclua uma missão específica ou toda a jornada de qualquer jogador. Todas as ações ficam no log de auditoria.</p>
      </div>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jogador, mascote, #Pokédex ou postura…" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100" />
      <p className="text-[10px] text-slate-500">{data ? `${data.total} jornada(s) ativa(s)` : "Carregando…"}{loading && data ? " · atualizando…" : ""}</p>
      <div className="space-y-2">
        {data?.rows.map((journey) => {
          const milestones = open[journey.id];
          return (
            <div key={journey.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-100">{journey.mascot.nickname ?? `#${journey.mascot.pokemonId}`} · {journey.stanceKey}</p>
                  <p className="text-[10px] text-slate-400">{journey.mascot.player.displayName} · iniciado em {new Date(journey.startedAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => void toggle(journey.id)} className="rounded border border-slate-600 px-2 py-1 text-[10px] font-bold text-slate-200">{milestones ? "Ocultar objetivos" : "Ver objetivos"}</button>
                  <button type="button" disabled={pending} onClick={() => complete(journey, "ALL")} className="rounded bg-amber-300 px-2 py-1 text-[10px] font-black text-slate-950 disabled:opacity-40">Concluir jornada</button>
                </div>
              </div>
              {milestones === "loading" && <p className="mt-2 text-[10px] text-slate-500">Carregando objetivos…</p>}
              {Array.isArray(milestones) && (
                <div className="mt-2 space-y-1">
                  {milestones.map((milestone) => (
                    <div key={milestone.milestoneKey} className="flex items-center gap-2 rounded border border-slate-800 px-2 py-1 text-[10px]">
                      <span className="min-w-0 flex-1 text-slate-300">{labelFor(milestone)}</span>
                      <span className="font-bold text-amber-200">{milestone.value}/{milestone.target}</span>
                      <button type="button" disabled={pending || milestone.value >= milestone.target} onClick={() => complete(journey, milestone.milestoneKey)} className="rounded border border-cyan-400/35 px-1.5 py-0.5 text-[9px] font-bold text-cyan-100 disabled:opacity-30">Concluir</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {data && data.rows.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Nenhuma jornada ativa encontrada.</p>}
      </div>
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-[10px] text-slate-300">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-30">← Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-30">Próxima →</button>
        </div>
      )}
    </section>
  );
}
