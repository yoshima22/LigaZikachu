"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import {
  adminSimSetupAction,
  adminSimRoundAction,
  adminSimFinalizeAction,
  type SimRoundResult,
} from "../simulation-actions";
import { SyncBattleReplayModal, type SyncReplayJson } from "./sync-battle-replay";

type Phase = "idle" | "setup_done" | "round1_done" | "round2_done" | "round3_done" | "done";

interface MatchData {
  teamAName: string;
  teamBName: string;
  result: string;
  teamADamage: number;
  teamBDamage: number;
  survivingA: number;
  survivingB: number;
  replayJson: unknown;
}

interface RoundData {
  roundNumber: number;
  matches: MatchData[];
  ranking: NonNullable<SimRoundResult["ranking"]>;
}

const STEPS: { label: string; phase: Phase | "idle" }[] = [
  { label: "Setup", phase: "idle" },
  { label: "Rodada 1", phase: "setup_done" },
  { label: "Rodada 2", phase: "round1_done" },
  { label: "Rodada 3", phase: "round2_done" },
  { label: "Final", phase: "round3_done" },
];

function phaseIndex(phase: Phase): number {
  const map: Record<Phase, number> = {
    idle: 0,
    setup_done: 1,
    round1_done: 2,
    round2_done: 3,
    round3_done: 4,
    done: 5,
  };
  return map[phase];
}

function actionLabel(phase: Phase): string {
  switch (phase) {
    case "idle": return "Iniciar simulação";
    case "setup_done": return "Executar Rodada 1";
    case "round1_done": return "Executar Rodada 2";
    case "round2_done": return "Executar Rodada 3";
    case "round3_done": return "Finalizar";
    case "done": return "Concluído";
  }
}

