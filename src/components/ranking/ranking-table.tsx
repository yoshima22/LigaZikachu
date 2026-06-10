import type { PlayerRankingEntry } from "@/lib/ranking";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";

interface RankingTableProps {
  ranking: PlayerRankingEntry[];
  compact?: boolean;
}

export function RankingTable({ ranking, compact = false }: RankingTableProps) {
  if (ranking.length === 0) return null;

  // Colunas visiveis. mobile: apenas as essenciais; sm+: todas.
  const cols = [
    { label: "#",           key: "position",             color: "text-[#FFCB05] font-bold",      mobileHide: false },
    { label: "Jogador",      key: "displayName",          color: "text-white font-medium text-left", mobileHide: false },
    { label: "Pts",          key: "points",               color: "text-white font-bold",          mobileHide: false },
    { label: "V",            key: "wins",                 color: "text-emerald-400 font-semibold",mobileHide: false },
    { label: "D",            key: "losses",               color: "text-red-400",                  mobileHide: false },
    { label: "E",            key: "draws",                color: "text-slate-400",                mobileHide: true  },
    { label: "J",            key: "matchesPlayed",        color: "text-slate-300",                mobileHide: true  },
    { label: "Insígnias",    key: "badgesOwned",          color: "text-[#FFCB05]",                mobileHide: true  },
    { label: "Pts Insígnia", key: "badgePoints",          color: "text-[#FFCB05]",                mobileHide: true  },
    { label: "Prêmios",      key: "defendedPrizes",       color: "text-slate-300",                mobileHide: true  },
    { label: "Desafios",     key: "gymChallenges",        color: "text-slate-300",                mobileHide: true  },
    { label: "✓ Desafios",   key: "successfulChallenges", color: "text-emerald-400",              mobileHide: true  },
    { label: "Def. Gin.",    key: "defendedChallenges",   color: "text-slate-300",                mobileHide: true  },
    { label: "✗ Desafios",   key: "failedChallenges",     color: "text-red-400",                  mobileHide: true  },
  ] as const;

  type ColKey = typeof cols[number]["key"];

  const val = (entry: PlayerRankingEntry, key: ColKey): string | number =>
    key === "displayName" ? entry.displayName : entry[key as keyof PlayerRankingEntry] as number;

  const renderPlayer = (entry: PlayerRankingEntry) => {
    const mascot = entry.equippedMascot;
    if (!mascot) return entry.displayName;

    const mascotName = mascot.nickname ?? getPokemonName(mascot.pokemonId);

    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <img
          src={getSpriteUrl(mascot.pokemonId)}
          alt={mascotName}
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 object-contain [image-rendering:pixelated]"
          title={`${mascotName} Nv.${mascot.level}`}
        />
        <span className="truncate">{entry.displayName}</span>
      </div>
    );
  };

  const th = compact
    ? "px-1.5 py-1.5 text-center text-[9px] uppercase tracking-wide text-slate-500 whitespace-nowrap font-semibold"
    : "px-2 py-2 text-center text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap font-semibold";

  const td = compact
    ? "px-1.5 py-1.5 text-center text-[10px] whitespace-nowrap"
    : "px-2 py-2.5 text-center text-xs whitespace-nowrap";

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-slate-950/60">
      <table className="w-full divide-y divide-border">
        <thead className="bg-slate-900/80">
          <tr>
            {cols.map(c => (
              <th key={c.key} className={`${th} ${c.key === "displayName" ? "text-left pl-3" : ""} ${c.mobileHide ? "hidden sm:table-cell" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {ranking.map((entry, i) => (
            <tr
              key={entry.playerId}
              className={`transition-colors hover:bg-slate-800/30 ${i === 0 ? "bg-[#FFCB05]/5" : ""}`}
            >
              {cols.map(c => (
                <td
                  key={c.key}
                  className={`${td} ${c.color} ${c.key === "displayName" ? "text-left pl-3" : ""} ${c.mobileHide ? "hidden sm:table-cell" : ""}`}
                >
                  {c.key === "displayName"
                    ? renderPlayer(entry)
                    : c.key === "position"
                      ? `#${entry.position}`
                      : val(entry, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
