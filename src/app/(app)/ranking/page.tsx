import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeGlobalRanking } from "@/lib/ranking";
import { RankingTable } from "@/components/ranking/ranking-table";
import { prisma } from "@/lib/prisma";
import { Trophy } from "lucide-react";
import { TutorialManager } from "@/components/tutorial/tutorial-manager";
import { TutorialHelpButton } from "@/components/tutorial/tutorial-help-button";

export const dynamic = "force-dynamic";

export default async function RankingPage({
  searchParams
}: {
  searchParams: Promise<{ seasonId?: string }>;
}) {
  const { seasonId } = await searchParams;
  const seasons = await prisma.season.findMany({
    select: { id: true, name: true },
    orderBy: { startDate: "desc" }
  });
  const selectedSeasonId = seasonId && seasons.some((season) => season.id === seasonId) ? seasonId : "";
  const ranking = await computeGlobalRanking(selectedSeasonId || undefined);

  return (
    <div className="space-y-6">
      <TutorialManager pageId="ranking" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">
            Ranking Geral
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Historico acumulado de partidas validadas. Use o filtro para ver todas as temporadas ou uma temporada especifica.
          </p>
        </div>
        <TutorialHelpButton pageId="ranking" />
      </div>

      <Card className="p-4" data-tutorial="ranking-season">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label htmlFor="seasonId" className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
              Temporada
            </label>
            <select
              id="seasonId"
              name="seasonId"
              defaultValue={selectedSeasonId}
              className="w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Todas</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#FFD700]"
          >
            Consultar
          </button>
        </form>
      </Card>

      {ranking.length === 0 ? (
        <Card>
          <EmptyState
            message="Ainda nao ha dados suficientes para calcular o ranking."
            icon={<Trophy size={32} />}
          />
        </Card>
      ) : (
        <Card data-tutorial="ranking-table" className="overflow-hidden p-0">
          <RankingTable ranking={ranking} />
        </Card>
      )}
    </div>
  );
}