export function SimulationButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Setup result
  const [setupLog, setSetupLog] = useState<string[]>([]);
  const [setupTeams, setSetupTeams] = useState<{ name: string; playerAName: string; playerBName: string }[]>([]);

  // Round results
  const [rounds, setRounds] = useState<RoundData[]>([]);

  // Final ranking
  const [finalRanking, setFinalRanking] = useState<{ position: number; teamName: string; wins: number }[]>([]);

  // Replay modal
  const [replayOpen, setReplayOpen] = useState(false);
  const [replayData, setReplayData] = useState<SyncReplayJson | null>(null);
  const [replayMatch, setReplayMatch] = useState<{ teamAName: string; teamBName: string } | null>(null);

  const run = () => {
    setError(null);
    startTransition(async () => {
      if (phase === "idle") {
        const result = await adminSimSetupAction();
        if (result.error) { setError(result.error); return; }
        setSetupLog(result.log ?? []);
        setSetupTeams(result.teams ?? []);
        setRoomId(result.roomId ?? null);
        setRounds([]);
        setPhase("setup_done");
        router.refresh();
        return;
      }

      if (!roomId) { setError("roomId ausente."); return; }

      if (phase === "setup_done" || phase === "round1_done" || phase === "round2_done") {
        const roundNumber = phase === "setup_done" ? 1 : phase === "round1_done" ? 2 : 3;
        const result = await adminSimRoundAction(roomId, roundNumber);
        if (result.error) { setError(result.error); return; }
        setRounds((prev) => [
          ...prev,
          {
            roundNumber,
            matches: result.matches ?? [],
            ranking: result.ranking ?? [],
          },
        ]);
        const next: Phase = roundNumber === 1 ? "round1_done" : roundNumber === 2 ? "round2_done" : "round3_done";
        setPhase(next);
        router.refresh();
        return;
      }

      if (phase === "round3_done") {
        const result = await adminSimFinalizeAction(roomId);
        if (result.error) { setError(result.error); return; }
        setFinalRanking(result.ranking ?? []);
        setPhase("done");
        router.refresh();
        return;
      }
    });
  };

  const openReplay = (match: MatchData) => {
    if (match.replayJson && typeof match.replayJson === "object") {
      setReplayData(match.replayJson as SyncReplayJson);
      setReplayMatch({ teamAName: match.teamAName, teamBName: match.teamBName });
      setReplayOpen(true);
    }
  };

  const currentIdx = phaseIndex(phase);
  const medals = ["🥇", "🥈", "🥉", "4️⃣"];

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="flex items-center gap-1 flex-wrap">
        {STEPS.map((step, idx) => {
          const active = idx === currentIdx;
          const done = idx < currentIdx;
          return (
            <div key={step.label} className="flex items-center gap-1">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                  active
                    ? "border-[#FFCB05]/60 bg-[#FFCB05]/20 text-[#FFCB05]"
                    : done
                    ? "border-green-500/40 bg-green-500/10 text-green-300"
                    : "border-slate-700 bg-slate-900 text-slate-500"
                }`}
              >
                {done ? "✓ " : ""}{step.label}
              </span>
              {idx < STEPS.length - 1 && <ChevronRight size={12} className="text-slate-600" />}
            </div>
          );
        })}
      </div>

      {/* Content area */}
      <div className="min-h-[60px]">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
            <p className="flex items-center gap-2 text-xs text-red-400">
              <XCircle size={13} /> {error}
            </p>
          </div>
        )}

        {phase === "setup_done" && setupLog.length > 0 && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-green-300">Setup concluído</p>
            <div className="space-y-0.5">
              {setupLog.map((line, i) => (
                <p key={i} className="text-xs font-mono text-slate-300">{line}</p>
              ))}
            </div>
            {setupTeams.length > 0 && (
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {setupTeams.map((team) => (
                  <div key={team.name} className="rounded-lg border border-border bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
                    <span className="font-semibold text-slate-100">{team.name}:</span>{" "}
                    {team.playerAName} + {team.playerBName}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(phase === "round1_done" || phase === "round2_done" || phase === "round3_done" || phase === "done") && rounds.length > 0 && (
          <div className="space-y-4">
            {rounds.map((round) => (
              <div key={round.roundNumber} className="rounded-xl border border-border bg-slate-950/40 p-3 space-y-3">
                <p className="text-xs font-semibold text-[#FFCB05]">Rodada {round.roundNumber}</p>
                <div className="space-y-2">
                  {round.matches.map((match, idx) => {
                    const aWon = match.result === "TEAM_A_WIN";
                    return (
                      <div key={idx} className="rounded-lg border border-border bg-slate-900 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`font-semibold ${aWon ? "text-green-300" : "text-slate-400"}`}>
                            {aWon ? "🏆 " : ""}{match.teamAName}
                          </span>
                          <span className="text-slate-500 text-[10px]">vs</span>
                          <span className={`font-semibold ${!aWon ? "text-green-300" : "text-slate-400"}`}>
                            {!aWon ? "🏆 " : ""}{match.teamBName}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-slate-500">
                          <span>Dano: {match.teamADamage}</span>
                          <button
                            onClick={() => openReplay(match)}
                            className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-[#FFCB05]/40 hover:text-[#FFCB05]"
                          >
                            ▶ Ver animação
                          </button>
                          <span>Dano: {match.teamBDamage}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {round.ranking.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-border bg-slate-950/60 text-slate-500">
                          <th className="p-1.5 text-left">#</th>
                          <th className="p-1.5 text-left">Dupla</th>
                          <th className="p-1.5 text-right">V</th>
                          <th className="p-1.5 text-right">Dano</th>
                        </tr>
                      </thead>
                      <tbody>
                        {round.ranking.map((row, idx) => (
                          <tr key={row.teamName} className="border-b border-border/50 last:border-0">
                            <td className="p-1.5">{medals[idx] ?? idx + 1}</td>
                            <td className="p-1.5 text-slate-200">{row.teamName}</td>
                            <td className="p-1.5 text-right text-slate-300">{row.wins}</td>
                            <td className="p-1.5 text-right text-slate-400">{row.damageDone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-4 space-y-3 mt-3">
            <p className="flex items-center gap-2 text-sm font-bold text-[#FFCB05]">
              <CheckCircle2 size={16} /> Evento finalizado!
            </p>
            {finalRanking.length > 0 && (
              <div className="space-y-1">
                {finalRanking.map((row) => (
                  <div key={row.teamName} className="flex items-center gap-2 text-xs">
                    <span className="text-base">{medals[row.position - 1] ?? row.position}</span>
                    <span className="text-slate-200 font-semibold">{row.teamName}</span>
                    <span className="ml-auto text-slate-400">{row.wins} vitória(s)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action button */}
      {phase !== "done" && (
        <button
          disabled={pending}
          onClick={run}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {pending ? "Aguarde…" : actionLabel(phase)}
        </button>
      )}

      {/* Replay modal */}
      {replayOpen && replayData && replayMatch && (
        <SyncBattleReplayModal
          teamAName={replayMatch.teamAName}
          teamBName={replayMatch.teamBName}
          replay={replayData}
          onFinish={() => setReplayOpen(false)}
        />
      )}
    </div>
  );
}
