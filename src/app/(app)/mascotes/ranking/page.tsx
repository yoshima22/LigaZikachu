import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import Link from "next/link";

type RankTab = "level" | "force" | "agility" | "charisma" | "instinct" | "vitality" | "battles" | "diary";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const MASCOT_SELECT = {
  id: true, pokemonId: true, nickname: true, level: true, exp: true,
  mood: true,
  statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
  battleWins: true, battleLosses: true,
  player: { select: { id: true, displayName: true } },
} as const;

const PLAYER_FILTER = { player: { user: { role: "PLAYER" as const } } };

// ── Helpers ────────────────────────────────────────────────────────────────────

type RankEntry = {
  id: string; pokemonId: number; nickname: string | null;
  ownerName: string; ownerId: string; level: number;
  value: number; value2: number; valueLabel: string;
  extra: string | null;
};

type DiaryEntry = {
  id: string; emoji: string; description: string; createdAt: Date;
  mascotId: string; pokemonId: number; nickname: string | null;
  ownerName: string; ownerId: string;
};

function statRanking(
  mascots: Array<typeof MASCOT_SELECT & { statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number; level: number; battleWins: number; battleLosses: number; mood: string; id: string; pokemonId: number; nickname: string | null; exp: number; player: { id: string; displayName: string } }>,
  statKey: "statForce" | "statAgility" | "statCharisma" | "statInstinct" | "statVitality",
  valueLabel: string,
): RankEntry[] {
  return (mascots as unknown as Record<string, unknown>[]).map(m => {
    const mm = m as { id: string; pokemonId: number; nickname: string | null; level: number; statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number; player: { id: string; displayName: string } };
    return {
      id: mm.id, pokemonId: mm.pokemonId, nickname: mm.nickname,
      ownerName: mm.player.displayName, ownerId: mm.player.id, level: mm.level,
      value: mm[statKey] as number, value2: 0, valueLabel,
      extra: `Nv.${mm.level} · Total stats ${mm.statForce + mm.statAgility + mm.statCharisma + mm.statInstinct + mm.statVitality}`,
    };
  });
}

const getCachedRanking = (tab: RankTab) =>
  unstable_cache(
    () => _getRanking(tab),
    ["mascot-ranking", tab],
    { revalidate: 300, tags: ["mascot-ranking"] },
  )();

