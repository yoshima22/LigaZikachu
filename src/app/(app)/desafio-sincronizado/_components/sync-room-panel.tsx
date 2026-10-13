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
import { getCombatRoleLabel } from "@/lib/combat-roles";
import { SyncCombatReplayModal, isStandardSyncReplay } from "./sync-battle-replay";
import type { AnySyncReplayJson, SyncReplayJson } from "./sync-battle-replay";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface MascotSlim {
  id: string; pokemonId: number; nickname: string | null; level: number;
  statForce?: number; statAgility?: number; statCharisma?: number; statInstinct?: number; statVitality?: number;
  megaEvolvedAt?: Date | string | null; megaEvolvedFromPokemonId?: number | null;
}
type LineupEntry = { playerId: string; mascotId: string; slot: number; combatRole?: string | null; mascot: MascotSlim };
const isMega = (m: MascotSlim) => Boolean(m.megaEvolvedAt || m.megaEvolvedFromPokemonId);
const statTotal = (m: MascotSlim) => (m.statForce ?? 0) + (m.statAgility ?? 0) + (m.statCharisma ?? 0) + (m.statInstinct ?? 0) + (m.statVitality ?? 0);

interface RoundSel {
  id: string;
  playerId: string;
  mascotIds: string[];
  isAuto: boolean;
}

