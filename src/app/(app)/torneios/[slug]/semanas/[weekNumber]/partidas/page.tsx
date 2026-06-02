import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { canViewTournamentWeekDecklist } from "@/lib/decks";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import { Button } from "@/components/ui/button";
import { generateMatchups, closeWeek } from "./actions";
import { MatchCard } from "./_components/match-card";
import { MatchDeckSelector } from "./_components/match-deck-selector";
import { canSubmitTournamentWeekDeck } from "@/lib/decks";

interface Props {
  params: Promise<{ slug: string; weekNumber: string }>;
}

export default async function PartidasPage({ params }: Props) {
  const { slug, weekNumber } = await params;
  const weekNum = Number(weekNumber);
  const user = await getSessionUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      weeks: {
        where: { weekNumber: weekNum },
        include: {
          matches: {
            include: {
              playerA: true,
              playerB: true,
              winnerPlayer: true,
              confirmations: true,
            },
            orderBy: { roundLabel: "asc" },
          },
          deckSubmissions: {
            include: {
              player: { select: { id: true, displayName: true } }
            },
            orderBy: [{ player: { displayName: "asc" } }, { deckNumber: "asc" }]
          },
        },
      },
    },
  });

  if (!tournament || tournament.weeks.length === 0) {
    notFound();
  }

  const week = tournament.weeks[0];
  const matches = week.matches;

  const player = user
    ? await prisma.player.findUnique({ where: { userId: user.id } })
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
  const canReportAnyInPersonMatch =
    tournament.format === "IN_PERSON" && (isAdmin || registration?.status === "APPROVED");

  // Monta mapa playerId → decks únicos visíveis.
  // Deduplica por deckList para que o mesmo deck enviado em múltiplas partidas
  // apareça uma única vez no seletor (evita lista poluída).
  const visibleDecksByPlayer = new Map<string, Array<{ id: string; deckNumber: number; deckName: string; archetype: string | null; deckList: string }>>();
  const seenDeckKeys = new Set<string>();
  for (const submission of week.deckSubmissions) {
    if (!user) continue;

    const canView = canViewTournamentWeekDecklist({
      viewerRole: user.role,
      isOwner: submission.playerId === player?.id,
      registrationStatus: registration?.status ?? null,
      week
    });
    if (!canView) continue;

    // Deduplicar por jogador + conteúdo do deck
    const dedupeKey = `${submission.playerId}::${submission.deckList.trim()}`;
    if (seenDeckKeys.has(dedupeKey)) continue;
    seenDeckKeys.add(dedupeKey);

    const decks = visibleDecksByPlayer.get(submission.playerId) ?? [];
    decks.push({
      id: submission.id,
      deckNumber: submission.deckNumber,
      deckName: submission.deckName,
      archetype: submission.archetype,
      deckList: submission.deckList
    });
    visibleDecksByPlayer.set(submission.playerId, decks);
  }

  const matchCards = matches.map((match) => ({
    id: match.id,
    playerAId: match.playerAId,
    playerBId: match.playerBId,
    playerA: {
      id: match.playerA.id,
      displayName: match.playerA.displayName
    },
    playerB: match.playerB
      ? {
          id: match.playerB.id,
          displayName: match.playerB.displayName
        }
      : {
          id: "bye",
          displayName: "Bye"
        },
    winnerPlayerId: match.winnerPlayerId,
    winnerPlayer: match.winnerPlayer
      ? {
          id: match.winnerPlayer.id,
          displayName: match.winnerPlayer.displayName
        }
      : null,
    status: match.status,
    roundLabel: match.roundLabel,
    rankingPointsA: Number(match.rankingPointsA),
    rankingPointsB: Number(match.rankingPointsB),
    winnerDefendedPrizes: match.winnerDefendedPrizes,
    playerADeckSubmissionId: match.playerADeckSubmissionId,
    playerBDeckSubmissionId: match.playerBDeckSubmissionId,
    reportedById: match.reportedById,
    notes: match.notes,
    playerADecks: visibleDecksByPlayer.get(match.playerAId) ?? [],
    playerBDecks: match.playerBId ? visibleDecksByPlayer.get(match.playerBId) ?? [] : [],
    currentPlayerDecks: player ? visibleDecksByPlayer.get(player.id) ?? [] : [],
    confirmations: match.confirmations.map((confirmation) => ({
      playerId: confirmation.playerId,
      status: confirmation.status
    }))
  }));

  const myMatches = player
    ? matchCards.filter(
        (m) => m.playerAId === player.id || m.playerBId === player.id
      )
    : [];

  // Saved decks do jogador atual (para o deck selector por partida)
  const savedDecks = player
    ? await prisma.savedDeck.findMany({
        where: { playerId: player.id },
        select: { id: true, name: true, archetype: true, deckList: true },
        orderBy: { updatedAt: "desc" }
      })
    : [];

  const weekOpen = week.status === "OPEN";
  const canSendDecks = player && canSubmitTournamentWeekDeck({
    viewerRole: user?.role ?? "PLAYER",
    registrationStatus: registration?.status ?? null,
    week
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-400">
        <Link href="/torneios" className="hover:text-[#FFCB05]">Torneios</Link>
        <span className="mx-2">/</span>
        <Link href={`/torneios/${slug}`} className="hover:text-[#FFCB05]">
          {tournament.name}
        </Link>
        <span className="mx-2">/</span>
        <span>Semana {weekNum}</span>
        <span className="mx-2">/</span>
        <span className="text-[#FFCB05]">Partidas</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-pixel">
            Partidas — Semana {weekNum}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <WeekModeBadge mode={week.mode} />
            <span className="text-sm text-slate-400">
              {matches.length} partidas
            </span>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            {matches.length === 0 && week.status === "PLANNED" && (
              <form
                action={async (formData) => {
                  "use server";
                  await generateMatchups({
                    tournamentId: String(formData.get("tournamentId") ?? ""),
                    weekNumber: Number(formData.get("weekNumber") ?? 0)
                  });
                }}
              >
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="weekNumber" value={weekNum} />
                <Button type="submit" variant="default">
                  Gerar Confrontos
                </Button>
              </form>
            )}
            {week.status === "OPEN" && (
              <form
                action={async () => {
                  "use server";
                  await closeWeek(tournament.id, weekNum);
                }}
              >
                <Button type="submit" variant="destructive">
                  Fechar Semana
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Minhas Partidas */}
      {player && myMatches.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#FFCB05]">Minhas Partidas</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {myMatches.map((match, idx) => {
              const globalIdx = matchCards.indexOf(match) + 1;
              return (
                <MatchCard
                  key={match.id}
                  match={{ ...match, roundLabel: match.roundLabel ?? `Partida ${globalIdx}` }}
                  currentPlayerId={player.id}
                  isAdmin={isAdmin}
                  tournamentFormat={tournament.format}
                  canReportResult={canReportAnyInPersonMatch}
                />
              );
            })}
          </div>

          {/* Envio de deck por partida */}
          {(weekOpen || myMatches.some(m =>
            (m.playerAId === player.id && m.playerADeckSubmissionId) ||
            (m.playerBId === player.id && m.playerBDeckSubmissionId)
          )) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-200">Decks por Partida</h3>
                {weekOpen && (
                  <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-0.5 text-[10px] text-[#FFCB05]">
                    Semana aberta — envio liberado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Você pode usar decks diferentes em cada partida. Selecione ou cole a lista abaixo.
              </p>
              <div className="space-y-2">
                {myMatches.map((match, idx) => {
                  const globalIdx = matchCards.indexOf(match) + 1;
                  const isPlayerA = match.playerAId === player.id;
                  const opponent = isPlayerA ? match.playerB : match.playerA;
                  const submissionId = isPlayerA
                    ? match.playerADeckSubmissionId
                    : match.playerBDeckSubmissionId;

                  // Busca pelo ID exato da submission, não apenas [0]
                  const allPlayerDecks = isPlayerA ? match.playerADecks : match.playerBDecks;
                  const submittedDeck = submissionId
                    ? (allPlayerDecks.find(d => d.id === submissionId) ?? allPlayerDecks[0] ?? null)
                    : null;

                  return (
                    <MatchDeckSelector
                      key={match.id}
                      matchId={match.id}
                      matchNumber={globalIdx}
                      opponentName={opponent?.displayName ?? "Adversário"}
                      weekOpen={weekOpen}
                      savedDecks={savedDecks ?? []}
                      existingSubmission={submittedDeck && submissionId ? {
                        id: submissionId,
                        deckName: submittedDeck.deckName,
                        archetype: submittedDeck.archetype ?? null,
                        deckList: submittedDeck.deckList,
                      } : null}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Todas as Partidas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          {isAdmin ? "Todas as Partidas" : "Outras Partidas"}
          <span className="ml-2 text-sm font-normal text-slate-500">({matchCards.length} total)</span>
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(isAdmin ? matchCards : matchCards.filter((m) =>
            !player || (m.playerAId !== player.id && m.playerBId !== player.id)
          )).map((match, _, arr) => {
            const num = matchCards.indexOf(match) + 1;
            return (
            <MatchCard
              key={match.id}
              match={{ ...match, roundLabel: match.roundLabel ?? `Partida ${num}` }}
              currentPlayerId={player?.id}
              isAdmin={isAdmin}
              tournamentFormat={tournament.format}
              canReportResult={canReportAnyInPersonMatch}
            />
          );
          })}
        </div>
      </section>
    </div>
  );
}
