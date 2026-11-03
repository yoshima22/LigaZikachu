/**
 * backfill-training-journey-combat-2026-11.ts (idempotente)
 *
 * Recupera o progresso das jornadas de postura ATIVAS a partir das partidas já resolvidas da Liga Semanal
 * e da Liga Rush (resolvidas depois do início de cada jornada). Usa o mesmo código do combate ao vivo
 * (recordLeagueBattleProgress); o id da partida fica no "livro" do marco LEAGUE, então rodar de novo não duplica.
 * Partidas antigas não têm `round` no log: objetivos baseados em round só contam a partir das novas.
 *
 * Uso: npx tsx scripts/backfill-training-journey-combat-2026-11.ts           (simulação, nada é gravado)
 *      npx tsx scripts/backfill-training-journey-combat-2026-11.ts --apply   (grava)
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { recordLeagueBattleProgress } from "../src/lib/training-journeys";

for (const f of [".env", ".env.local"]) {
  const p = resolve(process.cwd(), f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] ??= v;
  }
}

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();
class DryRun extends Error {}

type Battle = { id: string; resolvedAt: Date; replayJson: unknown; resultJson: unknown; winnerId: string | null; isDraw: boolean; playerAId: string };

async function main() {
  const journeys = await prisma.mascotTrainingJourney.findMany({
    where: { status: "ACTIVE" },
    include: { mascot: { select: { nickname: true, player: { select: { displayName: true } } } }, milestones: { orderBy: { milestoneKey: "asc" } } },
  });
  if (!journeys.length) return console.log("Nenhuma jornada ativa.");
  const since = new Date(Math.min(...journeys.map((j) => j.startedAt.getTime())));
  const ids = new Set(journeys.map((j) => j.mascotId));
  const select = { id: true, resolvedAt: true, replayJson: true, resultJson: true, winnerId: true, isDraw: true, playerAId: true } as const;
  const [weekly, rush] = await Promise.all([
    prisma.weeklyMascotLeagueMatch.findMany({ where: { status: "RESOLVED", resolvedAt: { gte: since } }, select, orderBy: { resolvedAt: "asc" } }),
    prisma.rushLeagueMatch.findMany({ where: { status: "RESOLVED", resolvedAt: { gte: since } }, select, orderBy: { resolvedAt: "asc" } }),
  ]);
  const battles = ([...weekly, ...rush] as Battle[]).sort((a, b) => a.resolvedAt.getTime() - b.resolvedAt.getTime());
  console.log(`${journeys.length} jornadas ativas; ${battles.length} partidas resolvidas desde ${since.toISOString()}.`);

  const before = new Map(journeys.map((j) => [j.id, new Map(j.milestones.map((m) => [m.milestoneKey, m.value]))]));
  try {
    await prisma.$transaction(async (tx) => {
      for (const b of battles) {
        const r = (b.resultJson ?? {}) as { lineupA?: Array<{ id: string }>; lineupB?: Array<{ id: string }> };
        const lineupA = r.lineupA ?? [], lineupB = r.lineupB ?? [];
        if (![...lineupA, ...lineupB].some((m) => ids.has(m.id)) || !Array.isArray(b.replayJson)) continue;
        const winner = b.isDraw || !b.winnerId ? "DRAW" : b.winnerId === b.playerAId ? "A" : "B";
        const res = await recordLeagueBattleProgress(tx, { battleId: b.id, resolvedAt: b.resolvedAt, log: b.replayJson as never, lineupA: lineupA as never, lineupB: lineupB as never, winner, rounds: Number((r as { rounds?: number }).rounds) || 0 });
        if (res.counted) console.log(`  partida ${b.id} (${b.resolvedAt.toISOString()}): contou em ${res.counted} jornada(s)`);
      }
      const after = await tx.mascotTrainingJourney.findMany({ where: { id: { in: journeys.map((j) => j.id) } }, include: { milestones: { orderBy: { milestoneKey: "asc" } } } });
      for (const j of after) {
        const meta = journeys.find((x) => x.id === j.id)!;
        const changes = j.milestones.filter((m) => m.value !== before.get(j.id)!.get(m.milestoneKey));
        console.log(`\n${meta.mascot.player.displayName} / ${meta.mascot.nickname ?? j.mascotId} / ${j.stanceKey} [${j.status}]${changes.length ? "" : " — sem mudança"}`);
        for (const m of changes) console.log(`   ${m.milestoneKey}: ${before.get(j.id)!.get(m.milestoneKey)} -> ${m.value}/${m.target}`);
      }
      if (!APPLY) throw new DryRun();
    }, { timeout: 120_000, maxWait: 20_000 });
    console.log("\n[APPLY] gravado.");
  } catch (e) {
    if (e instanceof DryRun) console.log("\n[DRY] nada foi gravado (transação desfeita). Use --apply para gravar.");
    else throw e;
  }
}

main().finally(() => prisma.$disconnect());
