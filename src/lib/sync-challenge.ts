import { Prisma, ShopItemRarity } from "@prisma/client";

export const SYNC_TICKET_TYPES = {
  fireLeft: "SYNC_TICKET_FIRE_LEFT",
  waterRight: "SYNC_TICKET_WATER_RIGHT",
  complete: "SYNC_TICKET_COMPLETE",
} as const;

export type SyncTicketType = typeof SYNC_TICKET_TYPES[keyof typeof SYNC_TICKET_TYPES];

export const SYNC_TICKET_ITEMS = [
  {
    type: SYNC_TICKET_TYPES.fireLeft,
    name: "Ticket Esquerda de Fogo",
    description: "Metade esquerda do Desafio Sincronizado. Junte com a metade direita de agua para formar um ticket VIP completo.",
    imageUrl: "/events/desafio-sincronizado/ticket-esquerda-fogo.png",
    rarity: ShopItemRarity.EPIC,
    price: 0,
    sortOrder: 910,
  },
  {
    type: SYNC_TICKET_TYPES.waterRight,
    name: "Ticket Direita de Agua",
    description: "Metade direita do Desafio Sincronizado. Junte com a metade esquerda de fogo para formar um ticket VIP completo.",
    imageUrl: "/events/desafio-sincronizado/ticket-direita-agua.png",
    rarity: ShopItemRarity.EPIC,
    price: 0,
    sortOrder: 911,
  },
  {
    type: SYNC_TICKET_TYPES.complete,
    name: "Ticket Completo Agua e Fogo",
    description: "Entrada completa do Desafio Sincronizado. Consumido ao confirmar os bans e iniciar uma tentativa do evento.",
    imageUrl: "/events/desafio-sincronizado/ticket-completo-agua-fogo.png",
    rarity: ShopItemRarity.LEGENDARY,
    price: 0,
    sortOrder: 912,
  },
] as const;

export async function ensureSyncChallengeItems(tx: Prisma.TransactionClient) {
  const items = [];
  for (const item of SYNC_TICKET_ITEMS) {
    const existing = await tx.shopItem.findFirst({
      where: { type: item.type as never, name: item.name },
      select: { id: true },
    });
    const data = {
      type: item.type as never,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      rarity: item.rarity,
      price: item.price,
      active: true,
      sortOrder: item.sortOrder,
    };
    items.push(existing
      ? await tx.shopItem.update({ where: { id: existing.id }, data, select: { id: true, type: true, name: true } })
      : await tx.shopItem.create({ data, select: { id: true, type: true, name: true } }));
  }
  return items;
}

export async function getSyncTicketItem(tx: Prisma.TransactionClient, type: SyncTicketType) {
  const items = await ensureSyncChallengeItems(tx);
  return items.find((item) => item.type === type);
}

export async function grantSyncTicket(
  tx: Prisma.TransactionClient,
  playerId: string,
  type: SyncTicketType,
  quantity = 1,
) {
  if (quantity < 1) return;
  const item = await getSyncTicketItem(tx, type);
  if (!item) throw new Error("Item do Desafio Sincronizado nao encontrado.");
  await tx.playerInventory.upsert({
    where: { playerId_itemId: { playerId, itemId: item.id } },
    update: { quantity: { increment: quantity } },
    create: { playerId, itemId: item.id, quantity },
  });
}

export async function maybeDropSyncTicket(
  tx: Prisma.TransactionClient,
  playerId: string,
  source: "arena-pve" | "arena-pvp",
) {
  const roll = Math.random();
  const chance = source === "arena-pvp" ? 0.12 : 0.08;
  if (roll >= chance) return null;

  const type = Math.random() < 0.5 ? SYNC_TICKET_TYPES.fireLeft : SYNC_TICKET_TYPES.waterRight;
  await grantSyncTicket(tx, playerId, type, 1);
  return type;
}