interface RoundMatch {
  id: string;
  teamAId: string;
  teamBId: string | null;
  botName?: string | null;
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
  lineups: LineupEntry[];
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
          {isAdmin && room.status === "FINISHED" && (
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
        .sort((a, b) => (a.roundNumber === 0 ? 99 : a.roundNumber) - (b.roundNumber === 0 ? 99 : b.roundNumber))
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
    entry.damageDone = Math.max(entry.damageDone, score.damageDone);
    entry.damageTaken = Math.max(entry.damageTaken, score.damageTaken);
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

function parseModifierEffect(effectJson: unknown, modifierName?: string): string | null {
  if (!effectJson || typeof effectJson !== "object" || Array.isArray(effectJson)) return null;
  const ej = effectJson as Record<string, unknown>;
  if (ej.type === "GENERATION_STAT_BOOST") {
    const generation = typeof ej.selectedGeneration === "number" ? ej.selectedGeneration : null;
    const value = typeof ej.value === "number" ? ej.value : 30;
    if (generation) return `Geração ${generation} selecionada: +${value} em todos os status desses mascotes`;
    return `Geração sorteada: +${value} em todos os status dos mascotes elegíveis`;
  }
  if (ej.type === "STAT_BOOST" && typeof ej.value === "number") {
    const stat = typeof ej.targetStat === "string" ? STAT_LABELS[ej.targetStat] ?? ej.targetStat : null;
    const pct = Math.round(ej.value * 100);
    if (stat) return `+${pct}% em ${stat} para todos os mascotes desta rodada`;
    return `+${pct}% em todos os atributos`;
  }
  const messages: Record<string, string> = {
    TEAM_CHARISMA_SHIELD: "A maior soma de Carisma concede +20% de Vitalidade à dupla.",
    LOWEST_VITALITY_DEFENSE: "O menor valor de Vitalidade de cada dupla recebe +60 de Vitalidade.",
    FIRST_EVENT_USE_BOOST: "Mascotes em sua primeira participação recebem +15 em todos os status.",
    TEAM_AGILITY_PRIORITY: "A dupla com maior Agilidade total ganha prioridade de ação.",
    TEAM_TYPE_UNIQUE_BOOST: "A diversidade exigida de tipos concede bônus em todos os status.",
    TEAM_TYPE_REPEAT_PENALTY: "Repetir 3 ou mais tipos primários reduz todos os status em 10%.",
    LAST_MASCOT_VITALITY: "O último sobrevivente recebe Vitalidade e HP adicionais imediatamente.",
    INSTINCT_CHAOS: "Instinto aumenta simultaneamente o risco de erro e a chance de crítico.",
    LOWEST_LEVEL_PRIORITY: "O mascote de menor nível age primeiro; empate: menor status total.",
    MID_BATTLE_REROLL: "No meio da luta, um status de cada sobrevivente varia de -20 a +20.",
    SAME_TYPE_PLAYERS_PENALTY: "Tipos compartilhados entre os parceiros reduzem os status da dupla em 15%.",
    HIGH_LEVEL_LIMIT_SOFT: "Um mascote acima do Nv.30 por jogador atua normalmente; os excedentes são ajustados ao equivalente do Nv.30.",
    EQUIPPED_MASCOT_NERF: "O mascote companheiro pode entrar, mas luta com todos os status em 20.",
    LOWEST_TEAM_LEVEL_BOOST: "A menor soma de níveis recebe o bônus; empate: menor soma total de status.",
    REWARD_UNDERDOG_WIN: "O azarão é definido pela menor soma de níveis; empate: menor soma total de status.",
    REWARD_LOWEST_SCORE: "Apenas o menor placar individual recebe o item; empate: menor dano acumulado.",
  };
  if (typeof ej.type === "string" && messages[ej.type]) return messages[ej.type];
  if (ej.type === "DISPLAY_ONLY" && modifierName) {
    const legacyMessages: Record<string, string> = {
      "Carisma de Palco": messages.TEAM_CHARISMA_SHIELD,
      "Fraqueza Exposta": messages.LOWEST_VITALITY_DEFENSE,
      "Treino Relâmpago": messages.FIRST_EVENT_USE_BOOST,
      "Corrida de Agilidade": messages.TEAM_AGILITY_PRIORITY,
      "União Perfeita": messages.TEAM_TYPE_UNIQUE_BOOST,
      "Time Desajustado": messages.TEAM_TYPE_REPEAT_PENALTY,
      "Virada Final": messages.LAST_MASCOT_VITALITY,
      "Instinto Confuso": messages.INSTINCT_CHAOS,
      "Tática Invertida": messages.LOWEST_LEVEL_PRIORITY,
      "Pane na Arena": messages.MID_BATTLE_REROLL,
      "Dupla Desafinada": messages.SAME_TYPE_PLAYERS_PENALTY,
      "Harmonia Total": "Se os 6 tipos primários forem diferentes, a dupla recebe +15 em todos os status.",
      "Baixa Rotação": messages.HIGH_LEVEL_LIMIT_SOFT,
      "Sem Mascote Principal": messages.EQUIPPED_MASCOT_NERF,
    };
    return legacyMessages[modifierName] ?? null;
  }
  return null;
}

function ModifierBanner({ modifier }: { modifier: { name: string; description: string; effectJson: unknown } }) {
  const parsedEffect = parseModifierEffect(modifier.effectJson, modifier.name);
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
          modifierEffect={round.modifier?.effectJson}
          modifierName={round.modifier?.name}
          ally={(() => {
            const allyId = myTeam.playerAId === playerId ? myTeam.playerBId : myTeam.playerAId;
            if (!allyId) return null;
            const allyName = myTeam.playerA.id === allyId ? myTeam.playerA.displayName : myTeam.playerB?.displayName ?? "Aliado";
            const sel = round.selections.find((s) => s.playerId === allyId);
            const lineup = myTeam.lineups.filter((l) => l.playerId === allyId);
            return { name: allyName, selection: sel ?? null, lineup };
          })()}
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

const MAX_MEGAS_PER_ROUND = 1;

function MascotSelector({
  roundId, myTeamLineup, usedInPrevRounds, onAct, pending, modifierEffect, modifierName, ally,
}: {
  roundId: string;
  myTeamLineup: LineupEntry[];
  usedInPrevRounds: Set<string>;
  onAct: (fn: () => Promise<{ error?: string }>) => void;
  pending: boolean;
  modifierEffect?: unknown;
  modifierName?: string;
  ally?: { name: string; selection: RoundSel | null; lineup: LineupEntry[] } | null;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  };

  const available = myTeamLineup.filter((l) => !usedInPrevRounds.has(l.mascotId));
  const effect = modifierEffect && typeof modifierEffect === "object" && !Array.isArray(modifierEffect)
    ? modifierEffect as Record<string, unknown>
    : null;
  const selectedAbove30 = myTeamLineup.filter(({ mascot }) => selected.includes(mascot.id) && mascot.level > 30).length;

  // Regra "Divisão Limitada": no máximo 1 mega por rodada na escalação.
  const selectedMegas = myTeamLineup.filter((l) => selected.includes(l.mascotId) && isMega(l.mascot)).length;
  const megaBlocked = selectedMegas > MAX_MEGAS_PER_ROUND;
  const canConfirm = selected.length === 3 && !megaBlocked && !pending;
  const blockReason = selected.length !== 3
    ? `Selecione ${3 - selected.length} mascote(s).`
    : megaBlocked
      ? `Mais de ${MAX_MEGAS_PER_ROUND} mega na rodada (${selectedMegas}). Remova ${selectedMegas - MAX_MEGAS_PER_ROUND}.`
      : null;

  // Escolhas do aliado nesta rodada.
  const allyNameById = new Map((ally?.lineup ?? []).map((l) => [l.mascotId, l.mascot]));
  const allyPicks = (ally?.selection?.mascotIds ?? []).map((id) => allyNameById.get(id));

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-3 space-y-3">
      <p className="text-xs font-semibold text-amber-200">
        Escolha 3 mascotes para esta rodada ({selected.length}/3)
      </p>
      {(effect?.type === "HIGH_LEVEL_LIMIT_SOFT" || (effect?.type === "DISPLAY_ONLY" && modifierName === "Baixa Rotação")) && (
        <p className="rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1.5 text-[11px] text-blue-200">
          Baixa Rotação não bloqueia sua escalação: 1 mascote acima do Nv.30 atua normalmente; {Math.max(0, selectedAbove30 - 1)} excedente(s) selecionado(s) terá(ão) os status ajustados ao equivalente do Nv.30.
        </p>
      )}
      {available.length === 0 && (
        <p className="text-xs text-slate-500">Todos os seus mascotes já foram usados. O sistema auto-selecionará.</p>
      )}
      <div className="grid grid-cols-5 gap-2">
        {myTeamLineup.map(({ mascot, combatRole }) => {
          const used = usedInPrevRounds.has(mascot.id);
          const sel = selected.includes(mascot.id);
          const mega = isMega(mascot);
          return (
            <button
              key={mascot.id}
              type="button"
              disabled={used}
              onClick={() => toggle(mascot.id)}
              title={mega ? "Mega evolução" : undefined}
              className={`flex flex-col items-center rounded-lg border p-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                sel ? "border-[#FFCB05] bg-[#FFCB05]/20" : "border-border bg-slate-950/60 hover:border-slate-500"
              }`}
            >
              <div className="relative">
                <Image
                  src={getSpriteUrl(mascot.pokemonId)}
                  alt={mascot.nickname ?? `#${mascot.pokemonId}`}
                  width={40}
                  height={40}
                  className="pixelated"
                />
                {mega && <span className="absolute -right-1 -top-1 rounded bg-fuchsia-500/90 px-1 text-[7px] font-black text-white">M</span>}
              </div>
              <span className="text-[10px] text-slate-200 truncate w-full text-center">
                {mascot.nickname ?? getPokemonName(mascot.pokemonId)}
              </span>
              <span className="text-[9px] text-slate-500">Nv.{mascot.level} · {statTotal(mascot)} pts</span>
              {/* Status detalhados */}
              <span className="text-[8px] leading-tight text-slate-400 text-center">
                FOR {mascot.statForce ?? 0} · AGI {mascot.statAgility ?? 0} · VIT {mascot.statVitality ?? 0}
              </span>
              <span className="text-[8px] leading-tight text-slate-400 text-center">
                CAR {mascot.statCharisma ?? 0} · INS {mascot.statInstinct ?? 0}
              </span>
              <span className="mt-0.5 rounded bg-slate-800 px-1 text-[8px] font-semibold text-cyan-300">{getCombatRoleLabel(combatRole)}</span>
              {sel && <Lock size={10} className="mt-0.5 text-[#FFCB05]" />}
              {used && <span className="text-[10px] text-red-400">usado</span>}
            </button>
          );
        })}
      </div>

      {/* Escolhas do aliado */}
      {ally && (
        <div className="rounded-md border border-cyan-400/20 bg-cyan-500/5 px-2 py-1.5">
          <p className="text-[10px] font-bold text-cyan-200">Escolhas de {ally.name}</p>
          {ally.selection ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {ally.selection.isAuto && <span className="text-[9px] text-slate-500">(automática)</span>}
              {allyPicks.map((m, i) => (
                <span key={m?.id ?? i} className="flex items-center gap-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[9px] text-slate-200">
                  {m && <Image src={getSpriteUrl(m.pokemonId)} alt="" width={16} height={16} className="pixelated" />}
                  {m ? (m.nickname ?? getPokemonName(m.pokemonId)) : "?"}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-0.5 text-[10px] text-slate-500">{ally.name} ainda não escolheu os mascotes desta rodada.</p>
          )}
        </div>
      )}

      {blockReason && (
        <p className={`rounded-md border px-2 py-1.5 text-[11px] ${megaBlocked ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-slate-500/20 bg-slate-500/5 text-slate-400"}`}>
          {blockReason}
        </p>
      )}
      <button
        disabled={!canConfirm}
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
  const teamB = match.teamBId ? room.teams.find((t) => t.id === match.teamBId) : null;
  if (!teamA || (!teamB && !match.botName)) return null;

  const nameA = `${teamA.playerA.displayName}${teamA.playerB ? ` + ${teamA.playerB.displayName}` : ""}`;
  const nameB = teamB
    ? `${teamB.playerA.displayName}${teamB.playerB ? ` + ${teamB.playerB.displayName}` : ""}`
    : match.botName ?? "Bot Sincronizado";
  const winner = match.result === "TEAM_A_WIN" ? nameA : match.result === "TEAM_B_WIN" ? nameB : "Empate";

  const replay = match.replayJson as AnySyncReplayJson | null;
  const hasReplay = Boolean(replay && (isStandardSyncReplay(replay) ? replay.log.length > 0 : (replay as SyncReplayJson).rounds?.length > 0));

  const modifierLabel = modifier ? parseModifierEffect(modifier.effectJson, modifier.name) : null;

  return (
    <>
      {showModal && hasReplay && (
        <SyncCombatReplayModal
          teamAName={nameA}
          teamBName={nameB}
          teamAId={teamA.id}
          result={match.result}
          survivingA={match.survivingA}
          survivingB={match.survivingB}
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
