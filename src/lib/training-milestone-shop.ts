import { ShopItemRarity } from "@prisma/client";
import { prisma } from "./prisma";
import { TRAINING_MILESTONE_ITEMS } from "./training-catalog";
import { invalidateShopCache } from "./shop-cache";

/** Idempotent catalog bootstrap used by the Shop and expedition reward path. */
export async function ensureTrainingMilestoneShopItems(active = true) {
  let changed = false;
  for (const item of TRAINING_MILESTONE_ITEMS) {
    const existing = await prisma.shopItem.findFirst({ where: { type: item.type as never }, select: { id: true } });
    const data = {
      name: item.name,
      description: `Consumível negociável. Ao usar em um mascote, inicia a Jornada de Postura ${item.stanceName}; o Marco é consumido mesmo se a jornada for cancelada ou substituída.`,
      imageUrl: item.imageUrl, price: item.price, active, inventoryEnabled: true,
      rarity: ShopItemRarity.EPIC, metadata: item.metadata,
    };
    if (existing) await prisma.shopItem.update({ where: { id: existing.id }, data });
    else await prisma.shopItem.create({ data: { type: item.type as never, ...data } });
    changed = true;
  }
  if (changed) await invalidateShopCache();
}
