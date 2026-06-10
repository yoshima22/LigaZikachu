import { prisma } from "@/lib/prisma";
import { computeTournamentWeekTopOfDay } from "@/lib/ranking";
import { TournamentStatus } from "@prisma/client";
import { CalendarDays, Crown, Swords, Trophy } from "lucide-react";
import Link from "next/link";

export const revalidate = 120; // 2 min — top do dia muda com partidas confirmadas

const MEDAL = ["🥇", "🥈", "🥉"];
const POSITION_COLOR = ["text-[#FFCB05]", "text-slate-300", "text-amber-600"];

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatScore(wins: number, losses: number, draws: number, points: number) {
  const total = wins + losses + draws;
  const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { wr, record: `${wins}V ${losses}D${draws > 0 ? ` ${draws}E` : ""}`, points };
}

export default async function TopDoDiaPage() {
  const weeks = await prisma.tournamentWeek.findMany({
    where: {
      tournament: { status: { not: "DRAFT" } },
      matches: { some: { status: "CONFIRMED" } }
    },
    include: {
      tournament: { select: { name: true, slug: true, status: true } },
      _count: { select: { matches: { where: { status: "CONFIRMED" } } } }
    },
    orderBy: [{ startDate: "desc" }, { weekNumber: "desc" }],
    take: 12
  });

  // Busca top-3 de cada semana em paralelo
  const rankings = await Promise.all(
    weeks.map((w) =>
      computeTournamentWeekTopOfDay(w.id)
        .then((r) => r.slice(0, 3))
        .catch(() => [])
    )
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">Top do Dia</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ranking de desempenho por semana de campeonato — baseado em aproveitamento e prêmios defendidos.
        </p>
      </div>

      {weeks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Crown size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">Nenhum dia de campeonato foi configurado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {weeks.map((week, wi) => {
            const top = rankings[wi] ?? [];
            const hasWinner = top.length > 0;
            const isActive = week.tournament.status === TournamentStatus.IN_PROGRESS;

            return (
              <div key={week.id} className="rounded-2xl border border-border bg-slate-950/60 overflow-hidden">
                {/* ── Cabeçalho da semana ── */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">
                      {week.tournament.name}
                      {isActive && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 text-[9px] text-green-400">
                          ● ao vivo
                        </span>
                      )}
                    </p>
                    <h2 className="mt-0.5 font-semibold text-white leading-tight">
                      {week.label ?? `Semana ${week.weekNumber}`}
                    </h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <CalendarDays size={11} />
                      {formatDate(week.startDate)} — {formatDate(week.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-[#FFCB05] leading-none">{week._count.matches}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">partidas</p>
                    </div>
                    <Link
                      href={`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-400 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] transition-colors"
                    >
                      <Swords size={12} /> Ver completo
                    </Link>
                  </div>
                </div>

                {/* ── Pódio / ranking ── */}
                {!hasWinner ? (
                  <div className="px-5 py-6 text-center text-xs text-slate-600">
                    Nenhum resultado validado ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {top.map((entry, i) => {
                      const { wr, record, points } = formatScore(
                        entry.wins, entry.losses, entry.draws, entry.points
                      );
                      const isFirst = i === 0;

                      return (
                        <div
                          key={entry.playerId}
                          className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                            isFirst
                              ? "bg-gradient-to-r from-[#FFCB05]/8 via-transparent to-transparent"
                              : "hover:bg-slate-900/40"
                          }`}
                        >
                          {/* Posição */}
                          <div className="w-8 text-center shrink-0">
                            <span className={`text-lg leading-none ${isFirst ? "" : "text-sm"}`}>
                              {MEDAL[i]}
                            </span>
                          </div>

                          {/* Nome */}
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/jogadores/${entry.playerId}`}
                              className={`font-semibold hover:underline underline-offset-2 ${
                                isFirst ? "text-white text-sm" : "text-slate-300 text-xs"
                              }`}
                            >
                              {entry.displayName}
                            </Link>
                            <p className="text-[10px] text-slate-600 mt-0.5">{record}</p>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-4 shrink-0">
                            {/* Aproveitamento */}
                            <div className="text-right hidden sm:block">
                              <p className={`font-bold text-sm leading-none ${POSITION_COLOR[i]}`}>{wr}%</p>
                              <p className="text-[10px] text-slate-600 mt-0.5">aprov.</p>
                            </div>

                            {/* Pontos */}
                            <div className="text-right">
                              <p className={`font-bold leading-none ${isFirst ? "text-base text-[#FFCB05]" : "text-sm text-slate-400"}`}>
                                {points}
                              </p>
                              <p className="text-[10px] text-slate-600 mt-0.5">pts</p>
                            </div>

                            {/* Prêmios defendidos */}
                            {entry.defendedPrizes > 0 && (
                              <div className="flex items-center gap-0.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-2 py-1">
                                <Trophy size={10} className="text-yellow-400" />
                                <span className="text-[10px] font-semibold text-yellow-400">{entry.defendedPrizes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Link para ver ranking completo se há mais de 3 */}
                    <div className="px-5 py-2.5">
                      <Link
                        href={`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`}
                        className="text-[11px] text-slate-600 hover:text-[#FFCB05] transition-colors"
                      >
                        Ver ranking completo →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
