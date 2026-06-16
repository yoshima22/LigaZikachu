"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock, Medal, Trophy, Zap } from "lucide-react";
import {
  adminStartRoundSelectionAction,
  adminExecuteRoundAction,
  adminStartTiebreakAction,
  selectRoundMascotsAction,
  adminFinalizeRoomAction,
} from "../combat-actions";
import { getSpriteUrl, getPokemonName } from "@/lib/mascot-data";
import { SyncBattleReplayModal } from "./sync-battle-replay";
import type { SyncReplayJson } from "./sync-battle-replay";

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
  modifier?: { name: string; description: string; effectJson: unknown } | null;
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
  damageTaken: number;
  survivingTotal: number;
  finalPosition: number | null;
  rewardGranted: boolean;
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

const ROOM_STATUS_LABEL: Record<string, string> = {
  FORMING: "Aguardando inscrições",
  VALIDATING: "Validando duplas",
  READY: "Salas prontas — aguardando início",
  ROUND_1: "🥊 Rodada 1 em andamento",
  ROUND_2: "🥊 Rodada 2 em andamento",
  ROUND_3: "🥊 Rodada 3 em andamento",
  TIEBREAK: "⚡ Desempate em andamento",
  FINISHED: "✅ Evento encerrado",
  CANCELLED: "❌ Cancelado",
};

// ── Componente principal ───────────────────────────────────────────────────────

