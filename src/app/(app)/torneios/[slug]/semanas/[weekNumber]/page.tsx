import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/permissions";
import { WeekModeBadge } from "@/components/ui/poke/week-mode-badge";
import type { WeekMode } from "@/components/ui/poke/week-mode-badge";
import Link from "next/link";
import { ChevronRight, CalendarDays, Clock, Info } from "lucide-react";

export default async function WeekDetailPage({
  params
}: {
  params: Promise<{ slug: string; weekNumber: string }>;
}) {
  const { slug, weekNumber } = await params;
  const weekNum = parseInt(weekNumber, 10);
  if (isNaN(weekNum)) notFound();

  await getSessionUser();

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true }
  });
  if (!tournament) notFound();

  const week = await prisma.tournamentWeek.findUnique({
    where: { tournamentId_weekNumber: { tournamentId: tournament.id, weekNumber: weekNum } }
  });
  if (!week) notFound();

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
      ? (week.bonusRule as Record<string, string | number | boolean | null | Array<Record<string, string | number>>>)
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
              {week.mode === "BATALHA_FINAL" && Array.isArray(bonusRule.positionBonus) && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium">Bônus por posição:</p>
                  {(bonusRule.positionBonus as Array<{ positions: number[]; bonusPerWin: number }>).map((pb) => (
                    <div key={pb.positions.join()} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-300 font-medium">
                        {pb.positions[0]}º–{pb.positions[pb.positions.length - 1]}º
                      </span>
                      <span className="text-slate-500">→</span>
                      <span className="text-[#FFCB05] font-semibold">+{pb.bonusPerWin}pt/vitória</span>
                    </div>
                  ))}
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

      {/* Partidas — placeholder Slice 3 */}
      <div className="rounded-xl border border-dashed border-border bg-slate-900/20 px-6 py-8 text-center">
        <p className="text-sm text-slate-500">Partidas desta semana serão exibidas na Slice 3.</p>
      </div>
    </div>
  );
}
