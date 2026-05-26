import type { PlayerRankingEntry } from "@/lib/ranking";

interface RankingTableProps {
  ranking: PlayerRankingEntry[];
  compact?: boolean;
}

export function RankingTable({ ranking, compact = false }: RankingTableProps) {
  const cell = compact ? "py-2 pr-4" : "px-5 py-3";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-widest text-slate-500">
          <tr>
            <th className={cell}>#</th>
            <th className={cell}>Jogador</th>
            <th className={cell}>Pts</th>
            <th className={cell}>V</th>
            <th className={cell}>E</th>
            <th className={cell}>D</th>
            <th className={cell}>Partidas</th>
            <th className={cell}>Premios Defendidos</th>
            <th className={cell}>Desafios de Ginasio</th>
            <th className={cell}>Desafios Bem Sucedidos</th>
            <th className={cell}>Desafios Perdidos</th>
            <th className={cell}>BYE</th>
            <th className={cell}>Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ranking.map((entry) => (
            <tr key={entry.playerId}>
              <td className={`${cell} font-semibold text-[#FFCB05]`}>#{entry.position}</td>
              <td className={`${cell} font-medium text-white`}>{entry.displayName}</td>
              <td className={`${cell} text-white`}>{entry.points}</td>
              <td className={`${cell} text-emerald-400`}>{entry.wins}</td>
              <td className={`${cell} text-slate-300`}>{entry.draws}</td>
              <td className={`${cell} text-red-400`}>{entry.losses}</td>
              <td className={`${cell} text-slate-300`}>{entry.matchesPlayed}</td>
              <td className={`${cell} text-slate-300`}>{entry.defendedPrizes}</td>
              <td className={`${cell} text-slate-300`}>{entry.gymChallenges}</td>
              <td className={`${cell} text-emerald-400`}>{entry.successfulChallenges}</td>
              <td className={`${cell} text-red-400`}>{entry.failedChallenges}</td>
              <td className={`${cell} text-slate-300`}>{entry.byeCount}</td>
              <td className={`${cell} text-slate-300`}>{entry.gameDiff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
