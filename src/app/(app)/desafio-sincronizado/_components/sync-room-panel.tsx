"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock, Swords, Trophy } from "lucide-react";
import {
  adminStartRoundSelectionAction,
  adminExecuteRoundAction,
  selectRoundMascotsAction,
  adminFinalizeRoomAction,
} from "../combat-actions";
import { getSpriteUrl } from "@/lib/mascot-data";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface MascotSlim { id: string; pokemonId: number; nickname: string | null; level: number }

interface RoundSel {
  id: string;
  playerId: string;
  mascotIds: string[];
  isAuto: boolean;
}

interface RoundMatch {
  id: string;
  teamAId: string;
  teamBId: string;
  result: string | null;
  teamADamage: number;
  teamBDamage: number;
  survivingA: number;
  survivingB: number;
  replayJson: unknown;
}

interface Round {
  id: string;
  roundNumber: number;
  status: string;
  modifierId: string | null;
  scheduledAt: Date | string;
  modifier?: { name: string; description: string } | null;
  selections: RoundSel[];
  matches: RoundMatch[];
}

interface Score {
  id: string;
  playerId: string;
  teamId: string;
  wins: number;
  losses: number;
  draws: number;
  damageDone: number;
  finalPosition: number | null;
  player: { displayName: string };
}

interface Team {
  id: string;
  roomSlot: number | null;
  playerAId: string;
  playerBId: string | null;
  playerA: { id: string; displayName: string };
  playerB: { id: string; displayName: string } | null;
  lineups: { playerId: string; mascotId: string; slot: number; mascot: MascotSlim }[];
}

interface Room {
  id: string;
  roomIndex: number;
  status: string;
  teams: Team[];
  rounds: Round[];
  scores: Score[];
}

interface Props {
  room: Room;
  playerId: string;
  isAdmin: boolean;
  myLineupMascots: MascotSlim[];
}

// ── Componente principal ───────────────────────────────────────────────────────