async function _getRanking(tab: RankTab): Promise<{ ranking: RankEntry[]; diary: DiaryEntry[] }> {
  const empty: RankEntry[] = [];

  // ── Diário ─────────────────────────────────────────────────────────────────
  if (tab === "diary") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const events = await prisma.mascotEvent.findMany({
      where: { mascot: PLAYER_FILTER, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true, emoji: true, description: true, createdAt: true,
        mascot: {
          select: {
            id: true, pokemonId: true, nickname: true,
            player: { select: { id: true, displayName: true } },
          },
        },
      },
    });
    const diary: DiaryEntry[] = events.map(e => ({
      id: e.id, emoji: e.emoji, description: e.description, createdAt: e.createdAt,
      mascotId: e.mascot.id, pokemonId: e.mascot.pokemonId, nickname: e.mascot.nickname,
      ownerName: e.mascot.player.displayName, ownerId: e.mascot.player.id,
    }));
    return { ranking: empty, diary };
  }

  // ── Batalhas ──────────────────────────────────────────────────────────────
  if (tab === "battles") {
    const mascots = await prisma.mascot.findMany({
      where: PLAYER_FILTER, select: MASCOT_SELECT,
      orderBy: [{ battleWins: "desc" }, { battleLosses: "asc" }, { id: "asc" }],
      take: 50,
    });
    return {
      ranking: mascots.map(m => {
        const total = m.battleWins + m.battleLosses;
        const pct = total > 0 ? Math.round((m.battleWins / total) * 100) : 0;
        return {
          id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
          ownerName: m.player.displayName, ownerId: m.player.id, level: m.level,
          value: m.battleWins, value2: 0, valueLabel: "vitórias",
          extra: total > 0 ? `${pct}% aproveit. · ${m.battleLosses} derrotas` : "sem derrotas",
        };
      }),
      diary: [],
    };
  }

  // ── Nível ─────────────────────────────────────────────────────────────────
  if (tab === "level") {
    const mascots = await prisma.mascot.findMany({
      where: PLAYER_FILTER, select: MASCOT_SELECT,
      orderBy: [{ level: "desc" }, { exp: "desc" }, { id: "asc" }],
      take: 50,
    });
    return {
      ranking: mascots
        .map(m => ({
          id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
          ownerName: m.player.displayName, ownerId: m.player.id, level: m.level,
          totalStats: m.statForce + m.statAgility + m.statCharisma + m.statInstinct + m.statVitality,
          value: m.level, value2: m.exp, valueLabel: "nível",
          extra: `${m.exp.toLocaleString("pt-BR")} EXP`,
        }))
        .sort((a, b) => b.level - a.level || b.value2 - a.value2 || b.totalStats - a.totalStats)
        .slice(0, 50),
      diary: [],
    };
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const statMap: Record<string, { key: "statForce" | "statAgility" | "statCharisma" | "statInstinct" | "statVitality"; label: string; order: object[] }> = {
    force:    { key: "statForce",    label: "Força",      order: [{ statForce:    "desc" }, { statVitality:  "desc" }, { id: "asc" }] },
    agility:  { key: "statAgility",  label: "Agilidade",  order: [{ statAgility:  "desc" }, { statForce:     "desc" }, { id: "asc" }] },
    charisma: { key: "statCharisma", label: "Carisma",    order: [{ statCharisma: "desc" }, { statInstinct:  "desc" }, { id: "asc" }] },
    instinct: { key: "statInstinct", label: "Instinto",   order: [{ statInstinct: "desc" }, { statCharisma:  "desc" }, { id: "asc" }] },
    vitality: { key: "statVitality", label: "Vitalidade", order: [{ statVitality: "desc" }, { statForce:     "desc" }, { id: "asc" }] },
  };

  const cfg = statMap[tab];
  if (!cfg) return { ranking: empty, diary: [] };

  const mascots = await prisma.mascot.findMany({
    where: PLAYER_FILTER, select: MASCOT_SELECT,
    orderBy: cfg.order,
    take: 50,
  });

  return { ranking: statRanking(mascots as Parameters<typeof statRanking>[0], cfg.key, cfg.label), diary: [] };
}

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS: { key: RankTab; label: string; emoji: string }[] = [
  { key: "level",    label: "Nível",      emoji: "⭐" },
  { key: "force",    label: "Força",      emoji: "💪" },
  { key: "agility",  label: "Agilidade",  emoji: "⚡" },
  { key: "charisma", label: "Carisma",    emoji: "💛" },
  { key: "instinct", label: "Instinto",   emoji: "🔍" },
  { key: "vitality", label: "Vitalidade", emoji: "🛡️" },
  { key: "battles",  label: "Batalhas",   emoji: "⚔️" },
  { key: "diary",    label: "Diário",     emoji: "📖" },
];

// ── Medalhas ───────────────────────────────────────────────────────────────────

function Medal({ pos }: { pos: number }) {
  if (pos === 0) return <span className="text-lg">🥇</span>;
  if (pos === 1) return <span className="text-lg">🥈</span>;
  if (pos === 2) return <span className="text-lg">🥉</span>;
  return <span className="w-7 text-center text-xs font-bold text-slate-600">{pos + 1}</span>;
}

