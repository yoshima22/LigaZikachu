"use client";

import { useState, useEffect, useRef } from "react";

export type ArenaTurnLog = {
  turn: number;
  actorId: string;
  actorName: string;
  targetId: string;
  targetName: string;
  action: "ATTACK" | "DEFEND";
  damage: number;
  attackerType: string;
  defenderType: string;
  multiplier: number;
  advantageApplied: boolean;
  actorRole?: string;
  targetRole?: string;
  effect?: string;
};

interface Combatant {
  id: string;
  name: string;
  side: "A" | "B";
  maxHp: number;
  hp: number;
}

function buildCombatants(turns: ArenaTurnLog[], playerAId?: string): Combatant[] {
  // Deduce combatants from turns - first appearance determines side
  const seen = new Map<string, Combatant>();
  const sideA = new Set<string>();
  const sideB = new Set<string>();

  // If we have playerAId from actorOwnerId, use that; otherwise infer from first turn
  for (const t of turns) {
    if (!seen.has(t.actorId)) {
      // Determine side: first 6 unique actors = A, rest = B
      const side = sideA.size < 6 && !sideB.has(t.actorId) ? "A" : "B";
      if (side === "A") sideA.add(t.actorId);
      else sideB.add(t.actorId);
      seen.set(t.actorId, { id: t.actorId, name: t.actorName, side, maxHp: 100, hp: 100 });
    }
    if (!seen.has(t.targetId)) {
      const side = sideA.size < 6 && !sideB.has(t.targetId) ? "A" : "B";
      if (side === "A") sideA.add(t.targetId);
      else sideB.add(t.targetId);
      seen.set(t.targetId, { id: t.targetId, name: t.targetName, side, maxHp: 100, hp: 100 });
    }
  }

  // Estimate maxHP based on total damage taken
  for (const t of turns) {
    const target = seen.get(t.targetId);
    if (target && t.action === "ATTACK") {
      target.maxHp += t.damage;
    }
  }
  // Normalize so max is roughly proportional
  for (const c of seen.values()) {
    if (c.maxHp <= 100) c.maxHp = 100;
    c.hp = c.maxHp;
  }

  return [...seen.values()];
}