export function SyncRoomPanel({ room, playerId, isAdmin, myLineupMascots }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const act = async (fn: () => Promise<{ error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  };

  const myTeam = room.teams.find((t) => t.playerAId === playerId || t.playerBId === playerId);
  const activeRound = room.rounds.find((r) => r.status === "SELECTING" || r.status === "MODIFIER_DRAWN" || r.status === "EXECUTING");

  const roomStatusLabel: Record<string, string> = {
    FORMING: "Aguardando inscrições",
    VALIDATING: "Validando duplas",
    READY: "Salas formadas — aguardando início",
    ROUND_1: "🥊 Rodada 1 em andamento",
    ROUND_2: "🥊 Rodada 2 em andamento",
    ROUND_3: "🥊 Rodada 3 em andamento",
    TIEBREAK: "⚡ Desempate",
    FINISHED: "✅ Evento encerrado",
    CANCELLED: "❌ Cancelado",
  };

  return (
    <div className="space-y-5">
      {/* Header da sala */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-100">Arena {room.roomIndex}</h3>
          <p className="text-xs text-slate-400">{roomStatusLabel[room.status] ?? room.status}</p>
        </div>
        {isAdmin && room.status === "FINISHED" && (
          <button
            disabled={pending}
            onClick={() => act(() => adminFinalizeRoomAction(room.id))}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            <Trophy size={14} /> Entregar recompensas
          </button>
        )}
      </div>

      {/* Duplas da sala */}
      <div className="grid grid-cols-2 gap-2">
        {room.teams.sort((a, b) => (a.roomSlot ?? 0) - (b.roomSlot ?? 0)).map((team) => {
          const score = room.scores.find((s) => s.teamId === team.id && s.playerId === team.playerAId);
          const isMyTeam = team.id === myTeam?.id;
          return (
            <div key={team.id} className={`rounded-xl border p-3 text-xs ${isMyTeam ? "border-[#FFCB05]/40 bg-[#FFCB05]/5" : "border-border bg-slate-950/60"}`}>
              <p className="font-semibold text-slate-100">
                {team.playerA.displayName}
                {team.playerB ? ` + ${team.playerB.displayName}` : ""}
              </p>
              <p className="mt-1 text-slate-400">Slot {team.roomSlot}</p>
              {score && (
                <p className="mt-1 font-bold text-[#FFCB05]">
                  {score.wins}V {score.losses}D {score.draws}E
                  {score.finalPosition ? ` — ${score.finalPosition}º` : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Rodadas */}
      {room.rounds.map((round) => (
        <RoundCard
          key={round.id}
          round={round}
          room={room}
          playerId={playerId}
          myTeam={myTeam ?? null}
          isAdmin={isAdmin}
          myLineupMascots={myLineupMascots}
          pending={pending}
          onAct={act}
        />
      ))}
    </div>
  );
}

// ── Rodada ─────────────────────────────────────────────────────────────────────

function RoundCard({
  round, room, playerId, myTeam, isAdmin, myLineupMascots, pending, onAct,
}: {
  round: Round;
  room: Room;
  playerId: string;
  myTeam: Team | null;
  isAdmin: boolean;
  myLineupMascots: MascotSlim[];
  pending: boolean;
  onAct: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const mySelection = round.selections.find((s) => s.playerId === playerId);
  const roundLabel = round.roundNumber === 0 ? "Desempate" : `Rodada ${round.roundNumber}`;
  const statusBadge: Record<string, string> = {
    PENDING: "text-slate-500",
    SELECTING: "text-amber-300",
    MODIFIER_DRAWN: "text-blue-300",
    EXECUTING: "text-orange-300",
    DONE: "text-green-400",
  };

  return (
    <div className="rounded-xl border border-border bg-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-100">{roundLabel}</span>
          <span className={`text-xs ${statusBadge[round.status] ?? "text-slate-500"}`}>
            {round.status === "PENDING" && "Aguardando"}
            {round.status === "SELECTING" && "Selecionando mascotes…"}
            {round.status === "MODIFIER_DRAWN" && "Modificador revelado"}
            {round.status === "EXECUTING" && "Executando…"}
            {round.status === "DONE" && "Concluída"}
          </span>
        </div>
        {isAdmin && round.status === "PENDING" && (
          <button
            disabled={pending}
            onClick={() => onAct(() => adminStartRoundSelectionAction(round.id))}
            className="rounded-lg border border-amber-400/40 px-3 py-1 text-xs font-bold text-amber-100 disabled:opacity-50"
          >
            Abrir seleção
          </button>
        )}
        {isAdmin && (round.status === "SELECTING" || round.status === "MODIFIER_DRAWN") && (
          <button
            disabled={pending}
            onClick={() => onAct(() => adminExecuteRoundAction(round.id))}
            className="rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
          >
            Executar combates
          </button>
        )}
      </div>

      {/* Modificador */}
      {round.modifier && (
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-xs text-purple-200">
          <p className="font-bold">⚡ Modificador: {round.modifier.name}</p>
          <p className="mt-1 text-purple-300">{round.modifier.description}</p>
        </div>
      )}

      {/* Seleção de mascotes (apenas se rodada ativa e jogador na sala) */}
      {round.status === "SELECTING" && myTeam && (
        <MascotSelector
          roundId={round.id}
          myTeamLineup={myTeam.lineups.filter((l) => l.playerId === playerId)}
          existingSelection={mySelection?.mascotIds ?? null}
          onAct={onAct}
          pending={pending}
        />
      )}

      {/* Seleção confirmada */}
      {mySelection && round.status !== "SELECTING" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-xs">
          <p className="font-semibold text-green-400 flex items-center gap-1">
            <CheckCircle2 size={13} />
            {mySelection.isAuto ? "Seleção automática" : "Sua seleção confirmada"}
          </p>
          <div className="mt-2 flex gap-2">
            {mySelection.mascotIds.map((mid) => {
              const m = myLineupMascots.find((x) => x.id === mid);
              if (!m) return null;
              return (
                <div key={mid} className="flex flex-col items-center">
                  <Image src={getSpriteUrl(m.pokemonId)} alt={m.nickname ?? `#${m.pokemonId}`} width={40} height={40} className="pixelated" />
                  <span className="text-[10px] text-slate-400">{m.nickname ?? `#${m.pokemonId}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resultados dos combates */}
      {round.matches.length > 0 && (
        <div className="space-y-2">
          {round.matches.map((match) => (
            <MatchResult key={match.id} match={match} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Seletor de mascotes ────────────────────────────────────────────────────────

function MascotSelector({
  roundId, myTeamLineup, existingSelection, onAct, pending,
}: {
  roundId: string;
  myTeamLineup: Team["lineups"];
  existingSelection: string[] | null;
  onAct: (fn: () => Promise<{ error?: string }>) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(existingSelection ?? []);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  };

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-3 space-y-3">
      <p className="text-xs font-semibold text-amber-200">Escolha 3 mascotes para esta rodada ({selected.length}/3)</p>
      <div className="grid grid-cols-5 gap-2">
        {myTeamLineup.map(({ mascot, slot }) => {
          const sel = selected.includes(mascot.id);
          return (
            <button
              key={mascot.id}
              type="button"
              onClick={() => toggle(mascot.id)}
              className={`flex flex-col items-center rounded-lg border p-1 transition-colors ${sel ? "border-[#FFCB05] bg-[#FFCB05]/20" : "border-border bg-slate-950/60 hover:border-slate-500"}`}
            >
              <Image src={getSpriteUrl(mascot.pokemonId)} alt={mascot.nickname ?? `#${mascot.pokemonId}`} width={40} height={40} className="pixelated" />
              <span className="text-[10px] text-slate-400 truncate w-full text-center">{mascot.nickname ?? `Nv.${mascot.level}`}</span>
              {sel && <Lock size={10} className="text-[#FFCB05]" />}
            </button>
          );
        })}
      </div>
      <button
        disabled={selected.length !== 3 || pending}
        onClick={() => onAct(() => selectRoundMascotsAction(roundId, selected))}
        className="w-full rounded-lg bg-[#FFCB05] py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
        Confirmar seleção
      </button>
    </div>
  );
}

// ── Resultado de uma partida ───────────────────────────────────────────────────

function MatchResult({ match, room }: { match: RoundMatch; room: Room }) {
  const [showReplay, setShowReplay] = useState(false);
  const teamA = room.teams.find((t) => t.id === match.teamAId);
  const teamB = room.teams.find((t) => t.id === match.teamBId);
  if (!teamA || !teamB) return null;

  const teamAName = `${teamA.playerA.displayName}${teamA.playerB ? ` + ${teamA.playerB.displayName}` : ""}`;
  const teamBName = `${teamB.playerA.displayName}${teamB.playerB ? ` + ${teamB.playerB.displayName}` : ""}`;

  const winner = match.result === "TEAM_A_WIN" ? teamAName : match.result === "TEAM_B_WIN" ? teamBName : "Empate";

  return (
    <div className="rounded-lg border border-border bg-slate-900 p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-100">{teamAName} <span className="text-slate-500">vs</span> {teamBName}</p>
        <span className={`font-bold ${match.result ? "text-green-400" : "text-slate-500"}`}>
          {match.result ? `Vencedor: ${winner}` : "Aguardando"}
        </span>
      </div>
      {match.result && (
        <div className="flex gap-4 text-slate-400">
          <span>🗡️ A: {match.teamADamage} dmg, {match.survivingA} vivos</span>
          <span>🗡️ B: {match.teamBDamage} dmg, {match.survivingB} vivos</span>
        </div>
      )}
      {match.replayJson != null && (
        <button onClick={() => setShowReplay((p) => !p)} className="text-cyan-400 underline">
          {showReplay ? "Ocultar replay" : "Ver replay"}
        </button>
      )}
      {showReplay && match.replayJson != null && (
        <pre className="rounded-lg border border-border bg-slate-950 p-2 text-[10px] text-slate-300 overflow-auto max-h-40">
          {JSON.stringify(match.replayJson as object, null, 2)}
        </pre>
      )}
    </div>
  );
}
