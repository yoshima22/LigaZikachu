import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
export const dynamic = "force-dynamic";
type Metric = {
  speciesId: number;
  damageDealt: number;
  damageReceived: number;
  healing: number;
  kos: number;
  actions: number;
};
type Row = {
  key: string;
  player: string;
  speciesId: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  kos: number;
  damage: number;
  received: number;
  healing: number;
  score: number;
};
export default async function MascotRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: modeParam } = await searchParams;
  const mode = modeParam === "REAL" ? "REAL" : "CUSTOM";
  const matches = await prisma.arenaDraftMatch.findMany({
    where: {
      state: "FINISHED",
      playerBId: { not: null },
      // Ranking por mascote separado por modo.
      mode,
      playerA: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } },
      playerB: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } },
    },
    orderBy: { finishedAt: "desc" },
    take: 500,
    select: {
      playerAId: true,
      playerBId: true,
      winnerId: true,
      metricsJson: true,
      playerA: { select: { displayName: true } },
      playerB: { select: { displayName: true } },
    },
  });
  const rows = new Map<string, Row>();
  for (const match of matches) {
    const metrics = (match.metricsJson ?? {}) as unknown as {
      playerA?: Metric[];
      playerB?: Metric[];
    };
    for (const side of [
      {
        id: match.playerAId,
        name: match.playerA.displayName,
        list: metrics.playerA ?? [],
      },
      {
        id: match.playerBId!,
        name: match.playerB!.displayName,
        list: metrics.playerB ?? [],
      },
    ])
      for (const m of side.list) {
        const key = `${side.id}:${m.speciesId}`,
          row = rows.get(key) ?? {
            key,
            player: side.name,
            speciesId: m.speciesId,
            matches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            kos: 0,
            damage: 0,
            received: 0,
            healing: 0,
            score: 0,
          };
        row.matches++;
        if (!match.winnerId) row.draws++;
        else if (match.winnerId === side.id) row.wins++;
        else row.losses++;
        row.kos += m.kos;
        row.damage += m.damageDealt;
        row.received += m.damageReceived;
        row.healing += m.healing;
        rows.set(key, row);
      }
  }
  const ranked = [...rows.values()]
    .filter((r) => r.matches >= 5)
    .map((r) => ({
      ...r,
      score: Math.round(
        r.wins * 100 -
          r.losses * 35 +
          r.kos * 18 +
          r.damage / 120 +
          r.healing / 100,
      ),
    }))
    .sort((a, b) => b.score - a.score || b.wins - a.wins);
  return (
    <div className="space-y-5">
      <Link
        href="/combates/arena-draft"
        className="text-xs font-bold text-cyan-300"
      >
        ← Arena Draft
      </Link>
      <header className="rounded-3xl bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,.18),transparent_36%),#050916] p-7">
        <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">
          Meta do Beta
        </p>
        <h1 className="mt-2 text-3xl font-black text-white">
          Ranking por mascote e jogador
        </h1>
        <div className="mt-3 flex gap-2">
          {(
            [
              ["CUSTOM", "⚙️ Customizado"],
              ["REAL", "🐾 Meus mascotes"],
            ] as const
          ).map(([m, label]) => (
            <Link
              key={m}
              href={`/combates/arena-draft/ranking-mascotes?mode=${m}`}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${mode === m ? (m === "REAL" ? "bg-emerald-400 text-slate-950" : "bg-cyan-300 text-slate-950") : "border border-white/10 text-slate-400"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Amostra mínima de 5 partidas por combinação. Partidas com
          administradores são removidas integralmente.
        </p>
        <p className="mt-3 text-[10px] text-slate-500">
          Score atual: +100 por vitória, −35 por derrota, +18 por KO, dano ÷ 120
          e cura ÷ 100. Valores Beta, sem premiação.
        </p>
      </header>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
        <div className="grid grid-cols-[44px_1fr_auto] gap-3 border-b border-white/10 px-4 py-3 text-[9px] font-black uppercase text-slate-500 sm:grid-cols-[44px_1fr_120px_170px_90px]">
          <span>#</span>
          <span>Mascote · jogador</span>
          <span className="hidden sm:block">Partidas</span>
          <span className="hidden sm:block">Contribuição</span>
          <span>Score</span>
        </div>
        {ranked.length ? (
          ranked.map((r, i) => (
            <div
              key={r.key}
              className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0 sm:grid-cols-[44px_1fr_120px_170px_90px]"
            >
              <b className="text-cyan-300">#{i + 1}</b>
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={getSpriteUrl(r.speciesId)}
                  alt=""
                  className="h-10 w-10 object-contain"
                />
                <span className="min-w-0">
                  <b className="block truncate text-sm text-white">
                    {getPokemonName(r.speciesId)}
                  </b>
                  <small className="text-slate-500">{r.player}</small>
                </span>
              </div>
              <span className="hidden text-xs text-slate-300 sm:block">
                {r.matches} · {r.wins}V {r.losses}D {r.draws}E
              </span>
              <span className="hidden text-[10px] text-slate-400 sm:block">
                {r.kos} KO · {r.damage} dano · {r.healing} cura
              </span>
              <b className="text-right text-sm text-fuchsia-300">{r.score}</b>
            </div>
          ))
        ) : (
          <p className="p-12 text-center text-sm text-slate-500">
            Ainda não há combinações com cinco partidas válidas.
          </p>
        )}
      </section>
    </div>
  );
}
