"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setMatchOdds } from "../actions";

interface Props {
  matchId: string;
  playerAName: string;
  playerBName: string;
  playerAOdds: number;
  playerBOdds: number;
  betsEnabled: boolean;
}

export function OddsForm({ matchId, playerAName, playerBName, playerAOdds, playerBOdds, betsEnabled }: Props) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ playerAOdds, playerBOdds, betsEnabled });

  const handle = () => {
    startTransition(async () => {
      try {
        const result = await setMatchOdds(matchId, form.playerAOdds, form.playerBOdds, form.betsEnabled);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Odds salvas!");
      } catch { toast.error("Erro ao salvar odds."); }
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-slate-950/60 px-4 py-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-300">{playerAName}</p>
        <span className="text-slate-600">vs</span>
        <p className="truncate text-xs font-semibold text-slate-300">{playerBName}</p>
      </div>
      <label className="space-y-0.5 text-xs text-slate-500">
        <span>{playerAName.split(" ")[0]} odds</span>
        <input type="number" step="0.05" min="1" max="99" value={form.playerAOdds}
          onChange={(e) => setForm({ ...form, playerAOdds: Number(e.target.value) })}
          className="w-20 rounded border border-border bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
      </label>
      <label className="space-y-0.5 text-xs text-slate-500">
        <span>{playerBName.split(" ")[0]} odds</span>
        <input type="number" step="0.05" min="1" max="99" value={form.playerBOdds}
          onChange={(e) => setForm({ ...form, playerBOdds: Number(e.target.value) })}
          className="w-20 rounded border border-border bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        <input type="checkbox" checked={form.betsEnabled} onChange={(e) => setForm({ ...form, betsEnabled: e.target.checked })}
          className="accent-[#FFCB05]" />
        Apostas abertas
      </label>
      <button type="button" disabled={pending} onClick={handle}
        className="rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-60">
        Salvar
      </button>
    </div>
  );
}
