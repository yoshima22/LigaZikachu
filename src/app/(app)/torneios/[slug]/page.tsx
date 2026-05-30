import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import type { WeekMode } from "@/components/ui/poke/week-mode-badge";
import { TrainerAvatar } from "@/components/ui/poke/trainer-avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Award, CalendarDays, ChevronRight, Crown, Settings, Trophy, Users } from "lucide-react";
import type { RegistrationStatus } from "@prisma/client";
import { RegisterButton } from "./_components/register-button";
import { computeTournamentRanking, computeTournamentWeekTopOfDay } from "@/lib/ranking";

export default async function TorneioDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const admin = user ? isAdmin(user.role) : false;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      weeks: { orderBy: { weekNumber: "asc" } },
      registrations: {
        include: {
          player: {
            include: { user: { select: { image: true } } }
          }
        },
        orderBy: { registeredAt: "asc" }
      }
    }
  });

  if (!tournament) notFound();
  const canManage = admin || tournament.createdById === user.id;
  if (!canManage && tournament.status === "DRAFT") notFound();

  const player = await prisma.player.findUnique({ where: { userId: user.id } });
  let myRegistration: { status: RegistrationStatus } | null = null;
  if (player) {
    myRegistration = await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: player.id } },
      select: { status: true }
    });
  }

  const approved = tournament.registrations.filter((r) => r.status === "APPROVED");

  // Ranking do torneio para mostrar posições na lista de inscritos
  const tournamentRanking = await computeTournamentRanking(tournament.id);
  const rankMap = new Map(tournamentRanking.map((r) => [r.playerId, r]));

  // Top do dia para semanas encerradas
  const closedWeeks = tournament.weeks.filter((wk) => wk.status === "CLOSED");
  const topByWeek = new Map<string, Awaited<ReturnType<typeof computeTournamentWeekTopOfDay>>>();
  await Promise.all(
    closedWeeks.map(async (wk) => {
      const top = await computeTournamentWeekTopOfDay(wk.id);
      topByWeek.set(wk.id, top.slice(0, 3));
    })
  );

  // Insígnias do torneio
  const badges = await prisma.leagueBadge.findMany({
    where: { tournamentId: tournament.id },
    include: {
      owners: {
        include: { player: { select: { id: true, displayName: true } } },
        orderBy: { awardedAt: "desc" }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const statusColors: Record<string, string> = {
    DRAFT:             "bg-slate-500/15 text-slate-400 border-slate-500/30",
    REGISTRATION_OPEN: "bg-[#7AC74C]/15 text-[#7AC74C] border-[#7AC74C]/40",
    IN_PROGRESS:       "bg-[#F7D02C]/15 text-[#F7D02C] border-[#F7D02C]/40",
    FINISHED:          "bg-[#6390F0]/15 text-[#6390F0] border-[#6390F0]/40"
  };
  const statusLabels: Record<string, string> = {
    DRAFT:             "Rascunho",
    REGISTRATION_OPEN: "Inscrições abertas",
    IN_PROGRESS:       "Em andamento",
    FINISHED:          "Encerrado"
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/torneios" className="hover:text-slate-300 transition-colors">Torneios</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">{tournament.name}</span>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-950/70 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[#735797]/10 via-transparent to-[#FFCB05]/5 pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            {tournament.edition && (
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">{tournament.edition}</p>
            )}
            <h1 className="font-pixel text-base leading-snug text-white sm:text-lg">
              {tournament.name}
            </h1>
            {tournament.description && (
              <p className="mt-2 max-w-xl text-sm text-slate-400">{tournament.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColors[tournament.status]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabels[tournament.status]}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <CalendarDays size={12} />
                {fmt(tournament.startDate)} – {fmt(tournament.endDate)}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Users size={12} />
                {approved.length}{tournament.maxPlayers ? `/${tournament.maxPlayers}` : ""} inscritos
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                {tournament.format === "IN_PERSON" ? "Presencial" : "Online"}
              </span>
              {tournament.format === "IN_PERSON" && (
                <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2.5 py-0.5 text-xs font-semibold text-[#FFCB05]">
                  {tournament.matchesPerPlayer ?? 4} partidas por jogador
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/torneios/${slug}/inscricoes`}>
                    <Settings size={14} className="mr-1" />
                    Gerenciar
                  </Link>
                </Button>
                <Button variant="default" size="sm" asChild className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
                  <Link href={`/torneios/${slug}/admin`}>
                    <Trophy size={14} className="mr-1" />
                    Painel
                  </Link>
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/torneios/${slug}/ranking`}>
                Ranking do Campeonato
              </Link>
            </Button>
            <RegisterButton
              tournamentId={tournament.id}
              tournamentStatus={tournament.status}
              myRegistrationStatus={myRegistration?.status ?? null}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Semanas */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <CalendarDays size={16} className="text-[#FFCB05]" />
            Cronograma de Semanas
          </h2>
          <div className="space-y-2">
            {tournament.weeks.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Semanas ainda não configuradas.</p>
            ) : (
              tournament.weeks.map((wk) => {
                const isClosed = wk.status === "CLOSED";
                const topOfDay = topByWeek.get(wk.id) ?? [];
                return (
                  <div key={wk.id} className="rounded-xl border border-border bg-slate-900/50 overflow-hidden">
                    <Link
                      href={`/torneios/${slug}/semanas/${wk.weekNumber}`}
                      className="flex items-center gap-3 px-4 py-3 hover:border-[#FFCB05]/30 hover:bg-slate-900 transition-all"
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isClosed ? "bg-[#6390F0]/20 text-[#6390F0]" : "bg-slate-800 text-slate-300"}`}>
                        {wk.weekNumber}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200 truncate">{wk.label ?? `Semana ${wk.weekNumber}`}</p>
                        <p className="text-xs text-slate-500">
                          {fmt(wk.startDate)} – {fmt(wk.endDate)}
                        </p>
                        {tournament.requiresDeckSubmission && myRegistration?.status === "APPROVED" && !isClosed && (
                          <p className="mt-1 text-xs text-[#FFCB05]">
                            {wk.deckLockAt && new Date() < wk.deckLockAt
                              ? "Enviar ou editar decklist"
                              : "Ver decklists do dia"}
                          </p>
                        )}
                      </div>
                      <WeekModeBadge mode={wk.mode as WeekMode} short />
                      <ChevronRight size={14} className="text-slate-500" />
                    </Link>

                    {isClosed && topOfDay.length > 0 && (
                      <div className="border-t border-border/50 bg-slate-950/40 px-4 py-2">
                        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[#FFCB05]/70">
                          <Crown size={10} /> Top do Dia
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {topOfDay.map((entry, idx) => (
                            <span key={entry.playerId} className="text-xs text-slate-300">
                              <span className="mr-1 font-bold text-[#FFCB05]">{idx + 1}º</span>
                              {entry.displayName}
                              <span className="ml-1 text-slate-500">{entry.points}pt</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Inscritos */}
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <Trophy size={16} className="text-[#FFCB05]" />
            Inscritos ({approved.length})
          </h2>
          <div className="rounded-xl border border-border bg-slate-950/50 divide-y divide-border overflow-hidden">
            {approved.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Nenhum inscrito aprovado.</p>
            ) : (
              approved.map((reg) => {
                const rank = rankMap.get(reg.player.id);
                return (
                  <Link
                    key={reg.player.id}
                    href={`/jogadores/${reg.player.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                  >
                    <TrainerAvatar
                      displayName={reg.player.displayName}
                      image={reg.player.user?.image}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 truncate">{reg.player.displayName}</p>
                      {reg.player.ptcglNick && (
                        <p className="text-xs text-slate-500">{reg.player.ptcglNick}</p>
                      )}
                    </div>
                    {rank && (
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-[#FFCB05]">#{rank.position}</p>
                        <p className="text-[10px] text-slate-500">{rank.points}pt</p>
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Insígnias do torneio */}
      {badges.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <Award size={16} className="text-[#FFCB05]" />
            Insígnias do Campeonato
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {badges.map((badge) => {
              const currentOwner = badge.owners[0];
              return (
                <div
                  key={badge.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-slate-950/50 p-3"
                >
                  {badge.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={badge.imageUrl}
                      alt={badge.name}
                      className="h-10 w-10 shrink-0 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFCB05]/10">
                      <Award size={20} className="text-[#FFCB05]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{badge.name}</p>
                    {currentOwner ? (
                      <Link
                        href={`/jogadores/${currentOwner.playerId}`}
                        className="truncate text-xs text-[#FFCB05] hover:underline"
                      >
                        {currentOwner.player.displayName}
                      </Link>
                    ) : (
                      <p className="text-xs text-slate-500">Sem dono</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
