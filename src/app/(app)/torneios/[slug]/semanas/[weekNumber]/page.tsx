import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import type { WeekMode } from "@/components/ui/poke/week-mode-badge";
import Link from "next/link";
import { ChevronRight, CalendarDays, Clock, Crown, Eye, Info, Lock, Swords } from "lucide-react";
import { computeTournamentWeekTopOfDay } from "@/lib/ranking";
import {
  canSubmitTournamentWeekDeck,
  canViewTournamentWeekDecklist,
  getDeckVisibilityState
} from "@/lib/decks";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { DeckSubmissionForm } from "./_components/deck-submission-form";
import { CopyDeckButton } from "@/components/ui/copy-deck-button";
import { applyTournamentWeekBonus, setTournamentWeekTeam, updateTournamentWeekSettings } from "../../../actions";
import { NarrativePanel } from "./_components/narrative-panel";
import { BulkConfirmButton } from "./_components/bulk-confirm-button";

export const dynamic = "force-dynamic";

export default async function WeekDetailPage({
  params
}: {
  params: Promise<{ slug: string; weekNumber: string }>;
}) {
  const { slug, weekNumber } = await params;
  const user = await getSessionUser();
  const admin = user ? isAdmin(user.role) : false;
  const weekNum = parseInt(weekNumber, 10);
  if (isNaN(weekNum)) notFound();

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true, seasonId: true, format: true, createdById: true }
  });
  if (!tournament) notFound();
  const canManage = admin || (user && tournament.createdById === user.id);
  if (!canManage && tournament.status === "DRAFT") notFound();
  const isInPerson = tournament.format === "IN_PERSON";

  const week = await prisma.tournamentWeek.findUnique({
    where: { tournamentId_weekNumber: { tournamentId: tournament.id, weekNumber: weekNum } },
    include: {
      deckSubmissions: {
        include: {
          player: { select: { id: true, displayName: true, ptcglNick: true } }
        },
        orderBy: [{ player: { displayName: "asc" } }, { deckNumber: "asc" }]
      },
      matches: {
        where: { isBye: false, playerBId: { not: null } },
        select: {
          id: true,
          playerAId: true,
          playerBId: true,
          playerADeckSubmissionId: true,
          playerBDeckSubmissionId: true,
          playerA: { select: { id: true, displayName: true } },
          playerB: { select: { id: true, displayName: true } },
        }
      }
    }
  });
  if (!week) notFound();

  const player = user
    ? await prisma.player.findUnique({
        where: { userId: user.id },
        select: { id: true }
      })
    : null;
  const registration = player
    ? await prisma.tournamentRegistration.findUnique({
        where: {
          tournamentId_playerId: {
            tournamentId: tournament.id,
            playerId: player.id
          }
        },
        select: { status: true }
      })
    : null;

  // ── Mapa submissionId → nomes dos adversários ────────────────────────────────
  // Permite mostrar "vs Fulano" nos chips e filtrar decks não vinculados a partidas.
  const submissionOpponents = new Map<string, string[]>();
  for (const m of week.matches) {
    if (m.playerADeckSubmissionId && m.playerB) {
      const list = submissionOpponents.get(m.playerADeckSubmissionId) ?? [];
      if (!list.includes(m.playerB.displayName)) list.push(m.playerB.displayName);
      submissionOpponents.set(m.playerADeckSubmissionId, list);
    }
    if (m.playerBDeckSubmissionId && m.playerA) {
      const list = submissionOpponents.get(m.playerBDeckSubmissionId) ?? [];
      if (!list.includes(m.playerA.displayName)) list.push(m.playerA.displayName);
      submissionOpponents.set(m.playerBDeckSubmissionId, list);
    }
  }

  const topDoDiaRanking = await computeTournamentWeekTopOfDay(week.id);
  const deckVisibility = getDeckVisibilityState(week);

  // Sempre exibe no fuso do Brasil (BRT = UTC-3 / America/Sao_Paulo)
  const fmt = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "-";

  const bonusRule =
    week.bonusRule && typeof week.bonusRule === "object"
      ? (week.bonusRule as Record<string, unknown>)
      : null;

  const deckSlots = Math.min(
    Math.max(Number(bonusRule?.decksToSubmit ?? 1), 1),
    3
  );
  // Decks do jogador atual — apenas os vinculados a partidas, agrupados por conteúdo
  // (lida com duplicatas legadas: mesmo deck em múltiplas submissions → um único chip)
  type DeckChip = {
    id: string; deckNumber: number; deckName: string;
    archetype: string | null; deckList: string; opponents: string[];
  };
  const currentPlayerDecks = (() => {
    if (!player) return [] as DeckChip[];
    const byContent = new Map<string, DeckChip>();
    for (const sub of week.deckSubmissions) {
      if (sub.playerId !== player.id) continue;
      const opponents = submissionOpponents.get(sub.id) ?? [];
      if (opponents.length === 0) continue; // não vinculado a nenhuma partida
      const key = sub.deckList.trim();
      if (byContent.has(key)) {
        // Mescla adversários de duplicatas legadas
        const entry = byContent.get(key)!;
        for (const opp of opponents) {
          if (!entry.opponents.includes(opp)) entry.opponents.push(opp);
        }
      } else {
        byContent.set(key, {
          id: sub.id, deckNumber: sub.deckNumber, deckName: sub.deckName,
          archetype: sub.archetype, deckList: sub.deckList, opponents,
        });
      }
    }
    return Array.from(byContent.values());
  })();

  const savedDecks = player
    ? await prisma.savedDeck.findMany({
        where: { playerId: player.id },
        select: { id: true, name: true, archetype: true, deckList: true },
        orderBy: { updatedAt: "desc" }
      })
    : [];
  const canSubmitDeck =
    !!user &&
    !!player &&
    canSubmitTournamentWeekDeck({
      viewerRole: user.role,
      registrationStatus: registration?.status ?? null,
      week
    });
  // Decks visíveis na lista pública:
  // - Apenas submissions vinculadas a pelo menos uma partida
  // - Deduplica por (playerId + conteúdo) para evitar cópias legadas
  // - Agrega adversários para exibir "vs Fulano, Beltrano"
  type VisibleDeck = typeof week.deckSubmissions[number] & { opponents: string[] };
  const visibleDecks = (() => {
    if (!user) return [] as VisibleDeck[];
    const seen = new Map<string, VisibleDeck>();
    for (const sub of week.deckSubmissions) {
      if (!canViewTournamentWeekDecklist({
        viewerRole: user.role,
        isOwner: sub.playerId === player?.id,
        registrationStatus: registration?.status ?? null,
        week
      })) continue;
      const opponents = submissionOpponents.get(sub.id) ?? [];
      if (opponents.length === 0) continue; // descarta submissions sem partida vinculada
      const key = `${sub.playerId}::${sub.deckList.trim()}`;
      if (seen.has(key)) {
        const entry = seen.get(key)!;
        for (const opp of opponents) {
          if (!entry.opponents.includes(opp)) entry.opponents.push(opp);
        }
      } else {
        seen.set(key, { ...sub, opponents });
      }
    }
    return Array.from(seen.values());
  })();
  const approvedPlayers = admin
    ? await prisma.tournamentRegistration.findMany({
        where: { tournamentId: tournament.id, status: "APPROVED" },
        include: { player: { select: { id: true, displayName: true } } },
        orderBy: { player: { displayName: "asc" } }
      })
    : [];

  const positionBonus: Array<Record<string, unknown>> | null =
    bonusRule && Array.isArray(bonusRule.positionBonus)
      ? (bonusRule.positionBonus as Array<Record<string, unknown>>)
      : null;
  const teamAssignments =
    bonusRule && Array.isArray(bonusRule.teamAssignments)
      ? (bonusRule.teamAssignments as Array<Record<string, unknown>>)
      : [];
  const teamAssignmentsByPlayer = new Map(
    teamAssignments
      .map((assignment) => [
        String(assignment.playerId ?? ""),
        {
          playerId: String(assignment.playerId ?? ""),
          playerName: String(assignment.playerName ?? ""),
          teamName: String(assignment.teamName ?? "")
        }
      ] as const)
      .filter(([, assignment]) => assignment.playerId && assignment.teamName)
  );
  const rankingByPlayer = new Map(topDoDiaRanking.map((entry) => [entry.playerId, entry] as const));
  const manualBonuses =
    bonusRule && Array.isArray(bonusRule.manualBonuses)
      ? (bonusRule.manualBonuses as Array<Record<string, unknown>>)
      : [];

  type TeamMemberStat = {
    playerId: string; playerName: string; matchesPlayed: number;
    wins: number; losses: number; draws: number; points: number; defendedPrizes: number;
  };
  type TeamStat = {
    teamName: string; members: TeamMemberStat[]; playedCount: number; matchesPlayed: number;
    wins: number; losses: number; draws: number; points: number; defendedPrizes: number;
  };
  // Média do time = (vitórias × 3 + prêmios defendidos) / partidas jogadas pelo time.
  // O denominador é a PARTIDA, não o número de jogadores: mesma fórmula do Top do Dia,
  // e quem foi escalado mas ainda não jogou aparece no elenco sem distorcer a média.
  const teamStats = Array.from(
    Array.from(teamAssignmentsByPlayer.values())
      .reduce((map, assignment) => {
        const entry = rankingByPlayer.get(assignment.playerId);
        const current = map.get(assignment.teamName) ?? {
          teamName: assignment.teamName, members: [], playedCount: 0, matchesPlayed: 0,
          wins: 0, losses: 0, draws: 0, points: 0, defendedPrizes: 0
        };
        current.members.push({
          playerId: assignment.playerId,
          playerName: entry?.displayName ?? assignment.playerName,
          matchesPlayed: entry?.matchesPlayed ?? 0,
          wins: entry?.wins ?? 0,
          losses: entry?.losses ?? 0,
          draws: entry?.draws ?? 0,
          points: entry?.points ?? 0,
          defendedPrizes: entry?.defendedPrizes ?? 0
        });
        if (entry && entry.matchesPlayed > 0) {
          current.playedCount += 1;
          current.matchesPlayed += entry.matchesPlayed;
          current.wins += entry.wins;
          current.losses += entry.losses;
          current.draws += entry.draws;
          current.points += entry.points;
          current.defendedPrizes += entry.defendedPrizes;
        }
        map.set(assignment.teamName, current);
        return map;
      }, new Map<string, TeamStat>())
      .values()
  )
    .map((stats) => ({
      ...stats,
      members: [...stats.members].sort((a, b) => b.points - a.points || b.wins - a.wins || a.playerName.localeCompare(b.playerName, "pt-BR")),
      // criterio de ordenacao (mesmo do Top do Dia); nao e exibido porque mistura
      // duas escalas: vitorias (x3) + premios (0-6 por partida)
      averageScore: stats.matchesPlayed > 0 ? (stats.wins * 3 + stats.defendedPrizes) / stats.matchesPlayed : 0,
      winRate: stats.matchesPlayed > 0 ? stats.wins / stats.matchesPlayed : 0,
      averagePrizes: stats.matchesPlayed > 0 ? stats.defendedPrizes / stats.matchesPlayed : 0
    }))
    .sort((a, b) => b.averageScore - a.averageScore || b.wins - a.wins || b.defendedPrizes - a.defendedPrizes || a.teamName.localeCompare(b.teamName, "pt-BR"));

  const championTeam = teamStats[0] && teamStats[0].matchesPlayed > 0 ? teamStats[0] : null;
  const championIsTied = Boolean(
    championTeam && teamStats[1] &&
      teamStats[1].averageScore === championTeam.averageScore &&
      teamStats[1].wins === championTeam.wins &&
      teamStats[1].defendedPrizes === championTeam.defendedPrizes
  );

  const statusConfig: Record<string, { label: string; cls: string }> = {
    PLANNED: { label: "Planejada", cls: "border-slate-500/30 bg-slate-500/10 text-slate-400" },
    OPEN: { label: "Aberta", cls: "border-[#7AC74C]/40 bg-[#7AC74C]/10 text-[#7AC74C]" },
    LOCKED: { label: "Bloqueada", cls: "border-[#F7D02C]/40 bg-[#F7D02C]/10 text-[#F7D02C]" },
    CLOSED: { label: "Encerrada", cls: "border-[#6390F0]/40 bg-[#6390F0]/10 text-[#6390F0]" }
  };
  const sc = statusConfig[week.status] ?? statusConfig.PLANNED;

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Link href="/torneios" className="transition-colors hover:text-slate-300">Torneios</Link>
        <ChevronRight size={12} />
        <Link href={`/torneios/${slug}`} className="transition-colors hover:text-slate-300">
          {tournament.name}
        </Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Semana {week.weekNumber}</span>
      </nav>

      <div className="rounded-2xl border border-border bg-slate-950/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Semana {week.weekNumber}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${sc.cls}`}>
                {sc.label}
              </span>
            </div>
            <h1 className="font-pixel text-base leading-snug text-white">
              {week.label ?? `Semana ${week.weekNumber}`}
            </h1>
          </div>
          <WeekModeBadge mode={week.mode as WeekMode} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border bg-slate-950/50 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-200">
            <CalendarDays size={16} className="text-[#FFCB05]" />
            Datas
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="mb-0.5 text-xs text-slate-500">Inicio</dt>
              <dd className="capitalize text-slate-200">{fmt(week.startDate)}</dd>
            </div>
            <div>
              <dt className="mb-0.5 text-xs text-slate-500">Fim</dt>
              <dd className="capitalize text-slate-200">{fmt(week.endDate)}</dd>
            </div>
            {week.lockAt && (
              <div>
                <dt className="mb-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={11} /> Bloqueio de resultados
                </dt>
                <dd className="capitalize text-slate-200">{fmt(week.lockAt)}</dd>
              </div>
            )}
            <div>
              <dt className="mb-0.5 flex items-center gap-1 text-xs text-slate-500">
                <Clock size={11} /> Fechamento de decklists
              </dt>
              <dd className="capitalize text-slate-200">{fmt(deckVisibility.deadline)}</dd>
              <p className="mt-1 text-xs text-slate-500">{deckVisibility.label}</p>
            </div>
          </dl>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-slate-950/50 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-200">
            <Info size={16} className="text-[#FFCB05]" />
            Regras do Modo
          </h2>
          {bonusRule ? (
            <div className="space-y-2 text-sm text-slate-300">
              {!!bonusRule.description && (
                <p className="text-slate-400">{String(bonusRule.description)}</p>
              )}
              {Number(week.multiplier) !== 1 && (
                <div className="flex items-center gap-2 rounded-lg border border-[#F7D02C]/20 bg-[#F7D02C]/5 px-3 py-2">
                  <span className="font-bold text-[#F7D02C]">{Number(week.multiplier)}x</span>
                  <span className="text-xs text-slate-400">multiplicador de pontos</span>
                </div>
              )}
              {!!bonusRule.extraPointsPerWin && (
                <div className="flex items-center gap-2 rounded-lg border border-[#7AC74C]/20 bg-[#7AC74C]/5 px-3 py-2">
                  <span className="font-bold text-[#7AC74C]">+{String(bonusRule.extraPointsPerWin)}pt</span>
                  <span className="text-xs text-slate-400">bonus por vitoria</span>
                </div>
              )}
              {!!bonusRule.winnerTeamBonus && (
                <div className="flex items-center gap-2 rounded-lg border border-[#EE8130]/20 bg-[#EE8130]/5 px-3 py-2">
                  <span className="font-bold text-[#EE8130]">+{String(bonusRule.winnerTeamBonus)}pt</span>
                  <span className="text-xs text-slate-400">bonus para o time vencedor</span>
                </div>
              )}
              {!!bonusRule.decksToSubmit && (
                <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                  Envie {String(bonusRule.decksToSubmit)} decks antes do prazo. O adversario escolhe qual voce usa.
                </div>
              )}
              {week.mode === "BATALHA_FINAL" && positionBonus && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">Bonus por posicao:</p>
                  {positionBonus.map((pb) => {
                    const positionsRaw = Array.isArray(pb.positions) ? pb.positions : [];
                    const positions: unknown[] = positionsRaw;
                    const bonusPerWin = typeof pb.bonusPerWin === "number" ? pb.bonusPerWin : 0;
                    const first = typeof positions[0] === "number" ? positions[0] : 0;
                    const last = typeof positions[positions.length - 1] === "number" ? positions[positions.length - 1] : first;
                    const firstNum = typeof first === "number" ? first : 0;
                    const lastNum = typeof last === "number" ? last : firstNum;
                    return (
                      <div key={String(firstNum)} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-slate-300">
                          {firstNum}-{lastNum}
                        </span>
                        <span className="text-slate-500">-&gt;</span>
                        <span className="font-semibold text-[#FFCB05]">+{bonusPerWin}pt/vitoria</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Formato padrao, sem restricoes especiais.
            </p>
          )}
          {week.notes && (
            <p className="border-t border-border pt-3 text-xs text-slate-500 whitespace-pre-line leading-relaxed">
              {week.notes}
            </p>
          )}
          {admin && (
            <form
              className="border-t border-border pt-3"
              action={async (formData) => {
                "use server";
                // Passa apenas strings simples para evitar problemas de serialização
                // do objeto week completo no closure do Server Action
                const weekId: string = week.id;
                const label: string = week.label ?? "";
                const mode: string = week.mode;
                const status: string = week.status;
                const deckLockAt: string = week.deckLockAt != null
                  ? new Date(week.deckLockAt).toISOString()
                  : "";
                await updateTournamentWeekSettings({
                  weekId,
                  label,
                  mode: mode as import("@prisma/client").WeekMode,
                  status: status as import("@prisma/client").WeekStatus,
                  deckLockAt,
                  notes: String(formData.get("notes") ?? "")
                });
              }}
            >
              <label className="space-y-1 text-xs text-slate-400">
                <span>Editar explicacao manual do modo</span>
                <textarea
                  name="notes"
                  defaultValue={week.notes ?? ""}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
                />
              </label>
              <button
                type="submit"
                className="mt-2 rounded-lg bg-[#FFCB05] px-3 py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700]"
              >
                Salvar explicacao
              </button>
            </form>
          )}
        </div>
      </div>

      {admin && (
        <div className="rounded-xl border border-border bg-slate-950/50 p-5">
          <h2 className="mb-3 font-semibold text-slate-200">Bonus manual do modo de jogo</h2>
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto]"
            action={async (formData) => {
              "use server";
              await applyTournamentWeekBonus({
                weekId: week.id,
                playerId: String(formData.get("playerId") ?? ""),
                points: Number(formData.get("points") ?? 0),
                reason: String(formData.get("reason") ?? "")
              });
            }}
          >
            <label className="space-y-1 text-xs text-slate-400">
              <span>Jogador</span>
              <select
                name="playerId"
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              >
                {approvedPlayers.map((registration) => (
                  <option key={registration.playerId} value={registration.playerId}>
                    {registration.player.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Pontos (+ adiciona / − remove)</span>
              <input
                name="points"
                type="number"
                defaultValue={1}
                min={-50}
                max={50}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Motivo</span>
              <input
                name="reason"
                placeholder="Ex: bonus do modo especial"
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={approvedPlayers.length === 0}
                className="w-full rounded-lg bg-[#FFCB05] px-3 py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
              >
                Aplicar bonus
              </button>
            </div>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            Os pontos são somados ao bônus manual atual do jogador neste dia (use valores negativos para remover). Para zerar, aplique o oposto do total atual.
          </p>
          {manualBonuses.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-slate-900/40 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Bonus manual acumulado neste dia</p>
              <div className="space-y-1">
                {manualBonuses.map((bonus) => (
                  <div key={String(bonus.playerId)} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300">{String(bonus.playerName ?? bonus.playerId)}</span>
                    <span className="flex items-center gap-2">
                      {!!bonus.reason && <span className="text-slate-500">{String(bonus.reason)}</span>}
                      <span className={Number(bonus.points) >= 0 ? "font-semibold text-[#7AC74C]" : "font-semibold text-red-400"}>
                        {Number(bonus.points) > 0 ? "+" : ""}{Number(bonus.points)} pts
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {admin && (
        <div className="rounded-xl border border-border bg-slate-950/50 p-5">
          <h2 className="mb-3 font-semibold text-slate-200">Escalar times e duplas</h2>
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            action={async (formData) => {
              "use server";
              await setTournamentWeekTeam({
                weekId: week.id,
                playerId: String(formData.get("playerId") ?? ""),
                teamName: String(formData.get("teamName") ?? "")
              });
            }}
          >
            <label className="space-y-1 text-xs text-slate-400">
              <span>Jogador</span>
              <select
                name="playerId"
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              >
                {approvedPlayers.map((registration) => (
                  <option key={registration.playerId} value={registration.playerId}>
                    {registration.player.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Time ou dupla</span>
              <input
                name="teamName"
                placeholder="Ex: Time Amarelo ou Dupla 1"
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
              <span className="block text-[10px] text-slate-500">Deixe em branco para remover o jogador do time/dupla.</span>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={approvedPlayers.length === 0}
                className="w-full rounded-lg bg-[#FFCB05] px-3 py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
              >
                Salvar time
              </button>
            </div>
          </form>

          <div className="mt-4">
            <div className="rounded-lg border border-border bg-slate-900/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Escalacoes</p>
              {teamAssignments.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum time ou dupla definido ainda.</p>
              ) : (
                <div className="space-y-1 text-sm text-slate-300">
                  {teamAssignments.map((assignment) => (
                    <div key={String(assignment.playerId)} className="flex items-center justify-between gap-2">
                      <p>
                        <span className="font-semibold text-white">{String(assignment.playerName)}</span>
                        <span className="text-slate-500"> - </span>
                        <span className="text-[#FFCB05]">{String(assignment.teamName)}</span>
                      </p>
                      <form
                        action={async () => {
                          "use server";
                          await setTournamentWeekTeam({
                            weekId: week.id,
                            playerId: String(assignment.playerId),
                            teamName: ""
                          });
                        }}
                      >
                        <button
                          type="submit"
                          className="shrink-0 rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                        >
                          remover
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {teamStats.length > 0 && (
        <div className="rounded-xl border border-border bg-slate-950/50 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-200">
                <Crown size={16} className="text-[#FFCB05]" />
                Times e duplas do dia
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Premios por partida = premios defendidos / partidas jogadas pelo time (0 a 6). A ordem segue o criterio do Top do Dia: aproveitamento de vitorias primeiro, premios por partida como desempate. Quem foi escalado e ainda nao jogou aparece no elenco, mas nao entra nas medias.
              </p>
            </div>
            {!!bonusRule?.winnerTeamBonus && (
              <span className="rounded-full border border-[#EE8130]/40 bg-[#EE8130]/10 px-3 py-1 text-xs font-semibold text-[#EE8130]">
                +{String(bonusRule.winnerTeamBonus)}pt ao time campeao (aplicar no bonus manual)
              </span>
            )}
          </div>

          {championTeam ? (
            <div className="mb-4 rounded-xl border border-[#FFCB05]/40 bg-gradient-to-r from-[#FFCB05]/15 to-transparent p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#FFCB05]">
                    <Crown size={14} /> {championIsTied ? "Lideranca empatada" : "Time campeao do dia"}
                  </p>
                  <p className="mt-1 font-pixel text-base text-white">{championTeam.teamName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {championTeam.wins}V-{championTeam.draws}E-{championTeam.losses}D em {championTeam.matchesPlayed} partidas - {championTeam.defendedPrizes} premios defendidos - {championTeam.points} pts somados
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-pixel text-lg text-[#FFCB05]">{Math.round(championTeam.winRate * 100)}%</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">vitorias</p>
                  <p className="mt-1 font-pixel text-base text-slate-200">{championTeam.averagePrizes.toFixed(2)}</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">premios/partida</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {championTeam.members.map((member) => member.playerName).join(", ")}
              </p>
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-500">Valide partidas para definir o time campeao do dia.</p>
          )}

          <div className="space-y-3">
            {teamStats.map((team, index) => (
              <div
                key={team.teamName}
                className={`rounded-xl border p-3 ${index === 0 && championTeam ? "border-[#FFCB05]/40 bg-[#FFCB05]/5" : "border-border bg-slate-900/40"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">
                    <span className="mr-2 text-slate-500">{index + 1}o</span>
                    {team.teamName}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span><span className="font-semibold text-slate-200">{Math.round(team.winRate * 100)}%</span> vitorias</span>
                    <span><span className="font-semibold text-slate-200">{team.averagePrizes.toFixed(2)}</span> premios/partida</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {team.members.length} escalados ({team.playedCount} jogaram) - {team.matchesPlayed} partidas - {team.wins}V-{team.draws}E-{team.losses}D - {team.defendedPrizes} premios defendidos - {team.points} pts
                </p>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {team.members.map((member) => (
                    <div key={member.playerId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/70 px-2 py-1 text-xs">
                      <span className={member.matchesPlayed > 0 ? "text-slate-200" : "text-slate-500"}>
                        {member.playerName}
                        {member.matchesPlayed === 0 && (
                          <span className="ml-1 text-[10px] text-slate-600">(sem partida validada)</span>
                        )}
                      </span>
                      <span className="shrink-0 text-slate-400">
                        {member.matchesPlayed > 0
                          ? `${member.wins}V-${member.draws}E-${member.losses}D - ${member.defendedPrizes} premios - ${member.points} pts`
                          : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isInPerson && <div className="rounded-xl border border-border bg-slate-950/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              {deckVisibility.locked ? (
                <Eye size={16} className="text-[#FFCB05]" />
              ) : (
                <Lock size={16} className="text-[#FFCB05]" />
              )}
              Decklists do Dia
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Antes do fechamento, cada jogador ve apenas a propria lista. Depois do fechamento, jogadores inscritos podem ver as listas uns dos outros.
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-slate-300">
            {deckVisibility.label}
          </span>
        </div>

        {week.mode === "CONSTRUTOR_MISTERIOSO" ? (
          <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-xl">🔨</span>
              <div>
                <p className="text-sm font-semibold text-[#FFCB05]">Modo Construtor — registre 3 decks</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nesta semana você registra 3 decks e o adversário escolhe qual você usa em cada partida. O registro é feito na página do Construtor.
                </p>
              </div>
            </div>
            <Link
              href={`/torneios/${tournament.slug}/construtor`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors"
            >
              Ir para o Construtor →
            </Link>
          </div>
        ) : !player && !admin ? (
          <p className="text-sm text-slate-500">
            Entre com uma conta de jogador para se inscrever e enviar decklist.
          </p>
        ) : registration?.status !== "APPROVED" && registration?.status !== "PENDING" && !admin ? (
          <p className="text-sm text-slate-500">
            Voce precisa estar inscrito neste torneio para enviar decklist deste dia.
          </p>
        ) : canSubmitDeck || currentPlayerDecks.length > 0 ? (
          /* Deck por partida — redireciona para Ver Partidas onde cada confronto tem seu próprio deck */
          <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-xl">🃏</span>
              <div>
                <p className="text-sm font-semibold text-[#FFCB05]">Envie um deck para cada partida</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Você pode usar decks diferentes em cada confronto. O envio é feito na página de partidas.
                </p>
              </div>
            </div>
            {/* Decks já vinculados a partidas desta semana */}
            {currentPlayerDecks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentPlayerDecks.map(d => (
                  <div key={d.id} className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-1.5">
                    <span className="text-[10px] text-emerald-400">✓</span>
                    <span className="text-xs font-medium text-slate-200">{d.deckName}</span>
                    {d.opponents.length > 0 && (
                      <span className="text-[10px] text-slate-500">
                        vs {d.opponents.join(", ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Link
              href={`/torneios/${tournament.slug}/semanas/${weekNum}/partidas`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors"
            >
              {currentPlayerDecks.length > 0 ? "Ver e editar decks por partida →" : "Ir para Ver Partidas →"}
            </Link>
          </div>
        ) : week.status !== "OPEN" && !admin ? (
          <p className="text-sm text-slate-500">
            O prazo de envio de decklist ja foi encerrado para este dia.
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          {visibleDecks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-slate-500">
              Nenhuma decklist visivel para voce neste momento.
            </p>
          ) : (
            visibleDecks.map((submission) => (
              <div
                key={submission.id}
                className="rounded-xl border border-border bg-slate-900/40 p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {submission.player.displayName}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      {submission.deckName}
                      {submission.archetype ? ` · ${submission.archetype}` : ""}
                    </p>
                    {submission.opponents.length > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                        <Swords size={9} />
                        vs {submission.opponents.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyDeckButton deckList={submission.deckList} />
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-slate-400">
                      {submission.status}
                    </span>
                  </div>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-300">
                  {submission.deckList}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>}

      {/* Recap Narrativo — visível para jogadores inscritos e admins */}
      {(admin || registration?.status === "APPROVED") && (
        <NarrativePanel
          weekId={week.id}
          weekLabel={week.label ?? `Semana ${weekNum}`}
          existingNarrative={week.narrativeText ?? null}
          generatedAt={week.narrativeGeneratedAt ?? null}
          isAdmin={admin}
        />
      )}

      <div className="rounded-xl border border-border bg-slate-950/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              <Crown size={16} className="text-[#FFCB05]" />
              Performance da semana para Top do Dia
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Tabela informativa da semana. Ela não distribui recompensas automaticamente e serve de referência pública para jogadores e administração.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {admin && (
              <BulkConfirmButton
                tournamentId={tournament.id}
                weekNumber={weekNum}
                slug={slug}
              />
            )}
            <Link
              href={`/torneios/${slug}/semanas/${weekNum}/partidas`}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5"
            >
              Ver partidas
            </Link>
          </div>
        </div>

        {topDoDiaRanking.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum resultado validado nesta semana ainda. A performance só aparece depois da confirmação das partidas.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3 text-xs leading-5 text-cyan-100">
              <strong>Fórmula:</strong> performance média = ((vitórias × 3) + prêmios defendidos) ÷ partidas jogadas. Primeiro comparamos a média; em empate, usamos mais vitórias, mais prêmios defendidos e depois menos partidas.
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Pos.</th>
                    <th className="min-w-40 px-3 py-3">Jogador</th>
                    <th className="px-3 py-3 text-center">Partidas</th>
                    <th className="px-3 py-3 text-center">Vitórias</th>
                    <th className="px-3 py-3 text-center">Prêmios defendidos</th>
                    <th className="px-3 py-3 text-center">Média de vitórias</th>
                    <th className="px-3 py-3 text-center">Média de prêmios</th>
                    <th className="px-3 py-3 text-center">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                  {topDoDiaRanking.map((entry, index) => {
                    const matches = entry.matchesPlayed || 0;
                    const winAverage = matches > 0 ? entry.wins / matches : 0;
                    const prizeAverage = matches > 0 ? entry.defendedPrizes / matches : 0;
                    const performance = winAverage * 3 + prizeAverage;
                    return (
                      <tr key={entry.playerId} className={index === 0 ? "bg-[#FFCB05]/10" : "hover:bg-white/[0.03]"}>
                        <td className="px-3 py-3 font-bold text-[#FFCB05]">{index === 0 ? "👑 1º" : `${index + 1}º`}</td>
                        <td className="px-3 py-3 font-semibold text-white">{entry.displayName}</td>
                        <td className="px-3 py-3 text-center text-slate-300">{matches}</td>
                        <td className="px-3 py-3 text-center text-emerald-300">{entry.wins}</td>
                        <td className="px-3 py-3 text-center text-violet-300">{entry.defendedPrizes}</td>
                        <td className="px-3 py-3 text-center text-slate-300">{winAverage.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center text-slate-300">{prizeAverage.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center font-black text-cyan-300">{performance.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-slate-900/20 px-6 py-8 text-center">
        <Swords className="mx-auto mb-2 h-8 w-8 text-[#FFCB05]" />
        <p className="mb-3 text-sm text-slate-400">Veja as partidas desta semana</p>
        <Link
          href={`/torneios/${slug}/semanas/${weekNum}/partidas`}
          className="inline-flex items-center gap-1 rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-semibold text-[#1A1A2E] transition-colors hover:bg-[#FFD700]"
        >
          Ver Partidas
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