export function SyncRoomPanel({ room, playerId, isAdmin, myLineupMascots }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<{ error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  };

  const myTeam = room.teams.find((t) => t.playerAId === playerId || t.playerBId === playerId);
  const allRoundsDone = room.rounds.filter((r) => r.roundNumber > 0).every((r) => r.status === "DONE");
  const hasTiebreak = room.rounds.some((r) => r.roundNumber === 0);

  // Duplas ordenadas por slot
  const sortedTeams = [...room.teams].sort((a, b) => (a.roomSlot ?? 0) - (b.roomSlot ?? 0));

  // Ranking ao vivo: agrupa scores por dupla (média ou soma por jogador da dupla)
  const ranking = buildRanking(room);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-slate-100">Arena {room.roomIndex}</h3>
          <p className="text-xs text-slate-400">{ROOM_STATUS_LABEL[room.status] ?? room.status}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && allRoundsDone && !hasTiebreak && room.status !== "FINISHED" && (
            <button
              disabled={pending}
              onClick={() => act(() => adminStartTiebreakAction(room.id))}
              className="inline-flex items-center gap-2 rounded-lg border border-purple-400/40 px-3 py-1.5 text-xs font-bold text-purple-200 disabled:opacity-50"
            >
              <Zap size={13} /> Iniciar desempate
            </button>
          )}
          {isAdmin && (room.status === "FINISHED" || allRoundsDone) && (
            <button
              disabled={pending}
              onClick={() => act(() => adminFinalizeRoomAction(room.id))}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
            >
              <Trophy size={13} /> Entregar recompensas
            </button>
          )}
        </div>
      </div>

      {/* Ranking ao vivo */}
      <RankingTable ranking={ranking} playerId={playerId} />

      {/* Rodadas */}
      {room.rounds
        .sort((a, b) => a.roundNumber - b.roundNumber)
        .map((round) => (
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

// ── Ranking ────────────────────────────────────────────────────────────────────

interface RankingEntry {
  teamId: string;
  teamName: string;
  wins: number;
  damageDone: number;
  damageTaken: number;
  finalPosition: number | null;
  rewardGranted: boolean;
  playerIds: string[];
}

function buildRanking(room: Room): RankingEntry[] {
  // Agrupa scores por dupla (2 jogadores por dupla, soma dano)
  const byTeam = new Map<string, RankingEntry>();
  for (const team of room.teams) {
    const teamName = `${team.playerA.displayName}${team.playerB ? ` + ${team.playerB.displayName}` : ""}`;
    byTeam.set(team.id, { teamId: team.id, teamName, wins: 0, damageDone: 0, damageTaken: 0, finalPosition: null, rewardGranted: false, playerIds: [team.playerAId, ...(team.playerBId ? [team.playerBId] : [])] });
  }
  for (const score of room.scores) {
    const entry = byTeam.get(score.teamId);
    if (!entry) continue;
    entry.wins = Math.max(entry.wins, score.wins); // mesmo valor para ambos os jogadores da dupla
    entry.damageDone += score.damageDone;
    entry.damageTaken += score.damageTaken;
    if (score.finalPosition) entry.finalPosition = score.finalPosition;
    if (score.rewardGranted) entry.rewardGranted = true;
  }
  return [...byTeam.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.damageDone !== a.damageDone) return b.damageDone - a.damageDone;
    return a.damageTaken - b.damageTaken;
  });
}

function RankingTable({ ranking, playerId }: { ranking: RankingEntry[]; playerId: string }) {
  const medals = ["🥇", "🥈", "🥉", "4️⃣"];
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-slate-950/60">
            <th className="py-2 px-3 text-left font-semibold text-slate-400">#</th>
            <th className="py-2 px-3 text-left font-semibold text-slate-400">Dupla</th>
            <th className="py-2 px-3 text-center font-semibold text-slate-400">V</th>
            <th className="py-2 px-3 text-center font-semibold text-slate-400">Dano</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((entry, i) => {
            const isMe = entry.playerIds.includes(playerId);
            return (
              <tr key={entry.teamId} className={`border-b border-border/40 ${isMe ? "bg-[#FFCB05]/5" : ""}`}>
                <td className="py-2 px-3 text-center">{medals[i] ?? `${i + 1}`}</td>
                <td className={`py-2 px-3 font-medium ${isMe ? "text-[#FFCB05]" : "text-slate-200"}`}>
                  {entry.teamName}
                  {entry.rewardGranted && <span className="ml-1 text-[#FFCB05]">✓</span>}
                </td>
                <td className="py-2 px-3 text-center font-bold text-slate-100">{entry.wins}</td>
                <td className="py-2 px-3 text-center text-slate-400">{entry.damageDone.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Modificador ────────────────────────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
  statForce: "Força",
  statAgility: "Agilidade",
  statVitality: "Vitalidade",
  statCharisma: "Carisma",
  statInstinct: "Instinto",
};

function parseModifierEffect(effectJson: unknown): string | null {
  if (!effectJson || typeof effectJson !== "object" || Array.isArray(effectJson)) return null;
  const ej = effectJson as Record<string, unknown>;
  if (ej.type === "STAT_BOOST" && typeof ej.value === "number") {
    const stat = typeof ej.targetStat === "string" ? STAT_LABELS[ej.targetStat] ?? ej.targetStat : null;
    const pct = Math.round(ej.value * 100);
    if (stat) return `+${pct}% em ${stat} para todos os mascotes desta rodada`;
    return `+${pct}% em todos os atributos`;
  }
  return null;
}

function ModifierBanner({ modifier }: { modifier: { name: string; description: string; effectJson: unknown } }) {
  const parsedEffect = parseModifierEffect(modifier.effectJson);
  return (
    <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-xs space-y-1.5">
      <p className="font-bold text-purple-200">⚡ Modificador ativo: {modifier.name}</p>
      <p className="text-purple-300">{modifier.description}</p>
      {parsedEffect && (
        <div className="flex items-start gap-1.5 rounded-md border border-purple-400/20 bg-purple-900/30 px-2 py-1.5">
          <span className="mt-0.5 text-purple-400">→</span>
          <span className="text-purple-100 font-semibold">{parsedEffect}</span>
        </div>
      )}
      <p className="text-purple-400/60 italic">Afeta: todos os mascotes escalados nos confrontos desta rodada</p>
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
  const roundLabel = round.roundNumber === 0 ? "⚡ Desempate" : `Rodada ${round.roundNumber}`;

  const statusColor: Record<string, string> = {
    PENDING: "text-slate-500",
    SELECTING: "text-amber-300",
    MODIFIER_DRAWN: "text-blue-300",
    EXECUTING: "text-orange-300",
    DONE: "text-green-400",
  };

  const statusText: Record<string, string> = {
    PENDING: "Aguardando",
    SELECTING: "Selecionando mascotes…",
    MODIFIER_DRAWN: "Modificador revelado",
    EXECUTING: "Executando combates…",
    DONE: "Concluída ✓",
  };

  return (
    <div className="rounded-xl border border-border bg-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-100">{roundLabel}</span>
          <span className={`text-xs ${statusColor[round.status] ?? "text-slate-500"}`}>
            {statusText[round.status] ?? round.status}
          </span>
        </div>
        <div className="flex gap-2">
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
              Executar
            </button>
          )}
        </div>
      </div>

      {/* Modificador */}
      {round.modifier && (
        <ModifierBanner modifier={round.modifier} />
      )}

      {/* Seleção ativa */}
      {round.status === "SELECTING" && myTeam && !mySelection && (
        <MascotSelector
          roundId={round.id}
          myTeamLineup={myTeam.lineups.filter((l) => l.playerId === playerId)}
          usedInPrevRounds={getUsedMascots(round, room, playerId)}
          onAct={onAct}
          pending={pending}
        />
      )}

      {/* Seleção confirmada */}
      {mySelection && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-xs space-y-2">
          <p className="font-semibold text-green-400 flex items-center gap-1">
            <CheckCircle2 size={13} />
            {mySelection.isAuto ? "Escalação automática do sistema" : "Sua escalação confirmada"}
          </p>
          <p className="text-slate-500">
            {mySelection.isAuto
              ? "O sistema escolheu automaticamente os 3 mascotes abaixo para representar você nesta rodada:"
              : "Os 3 mascotes abaixo foram escalados por você para este confronto:"}
          </p>
          <div className="flex gap-3 flex-wrap">
            {mySelection.mascotIds.map((mid, idx) => {
              const m = myLineupMascots.find((x) => x.id === mid);
              if (!m) return null;
              return (
                <div key={mid} className="flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-slate-600 uppercase">slot {idx + 1}</span>
                  <Image src={getSpriteUrl(m.pokemonId)} alt={m.nickname ?? getPokemonName(m.pokemonId)} width={44} height={44} className="pixelated" />
                  <span className="text-[10px] font-semibold text-slate-200 truncate w-12 text-center">
                    {m.nickname ?? getPokemonName(m.pokemonId)}
                  </span>
                  <span className="text-[9px] text-slate-500">Nv. {m.level}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aguardando seleção — já enviou mas rodada ainda aberta */}
      {round.status === "SELECTING" && mySelection && (
        <p className="text-xs text-slate-500">Aguardando outros jogadores e fechamento da rodada pelo admin…</p>
      )}

      {/* Resultados */}
      {round.matches.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Confrontos</p>
          {round.matches.map((match) => (
            <MatchResult key={match.id} match={match} room={room} modifier={round.modifier ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

function getUsedMascots(currentRound: Round, room: Room, playerId: string): Set<string> {
  const used = new Set<string>();
  for (const r of room.rounds) {
    if (r.roundNumber >= currentRound.roundNumber || r.roundNumber === 0) continue;
    for (const sel of r.selections) {
      if (sel.playerId === playerId) sel.mascotIds.forEach((id) => used.add(id));
    }
  }
  return used;
}

// ── Seletor de mascotes ────────────────────────────────────────────────────────

function MascotSelector({
  roundId, myTeamLineup, usedInPrevRounds, onAct, pending,
}: {
  roundId: string;
  myTeamLineup: Team["lineups"];
  usedInPrevRounds: Set<string>;
  onAct: (fn: () => Promise<{ error?: string }>) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  };

  const available = myTeamLineup.filter((l) => !usedInPrevRounds.has(l.mascotId));

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-3 space-y-3">
      <p className="text-xs font-semibold text-amber-200">
        Escolha 3 mascotes para esta rodada ({selected.length}/3)
      </p>
      {available.length === 0 && (
        <p className="text-xs text-slate-500">Todos os seus mascotes já foram usados. O sistema auto-selecionará.</p>
      )}
      <div className="grid grid-cols-5 gap-2">
        {myTeamLineup.map(({ mascot }) => {
          const used = usedInPrevRounds.has(mascot.id);
          const sel = selected.includes(mascot.id);
          return (
            <button
              key={mascot.id}
              type="button"
              disabled={used}
              onClick={() => toggle(mascot.id)}
              className={`flex flex-col items-center rounded-lg border p-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                sel ? "border-[#FFCB05] bg-[#FFCB05]/20" : "border-border bg-slate-950/60 hover:border-slate-500"
              }`}
            >
              <Image
                src={getSpriteUrl(mascot.pokemonId)}
                alt={mascot.nickname ?? `#${mascot.pokemonId}`}
                width={40}
                height={40}
                className="pixelated"
              />
              <span className="text-[10px] text-slate-400 truncate w-full text-center">
                {mascot.nickname ?? `Nv.${mascot.level}`}
              </span>
              {sel && <Lock size={10} className="text-[#FFCB05]" />}
              {used && <span className="text-[10px] text-red-400">usado</span>}
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

function MatchResult({ match, room, modifier }: { match: RoundMatch; room: Room; modifier: Round["modifier"] }) {
  const [showModal, setShowModal] = useState(false);
  const teamA = room.teams.find((t) => t.id === match.teamAId);
  const teamB = room.teams.find((t) => t.id === match.teamBId);
  if (!teamA || !teamB) return null;

  const nameA = `${teamA.playerA.displayName}${teamA.playerB ? ` + ${teamA.playerB.displayName}` : ""}`;
  const nameB = `${teamB.playerA.displayName}${teamB.playerB ? ` + ${teamB.playerB.displayName}` : ""}`;
  const winner = match.result === "TEAM_A_WIN" ? nameA : match.result === "TEAM_B_WIN" ? nameB : "Empate";

  const replay = match.replayJson as SyncReplayJson | null;
  const hasReplay = replay?.rounds && replay.rounds.length > 0;

  const modifierLabel = modifier ? parseModifierEffect(modifier.effectJson) : null;

  return (
    <>
      {showModal && hasReplay && (
        <SyncBattleReplayModal
          teamAName={nameA}
          teamBName={nameB}
          replay={replay!}
          modifierName={modifier?.name ?? null}
          modifierEffect={modifierLabel}
          onFinish={() => setShowModal(false)}
        />
      )}

      <div className="rounded-lg border border-border bg-slate-900 p-3 text-xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <p className="font-semibold text-slate-100">
            {nameA} <span className="text-slate-500">vs</span> {nameB}
          </p>
          {match.result && (
            <span className="font-bold text-green-400">
              <Medal size={11} className="inline mr-1" />
              {winner}
            </span>
          )}
        </div>
        {match.result && (
          <div className="flex gap-4 text-slate-400">
            <span>{nameA}: {match.teamADamage} dano · {match.survivingA} vivos</span>
            <span>{nameB}: {match.teamBDamage} dano · {match.survivingB} vivos</span>
          </div>
        )}
        {hasReplay && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/20"
          >
            ▶ Ver animação do combate
          </button>
        )}
      </div>
    </>
  );
}
