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
import { MatchStatus, SeasonStatus } from "@prisma/client";

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
        take: 5,
        select: { id: true, deckName: true, status: true, submittedAt: true, isLate: true }
      },
      playerAchievements: {
        include: { achievement: { select: { name: true, description: true, icon: true } } }
      }
    }
  });

  if (!player) notFound();

  const activeSeason = player.seasonEntries.find((sp) => sp.season.status === SeasonStatus.ACTIVE);
  const isSelf = session.user.id === player.userId;
  const isAdminUser = isAdmin(session.user.role);

  const [ranking, recentMatches, codesCount] = await Promise.all([
    activeSeason ? computePlayerRanking(activeSeason.seasonId) : [],
    prisma.match.findMany({
      where: {
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
        status: MatchStatus.CONFIRMED
      },
      orderBy: { playedAt: "desc" },
      take: 5,
      include: {
        playerA: { select: { id: true, displayName: true } },
        playerB: { select: { id: true, displayName: true } },
        week: { select: { number: true, label: true } }
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
      : 0
  ]);

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
      <Card>
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-700 text-xl font-bold text-white">
            {player.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.user.image}
                alt={player.displayName}
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              <User size={28} className="text-slate-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{player.displayName}</h1>
            {player.ptcglNick && (
              <p className="mt-0.5 text-sm text-slate-400">@{player.ptcglNick}</p>
            )}
            <p className="mt-0.5 text-sm text-slate-500">{player.user.email}</p>
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
                      {match.week && (
                        <span className="ml-2 text-xs text-slate-500">
                          S{match.week.number}
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
            {player.deckSubmissions.length === 0 ? (
              <EmptyState message="Nenhum deck enviado." icon={<BookOpen size={24} />} />
            ) : (
              <ul className="divide-y divide-border">
                {player.deckSubmissions.map((deck) => (
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
            )}
          </Card>

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
