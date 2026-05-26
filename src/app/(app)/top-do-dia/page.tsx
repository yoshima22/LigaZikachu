import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { CalendarDays, Crown } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TopDoDiaPage() {
  const weeks = await prisma.tournamentWeek.findMany({
    include: {
      tournament: { select: { name: true, slug: true } },
      _count: {
        select: {
          matches: {
            where: { status: "CONFIRMED" }
          }
        }
      }
    },
    orderBy: [{ startDate: "desc" }, { weekNumber: "desc" }],
    take: 12
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">
          Top do Dia
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Top do Dia e calculado dentro de um dia/semana de campeonato. Escolha um dia para ver a previa.
        </p>
      </div>

      {weeks.length === 0 ? (
        <Card>
          <EmptyState
            message="Nenhum dia de campeonato foi configurado ainda."
            icon={<Crown size={32} />}
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {weeks.map((week) => (
            <Link
              key={week.id}
              href={`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`}
              className="block"
            >
              <Card className="transition hover:border-[#FFCB05]/40 hover:bg-slate-900/80">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      {week.tournament.name}
                    </p>
                    <h2 className="mt-1 font-semibold text-white">
                      {week.label ?? `Semana ${week.weekNumber}`}
                    </h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <CalendarDays size={12} />
                      {formatDate(week.startDate)} ate {formatDate(week.endDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-[#FFCB05]">
                      {week._count.matches}
                    </p>
                    <p className="text-xs text-slate-500">resultados validados</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short"
  });
}
