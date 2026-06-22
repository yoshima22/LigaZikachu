"use client";

import { useState, useEffect, useRef } from "react";
import { getSpriteUrl } from "@/lib/mascot-data";

export type TurnLog = {
  turn: number;
  actorId: string;
  actorName: string;
  actorPokemonId?: number;
  targetId: string;
  targetName: string;
  targetPokemonId?: number;
  action: "ATTACK" | "DEFEND";
  damage: number;
  multiplier: number;
  advantageApplied: boolean;
  actorRole?: string;
  targetRole?: string;
  effect?: string;
};

interface Fighter {
  id: string;
  name: string;
  pokemonId?: number;
  side: "A" | "B";
  maxHp: number;
  hp: number;
  role?: string;
}

function buildFighters(turns: TurnLog[]): Fighter[] {
  const seen = new Map<string, Fighter>();
  const sideA = new Set<string>();
  const sideB = new Set<string>();

  for (const t of turns) {
    for (const [id, name, pId, role] of [
      [t.actorId, t.actorName, t.actorPokemonId, t.actorRole],
      [t.targetId, t.targetName, t.targetPokemonId, t.targetRole],
    ] as Array<[string, string, number | undefined, string | undefined]>) {
      if (!seen.has(id)) {
        const side = sideA.size < 6 && !sideB.has(id) ? "A" as const : "B" as const;
        if (side === "A") sideA.add(id); else sideB.add(id);
        seen.set(id, { id, name, pokemonId: pId, side, maxHp: 100, hp: 100, role });
      } else if (pId && !seen.get(id)!.pokemonId) {
        seen.get(id)!.pokemonId = pId;
      }
    }
  }

  for (const t of turns) {
    const target = seen.get(t.targetId);
    if (target && t.action === "ATTACK") target.maxHp += t.damage;
  }
  for (const c of seen.values()) {
    if (c.maxHp <= 100) c.maxHp = 100;
    c.hp = c.maxHp;
  }
  return [...seen.values()];
}

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color = pct > 50 ? "bg-green-500" : pct > 25 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FighterRow({ f, isActor, isTarget, isAttack }: { f: Fighter; isActor: boolean; isTarget: boolean; isAttack: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-all duration-300 ${
      isActor ? "bg-blue-500/10 ring-1 ring-blue-500/40" :
      isTarget && isAttack ? "bg-red-500/10 ring-1 ring-red-500/40" :
      ""
    }`}
    style={{ animation: isTarget && isAttack ? "leagueShake 0.4s ease" : isActor && isAttack ? "leagueAttack 0.5s ease" : "none" }}>
      {f.pokemonId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getSpriteUrl(f.pokemonId, true)}
          alt={f.name}
          className={`h-8 w-8 object-contain shrink-0 ${f.hp <= 0 ? "grayscale opacity-30" : ""} ${f.side === "B" ? "scale-x-[-1]" : ""}`}
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <div className={`h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] shrink-0 ${f.hp <= 0 ? "opacity-30" : ""}`}>
          {f.side === "A" ? "🔵" : "🔴"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className={`text-[9px] font-semibold truncate ${f.hp <= 0 ? "text-slate-600 line-through" : f.side === "A" ? "text-blue-300" : "text-red-300"}`}>{f.name}</p>
          {f.role && <span className="text-[7px] text-yellow-400 shrink-0 ml-1">{f.role}</span>}
        </div>
        <HpBar hp={f.hp} maxHp={f.maxHp} />
      </div>
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
  replay: TurnLog[];
  onFinish: () => void;
}) {
  const [turnIdx, setTurnIdx] = useState(-1);
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [autoPlay, setAutoPlay] = useState(true);
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; });

  useEffect(() => {
    setFighters(buildFighters(replay));
    setTurnIdx(-1);
  }, [replay]);

  useEffect(() => {
    if (!autoPlay) return;
    if (turnIdx >= replay.length) {
      const t = setTimeout(() => onFinishRef.current(), 2000);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setTurnIdx(prev => {
        const next = prev + 1;
        if (next < replay.length) {
          const turn = replay[next];
          setFighters(prev => prev.map(c => {
            if (c.id === turn.targetId && turn.action === "ATTACK") {
              return { ...c, hp: Math.max(0, c.hp - turn.damage) };
            }
            return c;
          }));
        }
        return next;
      });
    }, turnIdx < 0 ? 800 : 1800);

    return () => clearTimeout(t);
  }, [turnIdx, autoPlay, replay]);

  const current = turnIdx >= 0 && turnIdx < replay.length ? replay[turnIdx] : null;
  const finished = turnIdx >= replay.length;
  const progress = replay.length > 0 ? Math.round(((turnIdx + 1) / replay.length) * 100) : 0;

  const teamA = fighters.filter(c => c.side === "A");
  const teamB = fighters.filter(c => c.side === "B");
  const aliveA = teamA.filter(c => c.hp > 0).length;
  const aliveB = teamB.filter(c => c.hp > 0).length;

  return (
    <>
      <style>{`
        @keyframes leagueAttack { 0%,100%{transform:translateX(0)} 50%{transform:translateX(8px)} }
        @keyframes leagueShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3" onClick={onFinish}>
        <div className="w-full max-w-lg rounded-2xl border border-[#FFCB05]/30 bg-slate-950 shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#FFCB05]">⚔️ Replay da Batalha</p>
            <div className="flex gap-2">
              <button onClick={() => setAutoPlay(!autoPlay)} className="rounded-lg border border-border px-2 py-1 text-[10px] text-slate-400 hover:text-white">
                {autoPlay ? "⏸" : "▶"}
              </button>
              <button onClick={onFinish} className="rounded-lg border border-border px-2 py-1 text-[10px] text-slate-400 hover:text-white">✕</button>
            </div>
          </div>

          {/* Progress */}
          <div className="mx-4 mb-2 h-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-1 rounded-full bg-[#FFCB05] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Team headers */}
          <div className="mx-4 mb-2 flex justify-between text-[10px] font-bold">
            <span className="text-blue-300">{playerAName} ({aliveA}/{teamA.length})</span>
            <span className="text-slate-600">Turno {Math.max(0, turnIdx + 1)}/{replay.length}</span>
            <span className="text-red-300">{playerBName} ({aliveB}/{teamB.length})</span>
          </div>

          {/* Fighter panels with sprites */}
          <div className="mx-4 grid grid-cols-2 gap-2 mb-2">
            <div className="space-y-1">
              {teamA.map(f => (
                <FighterRow key={f.id} f={f}
                  isActor={current?.actorId === f.id}
                  isTarget={current?.targetId === f.id}
                  isAttack={current?.action === "ATTACK"}
                />
              ))}
            </div>
            <div className="space-y-1">
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
          <div className="mx-4 mb-3 rounded-xl border border-border bg-slate-900/60 px-3 py-2.5 text-center min-h-[50px] flex flex-col items-center justify-center">
            {current ? (
              <>
                <p className="text-[11px] text-slate-300">
                  <span className="font-bold text-[#FFCB05]">{current.actorName}</span>
                  {current.action === "ATTACK" ? " atacou " : " defendeu "}
                  <span className="font-bold text-[#FFCB05]">{current.targetName}</span>
                </p>
                {current.action === "ATTACK" && (
                  <p className="text-[10px]">
                    <span className="font-bold text-red-400">-{current.damage} HP</span>
                    {current.advantageApplied && <span className="ml-1 text-green-400 text-[9px]">Super efetivo! ×{current.multiplier.toFixed(1)}</span>}
                  </p>
                )}
                {current.effect && <p className="text-[9px] text-purple-300 mt-0.5">{current.effect}</p>}
              </>
            ) : finished ? (
              <div>
                <p className="text-sm font-bold text-[#FFCB05]">🏁 Batalha Encerrada!</p>
                <p className="text-[10px] text-slate-400">{aliveA > aliveB ? playerAName : aliveB > aliveA ? playerBName : "Empate"} {aliveA !== aliveB ? "venceu!" : ""}</p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Preparando batalha...</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2 px-4 pb-4">
            <button onClick={() => { setAutoPlay(false); setTurnIdx(i => Math.max(-1, i - 1)); }} disabled={turnIdx <= 0}
              className="rounded-lg border border-border bg-slate-900 px-3 py-1 text-[10px] text-slate-400 disabled:opacity-30">←</button>
            <button onClick={() => { setAutoPlay(false); const next = turnIdx + 1; if (next < replay.length) { const t = replay[next]; setFighters(p => p.map(c => c.id === t.targetId && t.action === "ATTACK" ? { ...c, hp: Math.max(0, c.hp - t.damage) } : c)); } setTurnIdx(next); }} disabled={finished}
              className="rounded-lg border border-border bg-slate-900 px-3 py-1 text-[10px] text-slate-400 disabled:opacity-30">→</button>
            <button onClick={() => { setAutoPlay(false); setTurnIdx(replay.length); }} className="rounded-lg border border-border bg-slate-900 px-3 py-1 text-[10px] text-slate-400">Pular</button>
          </div>
        </div>
      </div>
    </>
  );
}
