import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeTournamentRanking } from "@/lib/ranking";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TournamentRankingPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true }
  });

  if (!tournament) notFound();

  const ranking = await computeTournamentRanking(tournament.id);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Link href="/torneios" className="transition-colors hover:text-slate-300">
          Torneios
        </Link>
        <ChevronRight size={12} />
        <Link href={`/torneios/${slug}`} className="transition-colors hover:text-slate-300">
          {tournament.name}
        </Link>
        <ChevronRight size={12} />
        <span className="text-slate-300">Ranking do Campeonato</span>
      </nav>

      <div>
        <h1 className="font-pixel text-base leading-snug text-[#FFCB05]">
          Ranking do Campeonato
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Classificacao restrita as partidas validadas de {tournament.name}.
        </p>
      </div>

      {ranking.length === 0 ? (
        <Card>
          <EmptyState
            message="Ainda nao ha participantes ou resultados validados neste campeonato."
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
                  <th className="px-5 py-3">BYE</th>
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
                    <td className="px-5 py-3 text-slate-300">{entry.byeCount}</td>
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
