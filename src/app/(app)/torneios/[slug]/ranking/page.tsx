import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RankingTable } from "@/components/ranking/ranking-table";
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
          <RankingTable ranking={ranking} />
        </Card>
      )}
    </div>
  );
}
