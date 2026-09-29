import { EggType, FoodType, ShopItemType, SyncTicketSide, type Prisma, type ShopItem } from "@prisma/client";
import { grantSyncTicketHalf, grantValidSyncTicketForPlayer, SYNC_TICKET_TYPES } from "@/lib/sync-challenge";

export function normalizeRedeemCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Categoria exibida no painel admin para filtrar os ShopItems na hora de montar o prêmio. */
export function redeemItemCategory(type: string) {
  if (type.startsWith("EGG_")) return "Ovos";
  if (type.startsWith("MEGA_STONE_")) return "Pedras de evolução";
  if (type.startsWith("LEAGUE_")) return "Itens de Liga Semanal";
  if (type.startsWith("BOND_")) return "Itens de Laços";
  return "Outros itens";
}

const EGG_BY_ITEM_TYPE: Record<string, EggType> = {
  EGG_COMMON: EggType.COMMON, EGG_RARE: EggType.RARE, EGG_SPECIAL: EggType.SPECIAL, EGG_LAB: EggType.LAB,
  EGG_EVENT: EggType.EVENT, EGG_GEN1: EggType.EGG_GEN1, EGG_GEN2: EggType.EGG_GEN2, EGG_GEN3: EggType.EGG_GEN3,
  EGG_GEN4: EggType.EGG_GEN4, EGG_GEN5: EggType.EGG_GEN5, EGG_GEN6: EggType.EGG_GEN6, EGG_GEN7: EggType.EGG_GEN7,
  EGG_GEN8: EggType.EGG_GEN8, EGG_GEN9: EggType.EGG_GEN9, EGG_GEN6PLUS: EggType.EGG_GEN6PLUS,
};
const FOOD_BY_ITEM_TYPE: Record<string, FoodType> = {
  MASCOT_FOOD: FoodType.FOOD, MASCOT_SWEET: FoodType.SWEET, MASCOT_RARE_SWEET: FoodType.RARE_SWEET,
};

/** Entrega um ShopItem ao jogador na transação (ovo, comida, ticket sync ou inventário). */
export async function grantShopItemTx(
  tx: Prisma.TransactionClient,
  playerId: string,
  item: Pick<ShopItem, "id" | "name" | "type">,
  quantity: number,
  source: string,
) {
  const eggType = EGG_BY_ITEM_TYPE[item.type];
  const foodType = FOOD_BY_ITEM_TYPE[item.type];
  if (eggType) {
    await tx.mascotEgg.createMany({
      data: Array.from({ length: quantity }, () => ({ playerId, type: eggType, origin: `Código de resgate: ${item.name}` })),
    });
  } else if (foodType) {
    await tx.mascotFoodItem.upsert({
      where: { playerId_type: { playerId, type: foodType } },
      update: { quantity: { increment: quantity } },
      create: { playerId, type: foodType, quantity },
    });
  } else if (item.type === SYNC_TICKET_TYPES.fireLeft || item.type === SYNC_TICKET_TYPES.waterRight) {
    const side = item.type === SYNC_TICKET_TYPES.fireLeft ? SyncTicketSide.LEFT : SyncTicketSide.RIGHT;
    for (let i = 0; i < quantity; i++) await grantSyncTicketHalf(tx, playerId, "redeem-code", side, playerId);
  } else if (item.type === SYNC_TICKET_TYPES.complete) {
    for (let i = 0; i < quantity; i++) await grantValidSyncTicketForPlayer(tx, playerId);
  } else {
    await tx.playerInventory.upsert({
      where: { playerId_itemId: { playerId, itemId: item.id } },
      update: { quantity: { increment: quantity } },
      create: { playerId, itemId: item.id, quantity, equipped: false, source },
    });
  }
}

/** Tipos de item "Pedra de Mega" (o jogador escolhe uma delas num prêmio MEGA_CHOICE). */
export const MEGA_STONE_TYPES = Object.values(ShopItemType).filter((t) => t.startsWith("MEGA_STONE_"));

/** Comidas do mascote (mascotFoodItem) — o Doce Raro vem do laboratório e não é um ShopItem. */
export const FOOD_TYPE_LABELS: Record<string, string> = {
  FOOD: "Comida de Mascote", SWEET: "Doce de Mascote", RARE_SWEET: "Doce Raro",
};

type ShopDb =Pick<Prisma.TransactionClient, "shopItem">;

/** Pedras de Mega disponíveis para escolha: só as ligadas (ativas) na ZikaShop/painel admin. */
export function listActiveMegaStones(db: ShopDb) {
  return db.shopItem.findMany({
    where: { type: { in: MEGA_STONE_TYPES }, active: true },
    select: { id: true, name: true, type: true, imageUrl: true },
    orderBy: { name: "asc" },
  });
}

export function findActiveMegaStone(db: ShopDb, id: string) {
  return db.shopItem.findFirst({
    where: { id, type: { in: MEGA_STONE_TYPES }, active: true },
    select: { id: true, name: true, type: true, imageUrl: true },
  });
}

const EGG_TYPE_LABELS: Record<string, string> = {
  COMMON: "Ovo Comum", RARE: "Ovo Raro", SPECIAL: "Ovo Especial", LAB: "Ovo de Laboratório", EVENT: "Ovo de Evento",
  CELESTIAL: "Ovo Celestial", EGG_GEN6PLUS: "Ovo Geração 6+",
};
export function eggTypeLabel(type: string) {
  return EGG_TYPE_LABELS[type] ?? `Ovo Geração ${type.replace("EGG_GEN", "")}`;
}

/** Nome legível de um ShopItemType (ex.: LEAGUE_CAPTAIN_BAND -> "League Captain Band"). */
export function itemTypeLabel(type: string) {
  return type.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
