"use client";

import { useState, useEffect, useRef } from "react";
import { getSpriteUrl } from "@/lib/mascot-data";

export interface SyncReplaySlot {
  slot: number;
  nameA: string;
  nameB: string;
  pokemonIdA?: number;
  pokemonIdB?: number;
  scoreA: number;
  scoreB: number;
  winner: "A" | "B";
}

export interface SyncReplayJson {
  rounds: SyncReplaySlot[];
  modifierId?: string | null;
}

function ScoreBar({ score, max, side }: { score: number; max: number; side: "A" | "B" }) {
  const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-800 ${side === "B" ? "scale-x-[-1]" : ""}`}>
      <div
        className="h-full rounded-full bg-[#FFCB05] transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function FighterPanel({
  name,
  pokemonId,
  score,
  maxScore,
  side,
  phase,
  isWinner,
  revealed,
}: {
  name: string;
  pokemonId?: number;
  score: number;
  maxScore: number;
  side: "A" | "B";
  phase: "idle" | "fight" | "result";
  isWinner: boolean;
  revealed: boolean;
}) {
  const isA = side === "A";
  const lungeDir = isA ? "8px" : "-8px";
  const shakeAnim = `syncShake${isA ? "A" : "B"}`;

  return (
    <div className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all duration-300 ${
      phase === "result"
        ? isWinner
          ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 shadow-[0_0_18px_rgba(255,203,5,0.2)]"
          : "border-slate-800 bg-slate-950/40 opacity-40 grayscale"
        : phase === "fight"
          ? "border-[#FFCB05]/30 bg-slate-900/80"
          : "border-border/50 bg-slate-950/60"
    }`}>
      {pokemonId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getSpriteUrl(pokemonId, true)}
          alt=""
          className={`h-14 w-14 object-contain ${isA ? "" : "scale-x-[-1]"}`}
          style={{
            imageRendering: "pixelated",
            animation: phase === "fight"
              ? `syncLunge 0.5s ease-in-out`
              : phase === "result" && !isWinner
                ? `${shakeAnim} 0.4s ease-in-out`
                : "none",
            ["--lunge-dir" as string]: lungeDir,
          }}
        />
      ) : (
        <div className={`flex h-14 w-14 items-center justify-center rounded-full border border-border bg-slate-900 text-2xl ${isA ? "" : "scale-x-[-1]"}`}>
          🥊
        </div>
      )}
      <span className={`text-center text-[9px] font-semibold truncate max-w-full ${isA ? "text-blue-300" : "text-red-300"}`}>
        {name}
      </span>
      <ScoreBar score={revealed ? score : 0} max={maxScore} side={side} />
      <span className="text-[9px] text-slate-400 font-mono">
        {revealed ? score : "???"}
      </span>
    </div>
  );
}

export function SyncBattleReplayModal({
  teamAName,
  teamBName,
  replay,
  onFinish,
}: {
  teamAName: string;
  teamBName: string;
  replay: SyncReplayJson;
  onFinish: () => void;
}) {
  const slots = replay.rounds ?? [];
  const [slotIdx, setSlotIdx] = useState(0);
  const [phase, setPhase] = useState<"idle" | "fight" | "result">("idle");
  const [revealed, setRevealed] = useState(false);
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; });

  const maxScore = Math.max(...slots.flatMap((s) => [s.scoreA, s.scoreB]), 1);

  useEffect(() => {
    if (slotIdx >= slots.length) {
      const t = setTimeout(() => onFinishRef.current(), 600);
      return () => clearTimeout(t);
    }

    setPhase("idle");
    setRevealed(false);

    const t1 = setTimeout(() => setPhase("fight"), 400);
    const t2 = setTimeout(() => setRevealed(true), 900);
    const t3 = setTimeout(() => setPhase("result"), 1500);
    const t4 = setTimeout(() => setSlotIdx((i) => i + 1), 3000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [slotIdx, slots.length]);

  const current = slots[slotIdx] ?? null;
  const progress = slots.length > 0 ? Math.round((slotIdx / slots.length) * 100) : 100;

  return (
    <>
      <style>{`
        @keyframes syncLunge {
          0%,100%{transform:translateX(0) scaleX(var(--flip,1))}
          50%{transform:translateX(var(--lunge-dir,8px)) scaleX(var(--flip,1))}
        }
        @keyframes syncShakeA {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-6px)}
          50%{transform:translateX(6px)}
          80%{transform:translateX(-4px)}
        }
        @keyframes syncShakeB {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(6px)}
          50%{transform:translateX(-6px)}
          80%{transform:translateX(4px)}
        }
        @keyframes syncPulseGold {
          0%,100%{box-shadow:0 0 0 0 rgba(255,203,5,0)}
          50%{box-shadow:0 0 20px 4px rgba(255,203,5,0.3)}
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3">
        <div className="w-full max-w-lg rounded-2xl border border-[#FFCB05]/30 bg-slate-950 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#FFCB05]">
              ⚔️ Confronto em andamento…
            </p>
            <button
              type="button"
              onClick={() => onFinishRef.current()}
              className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] text-slate-400 hover:text-white"
            >
              Pular →
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
            <span className="text-blue-300">{teamAName}</span>
            <span className="text-slate-500">vs</span>
            <span className="text-red-300">{teamBName}</span>
          </div>

          {/* Fighter panels */}
          <div className="mx-4 grid grid-cols-[1fr_40px_1fr] items-center gap-2">
            {current ? (
              <>
                <FighterPanel
                  name={current.nameA}
                  pokemonId={current.pokemonIdA}
                  score={current.scoreA}
                  maxScore={maxScore}
                  side="A"
                  phase={phase}
                  isWinner={current.winner === "A"}
                  revealed={revealed}
                />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-slate-600">slot {current.slot}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-slate-900 text-base">
                    {phase === "result"
                      ? current.winner === "A" ? "←" : "→"
                      : phase === "fight" ? "⚡" : "🎯"}
                  </div>
                </div>
                <FighterPanel
                  name={current.nameB}
                  pokemonId={current.pokemonIdB}
                  score={current.scoreB}
                  maxScore={maxScore}
                  side="B"
                  phase={phase}
                  isWinner={current.winner === "B"}
                  revealed={revealed}
                />
              </>
            ) : (
              <div className="col-span-3 py-4 text-center text-xs text-slate-500">Calculando…</div>
            )}
          </div>

          {/* Action text */}
          <div className="mx-4 mt-3 rounded-xl border border-border bg-slate-900/60 px-3 py-2 text-center">
            {current && phase === "result" ? (
              <p className="text-[11px] text-slate-300">
                <span className={current.winner === "A" ? "font-bold text-blue-300" : "font-bold text-red-300"}>
                  {current.winner === "A" ? current.nameA : current.nameB}
                </span>
                {" venceu o slot "}
                <span className="font-bold text-[#FFCB05]">{current.slot}</span>
                {" "}
                <span className="text-slate-500">
                  ({current.scoreA} × {current.scoreB})
                </span>
              </p>
            ) : current && phase === "fight" ? (
              <p className="text-[11px] text-slate-400">
                {current.nameA} <span className="text-slate-600">vs</span> {current.nameB} — avaliando…
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">Preparando slot {(slotIdx + 1)}…</p>
            )}
          </div>

          {/* Slot dots */}
          <div className="flex justify-center gap-2 px-4 py-3">
            {slots.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  i === slotIdx
                    ? "h-2 w-4 bg-[#FFCB05]"
                    : i < slotIdx
                      ? "h-2 w-2 bg-slate-600"
                      : "h-2 w-2 bg-slate-800"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
