"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { getSpriteUrl, getPokemonName } from "@/lib/mascot-data";

export type TurnLog = {
  turn: number;
  actorId: string;
  actorName: string;
  actorOwnerId?: string | null;
  actorPokemonId?: number;
  targetId: string;
  targetName: string;
  targetOwnerId?: string | null;
  targetPokemonId?: number;
  action: "ATTACK" | "DEFEND";
  damage: number;
  multiplier: number;
  advantageApplied: boolean;
  actorRole?: string;
  targetRole?: string;
  effect?: string;
};

function buildCinematicReplay(replay: TurnLog[]) {
  // Cada entrada persistida corresponde a uma ação oficial. Não fragmentar nem
  // limitar: o replay deve sempre alcançar a última ação que decidiu o combate.
  return replay.map((turn, index) => ({ ...turn, turn: index + 1 }));
}

interface Fighter {
  id: string;
  name: string;
  pokemonId?: number;
  side: "A" | "B";
  maxHp: number;
  hp: number;
  role?: string;
}

function resolveName(name: string, pokemonId?: number) {
  if (name && !name.startsWith("#")) return name;
  if (pokemonId) return getPokemonName(pokemonId);
  return name;
}

function getGuardianAbsorption(turn: TurnLog) {
  const match = turn.effect?.match(/Guardião (.+?) absorveu (\d+) de dano\./i);
  if (!match) return null;
  return { guardianName: match[1], damage: Number(match[2]) };
}

