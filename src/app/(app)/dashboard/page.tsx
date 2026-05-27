import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { computePlayerRanking } from "@/lib/ranking";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Trophy,
  Swords,
  Clock,
  Package,
  Users,
  ShieldAlert,
  CheckCircle2,
  BookOpen,
  LayoutDashboard,
  Calendar
} from "lucide-react";
import { MatchStatus, SeasonStatus, UserStatus } from "@prisma/client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = session.user;
  const admin = isAdmin(user.role);

  // Temporada ativa
  const activeSeason = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    include: {
      seasonPlayers: { where: { isActive: true } },
      weeks: {
        where: { status: { in: ["OPEN", "LOCKED"] } },
        orderBy: { number: "desc" },
        take: 1
      }
    }
  });

  // ===== ADMIN / SUPER_ADMIN =====
  if (admin) {
    const seasonId = activeSeason?.id;
    const currentWeek = activeSeason?.weeks[0] ?? null;

    const [pendingMatchCount, disputedCount, availableCodesCount, recentMatches] = await Promise.all([
      seasonId
        ? prisma.match.count({ where: { seasonId, status: MatchStatus.PENDING_CONFIRMATION } })
        : 0,
      seasonId
        ? prisma.match.count({ where: { seasonId, status: MatchStatus.DISPUTED } })
        : 0,
      prisma.boosterCode.count({ where: { status: "AVAILABLE", ...(seasonId ? { seasonId } : {}) } }),
      seasonId
        ? prisma.match.findMany({
            where: { seasonId, status: MatchStatus.CONFIRMED },
            orderBy: { playedAt: "desc" },
            take: 5,
            include: {
              playerA: { select: { displayName: true } },
              playerB: { select: { displayName: true } },
              winnerPlayer: { select: { displayName: true } },
              week: { select: { number: true } }
            }
          })
        : []
    ]);

    let playersWithoutDeck = 0;
    if (currentWeek && seasonId) {
      const withDeck = await prisma.deckSubmission.count({
        where: { seasonId, weekId: currentWeek.id }
      });
      playersWithoutDeck = (activeSeason?.seasonPlayers.length ?? 0) - withDeck;
    }

    return (
      <div className="space-y-8">
        {/* Banner Pokemon */}
        <div className="relative overflow-hidden rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#2a1a3e] to-[#1A1A2E] p-6 sm:p-8">
          <div className="absolute top-0 right-0 h-32 w-32 opacity-10">
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#FFCB05" strokeWidth="2"/>
              <path d="M5 50 L95 50" stroke="#FFCB05" strokeWidth="2"/>
              <circle cx="50" cy="50" r="12" fill="#FFCB05"/>
            </svg>
          </div>
          <div className="relative z-10">
            <h1 className="font-pixel text-lg sm:text-xl text-[#FFCB05] leading-snug drop-shadow-[0_0_10px_#FFCB05]/20">
              Painel Admin
            </h1>
            <p className="mt-2 text-sm text-slate-400">Visão geral da operação da liga</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/torneios">
                <Button size="sm" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                  <Trophy size={14} className="mr-1" /> Torneios
                </Button>
              </Link>
              <Link href="/jogadores">
                <Button size="sm" variant="outline">
                  <Users size={14} className="mr-1" /> Jogadores
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Temporada ativa */}
        {activeSeason ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Temporada ativa</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{activeSeason.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge variant="active" label="Em andamento" />
                  {currentWeek && (
                    <StatusBadge variant="info" label={`Semana ${currentWeek.number} aberta`} />
                  )}
                  <StatusBadge variant="draft" label={`${activeSeason.seasonPlayers.length} jogadores`} />
                </div>
              </div>
              <Link href="/temporadas">
                <Button variant="outline" className="text-sm">Ver temporadas</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState message="Nenhuma temporada ativa no momento." icon={<Calendar size={32} />} />
          </Card>
        )}

        {/* Pendências operacionais */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Pendências operacionais
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Aguardando confirmação"
              value={pendingMatchCount}
              icon={<Clock size={22} />}
              highlight={pendingMatchCount > 0}
            />
            <StatCard
              label="Resultados disputados"
              value={disputedCount}
              icon={<ShieldAlert size={22} />}
              highlight={disputedCount > 0}
            />
            <StatCard
              label="Sem deck nesta semana"
              value={playersWithoutDeck}
              icon={<BookOpen size={22} />}
              highlight={playersWithoutDeck > 0}
            />
            <StatCard
              label="Códigos disponíveis"
              value={availableCodesCount}
              icon={<Package size={22} />}
            />
          </div>
        </div>

        {/* Atalhos rápidos */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Atalhos rápidos
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/torneios">
              <Button variant="outline" className="gap-2">
                <Trophy size={16} /> Torneios
              </Button>
            </Link>
            <Link href="/jogadores">
              <Button variant="outline" className="gap-2">
                <Users size={16} /> Jogadores
              </Button>
            </Link>
            <Link href="/temporadas">
              <Button variant="outline" className="gap-2">
                <LayoutDashboard size={16} /> Temporadas
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline" className="gap-2">
                <ShieldAlert size={16} /> Admin
              </Button>
            </Link>
          </div>
        </div>

        {/* Últimos resultados confirmados */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Últimos resultados confirmados
          </h2>
          {recentMatches.length === 0 ? (
            <Card>
              <EmptyState message="Nenhum resultado confirmado ainda." icon={<Swords size={28} />} />
            </Card>
          ) : (
            <Card className="divide-y divide-border p-0 overflow-hidden">
              {recentMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/torneios/${match.season?.slug ?? ""}/semanas/${match.week?.number ?? 1}/partidas`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span className="font-medium text-white">{match.playerA.displayName}</span>
                    <span className="text-slate-500">vs</span>
                    <span className="text-slate-300">{match.playerB?.displayName ?? "BYE"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {match.winnerPlayer && (
                      <span className="text-emerald-400">▶ {match.winnerPlayer.displayName}</span>
                    )}
                    {match.week && <span>S{match.week.number}</span>}
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ===== PLAYER =====
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true }
  });

  if (!player || !activeSeason) {
    return (
      <div className="space-y-6">
        <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">
          Olá, {user.name ?? user.email}
        </h1>
        <Card>
          <EmptyState
            message="Nenhuma temporada ativa no momento. Aguarde o início da próxima temporada."
            icon={<Trophy size={32} />}
          />
        </Card>
      </div>
    );
  }

  const seasonId = activeSeason.id;
  const currentWeek = activeSeason.weeks[0] ?? null;

  const [ranking, nextMatch, pendingConfs, codesCount] = await Promise.all([
    computePlayerRanking(seasonId),
    prisma.match.findFirst({
      where: {
        seasonId,
        OR: [{ playerAId: player.id }, { playerBId: player.id }],
        status: { in: [MatchStatus.PENDING_CONFIRMATION, MatchStatus.DRAFT] },
        scheduledAt: { gt: new Date() }
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        playerA: { select: { displayName: true } },
        playerB: { select: { displayName: true } },
        week: { select: { number: true, label: true } }
      }
    }),
    prisma.matchConfirmation.findMany({
      where: { playerId: player.id, status: "PENDING", match: { seasonId } },
      include: {
        match: {
          include: {
            playerA: { select: { displayName: true } },
            playerB: { select: { displayName: true } },
            week: { select: { number: true } }
          }
        }
      }
    }),
    prisma.codeDistribution.count({
      where: { playerId: player.id, seasonId, status: { not: "REVOKED" } }
    })
  ]);

  const deckSubmission = currentWeek
    ? await prisma.deckSubmission.findFirst({
        where: { seasonId, weekId: currentWeek.id, playerId: player.id }
      })
    : null;

  const myEntry = ranking.find((r) => r.playerId === player.id);

  const opponent = nextMatch
    ? nextMatch.playerAId === player.id
      ? nextMatch.playerB?.displayName
      : nextMatch.playerA.displayName
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">
          Olá, {player.displayName}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {activeSeason.name}
          {currentWeek && ` · Semana ${currentWeek.number}`}
        </p>
      </div>

      {/* Stats rápidos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Posição no ranking"
          value={myEntry ? `#${myEntry.position}` : "—"}
          icon={<Trophy size={22} />}
          description={myEntry ? `${myEntry.points} pts` : "Sem partidas confirmadas"}
          highlight={!!myEntry && myEntry.position === 1}
        />
        <StatCard
          label="Vitórias"
          value={myEntry?.wins ?? 0}
          icon={<CheckCircle2 size={22} />}
        />
        <StatCard
          label="Derrotas"
          value={myEntry?.losses ?? 0}
          icon={<Swords size={22} />}
        />
        <StatCard
          label="Códigos recebidos"
          value={codesCount}
          icon={<Package size={22} />}
          description="nesta temporada"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Próxima partida */}
        <Card>
          <CardTitle className="mb-3 flex items-center gap-2">
            <Calendar size={18} className="text-primary" /> Próxima partida
          </CardTitle>
          {nextMatch ? (
            <div className="space-y-1 text-sm">
              <p className="text-white">
                vs{" "}
                <span className="font-semibold text-primary">{opponent}</span>
              </p>
              {nextMatch.week && (
                <p className="text-slate-400">
                  {nextMatch.week.label ?? `Semana ${nextMatch.week.number}`}
                </p>
              )}
              {nextMatch.scheduledAt && (
                <p className="text-slate-400">
                  {new Date(nextMatch.scheduledAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              )}
              <StatusBadge
                className="mt-2"
                variant="warning"
                label={
                  nextMatch.status === MatchStatus.PENDING_CONFIRMATION
                    ? "Aguardando confirmação"
                    : "Rascunho"
                }
              />
            </div>
          ) : (
            <EmptyState message="Nenhuma partida agendada." icon={<Calendar size={24} />} />
          )}
        </Card>

        {/* Deck da semana */}
        <Card>
          <CardTitle className="mb-3 flex items-center gap-2">
            <BookOpen size={18} className="text-primary" /> Deck da semana
          </CardTitle>
          {!currentWeek ? (
            <EmptyState message="Nenhuma semana aberta." icon={<BookOpen size={24} />} />
          ) : deckSubmission ? (
            <Link href={`/temporadas/${activeSeason.id}/semanas/${currentWeek.id}/deck`} className="block space-y-2 hover:opacity-80 transition-opacity">
              <p className="font-medium text-white">{deckSubmission.deckName}</p>
              <StatusBadge
                variant={
                  deckSubmission.status === "APPROVED"
                    ? "active"
                    : deckSubmission.isLate
                    ? "warning"
                    : "info"
                }
                label={
                  deckSubmission.status === "APPROVED"
                    ? "Aprovado"
                    : deckSubmission.status === "REJECTED"
                    ? "Rejeitado"
                    : deckSubmission.isLate
                    ? "Enviado com atraso"
                    : "Enviado"
                }
              />
            </Link>
          ) : (
            <div className="space-y-3">
              <StatusBadge variant="pending" label="Deck pendente" />
              <p className="text-xs text-slate-400">
                Semana {currentWeek.number} · Envie seu deck antes do prazo
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Partidas pendentes de confirmação */}
      <Card>
        <CardTitle className="mb-3 flex items-center gap-2">
          <Clock size={18} className="text-primary" /> Partidas aguardando sua confirmação
        </CardTitle>
        {pendingConfs.length === 0 ? (
          <EmptyState message="Nenhuma partida aguarda confirmação." icon={<CheckCircle2 size={24} />} />
        ) : (
          <ul className="divide-y divide-border">
            {pendingConfs.map((conf) => {
              const isA = conf.match.playerAId === player.id;
              const opp = isA
                ? conf.match.playerB?.displayName
                : conf.match.playerA.displayName;
              return (
                <li key={conf.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <span className="text-white">vs {opp}</span>
                    {conf.match.week && (
                      <span className="ml-2 text-xs text-slate-400">S{conf.match.week.number}</span>
                    )}
                  </div>
                  <StatusBadge variant="warning" label="Pendente" />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
