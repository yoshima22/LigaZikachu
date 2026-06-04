export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getPokemonName, getSpriteUrl, getStaticSpriteUrl } from "@/lib/mascot-data";
import Link from "next/link";

type RankTab = "level" | "force" | "happiness" | "friends" | "battles";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

async function getRanking(tab: RankTab) {
  if (tab === "friends") {
    const mascots = await prisma.mascot.findMany({ where: { player: { user: { role: "PLAYER" } } },
      include: {
        player: { select: { displayName: true } },
        relationsAsA: { where: { type: "FRIEND" }, select: { id: true } },
      },
      orderBy: { relationsAsA: { _count: "desc" } },
      take: 50,
    });
    return mascots.map(m => ({
      id: m.id,
      pokemonId: m.pokemonId,
      nickname: m.nickname,
      ownerName: m.player.displayName,
      value: m.relationsAsA.length,
      valueLabel: "amigos",
    }));
  }

  const orderByMap: Record<Exclude<RankTab, "friends">, object> = {
    level:     { level: "desc" },
    force:     { statForce: "desc" },
    happiness: { happiness: "desc" },
    battles:   { battleWins: "desc" },
  };

  const mascots = await prisma.mascot.findMany({ where: { player: { user: { role: "PLAYER" } } },
    include: { player: { select: { displayName: true } } },
    orderBy: orderByMap[tab as Exclude<RankTab, "friends">],
    take: 50,
  });

  const valueMap: Record<Exclude<RankTab, "friends">, (m: typeof mascots[number]) => number> = {
    level:     m => m.level,
    force:     m => m.statForce,
    happiness: m => m.happiness,
    battles:   m => m.battleWins,
  };
  const labelMap: Record<Exclude<RankTab, "friends">, string> = {
    level:     "Nv.",
    force:     "Força",
    happiness: "Humor",
    battles:   "vitórias",
  };

  return mascots.map(m => ({
    id: m.id,
    pokemonId: m.pokemonId,
    nickname: m.nickname,
    ownerName: m.player.displayName,
    value: valueMap[tab as Exclude<RankTab, "friends">](m),
    valueLabel: labelMap[tab as Exclude<RankTab, "friends">],
  }));
}

const TABS: { key: RankTab; label: string; emoji: string }[] = [
  { key: "level",     label: "Nível",    emoji: "⭐" },
  { key: "force",     label: "Força",    emoji: "💪" },
  { key: "happiness", label: "Humor",    emoji: "💛" },
  { key: "friends",   label: "Amigos",   emoji: "💚" },
  { key: "battles",   label: "Batalhas", emoji: "⚔️" },
];

export default async function MascotRankingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = (params.tab as RankTab) ?? "level";
  const ranking = await getRanking(tab);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Ranking de Mascotes</h1>
        <p className="text-sm text-slate-500">Top 50 mascotes da liga</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-slate-900/60 p-1">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/mascotes/ranking?tab=${t.key}`}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold transition-all ${
              tab === t.key
                ? "bg-[#FFCB05] text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.emoji} {t.label}
          </Link>
        ))}
      </div>

      {/* Ranking list */}
      <div className="rounded-xl border border-border bg-slate-950/60 overflow-hidden">
        {ranking.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">Nenhum mascote encontrado.</p>
        )}
        {ranking.map((entry, i) => (
          <div
            key={entry.id}
            className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? "border-t border-border/40" : ""} ${i < 3 ? "bg-[#FFCB05]/5" : ""}`}
          >
            {/* Rank */}
            <span className={`w-7 shrink-0 text-center text-sm font-bold ${
              i === 0 ? "text-[#FFCB05]" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-slate-600"
            }`}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
            </span>

            {/* Sprite */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getSpriteUrl(entry.pokemonId, false)}
              alt={entry.nickname ?? getPokemonName(entry.pokemonId)}
              width={48}
              height={48}
              className="shrink-0 object-contain"
              style={{ imageRendering: "pixelated" }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {entry.nickname ?? getPokemonName(entry.pokemonId)}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                #{entry.pokemonId} · {entry.ownerName}
              </p>
            </div>

            {/* Value */}
            <div className="shrink-0 text-right">
              <p className="text-base font-bold text-[#FFCB05]">{entry.value}</p>
              <p className="text-[10px] text-slate-600">{entry.valueLabel}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Link href="/mascotes" className="text-xs text-slate-500 hover:text-slate-300 underline">
          Voltar para Mascotes
        </Link>
      </div>
    </div>
  );
}
