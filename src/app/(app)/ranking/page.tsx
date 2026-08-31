import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeGlobalRanking } from "@/lib/ranking";
import { RankingTable } from "@/components/ranking/ranking-table";
import { prisma } from "@/lib/prisma";
import { Trophy } from "lucide-react";
import { TutorialManager } from "@/components/tutorial/tutorial-manager";
import { unstable_cache } from "next/cache";

// Ranking cacheado por 5 minutos por seasonId.
// Revalidado explicitamente via revalidateTag("ranking") em partidas/actions.ts.
// Substitui force-dynamic (que recalculava tudo a cada visita).
const getCachedRanking = unstable_cache(
  (seasonId: string) => computeGlobalRanking(seasonId || undefined),
  ["global-ranking"],
  { revalidate: 300, tags: ["ranking"] }, // 5 min ou invalidação por tag
);

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
  const ranking = await getCachedRanking(selectedSeasonId);

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

      <details className="rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-4 text-sm">
        <summary className="cursor-pointer font-bold text-cyan-200">Como funciona o “Nível de Gameplay” (ordem do ranking)</summary>
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            O ranking geral é ordenado pelo <strong className="text-cyan-300">Nível de Gameplay</strong> — um índice que valoriza quem joga mais, <em>mas nem sempre</em> coloca quem tem mais partidas na frente. Quem joga muito tem preferência, porém desempenho e consistência pesam bastante.
          </p>
          <p className="font-semibold text-slate-200">O cálculo considera:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong className="text-slate-100">Winrate</strong> (taxa de vitórias) — o fator de maior peso.</li>
            <li><strong className="text-slate-100">Número de jogos</strong> — com retorno decrescente (raiz): jogar mais ajuda, mas cada jogo extra vale um pouco menos.</li>
            <li><strong className="text-slate-100">Prêmios defendidos</strong> — recompensa vitórias sólidas.</li>
            <li><strong className="text-slate-100">Eventos da temporada</strong> em que você está inscrito — recompensa a participação.</li>
            <li><strong className="text-slate-100">Derrotas</strong> — penalizam mais do que cada prêmio defendido recompensa, então acumular derrotas custa caro no índice.</li>
          </ul>
          <p className="text-slate-400">
            Assim, um jogador com muitas partidas e winrate baixo não passa automaticamente à frente de quem tem menos jogos porém desempenho melhor. A coluna <strong className="text-cyan-300">Nível</strong> mostra esse índice; <strong>Pts</strong> continua sendo os pontos acumulados de torneio.
          </p>
        </div>
      </details>

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
