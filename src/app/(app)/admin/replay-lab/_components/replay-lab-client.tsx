"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ReplayCanvas, type ReplayData } from "./replay-canvas";
import { getLeagueReplay, type LeagueReplayOption } from "../actions";

export function ReplayLabClient({ sample, games }: { sample: ReplayData; games: LeagueReplayOption[] }) {
  const [data, setData] = useState<ReplayData>(sample);
  const [current, setCurrent] = useState<string>("sample");
  const [pending, startTransition] = useTransition();

  function pick(value: string) {
    setCurrent(value);
    if (value === "sample") { setData(sample); return; }
    startTransition(async () => {
      try {
        const real = await getLeagueReplay(value);
        if (!real) { toast.error("Este jogo não tem replay gravado."); return; }
        setData(real);
      } catch {
        toast.error("Não foi possível carregar o replay.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
        <label className="text-xs font-semibold text-slate-300">Assistir:</label>
        <select
          value={current}
          onChange={(e) => pick(e.target.value)}
          disabled={pending}
          className="min-w-[280px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 disabled:opacity-50"
        >
          <option value="sample">Batalha de exemplo (demonstração)</option>
          {games.length > 0 && <optgroup label="Liga Semanal (jogos reais)">
            {games.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </optgroup>}
        </select>
        {pending && <span className="text-xs text-cyan-300">Carregando…</span>}
        <span className="text-[11px] text-slate-500">{data.teams.filter((t) => t.side === "A").length}×{data.teams.filter((t) => t.side === "B").length} mascotes</span>
      </div>
      <ReplayCanvas key={current} data={data} />
      {games.length === 0 && (
        <p className="text-xs text-slate-500">Nenhum jogo resolvido da liga semanal encontrado ainda. Assim que houver partidas resolvidas, elas aparecem aqui.</p>
      )}
    </div>
  );
}
