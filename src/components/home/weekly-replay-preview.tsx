"use client";

import { Swords } from "lucide-react";
import { useMemo } from "react";
import { ReplayCanvas, type ReplayData } from "@/components/replay/replay-canvas";
import type { PublicWeeklyReplay } from "@/lib/public-weekly-replay";

export function WeeklyReplayPreview({ replay }: { replay: PublicWeeklyReplay }) {
  const data = useMemo<ReplayData>(() => {
    const teams = replay.teams.map((team) => ({
      id: team.id,
      name: "",
      pokemonId: team.pokemonId,
      type: "normal",
      sprite: `/sprites/pokemon/${team.pokemonId}.png`,
      maxHp: team.maxHp,
      side: team.side,
    }));
    const hp = new Map(teams.map((team) => [team.id, team.maxHp]));
    const turns = replay.turns.map((turn, index) => {
      const maxHp = teams.find((team) => team.id === turn.targetId)?.maxHp ?? 100;
      const currentHp = hp.get(turn.targetId) ?? maxHp;
      const targetHpAfter = turn.action === "HEAL"
        ? Math.min(maxHp, currentHp + turn.damage)
        : turn.action === "ATTACK" || turn.action === "ABILITY"
          ? Math.max(0, currentHp - turn.damage)
          : currentHp;
      hp.set(turn.targetId, targetHpAfter);
      return { ...turn, turn: index + 1, targetHpAfter };
    });
    return { teams, turns, bgUrl: "/replay-lab/arena.webp", winnerName: null };
  }, [replay]);

  return (
    <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[#FFCB05]/35 bg-[linear-gradient(145deg,#132a52,#0a1128_58%,#1b1026)] p-3 shadow-2xl shadow-black/50 sm:p-4">
      <div className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-slate-950/30 p-3 backdrop-blur-[2px] sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-3 px-1">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-[#FFCB05]"><span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,.8)]" /> Liga Semanal</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-white"><Swords size={14} className="text-[#FFCB05]" /> Replay moderno em exibição</p>
          </div>
          <span className="rounded-full border border-white/15 bg-slate-950/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">{replay.source === "real" ? "Partida real" : "Demonstração"}</span>
        </div>
        <ReplayCanvas data={data} compact hideLabels loop />
        <div className="mt-3 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400"><span>Replay moderno</span><span>Rodando em loop</span></div>
      </div>
    </div>
  );
}
