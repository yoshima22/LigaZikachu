import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import type { WeekMode } from "@/components/ui/poke/week-mode-badge";
import Link from "next/link";
import { ChevronRight, CalendarDays, Clock, Crown, Info, Swords } from "lucide-react";
import { computeTournamentWeekTopOfDay } from "@/lib/ranking";
import { getDeckVisibilityState } from "@/lib/decks";

export const dynamic = "force-dynamic";

export default async function WeekDetailPage({
  params
}: {
  params: Promise<{ slug: string; weekNumber: string }>;
}) {
  const { slug, weekNumber } = await params;
  const weekNum = parseInt(weekNumber, 10);
  if (isNaN(weekNum)) notFound();

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true }
  });
  if (!tournament) notFound();

  const week = await prisma.tournamentWeek.findUnique({
    where: { tournamentId_weekNumber: { tournamentId: tournament.id, weekNumber: weekNum } }
  });
  if (!week) notFound();

  const topDoDiaRanking = await computeTournamentWeekTopOfDay(week.id);
  const deckVisibility = getDeckVisibilityState(week);

  const fmt = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "—";

  const bonusRule =
    week.bonusRule && typeof week.bonusRule === "object"
      ? (week.bonusRule as Record<string, unknown>)
      : null;

  const positionBonus: Array<Record<string, unknown>> | null =
    bonusRule && Array.isArray(bonusRule.positionBonus)
      ? (bonusRule.positionBonus as Array<Record<string, unknown>>)
      : null;

  const statusConfig: Record<string, { label: string; cls: string }> = {
    PLANNED: { label: "Planejada", cls: "border-slate-500/30 bg-slate-500/10 text-slate-400" },
    OPEN:    { label: "Aberta",    cls: "border-[#7AC74C]/40 bg-[#7AC74C]/10 text-[#7AC74C]" },
    LOCKED:  { label: "Bloqueada", cls: "border-[#F7D02C]/40 bg-[#F7D02C]/10 text-[#F7D02C]" },
    CLOSED:  { label: "Encerrada", cls: "border-[#6390F0]/40 bg-[#6390F0]/10 text-[#6390F0]" }
  };
  const sc = statusConfig[week.status] ?? statusConfig.PLANNED;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
        <Link href="/torneios" className="hover:text-slate-300 transition-colors">Torneios</Link>
        <ChevronRight size={12} />
        <Link href={`/torneios/${slug}`} className="hover:text-slate-300 transition-colors">
          {tournament.name}
        </Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Semana {week.weekNumber}</span>
      </nav>

      {/* Hero */}
      <div className="rounded-2xl border border-border bg-slate-950/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">
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
        {/* Datas */}
        <div className="rounded-xl border border-border bg-slate-950/50 p-5 space-y-4">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <CalendarDays size={16} className="text-[#FFCB05]" />
            Datas
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Início</dt>
              <dd className="text-slate-200 capitalize">{fmt(week.startDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Fim</dt>
              <dd className="text-slate-200 capitalize">{fmt(week.endDate)}</dd>
            </div>
            {week.lockAt && (
              <div>
                <dt className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                  <Clock size={11} /> Bloqueio de resultados
                </dt>
                <dd className="text-slate-200 capitalize">{fmt(week.lockAt)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                <Clock size={11} /> Fechamento de decklists
              </dt>
              <dd className="text-slate-200 capitalize">
                {fmt(deckVisibility.deadline)}
              </dd>
              <p className="mt-1 text-xs text-slate-500">
                {deckVisibility.label}
              </p>
            </div>
          </dl>
        </div>

        {/* Regras do modo */}
        <div className="rounded-xl border border-border bg-slate-950/50 p-5 space-y-4">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
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
                  <span className="text-[#F7D02C] font-bold">{Number(week.multiplier)}×</span>
                  <span className="text-slate-400 text-xs">multiplicador de pontos</span>
                </div>
              )}
              {!!bonusRule.extraPointsPerWin && (
                <div className="flex items-center gap-2 rounded-lg border border-[#7AC74C]/20 bg-[#7AC74C]/5 px-3 py-2">
                  <span className="text-[#7AC74C] font-bold">+{String(bonusRule.extraPointsPerWin)}pt</span>
                  <span className="text-slate-400 text-xs">bônus por vitória</span>
                </div>
              )}
              {!!bonusRule.winnerTeamBonus && (
                <div className="flex items-center gap-2 rounded-lg border border-[#EE8130]/20 bg-[#EE8130]/5 px-3 py-2">
                  <span className="text-[#EE8130] font-bold">+{String(bonusRule.winnerTeamBonus)}pt</span>
                  <span className="text-slate-400 text-xs">bônus para o time vencedor</span>
                </div>
              )}
              {!!bonusRule.decksToSubmit && (
                <div className="text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
                  Envie {String(bonusRule.decksToSubmit)} decks antes do prazo. Adversário escolhe qual você usa.
                </div>
              )}
              {week.mode === "BATALHA_FINAL" && positionBonus && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium">Bônus por posição:</p>
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
                        <span className="text-slate-300 font-medium">
                          {firstNum}º–{lastNum}º
                        </span>
                        <span className="text-slate-500">→</span>
                        <span className="text-[#FFCB05] font-semibold">+{bonusPerWin}pt/vitória</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Formato padrão — sem restrições especiais.
            </p>
          )}
          {week.notes && (
            <p className="text-xs text-slate-500 border-t border-border pt-3">{week.notes}</p>
          )}
        </div>
      </div>

      {/* Top do Dia */}
      <div className="rounded-xl border border-border bg-slate-950/50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              <Crown size={16} className="text-[#FFCB05]" />
              Top do Dia
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Previa calculada somente com partidas validadas desta semana/dia.
            </p>
          </div>
          <Link
            href={`/torneios/${slug}/semanas/${weekNum}/partidas`}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5"
          >
            Validar resultados
          </Link>
        </div>

        {topDoDiaRanking.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum resultado validado neste dia ainda. O Top do Dia so deve ser calculado depois da validacao.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Jogador</th>
                  <th className="py-2 pr-4">Pts</th>
                  <th className="py-2 pr-4">V</th>
                  <th className="py-2 pr-4">D</th>
                  <th className="py-2 pr-4">Partidas</th>
                  <th className="py-2 pr-4">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topDoDiaRanking.map((entry) => (
                  <tr key={entry.playerId}>
                    <td className="py-2 pr-4 font-semibold text-[#FFCB05]">#{entry.position}</td>
                    <td className="py-2 pr-4 font-medium text-white">{entry.displayName}</td>
                    <td className="py-2 pr-4 text-white">{entry.points}</td>
                    <td className="py-2 pr-4 text-emerald-400">{entry.wins}</td>
                    <td className="py-2 pr-4 text-red-400">{entry.losses}</td>
                    <td className="py-2 pr-4 text-slate-300">{entry.matchesPlayed}</td>
                    <td className="py-2 pr-4 text-slate-300">{entry.gameDiff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Partidas */}
      <div className="rounded-xl border border-dashed border-border bg-slate-900/20 px-6 py-8 text-center">
        <Swords className="mx-auto h-8 w-8 text-[#FFCB05] mb-2" />
        <p className="text-sm text-slate-400 mb-3">Veja as partidas desta semana</p>
        <Link
          href={`/torneios/${slug}/semanas/${weekNum}/partidas`}
          className="inline-flex items-center gap-1 rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors"
        >
          Ver Partidas
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
