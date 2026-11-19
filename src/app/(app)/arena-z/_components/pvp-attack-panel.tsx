"use client";

import { useState } from "react";
import { Coins, Shield, Swords } from "lucide-react";
import { CooldownChip, PvpBattleButton } from "./arena-z-buttons";

export type PanelAttacker = {
  id: string;
  name: string;
  updatedAt: string;
  memberCount: number;
  vaultCoins: number;
  vaultExp: number;
  pveUntil: string | null;
  pvpUntil: string | null;
};

export type PanelTarget = {
  id: string;
  name: string;
  playerId: string;
  playerName: string;
  isCasual: boolean;
  debuffPct: number;
  coins: number;
  exp: number;
  mult: number;
  members: { name: string | null; level: number }[];
};

/** Passo 1: escolher qual time ataca. Passo 2: escolher o alvo (agrupado por jogador). */
export function PvpAttackPanel({ attackers, targets, stolenPct }: { attackers: PanelAttacker[]; targets: PanelTarget[]; stolenPct: number }) {
  const [selectedId, setSelectedId] = useState(attackers[0]?.id ?? "");
  const selected = attackers.find((a) => a.id === selectedId) ?? attackers[0];
  if (!selected) return null;

  const byPlayer = new Map<string, PanelTarget[]>();
  for (const t of targets) byPlayer.set(t.playerId, [...(byPlayer.get(t.playerId) ?? []), t]);

  return (
    <div className="space-y-4 rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-4">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#FFCB05]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FFCB05] text-[9px] text-[#1A1A2E]">1</span>
          Com qual time você ataca?
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {attackers.map((a) => {
            const on = a.id === selected.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                aria-pressed={on}
                className={`rounded-xl border p-3 text-left transition ${on ? "border-[#FFCB05] bg-[#FFCB05]/10 ring-1 ring-[#FFCB05]/60" : "border-slate-700/60 bg-slate-900/40 hover:border-slate-500"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-xs font-bold ${on ? "text-[#FFCB05]" : "text-slate-200"}`}>{a.name}</p>
                  {on && <span className="shrink-0 rounded-full bg-[#FFCB05] px-1.5 py-0.5 text-[9px] font-black text-[#1A1A2E]">ATACA</span>}
                </div>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                  <Coins size={10} className="text-[#FFCB05]" /> {a.vaultCoins} ZC · {a.vaultExp} EXP · {a.memberCount} mascote{a.memberCount !== 1 ? "s" : ""}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  <CooldownChip label="PvP" until={a.pvpUntil} />
                  <CooldownChip label="PvE" until={a.pveUntil} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-300">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-400 text-[9px] text-[#1A1A2E]">2</span>
          Quem você ataca? <span className="font-medium normal-case tracking-normal text-slate-500">(atacando com <b className="text-slate-300">{selected.name}</b>)</span>
        </p>
        <div className="space-y-3">
          {[...byPlayer.entries()].map(([playerId, list]) => (
            <div key={playerId} className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/50">
              <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/60 px-3 py-1.5">
                <Shield size={11} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-200">{list[0].playerName}</span>
                <span className="text-[10px] text-slate-600">· {list.length} time{list.length !== 1 ? "s" : ""}</span>
                {list[0].isCasual && (
                  <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-bold text-sky-300" title="Jogador Casual: sem movimentação de cofre ou cooldown nestas batalhas">Casual</span>
                )}
              </div>
              <ul className="divide-y divide-slate-800/80">
                {list.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-xs font-bold text-slate-100">
                        {t.name}
                        {t.debuffPct > 0 && <span className="ml-1.5 text-[10px] font-medium text-orange-400">-{t.debuffPct}% stats</span>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-slate-500">
                        {t.members.map((m, i) => (
                          <span key={i}>{m.name ?? "???"} <span className="text-slate-600">Nv.{m.level}</span></span>
                        ))}
                      </p>
                    </div>
                    <div className="text-right text-[10px] leading-4">
                      <p className="flex items-center justify-end gap-1 font-bold text-[#FFCB05]"><Coins size={10} /> {t.coins} ZC · {t.exp} EXP no cofre</p>
                      <p className="text-green-400">K.O. total: +{Math.floor(t.coins * t.mult * stolenPct)} ZC</p>
                    </div>
                    <PvpBattleButton
                      attackTeamId={selected.id}
                      defenseTeamId={t.id}
                      attackTeamUpdatedAt={selected.updatedAt}
                      pvpCooldownUntil={selected.pvpUntil ? new Date(selected.pvpUntil) : null}
                      label="⚔️ Atacar"
                      confirmMessage={`Atacar o time "${t.name}" de ${t.playerName} com o seu time "${selected.name}"? Você pode ganhar ou perder loot do cofre.`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-1 text-[10px] text-slate-600"><Swords size={10} /> O roubo só acontece quando o time derrotado cai por completo (K.O. total).</p>
    </div>
  );
}
