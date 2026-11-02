import { ShopItemRarity } from "@prisma/client";
import { prisma } from "./prisma";
import { TRAINING_MILESTONE_ITEMS } from "./training-catalog";

/** Idempotent catalog bootstrap used by the Shop and expedition reward path. */
export async function ensureTrainingMilestoneShopItems(active = true) {
  let changed = false;
  for (const item of TRAINING_MILESTONE_ITEMS) {
    const existing = await prisma.shopItem.findFirst({ where: { type: item.type as never }, select: { id: true, name: true, description: true, imageUrl: true, price: true, active: true, inventoryEnabled: true, rarity: true, metadata: true } });
    const data = {
      name: item.name,
      description: `Consumível negociável. Ao usar em um mascote, inicia a Jornada de Postura ${item.stanceName}; o Marco é consumido mesmo se a jornada for cancelada ou substituída.`,
      imageUrl: item.imageUrl, price: item.price, active, inventoryEnabled: true,
      rarity: ShopItemRarity.EPIC, metadata: item.metadata,
    };
    if (existing) {
      const stale = existing.name !== data.name || existing.description !== data.description || existing.imageUrl !== data.imageUrl || existing.price !== data.price || existing.active !== data.active || existing.inventoryEnabled !== data.inventoryEnabled || existing.rarity !== data.rarity || JSON.stringify(existing.metadata) !== JSON.stringify(data.metadata);
      if (stale) { await prisma.shopItem.update({ where: { id: existing.id }, data }); changed = true; }
    } else { await prisma.shopItem.create({ data: { type: item.type as never, ...data } }); changed = true; }
  }
  // Esta função também roda em scripts e na conclusão de expedição. Não chame
  // revalidateTag aqui: fora de uma Server Action/Route Handler o Next lança
  // "static generation store missing" e derruba a renderização da Loja.
  // O cache público expira em até cinco minutos e mutações administrativas já
  // possuem seu próprio caminho de invalidação.
  return changed;
}
