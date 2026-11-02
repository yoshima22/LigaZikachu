/**
 * Estorna as trocas de Água Fresca do Laboratório feitas em 02/11/2026 (custo antigo: 100 comidas).
 * Devolve as comidas, retira as Águas Frescas ainda não usadas e zera o limite semanal.
 * Se faltar Água Fresca no inventário (já usada), aborta para tratar o caso à mão.
 * Uso: npx tsx scripts/refund-fresh-water-trades-2026-11-02.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const f of [".env", ".env.local"]) { const p = resolve(process.cwd(), f); if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) { const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (!m) continue; let v = m[2].trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); process.env[m[1]] ??= v; } }
const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();
const SINCE = new Date("2026-11-02T03:00:00Z"); // 00:00 BRT
const WEEK_KEY = "2026-W45";

async function main() {
  const trades = await prisma.playerActivityLog.findMany({ where: { entityType: "labFoodTrade", entityId: "FRESH_WATER", createdAt: { gte: SINCE } } });
  const refunded = await prisma.playerActivityLog.findMany({ where: { action: "LAB_FOOD_TRADE_REFUND", createdAt: { gte: SINCE } }, select: { playerId: true } });
  const done = new Set(refunded.map((r) => r.playerId));
  const water = await prisma.shopItem.findFirstOrThrow({ where: { type: "MASCOT_BUFF_MOOD" }, orderBy: [{ active: "desc" }, { createdAt: "asc" }], select: { id: true } });
  const byPlayer = new Map<string, { food: number; qty: number }>();
  for (const t of trades) {
    if (!t.playerId || done.has(t.playerId)) continue;
    const a = byPlayer.get(t.playerId) ?? { food: 0, qty: 0 };
    const after = t.afterJson as { foodSpent?: number; rewardQuantity?: number } | null;
    a.food += after?.foodSpent ?? t.amount ?? 0; a.qty += after?.rewardQuantity ?? 1;
    byPlayer.set(t.playerId, a);
  }
  for (const [playerId, { food, qty }] of byPlayer) {
    console.log(APPLY ? "[APPLY]" : "[DRY]", playerId, `devolver ${food} comidas, retirar ${qty} águas`);
    if (!APPLY) continue;
    await prisma.$transaction(async (tx) => {
      const taken = await tx.playerInventory.updateMany({ where: { playerId, itemId: water.id, quantity: { gte: qty } }, data: { quantity: { decrement: qty } } });
      if (taken.count !== 1) throw new Error(`Jogador ${playerId} não tem ${qty} Águas Frescas no inventário — tratar à mão.`);
      await tx.mascotFoodItem.upsert({ where: { playerId_type: { playerId, type: "FOOD" } }, create: { playerId, type: "FOOD", quantity: food }, update: { quantity: { increment: food } } });
      await tx.labWeeklyUsage.updateMany({ where: { playerId, weekKey: WEEK_KEY }, data: { freshWaters: 0 } });
      await tx.playerActivityLog.create({ data: { playerId, category: "ITEM", action: "LAB_FOOD_TRADE_REFUND", summary: `Laboratório: estorno de ${qty} Água Fresca (+${food} comidas); novo custo 350 comidas`, source: "LABORATORY", entityType: "labFoodTrade", entityId: "FRESH_WATER_REFUND", amount: food, unit: "FOOD" } });
    });
  }
  await prisma.$disconnect();
}
main();
