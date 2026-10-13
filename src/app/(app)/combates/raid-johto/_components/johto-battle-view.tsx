"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { LeagueBattleReplayModal, type TurnLog } from "../../liga-semanal/_components/league-battle-replay";
import { getStaticSpriteUrl } from "@/lib/mascot-data";
import type { JohtoBattlePayload, JohtoTestSummary } from "@/lib/johto-raid";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (n: number) => `${Math.round(n * 100)}%`;

type PerSlot = Array<{ slot: number; pokemonId: number; name: string; battleDamage: number; globalDamage: number; fellInBattle: boolean }>;

/** Replay do combate (motor da Liga) no modal padrão. */
export function JohtoReplay({ battle, onClose }: { battle: JohtoBattlePayload; onClose: () => void }) {
  return (
    <LeagueBattleReplayModal
      playerAName={battle.playerName}
      playerBName={battle.leaderName}
      playerAId={battle.playerId}
      winnerId={battle.winner === "A" ? battle.playerId : battle.winner === "B" ? "johto" : null}
      isDraw={battle.winner === "DRAW"}
      replay={battle.log as unknown as TurnLog[]}
      playerASurvivors={battle.survivorsA}
      playerBSurvivors={battle.survivorsB}
      lineupA={battle.lineupA}
      lineupB={battle.lineupB}
      onFinish={onClose}
    />
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-2.5 text-center">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      {hint && <p className="mt-0.5 text-[9px] text-slate-500">{hint}</p>}
    </div>
  );
}

function SlotTable({ rows }: { rows: PerSlot }) {
  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div key={row.slot} className="flex items-center gap-2 rounded-lg bg-slate-900/70 px-2 py-1 text-[11px]">
          <img src={getStaticSpriteUrl(row.pokemonId)} alt="" className="h-8 w-8 object-contain" style={{ imageRendering: "pixelated" }} />
          <span className="min-w-0 flex-1 truncate font-bold text-white">{row.name}{row.fellInBattle && <span className="ml-1 text-red-300">✖ caiu</span>}</span>
          <span className="text-slate-400">{fmt(row.battleDamage)} em combate</span>
          <span className="w-24 text-right font-black text-amber-300">{fmt(row.globalDamage)}</span>
        </div>
      ))}
    </div>
  );
}

type AttackView = {
  message?: string; win?: boolean; damage?: number; rounds?: number; leaderName?: string; perSlot?: PerSlot; fallenMascots?: string[];
  koSlots?: number[]; leaderDefeated?: boolean; eventDefeated?: boolean; battle?: JohtoBattlePayload; test?: JohtoTestSummary;
};

/** Resultado de uma investida (real) ou de uma simulação de teste (admin): resumo + botão para assistir ao replay. */
export function JohtoBattleResultView({ result, onClose }: { result: Record<string, unknown>; onClose: () => void }) {
  const view = result as AttackView;
  const [replay, setReplay] = useState(false);
  const test = view.test;
  const battle = test?.battle ?? view.battle;
  if (!battle) return null;
  const won = test ? test.winRate >= 0.5 : view.win;
  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3">
        <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#FFCB05]/30 bg-slate-950 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FFCB05]">{test ? `Teste · ${test.runs} simulações` : "Resultado do confronto"}</p>
              <h2 className="mt-1 text-xl font-black text-white">
                {test ? `Contra ${test.leaderName}` : view.eventDefeated ? "OS LÍDERES CAÍRAM!" : view.leaderDefeated ? `${view.leaderName} foi derrotado!` : won ? `Vitória contra ${view.leaderName}` : `Derrota contra ${view.leaderName}`}
              </h2>
              {!test && <p className="text-xs text-slate-400">{view.message}</p>}
            </div>
            <button onClick={onClose} className="rounded-full border border-white/15 p-2 text-slate-300 hover:text-white"><X size={16} /></button>
          </div>

          {test ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Vitórias" value={pct(test.winRate)} />
                <Stat label="Rodadas (média)" value={test.avgRounds.toFixed(1)} />
                <Stat label="Dano em combate" value={fmt(test.avgBattleDamage)} hint="média" />
                <Stat label="Dano no líder" value={fmt(test.avgGlobalDamage)} hint={`×${test.damageScale} convertido`} />
                <Stat label="Mascotes do líder caídos" value={test.avgLeaderFallen.toFixed(1)} hint="de 6 (por luta)" />
                <Stat label="Seus mascotes caídos" value={test.avgPlayerFallen.toFixed(1)} hint="feridos na luta" />
                <Stat label="Ataques p/ derrubar" value={test.attacksToDefeatLeader ? fmt(test.attacksToDefeatLeader) : "—"} hint="só você, em média" />
              </div>
              <p className="mb-1 mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Por mascote do líder (média · dano convertido)</p>
              <div className="space-y-1">
                {test.perSlot.map((slot) => (
                  <div key={slot.slot} className="flex items-center gap-2 rounded-lg bg-slate-900/70 px-2 py-1 text-[11px]">
                    <span className="min-w-0 flex-1 truncate font-bold text-white">{slot.name}</span>
                    <span className="text-slate-400">cai em combate {pct(slot.fellRate)}</span>
                    <span className="text-slate-400">{fmt(slot.avgBattleDamage)}</span>
                    <span className="w-28 text-right font-black text-amber-300">{fmt(slot.avgGlobalDamage)} / {fmt(slot.globalHpMax)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Dano no líder" value={fmt(view.damage ?? 0)} />
                <Stat label="Rodadas" value={String(view.rounds ?? 0)} />
                <Stat label="Caíram do líder" value={String(view.koSlots?.length ?? 0)} hint="derrubados de vez" />
                <Stat label="Seus feridos" value={String(view.fallenMascots?.length ?? 0)} hint={view.fallenMascots?.length ? "Atendimento SUS" : undefined} />
              </div>
              {view.perSlot && <div className="mt-4"><p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Dano por mascote do líder (em combate · convertido)</p><SlotTable rows={view.perSlot} /></div>}
              {view.fallenMascots && view.fallenMascots.length > 0 && <p className="mt-3 text-[11px] text-orange-200">Feridos: {view.fallenMascots.join(", ")}.</p>}
            </>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => setReplay(true)} className="rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-black text-slate-950 hover:brightness-110">▶ Assistir ao replay{test ? " (1ª luta)" : ""}</button>
            <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800">Fechar</button>
          </div>
        </div>
      </div>
      {replay && <JohtoReplay battle={battle} onClose={() => setReplay(false)} />}
    </>
  );
}
