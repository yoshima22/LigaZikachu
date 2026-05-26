import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeSeasonRanking } from "@/lib/ranking";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SeasonRankingPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const season = await prisma.season.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      tournaments: {
        select: { name: true, slug: true },
        orderBy: { startDate: "asc" }
      }
    }
  });

  if (!season) notFound();

  const ranking = await computeSeasonRanking(season.id);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Link href="/temporadas" className="transition-colors hover:text-slate-300">
          Temporadas
        </Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">{season.name}</span>
      </nav>

      <div>
        <h1 className="font-pixel text-base leading-snug text-[#FFCB05]">
          Ranking da Temporada
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Classificacao acumulada dos campeonatos vinculados a {season.name}.
        </p>
      </div>

      {season.tournaments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {season.tournaments.map((tournament) => (
            <Link
              key={tournament.slug}
              href={`/torneios/${tournament.slug}`}
              className="rounded-full border border-border px-3 py-1 text-xs text-slate-300 transition-colors hover:border-[#FFCB05]/40 hover:text-[#FFCB05]"
            >
              {tournament.name}
            </Link>
          ))}
        </div>
      )}

      {ranking.length === 0 ? (
        <Card>
          <EmptyState
            message="Ainda nao ha resultados validados nesta temporada."
            icon={<Trophy size={32} />}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Jogador</th>
                  <th className="px-5 py-3">Pts</th>
                  <th className="px-5 py-3">V</th>
                  <th className="px-5 py-3">E</th>
                  <th className="px-5 py-3">D</th>
                  <th className="px-5 py-3">Partidas</th>
                  <th className="px-5 py-3">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ranking.map((entry) => (
                  <tr key={entry.playerId}>
                    <td className="px-5 py-3 font-semibold text-[#FFCB05]">
                      #{entry.position}
                    </td>
                    <td className="px-5 py-3 font-medium text-white">{entry.displayName}</td>
                    <td className="px-5 py-3 text-white">{entry.points}</td>
                    <td className="px-5 py-3 text-emerald-400">{entry.wins}</td>
                    <td className="px-5 py-3 text-slate-300">{entry.draws}</td>
                    <td className="px-5 py-3 text-red-400">{entry.losses}</td>
                    <td className="px-5 py-3 text-slate-300">{entry.matchesPlayed}</td>
                    <td className="px-5 py-3 text-slate-300">{entry.gameDiff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
