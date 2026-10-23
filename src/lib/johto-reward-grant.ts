import { EggType, FoodType, Prisma, ZikaCoinTxType, type ShopItemType } from "@prisma/client";
import { creditCoins } from "@/lib/zikacoins";
import type { JohtoReward } from "@/lib/johto-reward-boxes";

const EGG_BY_ID: Record<string, EggType> = { "event-egg": EggType.EVENT, "special-egg": EggType.SPECIAL, "lab-egg": EggType.LAB };
const FEATHER_TIER_BY_ID: Record<string, string> = { "rare-feather": "RARE", "special-feather": "SPECIAL", "lab-feather": "LAB" };
const ITEM_TYPE_BY_ID: Record<string, ShopItemType> = { loot: "ZIKALOOT_TICKET", vacation: "VACATION_TICKET", protein: "MASCOT_BUFF_STAT" };

async function addShopItem(tx: Prisma.TransactionClient, playerId: string, where: Prisma.ShopItemWhereInput, quantity: number, label: string) {
  // active: true exclui variantes só de admin (ex.: Ticket da Torre, Pena Primordial).
  const item = await tx.shopItem.findFirst({ where: { ...where, active: true }, select: { id: true }, orderBy: { createdAt: "asc" } });
  if (!item) throw new Error(`Item "${label}" não encontrado na loja. O prêmio foi mantido na caixa.`);
  await tx.playerInventory.upsert({
    where: { playerId_itemId: { playerId, itemId: item.id } },
    update: { quantity: { increment: quantity } },
    create: { playerId, itemId: item.id, quantity, equipped: false, source: "EVENT_REWARD" },
  });
}

/**
 * Credita prêmios de Johto na conta. Qualquer item desconhecido ou ausente
 * aborta a transação inteira — o presente continua na caixa, nada é perdido.
 */
export async function grantJohtoRewards(tx: Prisma.TransactionClient, playerId: string, rewards: JohtoReward[], origin: string) {
  for (const r of rewards) {
    const quantity = Math.floor(r.quantity);
    if (!(quantity > 0)) continue;
    if (r.id === "coins") {
      await creditCoins(tx, { playerId, type: ZikaCoinTxType.ACHIEVEMENT_REWARD, amount: quantity, description: origin });
    } else if (r.id === "food" || r.id === "sweet") {
      const type = r.id === "food" ? FoodType.FOOD : FoodType.SWEET;
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId, type } },
        update: { quantity: { increment: quantity } },
        create: { playerId, type, quantity },
      });
    } else if (EGG_BY_ID[r.id]) {
      await tx.mascotEgg.createMany({
        data: Array.from({ length: quantity }, () => ({ playerId, type: EGG_BY_ID[r.id], origin, hatchRarityBonusPct: r.boostPercent ?? 0 })),
      });
    } else if (FEATHER_TIER_BY_ID[r.id]) {
      await addShopItem(tx, playerId, { type: "RAINBOW_FEATHER", metadata: { path: ["eggTier"], equals: FEATHER_TIER_BY_ID[r.id] } }, quantity, r.label);
    } else if (ITEM_TYPE_BY_ID[r.id]) {
      await addShopItem(tx, playerId, { type: ITEM_TYPE_BY_ID[r.id] }, quantity, r.label);
    } else {
      throw new Error(`Prêmio desconhecido (${r.id}). O prêmio foi mantido na caixa.`);
    }
  }
}
