import Link from "next/link";
import { CalendarDays, Trophy } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusMap = {
  DRAFT: { label: "Rascunho", variant: "draft" as const },
  ACTIVE: { label: "Ativa", variant: "active" as const },
  FINISHED: { label: "Encerrada", variant: "success" as const },
  ARCHIVED: { label: "Arquivada", variant: "draft" as const }
};

export default async function SeasonsPage() {
  const seasons = await prisma.season.findMany({
    include: {
      tournaments: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true
        },
        orderBy: { startDate: "asc" }
      },
      _count: {
        select: {
          tournaments: true,
          matches: true
        }
      }
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }]
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-pixel text-base leading-snug text-[#FFCB05]">
          Temporadas
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Temporadas agrupam campeonatos. Uma temporada normalmente possui 3 campeonatos, mas pode ter mais.
        </p>
      </div>

      {seasons.length === 0 ? (
        <Card>
          <EmptyState message="Nenhuma temporada cadastrada." icon={<CalendarDays size={32} />} />
        </Card>
      ) : (
        <div className="grid gap-4">
          {seasons.map((season) => {
            const status = statusMap[season.status];
            return (
              <Card key={season.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge variant={status.variant} label={status.label} />
                      <StatusBadge variant="info" label={`${season._count.tournaments} campeonato(s)`} />
                    </div>
                    <CardTitle>{season.name}</CardTitle>
                    {season.description && (
                      <CardDescription className="mt-2">{season.description}</CardDescription>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {season.tournaments.map((tournament) => (
                        <Link
                          key={tournament.id}
                          href={`/torneios/${tournament.slug}`}
                          className="rounded-full border border-border px-3 py-1 text-xs text-slate-300 transition-colors hover:border-[#FFCB05]/40 hover:text-[#FFCB05]"
                        >
                          {tournament.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <Link
                    href={`/temporadas/${season.slug}/ranking`}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
                  >
                    <Trophy size={16} />
                    Ranking da Temporada
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="hidden">
        <CardTitle>Temporadas</CardTitle>
        <CardDescription className="mt-2">
          Placeholder da área de temporadas, semanas, confrontos e ranking. O schema multi-temporada já está implementado.
        </CardDescription>
      </Card>
    </div>
  );
}