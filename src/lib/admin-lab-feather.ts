import { ShopItemRarity, ShopItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ADMIN_LAB_RAINBOW_FEATHER_ID = "admin-lab-rainbow-feather";
export const ADMIN_LAB_RAINBOW_FEATHER_NAME = "Pena Arco-Íris Primordial";

export async function ensureAdminLabRainbowFeather() {
  return prisma.shopItem.upsert({
    where: { id: ADMIN_LAB_RAINBOW_FEATHER_ID },
    create: {
      id: ADMIN_LAB_RAINBOW_FEATHER_ID,
      type: ShopItemType.RAINBOW_FEATHER,
      name: ADMIN_LAB_RAINBOW_FEATHER_NAME,
      description: "Item administrativo de uso único. Permite que um mascote sem origem registrada renasça com atributos de Ovo de Laboratório e registra essa origem.",
      rarity: ShopItemRarity.RELIC,
      price: 0,
      active: false,
      inventoryEnabled: true,
      sortOrder: 99_999,
      metadata: { eggTier: "LAB", adminGrantOnly: true, adminLabOriginOverride: true },
    },
    update: {
      type: ShopItemType.RAINBOW_FEATHER,
      name: ADMIN_LAB_RAINBOW_FEATHER_NAME,
      description: "Item administrativo de uso único. Permite que um mascote sem origem registrada renasça com atributos de Ovo de Laboratório e registra essa origem.",
      rarity: ShopItemRarity.RELIC,
      price: 0,
      active: false,
      inventoryEnabled: true,
      metadata: { eggTier: "LAB", adminGrantOnly: true, adminLabOriginOverride: true },
    },
  });
}
