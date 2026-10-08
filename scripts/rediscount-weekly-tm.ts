/** Aplica desconto aos slots da semana atual que ainda estão sem: npx tsx scripts/rediscount-weekly-tm.ts */
import { PrismaClient } from "@prisma/client";
import { rollDiscountPct } from "../src/lib/miauvadao-pricing";
import type { WeeklyTmSlot } from "../src/lib/weekly-tm";

const prisma = new PrismaClient();
(async () => {
  const cfg = await prisma.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const slots = cfg.weeklyTmSlots as unknown as WeeklyTmSlot[];
  const items = await prisma.shopItem.findMany({ where: { id: { in: slots.map((s) => s.shopItemId) } }, select: { id: true, rarity: true } });
  const rarity = new Map(items.map((i) => [i.id, i.rarity]));
  const next = slots.map((s) => {
    if (s.sold === 1 || s.discountPct > 0) return s;
    const discountPct = rollDiscountPct({ rarity: rarity.get(s.shopItemId) ?? "COMMON", capped: true, vaultBalance: cfg.vaultBalance });
    return { ...s, discountPct, finalPrice: Math.max(1, Math.round(s.originalPrice * (1 - discountPct / 100))) };
  });
  await prisma.miauvadaoConfig.update({ where: { id: "singleton" }, data: { weeklyTmSlots: next as never } });
  console.log(next.map((s) => `${s.name}: -${s.discountPct}% => ${s.finalPrice}${s.sold ? " (vendido)" : ""}`).join("\n"));
})().finally(() => prisma.$disconnect());
