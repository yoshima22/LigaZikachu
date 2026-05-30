import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { computePlayerRanking } from "@/lib/ranking";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardTitle } from "@/components/ui/card";
import { Trophy, Swords, CheckCircle2, Package, BookOpen, User, ChevronLeft } from "lucide-react";
import { pokemonTypes } from "@/components/ui/pokemon-type-selector";
import { MatchStatus, SeasonStatus } from "@prisma/client";
import { PlayerBadgeAdminActions } from "./_components/player-badge-admin-actions";

export default async function PlayerDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id: playerId }, session] = await Promise.all([params, auth()]);
  if (!session?.user) return null;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      user: {
        select: { id: true, email: true, image: true, status: true, role: true, name: true }
      },
      seasonEntries: {
        where: { isActive: true },
        include: { season: { select: { id: true, name: true, status: true } } }
      },
      deckSubmissions: {
        orderBy: { submittedAt: "desc" },
        take: 10,
        select: {
          id: true, deckName: true, status: true, submittedAt: true, isLate: true,
          tournament: { select: { name: true, slug: true, status: true } },
          tournamentWeek: { select: { weekNumber: true, status: true, deckLockAt: true, lockAt: true, endDate: true } }
        }
      },
      playerAchievements: {
        include: { achievement: { select: { name: true, description: true, icon: true } } }
      },
      playerBadges: {
        include: {
          badge: {
            include: {
              tournament: {
                select: {
                  name: true,
                  season: { select: { name: true } }
                }
              }
            }
          }
        },
        orderBy: { awardedAt: "desc" }
      }
    }
  });

  if (!player) notFound();

  const activeSeason = player.seasonEntries.find((sp) => sp.season.status === SeasonStatus.ACTIVE);
  const isSelf = session.user.id === player.userId;
  const isAdminUser = isAdmin(session.user.role);

  const [ranking, recentMatches, codesCount, allPlayers, dreamTeam, equippedItems, publicDecks] = await Promise.all([
    activeSeason ? computePlayerRanking(activeSeason.seasonId) : [],
    prisma.match.findMany({
      where: {
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
        status: MatchStatus.CONFIRMED,
        tournamentWeek: { tournament: { status: { not: "DRAFT" } } }
      },
      orderBy: { playedAt: "desc" },
      take: 5,
      include: {
        playerA: { select: { id: true, displayName: true } },
        playerB: { select: { id: true, displayName: true } },
        tournamentWeek: {
          select: {
            weekNumber: true,
            tournament: { select: { name: true, slug: true } }
          }
        }
      }
    }),
    isSelf || isAdminUser
      ? prisma.codeDistribution.count({
          where: {
            playerId,
            ...(activeSeason ? { seasonId: activeSeason.seasonId } : {}),
            status: { not: "REVOKED" }
          }
        })
      : 0,
    isAdminUser
      ? prisma.player.findMany({
          select: { id: true, displayName: true },
          orderBy: { displayName: "asc" }
        })
      : [],
    prisma.playerSticker.findMany({
      where: { playerId, isFavorite: true },
      include: { card: { select: { nationalId: true, displayName: true, imageUrl: true, rarity: true } } },
      orderBy: { firstObtained: "asc" },
      take: 6
    }),
    prisma.playerInventory.findMany({
      where: { playerId, equipped: true },
      include: { item: { select: { type: true, name: true, imageUrl: true } } }
    }),
    prisma.savedDeck.findMany({
      where: { playerId, isPublic: true },
      select: { id: true, name: true, archetype: true, deckList: true, updatedAt: true },
      orderBy: { updatedAt: "desc" }
    }).catch(() => [] as { id: string; name: string; archetype: string | null; deckList: string; updatedAt: Date }[])
  ]);

  const equippedBanner = equippedItems.find((i) => i.item.type === "BANNER");
  const equippedFrame  = equippedItems.find((i) => i.item.type === "FRAME");
  const equippedTitle  = equippedItems.find((i) => i.item.type === "TITLE");

  const myEntry = (ranking as Awaited<ReturnType<typeof computePlayerRanking>>).find(
    (r) => r.playerId === playerId
  );

  const winRate =
    myEntry && myEntry.wins + myEntry.losses + myEntry.draws > 0
      ? Math.round((myEntry.wins / (myEntry.wins + myEntry.losses + myEntry.draws)) * 100)
      : null;

  function statusBadge() {
    const map = {
      ACTIVE: { variant: "active" as const, label: "Ativo" },
      PENDING_APPROVAL: { variant: "pending" as const, label: "Pendente" },
      SUSPENDED: { variant: "suspended" as const, label: "Suspenso" },
      REJECTED: { variant: "rejected" as const, label: "Rejeitado" }
    };
    return map[player!.user.status] ?? { variant: "draft" as const, label: player!.user.status };
  }

  const badge = statusBadge();

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link
        href="/jogadores"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
      >
        <ChevronLeft size={16} /> Jogadores
      </Link>

      {/* Header */}
      <Card className="overflow-hidden p-0">
        {equippedBanner?.item.imageUrl && (
          <div className="relative h-24 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={equippedBanner.item.imageUrl} alt="Banner" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0f0f1a]/70" />
          </div>
        )}
        <div className={`flex flex-wrap items-start gap-5 p-6 ${equippedBanner?.item.imageUrl ? "-mt-10 relative" : ""}`}>
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-700 text-xl font-bold text-white ${equippedFrame ? "ring-4 ring-[#FFCB05]" : ""}`}>
            {player.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.user.image} alt={player.displayName} className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <User size={28} className="text-slate-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{player.displayName}</h1>
            {equippedTitle && (
              <p className="text-xs font-semibold text-[#FFCB05]/80">{equippedTitle.item.name}</p>
            )}
            {player.ptcglNick && (
              <p className="mt-0.5 text-sm text-slate-400">@{player.ptcglNick}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge variant={badge.variant} label={badge.label} />
              {player.user.role !== "PLAYER" && (
                <StatusBadge variant="info" label={player.user.role} />
              )}
              {activeSeason && (
                <StatusBadge variant="draft" label={activeSeason.season.name} />
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Time dos Sonhos */}
      {dreamTeam.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">⭐ Time dos Sonhos</h2>
          <div className="flex flex-wrap gap-3">
            {dreamTeam.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-2 w-20">
                {s.card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.card.imageUrl} alt={s.card.displayName} className="h-14 w-14 object-contain" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">#{s.card.nationalId}</div>
                )}
                <p className="text-center text-[10px] font-medium text-slate-300 leading-tight truncate w-full">{s.card.displayName}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Stats da temporada ativa */}
      {activeSeason && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Temporada atual · {activeSeason.season.name}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Posição"
              value={myEntry ? `#${myEntry.position}` : "—"}
              icon={<Trophy size={20} />}
              highlight={myEntry?.position === 1}
            />
            <StatCard
              label="Pontos"
              value={myEntry?.points ?? 0}
              icon={<CheckCircle2 size={20} />}
            />
            <StatCard
              label="V / E / D"
              value={
                myEntry
                  ? `${myEntry.wins} / ${myEntry.draws} / ${myEntry.losses}`
                  : "0 / 0 / 0"
              }
              icon={<Swords size={20} />}
            />
            <StatCard
              label="Taxa de vitória"
              value={winRate !== null ? `${winRate}%` : "—"}
              icon={<Trophy size={20} />}
            />
          </div>
        </div>
      )}

      {/* Decks Públicos */}
      {publicDecks.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen size={18} className="text-primary" /> Meus Decks
            </CardTitle>
            {publicDecks.length > 3 && (
              <Link href={`/jogadores/${playerId}/decks`} className="text-xs text-[#FFCB05] hover:underline">
                Ver todos ({publicDecks.length}) →
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {publicDecks.slice(0, 3).map((d) => {
              const typeValues = d.archetype
                ? d.archetype.split(",").map((t) => t.trim()).filter(Boolean)
                : [];
              return (
                <div key={d.id} className="rounded-lg border border-border bg-slate-900/40 p-3">
                  <p className="font-semibold text-slate-200 text-sm">{d.name}</p>
                  {typeValues.length > 0 && (
                    <div className="mt-1.5 mb-2 flex flex-wrap gap-1.5">
                      {typeValues.map((tv) => {
                        const pt = pokemonTypes.find((p) => p.value === tv);
                        if (!pt) return null;
                        const Icon = pt.icon;
                        return (
                          <span key={tv} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pt.className}`}>
                            <Icon size={10} /> {pt.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <pre className="max-h-36 overflow-auto rounded bg-slate-950 p-2 font-mono text-xs text-slate-300">
                    {d.deckList}
                  </pre>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Histórico de partidas */}
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Swords size={18} className="text-primary" /> Últimas partidas
          </CardTitle>
          {recentMatches.length === 0 ? (
            <EmptyState message="Nenhuma partida confirmada." icon={<Swords size={24} />} />
          ) : (
            <ul className="divide-y divide-border">
              {recentMatches.map((match) => {
                const isA = match.playerAId === playerId;
                const opp = isA ? match.playerB : match.playerA;
                const won = match.winnerPlayerId === playerId;
                const lost = match.loserPlayerId === playerId;
                return (
                  <li key={match.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <span className="text-white">
                        vs {opp?.displayName ?? "BYE"}
                      </span>
                      {match.tournamentWeek && (
                        <span className="ml-2 text-xs text-slate-500">
                          S{match.tournamentWeek.weekNumber}
                          {match.tournamentWeek.tournament && ` · ${match.tournamentWeek.tournament.name}`}
                        </span>
                      )}
                    </div>
                    <StatusBadge
                      variant={won ? "success" : lost ? "danger" : "info"}
                      label={won ? "Vitória" : lost ? "Derrota" : "Empate"}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {/* Decks enviados */}
          <Card>
            <CardTitle className="mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-primary" /> Decks enviados
            </CardTitle>
            {(() => {
              const validDecks = player.deckSubmissions.filter(
                (d) => d.tournament && d.tournament.status !== "DRAFT" && d.tournamentWeek
              );
              return validDecks.length === 0 ? (
                <EmptyState message="Nenhum deck enviado." icon={<BookOpen size={24} />} />
              ) : (
              <ul className="divide-y divide-border">
                {validDecks.map((deck) => (
                  <li key={deck.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-white">{deck.deckName}</span>
                    <div className="flex items-center gap-2">
                      {deck.isLate && <StatusBadge variant="warning" label="Atrasado" />}
                      <StatusBadge
                        variant={
                          deck.status === "APPROVED"
                            ? "success"
                            : deck.status === "REJECTED"
                            ? "danger"
                            : "info"
                        }
                        label={
                          deck.status === "APPROVED"
                            ? "Aprovado"
                            : deck.status === "REJECTED"
                            ? "Rejeitado"
                            : "Enviado"
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
              );
            })()}
          </Card>

          {/* Conquistas */}
          {player.playerBadges.length > 0 && (
            <Card>
              <CardTitle className="mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-primary" /> Insignias
              </CardTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {player.playerBadges.map((playerBadge) => (
                  <div
                    key={playerBadge.id}
                    className="flex items-center gap-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/10 p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={playerBadge.badge.imageUrl}
                      alt={playerBadge.badge.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{playerBadge.badge.name}</p>
                      <p className="truncate text-xs text-slate-400">{playerBadge.badge.tournament.name}</p>
                      <p className="text-xs text-[#FFCB05]">+3 pontos</p>
                      {isAdminUser && (
                        <PlayerBadgeAdminActions
                          badgeId={playerBadge.badgeId}
                          currentPlayerId={player.id}
                          players={allPlayers}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Conquistas */}
          {player.playerAchievements.length > 0 && (
            <Card>
              <CardTitle className="mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-primary" /> Conquistas
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {player.playerAchievements.map((pa) => (
                  <StatusBadge
                    key={pa.id}
                    variant="info"
                    label={pa.achievement.icon ? `${pa.achievement.icon} ${pa.achievement.name}` : pa.achievement.name}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Códigos recebidos (só para si ou admin) */}
          {(isSelf || isAdminUser) && (
            <Card>
              <CardTitle className="mb-2 flex items-center gap-2">
                <Package size={18} className="text-primary" /> Códigos recebidos
              </CardTitle>
              <p className="text-2xl font-bold text-white">{codesCount}</p>
              <p className="mt-1 text-xs text-slate-400">
                {activeSeason ? `nesta temporada (excl. revogados)` : "em todas as temporadas"}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
