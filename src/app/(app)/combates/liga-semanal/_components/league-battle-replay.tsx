"use client";

import { useState, useEffect, useRef } from "react";
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

function buildFighters(turns: TurnLog[]): Fighter[] {
  const seen = new Map<string, Fighter>();

  // First pass: determine which ownerId is "A" (first actor in turn 1)
  let ownerA: string | null = null;
  for (const t of turns) {
    if (t.actorOwnerId) { ownerA = t.actorOwnerId; break; }
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
  const [speed, setSpeed] = useState(1);
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; });

  useEffect(() => {
    setFighters(buildFighters(replay));
    setTurnIdx(-1);
  }, [replay]);

  const baseDelay = 1800;
  const delay = Math.round(baseDelay / speed);

  useEffect(() => {
    if (!autoPlay) return;
    if (turnIdx >= replay.length) return;

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
    }, turnIdx < 0 ? 600 / speed : delay);

    return () => clearTimeout(t);
  }, [turnIdx, autoPlay, replay, delay, speed]);

  const advanceTurn = () => {
    setAutoPlay(false);
    const next = turnIdx + 1;
    if (next < replay.length) {
      const t = replay[next];
      setFighters(p => p.map(c => c.id === t.targetId && t.action === "ATTACK" ? { ...c, hp: Math.max(0, c.hp - t.damage) } : c));
    }
    setTurnIdx(next);
  };

  const current = turnIdx >= 0 && turnIdx < replay.length ? replay[turnIdx] : null;
  const finished = turnIdx >= replay.length;
  const progress = replay.length > 0 ? Math.round(((turnIdx + 1) / replay.length) * 100) : 0;

  const teamA = fighters.filter(c => c.side === "A");
  const teamB = fighters.filter(c => c.side === "B");
  const aliveA = teamA.filter(c => c.hp > 0).length;
  const aliveB = teamB.filter(c => c.hp > 0).length;

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

          {/* Progress */}
          <div className="mx-5 mb-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-[#FFCB05] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Team headers */}
          <div className="mx-5 mb-3 flex justify-between text-sm font-bold">
            <span className="text-blue-300">{playerAName} ({aliveA}/{teamA.length})</span>
            <span className="text-xs text-slate-600">Turno {Math.max(0, turnIdx + 1)}/{replay.length}</span>
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
                <p className="text-xs text-slate-400 mt-1">
                  {aliveA > aliveB ? `${playerAName} venceu!` : aliveB > aliveA ? `${playerBName} venceu!` : "Empate!"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Preparando batalha...</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 px-5 pb-5">
            <button onClick={() => { setAutoPlay(false); setTurnIdx(i => Math.max(-1, i - 1)); }} disabled={turnIdx <= 0}
              className="rounded-lg border border-border bg-slate-900 px-4 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30">← Anterior</button>
            <button onClick={advanceTurn} disabled={finished}
              className="rounded-lg border border-border bg-slate-900 px-4 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30">Próximo →</button>
            <button onClick={() => { setAutoPlay(false); setTurnIdx(replay.length); }}
              className="rounded-lg border border-border bg-slate-900 px-4 py-1.5 text-xs text-slate-400 hover:text-white">Pular</button>
          </div>
        </div>
      </div>
    </>
  );
}
