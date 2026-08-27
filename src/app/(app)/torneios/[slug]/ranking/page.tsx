import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RankingTable } from "@/components/ranking/ranking-table";
import { computeTournamentRanking } from "@/lib/ranking";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Award, ChevronRight, Trophy } from "lucide-react";

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

  const [ranking, badges, registrations] = await Promise.all([
    computeTournamentRanking(tournament.id),
    prisma.leagueBadge.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, imageUrl: true,
        progress: { select: { playerId: true, points: true } },
        owners: { select: { playerId: true } },
      },
    }),
    prisma.tournamentRegistration.findMany({
      where: { tournamentId: tournament.id, status: "APPROVED" },
      select: { player: { select: { id: true, displayName: true } } },
    }),
  ]);
  const badgeProgress = new Map(badges.flatMap((badge) => badge.progress.map((entry) => [`${entry.playerId}:${badge.id}`, entry.points] as const)));
  const badgeOwners = new Set(badges.flatMap((badge) => badge.owners.map((entry) => `${entry.playerId}:${badge.id}`)));
  const badgeRows = registrations.map(({ player }) => ({
    player,
    points: badges.map((badge) => badgeProgress.get(`${player.id}:${badge.id}`) ?? 0),
  })).sort((a, b) => b.points.reduce((sum, value) => sum + value, 0) - a.points.reduce((sum, value) => sum + value, 0) || a.player.displayName.localeCompare(b.player.displayName));

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

      {badges.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-800 bg-slate-900/70 px-4 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Award size={17} className="text-[#FFCB05]" /> Jornada de Ginásio — pontos por insígnia</h2>
            <p className="mt-1 text-xs text-slate-400">Cada vitória com um deck vinculado a uma intenção válida soma 1 ponto quando o dia é oficialmente fechado. A entrega da insígnia pelo administrador é registrada separadamente.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="min-w-40 px-4 py-3">Jogador</th>
                  {badges.map((badge) => (
                    <th key={badge.id} className="min-w-28 px-3 py-3 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={badge.imageUrl} alt="" className="mx-auto mb-1 h-8 w-8 object-contain" />
                      <span>{badge.name}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {badgeRows.map((row, index) => (
                  <tr key={row.player.id} className="bg-slate-950/20 hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold text-white">{row.player.displayName}</td>
                    {badges.map((badge, badgeIndex) => {
                      const owned = badgeOwners.has(`${row.player.id}:${badge.id}`);
                      return <td key={badge.id} className="px-3 py-3 text-center"><span className={row.points[badgeIndex] > 0 ? "font-bold text-[#FFCB05]" : "text-slate-600"}>{row.points[badgeIndex]}</span>{owned && <span className="ml-1 text-emerald-400" title="Insígnia já entregue">✓</span>}</td>;
                    })}
                    <td className="px-4 py-3 text-center font-bold text-cyan-300">{row.points.reduce((sum, value) => sum + value, 0)}</td>
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
