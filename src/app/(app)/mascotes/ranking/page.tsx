export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import Link from "next/link";

type RankTab = "level" | "force" | "happiness" | "friends" | "battles";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

// Campos escalares explícitos — evita puxar colunas que podem não existir ainda no banco
const MASCOT_SELECT = {
  id: true, pokemonId: true, nickname: true, level: true, exp: true,
  happiness: true, mood: true,
  statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
  battleWins: true, battleLosses: true,
  player: { select: { id: true, displayName: true } },
} as const;

async function getRanking(tab: RankTab) {
  const playerFilter = { player: { user: { role: "PLAYER" as const } } };

  // ── Amigos ────────────────────────────────────────────────────────────────
  if (tab === "friends") {
    const mascots = await prisma.mascot.findMany({
      where: playerFilter,
      select: {
        ...MASCOT_SELECT,
        relationsAsA: {
          where: { type: "FRIEND" },
          select: { id: true, interactionCount: true },
        },
      },
      take: 200,
    });

    return mascots
      .map(m => ({
        id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
        ownerName: m.player.displayName, ownerId: m.player.id,
        level: m.level,
        value: m.relationsAsA.length,
        value2: m.relationsAsA.reduce((sum, r) => sum + r.interactionCount, 0),
        valueLabel: "amigos",
        extra: null as string | null,
      }))
      .sort((a, b) => b.value - a.value || b.value2 - a.value2)
      .slice(0, 50);
  }

  // ── Batalhas ──────────────────────────────────────────────────────────────
  if (tab === "battles") {
    const mascots = await prisma.mascot.findMany({
      where: playerFilter,
      select: MASCOT_SELECT,
      orderBy: [{ battleWins: "desc" }, { battleLosses: "asc" }, { id: "asc" }],
      take: 50,
    });
    return mascots.map(m => {
      const total = m.battleWins + m.battleLosses;
      const pct   = total > 0 ? Math.round((m.battleWins / total) * 100) : 0;
      return {
        id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
        ownerName: m.player.displayName, ownerId: m.player.id,
        level: m.level,
        value: m.battleWins, value2: 0, valueLabel: "vitórias",
        extra: total > 0 ? `${pct}% aproveit. (${m.battleLosses}D)` : "sem derrotas",
      };
    });
  }

  // ── Nível — desempate: exp → soma de stats ─────────────────────────────
  if (tab === "level") {
    const mascots = await prisma.mascot.findMany({
      where: playerFilter,
      select: MASCOT_SELECT,
      orderBy: [{ level: "desc" }, { exp: "desc" }, { id: "asc" }],
      take: 200, // carrega mais para aplicar desempate de stats em memória
    });

    return mascots
      .map(m => ({
        id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
        ownerName: m.player.displayName, ownerId: m.player.id,
        level: m.level, exp: m.exp,
        totalStats: m.statForce + m.statAgility + m.statCharisma + m.statInstinct + m.statVitality,
        value: m.level, value2: 0, valueLabel: "nível",
        extra: `${m.exp.toLocaleString("pt-BR")} EXP · Stats ${m.statForce + m.statAgility + m.statCharisma + m.statInstinct + m.statVitality}`,
      }))
      .sort((a, b) =>
        b.level - a.level ||
        b.exp - a.exp ||
        b.totalStats - a.totalStats
      )
      .slice(0, 50);
  }

  // ── Força e Felicidade ────────────────────────────────────────────────────
  const orderByMap: Record<"force" | "happiness", object[]> = {
    force:     [{ statForce: "desc" as const }, { statVitality: "desc" as const }, { id: "asc" as const }],
    happiness: [{ happiness: "desc" as const }, { level: "desc" as const }, { id: "asc" as const }],
  };
  const labelMap: Record<"force" | "happiness", string> = {
    force: "Força", happiness: "Felicidade",
  };
  const extraFn: Record<"force" | "happiness", (m: { statForce: number; statAgility: number; statVitality: number; level: number; mood: string }) => string> = {
    force:     m => `Agi ${m.statAgility} · Vit ${m.statVitality} · Nv.${m.level}`,
    happiness: m => `Humor: ${m.mood} · Nv.${m.level}`,
  };

  const mascots = await prisma.mascot.findMany({
    where: playerFilter,
    select: MASCOT_SELECT,
    orderBy: orderByMap[tab as "force" | "happiness"],
    take: 50,
  });

  return mascots.map(m => ({
    id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
    ownerName: m.player.displayName, ownerId: m.player.id,
    level: m.level,
    value: tab === "force" ? m.statForce : m.happiness,
    value2: 0,
    valueLabel: labelMap[tab as "force" | "happiness"],
    extra: extraFn[tab as "force" | "happiness"](m),
  }));
}

const TABS: { key: RankTab; label: string; emoji: string }[] = [
  { key: "level",     label: "Nível",      emoji: "⭐" },
  { key: "force",     label: "Força",      emoji: "💪" },
  { key: "happiness", label: "Felicidade", emoji: "💛" },
  { key: "friends",   label: "Amigos",     emoji: "💚" },
  { key: "battles",   label: "Batalhas",   emoji: "⚔️" },
];

export default async function MascotRankingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawTab = params.tab ?? "level";
  const validTabs: RankTab[] = ["level", "force", "happiness", "friends", "battles"];
  const tab: RankTab = validTabs.includes(rawTab as RankTab) ? (rawTab as RankTab) : "level";
  const ranking = await getRanking(tab);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Ranking de Mascotes</h1>
        <p className="text-sm text-slate-500">Top 50 mascotes da Liga · Somente jogadores PLAYER</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-slate-900/60 p-1">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/mascotes/ranking?tab=${t.key}`}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold transition-all min-w-[60px] ${
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
            <span className={`w-7 shrink-0 text-center text-sm font-bold ${
              i === 0 ? "text-[#FFCB05]" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-slate-600"
            }`}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
            </span>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getSpriteUrl(entry.pokemonId, false)}
              alt={entry.nickname ?? getPokemonName(entry.pokemonId)}
              width={48} height={48}
              className="shrink-0 object-contain"
              style={{ imageRendering: "pixelated" }}
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {entry.nickname ?? getPokemonName(entry.pokemonId)}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                #{entry.pokemonId} · {entry.ownerName}
              </p>
              {entry.extra && (
                <p className="text-[10px] text-slate-600 truncate">{entry.extra}</p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-base font-bold text-[#FFCB05]">{entry.value.toLocaleString("pt-BR")}</p>
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
