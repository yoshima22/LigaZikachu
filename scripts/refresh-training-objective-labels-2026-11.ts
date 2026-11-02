/**
 * Reescreve os textos dos marcos de jornada já criados (o label fica gravado em detailsJson).
 * Uso: npx tsx scripts/refresh-training-objective-labels-2026-11.ts [--apply]
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AFFINITY_LABELS, OBJECTIVES, affinityLabel, type TrainingPersonality } from "../src/lib/training-milestones";
for (const f of [".env", ".env.local"]) { const p = resolve(process.cwd(), f); if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) { const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (!m) continue; let v = m[2].trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); process.env[m[1]] ??= v; } }
const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.mascotTrainingMilestoneProgress.findMany({ include: { journey: { select: { stanceKey: true, status: true } } } });
  let changed = 0, legacyExpeditions = 0;
  for (const row of rows) {
    const d = (row.detailsJson ?? {}) as { type?: string; label?: string; modes?: unknown };
    let label: string | undefined;
    if (d.type && d.type in OBJECTIVES) label = OBJECTIVES[d.type as keyof typeof OBJECTIVES].label;
    else if (d.type === "AFFINITY") {
      const m = d.label?.match(/personalidade ([A-Z]+)\.$/);
      if (m && m[1] in AFFINITY_LABELS) label = affinityLabel(m[1] as TrainingPersonality);
      else {
        const known = (Object.keys(AFFINITY_LABELS) as TrainingPersonality[]).find((p) => d.label?.endsWith(AFFINITY_LABELS[p]));
        if (known) label = affinityLabel(known);
      }
    }
    if (d.type === "EXPEDITIONS" && row.value > 0 && !d.modes && row.journey.status === "ACTIVE") legacyExpeditions++;
    if (!label || label === d.label) continue;
    changed++;
    if (APPLY) await prisma.mascotTrainingMilestoneProgress.update({ where: { id: row.id }, data: { detailsJson: { ...d, label } as Prisma.InputJsonValue } });
  }
  console.log(APPLY ? "[APPLY]" : "[DRY]", `marcos: ${rows.length}, textos atualizados: ${changed}, expedições antigas sem detalhe por modo: ${legacyExpeditions}`);
  await prisma.$disconnect();
}
main();
