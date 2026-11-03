/**
 * backfill-training-affinity-expeditions-2026-11.ts (idempotente)
 *
 * Recupera a afinidade de expedição (Preguiçoso: 3h/6h, Elétrico: 30min/1h, Curioso: 1ª do dia) das jornadas
 * ATIVAS, a partir das expedições já coletadas e iniciadas depois do início da jornada. Grava max(atual, calculado),
 * então rodar de novo (ou depois de o código ao vivo já ter contado) não duplica.
 * Não recupera Tímido (falta a felicidade no momento da coleta) nem Brincalhão/Guloso (brincar/alimentar não deixam histórico).
 *
 * Uso: npx tsx scripts/backfill-training-affinity-expeditions-2026-11.ts           (simulação)
 *      npx tsx scripts/backfill-training-affinity-expeditions-2026-11.ts --apply   (grava)
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PERSONALITY_NAMES_PT } from "../src/lib/training-milestones";

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
const brDay = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

async function main() {
  const journeys = await prisma.mascotTrainingJourney.findMany({ where: { status: "ACTIVE" }, include: { milestones: true, mascot: { select: { nickname: true, player: { select: { displayName: true } } } } } });
  for (const j of journeys) {
    const m = j.milestones.find((x) => (x.detailsJson as { type?: string } | null)?.type === "AFFINITY");
    const label = (m?.detailsJson as { label?: string } | null)?.label ?? "";
    const key = (["LAZY", "ELECTRIC", "CURIOUS"] as const).find((k) => label.startsWith(`Personalidade ${PERSONALITY_NAMES_PT[k]}:`));
    if (!m || !key) continue;
    const all = await prisma.mascotExpedition.findMany({ where: { mascotId: j.mascotId }, orderBy: { startedAt: "asc" }, select: { startedAt: true, status: true, rewardJson: true } });
    const firstOfDay = new Map<string, Date>();
    for (const e of all) { const d = brDay(e.startedAt); if (!firstOfDay.has(d)) firstOfDay.set(d, e.startedAt); }
    const claimed = all.filter((e) => e.status === "CLAIMED" && e.startedAt >= j.startedAt);
    const dur = (e: (typeof all)[number]) => String((e.rewardJson as { durationKey?: string } | null)?.durationKey ?? "");
    const computed = claimed.filter((e) =>
      key === "LAZY" ? ["3h", "6h"].includes(dur(e))
      : key === "ELECTRIC" ? ["30min", "1h"].includes(dur(e))
      : firstOfDay.get(brDay(e.startedAt))?.getTime() === e.startedAt.getTime()).length;
    const next = Math.min(m.target, Math.max(m.value, computed));
    console.log(`${j.mascot.player.displayName} / ${j.mascot.nickname ?? j.mascotId} / ${key}: ${m.value} -> ${next}/${m.target} (${claimed.length} expedições coletadas na jornada)`);
    if (APPLY && next !== m.value) await prisma.mascotTrainingMilestoneProgress.update({ where: { id: m.id }, data: { value: next, ...(next >= m.target ? { completedAt: new Date() } : {}) } });
  }
  console.log(APPLY ? "[APPLY] gravado." : "[DRY] nada gravado. Use --apply para gravar.");
}

main().finally(() => prisma.$disconnect());
