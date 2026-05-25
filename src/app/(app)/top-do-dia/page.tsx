import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeTopOfDayRanking } from "@/lib/ranking";
import { prisma } from "@/lib/prisma";
import { SeasonStatus } from "@prisma/client";
import { Crown } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TopDoDiaPage() {
  const activeSeason = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true }
  });

  const ranking = activeSeason ? await computeTopOfDayRanking(activeSeason.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-pixel text-base text-[#FFCB05] leading-snug">
          Top do Dia
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Recorte diario com partidas confirmadas e marcadas como elegiveis.
        </p>
      </div>

      {ranking.length === 0 ? (
        <Card>
          <EmptyState
            message="Nenhuma partida elegivel foi confirmada hoje."
            icon={<Crown size={32} />}
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
