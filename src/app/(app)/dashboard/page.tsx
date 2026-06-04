import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { computePlayerRanking } from "@/lib/ranking";
import { getManualSessionUser } from "@/lib/manual-session";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Trophy, Swords, Clock, Package, Users, ShieldAlert,
  CheckCircle2, BookOpen, LayoutDashboard, Calendar, AlertCircle
} from "lucide-react";
import { MatchStatus, SeasonStatus } from "@prisma/client";
import { formatDateBRT } from "@/lib/date-brt";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getAppSession().catch(() => null);
  const user = session?.user ?? await getManualSessionUser();
  if (!user) return null;

  const admin = isAdmin(user.role);

  // Todas as temporadas (para seletor)
  const allSeasons = await prisma.season.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, status: true }
  });

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

  // ===== ADMIN =====
  if (admin) {
    const seasonId = activeSeason?.id;
    const currentWeek = activeSeason?.weeks[0] ?? null;

    const [pendingMatchCount, disputedCount, availableCodesCount, recentMatches] = await Promise.all([
      seasonId ? prisma.match.count({ where: { seasonId, status: MatchStatus.PENDING_CONFIRMATION } }) : 0,
      seasonId ? prisma.match.count({ where: { seasonId, status: MatchStatus.DISPUTED } }) : 0,
      prisma.boosterCode.count({ where: { status: "AVAILABLE", ...(seasonId ? { seasonId } : {}) } }),
      seasonId ? prisma.match.findMany({
        where: { seasonId, status: MatchStatus.CONFIRMED },
        orderBy: { playedAt: "desc" }, take: 5,
        include: {
          playerA: { select: { displayName: true } },
          playerB: { select: { displayName: true } },
          winnerPlayer: { select: { displayName: true } },
          week: { select: { number: true } },
          tournamentWeek: { select: { weekNumber: true, tournament: { select: { slug: true, name: true } } } }
        }
      }) : []
    ]);

    let playersWithoutDeck = 0;
    if (currentWeek && seasonId) {
      const withDeck = await prisma.deckSubmission.count({ where: { seasonId, weekId: currentWeek.id } });
      playersWithoutDeck = (activeSeason?.seasonPlayers.length ?? 0) - withDeck;
    }

    return (
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#2a1a3e] to-[#1A1A2E] p-6 sm:p-8">
          <div className="relative z-10">
            <h1 className="font-pixel text-lg sm:text-xl text-[#FFCB05] leading-snug">Painel Admin</h1>
            <p className="mt-2 text-sm text-slate-400">Visão geral da operação da liga</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/torneios"><Button size="sm" className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"><Trophy size={14} className="mr-1" /> Torneios</Button></Link>
              <Link href="/jogadores"><Button size="sm" variant="outline"><Users size={14} className="mr-1" /> Jogadores</Button></Link>
            </div>
          </div>
        </div>
        {activeSeason && (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Temporada ativa</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{activeSeason.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge variant="active" label="Em andamento" />
                  <StatusBadge variant="draft" label={`${activeSeason.seasonPlayers.length} jogadores`} />
                </div>
              </div>
              <Link href="/temporadas"><Button variant="outline" className="text-sm">Ver temporadas</Button></Link>
            </div>
          </Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Aguardando confirmação" value={pendingMatchCount} icon={<Clock size={22} />} highlight={pendingMatchCount > 0} />
          <StatCard label="Resultados disputados" value={disputedCount} icon={<ShieldAlert size={22} />} highlight={disputedCount > 0} />
          <StatCard label="Sem deck nesta semana" value={playersWithoutDeck} icon={<BookOpen size={22} />} highlight={playersWithoutDeck > 0} />
          <StatCard label="Códigos disponíveis" value={availableCodesCount} icon={<Package size={22} />} />
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/torneios", icon: Trophy, label: "Torneios" },
            { href: "/jogadores", icon: Users, label: "Jogadores" },
            { href: "/temporadas", icon: LayoutDashboard, label: "Temporadas" },
            { href: "/admin", icon: ShieldAlert, label: "Admin" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}><Button variant="outline" className="gap-2"><Icon size={16} /> {label}</Button></Link>
          ))}
        </div>
        {recentMatches.length > 0 && (
          <Card className="divide-y divide-border p-0 overflow-hidden">
            {recentMatches.map((match) => (
              <Link key={match.id}
                href={match.tournamentWeek ? `/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas` : "/temporadas"}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="font-medium text-white">{match.playerA.displayName}</span>
                  <span className="text-slate-500">vs</span>
                  <span className="text-slate-300">{match.playerB?.displayName ?? "BYE"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {match.winnerPlayer && <span className="text-emerald-400">▶ {match.winnerPlayer.displayName}</span>}
                  {match.tournamentWeek && <span>{match.tournamentWeek.tournament.name} · S{match.tournamentWeek.weekNumber}</span>}
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>
    );
  }

  // ===== JOGADOR =====
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true }
  });

  if (!player) {
    return (
      <div className="space-y-6">
        <h1 className="font-pixel text-base text-[#FFCB05]">Olá, {user.name ?? user.email}</h1>
        <Card><EmptyState message="Perfil de jogador não encontrado." icon={<Trophy size={32} />} /></Card>
      </div>
    );
  }

  const seasonId = activeSeason?.id;

  // Torneios ativos em que o jogador está inscrito (qualquer temporada/sem temporada)
  const myRegistrations = await prisma.tournamentRegistration.findMany({
    where: { playerId: player.id, status: "APPROVED", tournament: { status: { in: ["IN_PROGRESS", "REGISTRATION_OPEN"] } } },
    select: { tournamentId: true, tournament: { select: { id: true, name: true, slug: true, status: true } } }
  }).catch((error) => {
    console.error("[Dashboard] registrations lookup failed", { userId: user.id, playerId: player.id, error });
    return [] as Array<{ tournamentId: string; tournament: { id: string; name: string; slug: string; status: string } }>;
  });
  const activeTournamentIds = myRegistrations.map(r => r.tournamentId);

  // ── PRÓXIMAS PARTIDAS: todos os jogos do jogador na data mais próxima ────────
  const upcomingMatches = activeTournamentIds.length > 0
    ? await prisma.match.findMany({
        where: {
          status: { in: [MatchStatus.PENDING_CONFIRMATION, MatchStatus.DRAFT] },
          tournamentWeek: { tournamentId: { in: activeTournamentIds } },
          OR: [{ playerAId: player.id }, { playerBId: player.id }]
        },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
        include: {
          playerA: { select: { id: true, displayName: true } },
          playerB: { select: { id: true, displayName: true } },
          tournamentWeek: { select: { weekNumber: true, label: true, tournament: { select: { slug: true, name: true } } } }
        }
      }).catch((error) => {
        console.error("[Dashboard] upcoming matches lookup failed", { userId: user.id, playerId: player.id, activeTournamentIds, error });
        return [];
      })
    : [];

  // Agrupa por data (dia) e pega o dia mais próximo
  const matchesByDay = new Map<string, typeof upcomingMatches>();
  for (const m of upcomingMatches) {
    const dayKey = m.scheduledAt
      ? new Date(m.scheduledAt).toISOString().slice(0, 10)
      : "sem-data";
    const arr = matchesByDay.get(dayKey) ?? [];
    arr.push(m);
    matchesByDay.set(dayKey, arr);
  }
  const sortedDays = [...matchesByDay.keys()].sort();
  const nextDay = sortedDays[0] ?? null;
  const nextMatches = nextDay ? (matchesByDay.get(nextDay) ?? []) : [];

  // ── DECKS PENDENTES: partidas abertas sem deck registrado ────────────────────
  // Busca partidas das semanas OPEN em torneios ativos
  const openWeeks = await prisma.tournamentWeek.findMany({
    where: { tournamentId: { in: activeTournamentIds }, status: "OPEN" },
    select: { id: true, weekNumber: true, tournament: { select: { slug: true, name: true } } }
  }).catch((error) => {
    console.error("[Dashboard] open weeks lookup failed", { userId: user.id, playerId: player.id, activeTournamentIds, error });
    return [] as Array<{ id: string; weekNumber: number; tournament: { slug: string; name: string } }>;
  });

  const matchesNeedingDeck: Array<{
    matchId: string; weekId: string; weekNumber: number;
    tournamentSlug: string; tournamentName: string;
    opponentName: string;
  }> = [];

  for (const w of openWeeks) {
    const weekMatches = await prisma.match.findMany({
      where: {
        tournamentWeekId: w.id,
        OR: [{ playerAId: player.id }, { playerBId: player.id }]
      },
      include: {
        playerA: { select: { id: true, displayName: true } },
        playerB: { select: { id: true, displayName: true } }
      }
    }).catch((error) => {
      console.error("[Dashboard] week matches lookup failed", { userId: user.id, playerId: player.id, weekId: w.id, error });
      return [];
    });
    for (const m of weekMatches) {
      const isA = m.playerAId === player.id;
      const submissionId = isA ? m.playerADeckSubmissionId : m.playerBDeckSubmissionId;
      if (!submissionId) {
        const opponent = isA ? m.playerB?.displayName : m.playerA.displayName;
        matchesNeedingDeck.push({
          matchId: m.id,
          weekId: w.id,
          weekNumber: w.weekNumber,
          tournamentSlug: w.tournament.slug,
          tournamentName: w.tournament.name,
          opponentName: opponent ?? "Adversário"
        });
      }
    }
  }

  // ── DECKS ENVIADOS (semanas abertas) ────────────────────────────────────────
  const sentDecks = openWeeks.length > 0
    ? await prisma.deckSubmission.findMany({
        where: {
          playerId: player.id,
          tournamentWeekId: { in: openWeeks.map(w => w.id) }
        },
        orderBy: { submittedAt: "desc" },
        include: {
          tournament: { select: { name: true, slug: true } },
          tournamentWeek: { select: { weekNumber: true, label: true } }
        }
      }).catch((error) => {
        console.error("[Dashboard] sent decks lookup failed", { userId: user.id, playerId: player.id, error });
        return [];
      })
    : [];

  // ── RANKING (temporada ativa ou primeiro torneio) ─────────────────────────
  const ranking = seasonId
    ? await computePlayerRanking(seasonId).catch((error) => {
        console.error("[Dashboard] ranking compute failed", { userId: user.id, playerId: player.id, seasonId, error });
        return [] as Awaited<ReturnType<typeof computePlayerRanking>>;
      })
    : [];
  const myEntry = ranking.find(r => r.playerId === player.id);

  const codesCount = seasonId
    ? await prisma.codeDistribution.count({ where: { playerId: player.id, seasonId, status: { not: "REVOKED" } } }).catch((error) => {
        console.error("[Dashboard] code distribution count failed", { userId: user.id, playerId: player.id, seasonId, error });
        return 0;
      })
    : 0;

  const seasonLabel = activeSeason?.name ?? (allSeasons[0]?.name ?? "—");

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">
            Olá, {player.displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{seasonLabel}</p>
        </div>
        {/* Seletor de temporada (link simples) */}
        {allSeasons.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {allSeasons.slice(0, 4).map(s => (
              <span key={s.id} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                s.status === "ACTIVE"
                  ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]"
                  : "border-border text-slate-500"
              }`}>
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats rápidos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Posição no ranking" value={myEntry ? `#${myEntry.position}` : "—"}
          icon={<Trophy size={22} />} description={myEntry ? `${myEntry.points} pts` : "Sem partidas confirmadas"}
          highlight={!!myEntry && myEntry.position === 1} />
        <StatCard label="Vitórias" value={myEntry?.wins ?? 0} icon={<CheckCircle2 size={22} />} />
        <StatCard label="Derrotas" value={myEntry?.losses ?? 0} icon={<Swords size={22} />} />
        <StatCard label="Códigos recebidos" value={codesCount} icon={<Package size={22} />} description="nesta temporada" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Próximas Partidas — todos os jogos do dia mais próximo */}
        <Card>
          <CardTitle className="mb-3 flex items-center gap-2">
            <Calendar size={18} className="text-primary" /> Próximas Partidas
          </CardTitle>
          {nextMatches.length === 0 ? (
            <EmptyState message="Nenhuma partida agendada." icon={<Calendar size={24} />} />
          ) : (
            <div className="space-y-2">
              {nextMatches[0].scheduledAt && (
                <p className="text-xs font-semibold text-[#FFCB05] mb-3">
                  📅 {new Date(nextMatches[0].scheduledAt).toLocaleDateString("pt-BR", {
                    weekday: "long", day: "2-digit", month: "long",
                    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo"
                  })}
                </p>
              )}
              {nextMatches.map(m => {
                const isA = m.playerAId === player.id;
                const opp = isA ? m.playerB?.displayName : m.playerA.displayName;
                const href = m.tournamentWeek
                  ? `/torneios/${m.tournamentWeek.tournament.slug}/semanas/${m.tournamentWeek.weekNumber}/partidas`
                  : "/torneios";
                return (
                  <Link key={m.id} href={href}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-slate-900/40 px-3 py-2.5 hover:border-slate-600 transition-colors">
                    <div>
                      <p className="text-sm text-white">vs <span className="font-semibold text-primary">{opp}</span></p>
                      {m.tournamentWeek && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {m.tournamentWeek.tournament.name} · {m.tournamentWeek.label ?? `Semana ${m.tournamentWeek.weekNumber}`}
                        </p>
                      )}
                    </div>
                    <StatusBadge variant="warning" label="Agendada" />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Decks Enviados — todos os decks de semanas abertas */}
        <Card>
          <CardTitle className="mb-3 flex items-center gap-2">
            <BookOpen size={18} className="text-primary" /> Meus Decks Esta Semana
          </CardTitle>
          {sentDecks.length === 0 ? (
            <EmptyState message="Nenhum deck enviado nesta semana." icon={<BookOpen size={24} />} />
          ) : (
            <div className="space-y-2">
              {sentDecks.map(d => {
                const href = d.tournament && d.tournamentWeek
                  ? `/torneios/${d.tournament.slug}/semanas/${d.tournamentWeek.weekNumber}/partidas`
                  : "/torneios";
                return (
                  <Link key={d.id} href={href}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border bg-slate-900/40 px-3 py-2.5 hover:border-slate-600 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{d.deckName}</p>
                      {d.tournament && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {d.tournament.name} · {d.tournamentWeek?.label ?? `Semana ${d.tournamentWeek?.weekNumber}`}
                        </p>
                      )}
                    </div>
                    <StatusBadge variant={d.status === "APPROVED" ? "active" : d.isLate ? "warning" : "info"}
                      label={d.status === "APPROVED" ? "Aprovado" : d.isLate ? "Atrasado" : "Enviado"} />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Decks Pendentes — partidas abertas sem deck registrado */}
      <Card>
        <CardTitle className="mb-3 flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-400" />
          <span>Decks Pendentes</span>
          {matchesNeedingDeck.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[11px] text-amber-400 font-semibold">
              {matchesNeedingDeck.length}
            </span>
          )}
        </CardTitle>
        {matchesNeedingDeck.length === 0 ? (
          <EmptyState message="Todos os decks estão registrados!" icon={<CheckCircle2 size={24} />} />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 mb-3">
              Partidas em semanas abertas onde você ainda não registrou o deck.
            </p>
            {matchesNeedingDeck.map(m => (
              <Link key={m.matchId}
                href={`/torneios/${m.tournamentSlug}/semanas/${m.weekNumber}/partidas`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 hover:bg-amber-500/10 transition-colors"
              >
                <div>
                  <p className="text-sm text-white">vs <span className="font-semibold text-amber-300">{m.opponentName}</span></p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{m.tournamentName} · Semana {m.weekNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant="warning" label="Sem deck" />
                  <span className="text-[11px] text-amber-400">Enviar →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
