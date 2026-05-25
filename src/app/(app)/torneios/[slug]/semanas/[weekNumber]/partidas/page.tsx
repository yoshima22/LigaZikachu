import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import { Button } from "@/components/ui/button";
import { generateMatchups, closeWeek } from "./actions";
import { MatchCard } from "./_components/match-card";

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

  const myMatches = player
    ? matches.filter(
        (m) => m.playerAId === player.id || m.playerBId === player.id
      )
    : [];

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
              <form action={generateMatchups}>
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="weekNumber" value={weekNum} />
                <Button type="submit" variant="default">
                  Gerar Confrontos
                </Button>
              </form>
            )}
            {week.status === "OPEN" && (
              <form action={closeWeek.bind(null, tournament.id, weekNum)}>
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
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#FFCB05]">Minhas Partidas</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {myMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                currentPlayerId={player.id}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </section>
      )}

      {/* Todas as Partidas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          {isAdmin ? "Todas as Partidas" : "Outras Partidas"}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(isAdmin ? matches : matches.filter((m) =>
            !player || (m.playerAId !== player.id && m.playerBId !== player.id)
          )).map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              currentPlayerId={player?.id}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