// ── Relative time ──────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1)  return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d atrás`;
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function MascotRankingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawTab = params.tab ?? "level";
  const validTabs: RankTab[] = ["level", "force", "agility", "charisma", "instinct", "vitality", "battles", "diary"];
  const tab: RankTab = validTabs.includes(rawTab as RankTab) ? (rawTab as RankTab) : "level";
  const { ranking, diary } = await getCachedRanking(tab);

  const isDiary = tab === "diary";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">
          {isDiary ? "📖 Diário dos Mascotes" : "🏆 Ranking de Mascotes"}
        </h1>
        <p className="text-sm text-slate-500">
          {isDiary
            ? "Últimos 25 eventos de todos os mascotes da Liga"
            : "Top 50 mascotes · Somente jogadores PLAYER"}
        </p>
      </div>

      {/* Tabs — grade 4×2 (4 colunas fixas, 2 linhas) */}
      <div className="rounded-xl border border-border bg-slate-900/60 p-1.5">
        <div className="grid grid-cols-4 gap-1">
          {TABS.map(t => (
            <Link
              key={t.key}
              href={`/mascotes/ranking?tab=${t.key}`}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-all w-full ${
                tab === t.key
                  ? t.key === "diary"
                    ? "bg-purple-500 text-white"
                    : "bg-[#FFCB05] text-slate-900"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Diário ── */}
      {isDiary && (
        <div className="space-y-2">
          {diary.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-slate-500">
              Nenhum evento registrado ainda.
            </div>
          )}
          {diary.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-start gap-3 rounded-xl border bg-slate-950/60 px-4 py-3 transition-colors hover:bg-slate-900/60 ${
                i < 3 ? "border-purple-500/30" : "border-border/50"
              }`}
            >
              {/* Sprite pequeno */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getSpriteUrl(entry.pokemonId, false)}
                alt=""
                width={36} height={36}
                className="shrink-0 object-contain mt-0.5"
                style={{ imageRendering: "pixelated" }}
              />
              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-slate-200">
                    {entry.nickname ?? getPokemonName(entry.pokemonId)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    de{" "}
                    <Link href={`/jogadores/${entry.ownerId}`} className="hover:text-slate-300 underline underline-offset-2">
                      {entry.ownerName}
                    </Link>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400 leading-snug">
                  <span className="mr-1">{entry.emoji}</span>
                  {entry.description}
                </p>
              </div>
              {/* Tempo */}
              <span className="shrink-0 text-[10px] text-slate-600 mt-0.5 whitespace-nowrap">
                {relativeTime(entry.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Ranking ── */}
      {!isDiary && (
        <div className="rounded-xl border border-border bg-slate-950/60 overflow-hidden">
          {ranking.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">Nenhum mascote encontrado.</p>
          )}
          {ranking.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-900/40 ${
                i !== 0 ? "border-t border-border/40" : ""
              } ${i < 3 ? "bg-[#FFCB05]/5" : ""}`}
            >
              {/* Posição */}
              <div className="w-7 shrink-0 flex justify-center">
                <Medal pos={i} />
              </div>

              {/* Sprite */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getSpriteUrl(entry.pokemonId, false)}
                alt={entry.nickname ?? getPokemonName(entry.pokemonId)}
                width={48} height={48}
                className="shrink-0 object-contain"
                style={{ imageRendering: "pixelated" }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {entry.nickname ?? getPokemonName(entry.pokemonId)}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  #{entry.pokemonId} ·{" "}
                  <Link href={`/jogadores/${entry.ownerId}`} className="hover:text-slate-300">
                    {entry.ownerName}
                  </Link>
                </p>
                {entry.extra && (
                  <p className="text-[10px] text-slate-600 truncate">{entry.extra}</p>
                )}
              </div>

              {/* Valor */}
              <div className="shrink-0 text-right">
                <p className="text-base font-bold text-[#FFCB05]">{entry.value.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] text-slate-600">{entry.valueLabel}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <Link href="/mascotes" className="text-xs text-slate-500 hover:text-slate-300 underline">
          ← Voltar para Mascotes
        </Link>
      </div>
    </div>
  );
}