function HpBar({ hp, maxHp, side }: { hp: number; maxHp: number; side: "A" | "B" }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color = pct > 50 ? "bg-green-500" : pct > 25 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function LeagueBattleReplayModal({
  playerAName,
  playerBName,
  replay,
  onFinish,
}: {
  playerAName: string;
  playerBName: string;
  replay: ArenaTurnLog[];
  onFinish: () => void;
}) {
  const [turnIdx, setTurnIdx] = useState(-1);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; });

  // Initialize combatants
  useEffect(() => {
    setCombatants(buildCombatants(replay));
    setTurnIdx(-1);
  }, [replay]);

  // Auto-advance timer
  useEffect(() => {
    if (turnIdx >= replay.length) {
      const t = setTimeout(() => onFinishRef.current(), 1500);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setTurnIdx(prev => {
        const next = prev + 1;
        if (next < replay.length) {
          // Apply damage for this turn
          const turn = replay[next];
          setCombatants(prev => prev.map(c => {
            if (c.id === turn.targetId && turn.action === "ATTACK") {
              return { ...c, hp: Math.max(0, c.hp - turn.damage) };
            }
            return c;
          }));
        }
        return next;
      });
    }, turnIdx < 0 ? 800 : 2000);

    return () => clearTimeout(t);
  }, [turnIdx, replay]);

  const currentTurn = turnIdx >= 0 && turnIdx < replay.length ? replay[turnIdx] : null;
  const progress = replay.length > 0 ? Math.round(((turnIdx + 1) / replay.length) * 100) : 0;

  const teamA = combatants.filter(c => c.side === "A");
  const teamB = combatants.filter(c => c.side === "B");

  return (
    <>
      <style>{`
        @keyframes leagueAttack {
          0%,100%{transform:translateX(0)}
          50%{transform:translateX(var(--atk-dir,12px))}
        }
        @keyframes leagueShake {
          0%,100%{transform:translateX(0)}
          25%{transform:translateX(-4px)}
          75%{transform:translateX(4px)}
        }
        @keyframes leagueDmgPop {
          0%{opacity:1;transform:translateY(0) scale(1)}
          100%{opacity:0;transform:translateY(-18px) scale(1.3)}
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3">
        <div className="w-full max-w-lg rounded-2xl border border-[#FFCB05]/30 bg-slate-950 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#FFCB05]">
              Replay da Batalha
            </p>
            <button
              type="button"
              onClick={() => onFinishRef.current()}
              className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] text-slate-400 hover:text-white"
            >
              Pular
            </button>
          </div>

          {/* Progress bar */}
          <div className="mx-4 mb-3 h-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-1 rounded-full bg-[#FFCB05] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Team labels */}
          <div className="mx-4 mb-2 flex justify-between text-[10px] font-bold uppercase tracking-wide">
            <span className="text-blue-300">{playerAName}</span>
            <span className="text-slate-500">vs</span>
            <span className="text-red-300">{playerBName}</span>
          </div>

          {/* HP bars for both teams */}
          <div className="mx-4 grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              {teamA.map(c => (
                <div key={c.id} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-all duration-300 ${
                  currentTurn?.actorId === c.id ? "bg-blue-500/10 border border-blue-500/30" :
                  currentTurn?.targetId === c.id ? "bg-red-500/10 border border-red-500/30" :
                  "bg-slate-900/40"
                }`}
                style={{
                  animation: currentTurn?.targetId === c.id && currentTurn.action === "ATTACK" ? "leagueShake 0.4s ease-in-out" : "none",
                }}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-[9px] font-semibold truncate ${c.hp <= 0 ? "text-slate-600 line-through" : "text-blue-300"}`}>{c.name}</p>
                    <HpBar hp={c.hp} maxHp={c.maxHp} side="A" />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {teamB.map(c => (
                <div key={c.id} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-all duration-300 ${
                  currentTurn?.actorId === c.id ? "bg-red-500/10 border border-red-500/30" :
                  currentTurn?.targetId === c.id ? "bg-blue-500/10 border border-blue-500/30" :
                  "bg-slate-900/40"
                }`}
                style={{
                  animation: currentTurn?.targetId === c.id && currentTurn.action === "ATTACK" ? "leagueShake 0.4s ease-in-out" : "none",
                }}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-[9px] font-semibold truncate ${c.hp <= 0 ? "text-slate-600 line-through" : "text-red-300"}`}>{c.name}</p>
                    <HpBar hp={c.hp} maxHp={c.maxHp} side="B" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current turn action */}
          <div className="mx-4 mb-3 rounded-xl border border-border bg-slate-900/60 px-3 py-2.5 text-center min-h-[56px] flex flex-col items-center justify-center">
            {currentTurn ? (
              <>
                <p className="text-[11px] text-slate-300">
                  <span className="font-bold text-[#FFCB05]">{currentTurn.actorName}</span>
                  {currentTurn.action === "ATTACK" ? " atacou " : " defendeu de "}
                  <span className="font-bold text-[#FFCB05]">{currentTurn.targetName}</span>
                </p>
                {currentTurn.action === "ATTACK" && (
                  <p className="text-[10px] text-slate-400">
                    <span className={`font-bold ${currentTurn.multiplier > 1 ? "text-green-400" : currentTurn.multiplier < 1 ? "text-red-400" : "text-slate-300"}`}>
                      -{currentTurn.damage} HP
                    </span>
                    {currentTurn.multiplier !== 1 && (
                      <span className="ml-1 text-[9px]">
                        ({currentTurn.multiplier > 1 ? "super efetivo" : "pouco efetivo"} {currentTurn.multiplier}x)
                      </span>
                    )}
                  </p>
                )}
                {currentTurn.effect && (
                  <p className="text-[9px] text-purple-300 mt-0.5">{currentTurn.effect}</p>
                )}
              </>
            ) : turnIdx >= replay.length ? (
              <p className="text-[11px] text-slate-400">Batalha encerrada!</p>
            ) : (
              <p className="text-[11px] text-slate-500">Preparando batalha...</p>
            )}
          </div>

          {/* Turn counter */}
          <div className="flex justify-center px-4 pb-4">
            <span className="text-[10px] text-slate-600">
              Turno {Math.max(0, turnIdx + 1)} / {replay.length}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