function buildFighters(turns: TurnLog[], playerAId?: string, survivorsA = 0, survivorsB = 0): Fighter[] {
  const seen = new Map<string, Fighter>();

  // Use the match's playerAId to determine sides, not turn order
  let ownerA: string | null = playerAId ?? null;
  if (!ownerA) {
    for (const t of turns) { if (t.actorOwnerId) { ownerA = t.actorOwnerId; break; } }
  }

  function getSide(ownerId?: string | null): "A" | "B" {
    if (!ownerId || !ownerA) return "A";
    return ownerId === ownerA ? "A" : "B";
  }

  for (const t of turns) {
    if (!seen.has(t.actorId)) {
      seen.set(t.actorId, {
        id: t.actorId, name: resolveName(t.actorName, t.actorPokemonId),
        pokemonId: t.actorPokemonId, side: getSide(t.actorOwnerId),
        maxHp: 100, hp: 100, role: t.actorRole,
      });
    }
    if (!seen.has(t.targetId)) {
      seen.set(t.targetId, {
        id: t.targetId, name: resolveName(t.targetName, t.targetPokemonId),
        pokemonId: t.targetPokemonId, side: getSide(t.targetOwnerId),
        maxHp: 100, hp: 100, role: t.targetRole,
      });
    }
    if (t.actorPokemonId && !seen.get(t.actorId)!.pokemonId) seen.get(t.actorId)!.pokemonId = t.actorPokemonId;
    if (t.targetPokemonId && !seen.get(t.targetId)!.pokemonId) seen.get(t.targetId)!.pokemonId = t.targetPokemonId;
  }

  const damageTaken = new Map<string, number>();
  const lastActivity = new Map<string, number>();
  turns.forEach((turn, index) => {
    lastActivity.set(turn.actorId, index);
    lastActivity.set(turn.targetId, index);
    if (turn.action === "ATTACK") {
      damageTaken.set(turn.targetId, (damageTaken.get(turn.targetId) ?? 0) + turn.damage);
    }
    const absorption = getGuardianAbsorption(turn);
    if (absorption) {
      const guardian = [...seen.values()].find(fighter => fighter.name === absorption.guardianName);
      if (guardian) {
        damageTaken.set(guardian.id, (damageTaken.get(guardian.id) ?? 0) + absorption.damage);
      }
    }
  });
  const survivorIds = new Set<string>();
  for (const side of ["A", "B"] as const) {
    const count = side === "A" ? survivorsA : survivorsB;
    [...seen.values()]
      .filter(fighter => fighter.side === side)
      .sort((left, right) => (lastActivity.get(right.id) ?? -1) - (lastActivity.get(left.id) ?? -1))
      .slice(0, count)
      .forEach(fighter => survivorIds.add(fighter.id));
  }
  for (const fighter of seen.values()) {
    const received = damageTaken.get(fighter.id) ?? 0;
    fighter.maxHp = Math.max(1, received + (survivorIds.has(fighter.id) ? 100 : 0));
    fighter.hp = fighter.maxHp;
  }
  return [...seen.values()];
}

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color = pct > 50 ? "bg-green-500" : pct > 25 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FighterRow({ f, isActor, isTarget, isAttack }: { f: Fighter; isActor: boolean; isTarget: boolean; isAttack: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-all duration-300 ${
      isActor ? "bg-blue-500/10 ring-1 ring-blue-500/40" :
      isTarget && isAttack ? "bg-red-500/10 ring-1 ring-red-500/40" : ""
    }`}
    style={{ animation: isTarget && isAttack ? "leagueShake 0.4s ease" : isActor && isAttack ? "leagueAttack 0.5s ease" : "none" }}>
      {f.pokemonId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getSpriteUrl(f.pokemonId, true)}
          alt={f.name}
          className={`h-10 w-10 object-contain shrink-0 ${f.hp <= 0 ? "grayscale opacity-30" : ""} ${f.side === "B" ? "scale-x-[-1]" : ""}`}
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <div className={`h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-sm shrink-0 ${f.hp <= 0 ? "opacity-30" : ""}`}>
          {f.side === "A" ? "🔵" : "🔴"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className={`text-[11px] font-semibold truncate ${f.hp <= 0 ? "text-slate-600 line-through" : f.side === "A" ? "text-blue-300" : "text-red-300"}`}>{f.name}</p>
          {f.role && <span className="text-[9px] text-yellow-400 shrink-0 ml-1">{f.role}</span>}
        </div>
        <HpBar hp={f.hp} maxHp={f.maxHp} />
      </div>
    </div>
  );
}

export function LeagueBattleReplayModal({
  playerAName,
  playerBName,
  playerAId,
  winnerId,
  isDraw,
  replay,
  playerASurvivors = 0,
  playerBSurvivors = 0,
  orderSabotage,
  onFinish,
}: {
  playerAName: string;
  playerBName: string;
  playerAId?: string;
  winnerId?: string | null;
  isDraw?: boolean;
  replay: TurnLog[];
  playerASurvivors?: number;
  playerBSurvivors?: number;
  orderSabotage?: { affectedSlots: number[]; statMultiplier: number } | null;
  onFinish: () => void;
}) {
  const [turnIdx, setTurnIdx] = useState(-1);
  const [baseFighters, setBaseFighters] = useState<Fighter[]>([]);
  const [autoPlay, setAutoPlay] = useState(true);
  const [speed, setSpeed] = useState(1);
  const onFinishRef = useRef(onFinish);
  const cinematicReplay = useMemo(() => buildCinematicReplay(replay), [replay]);
  useEffect(() => { onFinishRef.current = onFinish; });

  useEffect(() => {
    setBaseFighters(buildFighters(cinematicReplay, playerAId, playerASurvivors, playerBSurvivors));
    setTurnIdx(-1);
  }, [cinematicReplay, playerAId, playerASurvivors, playerBSurvivors]);

  // Derive current HP state from baseFighters + all turns up to turnIdx
  const fighters = useMemo(() => {
    const state = baseFighters.map(f => ({ ...f }));
    for (let i = 0; i <= turnIdx && i < cinematicReplay.length; i++) {
      const t = cinematicReplay[i];
      if (t.action === "ATTACK") {
        const target = state.find(f => f.id === t.targetId);
        if (target) target.hp = Math.max(0, target.hp - t.damage);
      }
      const absorption = getGuardianAbsorption(t);
      if (absorption) {
        const guardian = state.find(fighter => fighter.name === absorption.guardianName);
        if (guardian) guardian.hp = Math.max(0, guardian.hp - absorption.damage);
      }
    }
    return state;
  }, [baseFighters, turnIdx, cinematicReplay]);

  const baseDelay = 2100;
  const delay = Math.round(baseDelay / speed);

  useEffect(() => {
    if (!autoPlay) return;
    if (turnIdx >= cinematicReplay.length) return;
    const t = setTimeout(() => setTurnIdx(prev => prev + 1), turnIdx < 0 ? 600 / speed : delay);
    return () => clearTimeout(t);
  }, [turnIdx, autoPlay, cinematicReplay, delay, speed]);

  const current = turnIdx >= 0 && turnIdx < cinematicReplay.length ? cinematicReplay[turnIdx] : null;
  const finished = turnIdx >= cinematicReplay.length;
  const progress = cinematicReplay.length > 0 ? Math.round(((turnIdx + 1) / cinematicReplay.length) * 100) : 0;

  const teamA = fighters.filter(c => c.side === "A");
  const teamB = fighters.filter(c => c.side === "B");
  const aliveA = teamA.filter(c => c.hp > 0).length;
  const aliveB = teamB.filter(c => c.hp > 0).length;

  // Use actual match result, not animated HP state
  const resultText = isDraw ? "Empate!"
    : winnerId === playerAId ? `${playerAName} venceu!`
    : winnerId ? `${playerBName} venceu!`
    : aliveA > aliveB ? `${playerAName} venceu!` : aliveB > aliveA ? `${playerBName} venceu!` : "Empate!";

  const resolvedActorName = current ? resolveName(current.actorName, current.actorPokemonId) : "";
  const resolvedTargetName = current ? resolveName(current.targetName, current.targetPokemonId) : "";

  return (
    <>
      <style>{`
        @keyframes leagueAttack { 0%,100%{transform:translateX(0)} 50%{transform:translateX(10px)} }
        @keyframes leagueShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" onClick={onFinish}>
        <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl border border-[#FFCB05]/30 bg-slate-950 shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <p className="text-sm font-bold uppercase tracking-widest text-[#FFCB05]">⚔️ Replay da Batalha</p>
            <div className="flex gap-1.5">
              <button onClick={() => setAutoPlay(!autoPlay)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-slate-400 hover:text-white">
                {autoPlay ? "⏸" : "▶"}
              </button>
              <button onClick={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  speed > 1 ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300" : "border-border text-slate-400 hover:text-white"
                }`}>
                {speed}×
              </button>
              <button onClick={onFinish} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-slate-400 hover:text-white">✕</button>
            </div>
          </div>

          {orderSabotage && (
            <div className="mx-5 mb-3 rounded-xl border border-red-500/45 bg-red-500/10 px-4 py-2 text-xs text-red-100">
              <p className="font-black uppercase tracking-wide text-red-200">Sabotagem ativa no replay</p>
              <p className="mt-0.5">
                Os slots {orderSabotage.affectedSlots.join(", ")} lutaram com -{Math.round((1 - orderSabotage.statMultiplier) * 100)}% nos atributos por efeito da Ordem da Trapaca.
              </p>
            </div>
          )}

          {/* Progress */}
          <div className="mx-5 mb-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-[#FFCB05] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Team headers */}
          <div className="mx-5 mb-3 flex justify-between text-sm font-bold">
            <span className="text-blue-300">{playerAName} ({aliveA}/{teamA.length})</span>
            <span className="text-xs text-slate-600">Turno {Math.max(0, turnIdx + 1)}/{cinematicReplay.length}</span>
            <span className="text-red-300">{playerBName} ({aliveB}/{teamB.length})</span>
          </div>

          {/* Fighter panels */}
          <div className="mx-5 grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1.5">
              {teamA.map(f => (
                <FighterRow key={f.id} f={f}
                  isActor={current?.actorId === f.id}
                  isTarget={current?.targetId === f.id}
                  isAttack={current?.action === "ATTACK"}
                />
              ))}
            </div>
            <div className="space-y-1.5">
              {teamB.map(f => (
                <FighterRow key={f.id} f={f}
                  isActor={current?.actorId === f.id}
                  isTarget={current?.targetId === f.id}
                  isAttack={current?.action === "ATTACK"}
                />
              ))}
            </div>
          </div>

          {/* Action text */}
          <div className="mx-5 mb-4 rounded-xl border border-border bg-slate-900/60 px-4 py-3 text-center min-h-[60px] flex flex-col items-center justify-center">
            {current ? (
              <>
                <p className="text-sm text-slate-300">
                  <span className="font-bold text-[#FFCB05]">{resolvedActorName}</span>
                  {current.action === "ATTACK" ? " atacou " : " defendeu "}
                  <span className="font-bold text-[#FFCB05]">{resolvedTargetName}</span>
                </p>
                {current.action === "ATTACK" && (
                  <p className="text-xs mt-0.5">
                    <span className="font-bold text-red-400">-{current.damage} HP</span>
                    {current.advantageApplied && <span className="ml-1.5 text-green-400 text-[10px]">Super efetivo! ×{current.multiplier.toFixed(1)}</span>}
                  </p>
                )}
                {current.effect && <p className="text-[10px] text-purple-300 mt-1">{current.effect}</p>}
              </>
            ) : finished ? (
              <div>
                <p className="text-lg font-bold text-[#FFCB05]">🏁 Batalha Encerrada!</p>
                <p className="text-xs text-slate-400 mt-1">{resultText}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Preparando batalha...</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 px-5 pb-5">
            <button onClick={() => { setAutoPlay(false); setTurnIdx(i => Math.max(-1, i - 1)); }} disabled={turnIdx <= 0}
              className="rounded-lg border border-border bg-slate-900 px-4 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30">← Anterior</button>
            <button onClick={() => { setAutoPlay(false); setTurnIdx(i => Math.min(cinematicReplay.length, i + 1)); }} disabled={finished}
              className="rounded-lg border border-border bg-slate-900 px-4 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30">Próximo →</button>
            <button onClick={() => { setAutoPlay(false); setTurnIdx(cinematicReplay.length); }}
              className="rounded-lg border border-border bg-slate-900 px-4 py-1.5 text-xs text-slate-400 hover:text-white">Pular</button>
          </div>
        </div>
      </div>
    </>
  );
}
