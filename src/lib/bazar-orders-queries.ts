import "server-only";
import { prisma } from "@/lib/prisma";
import {
  matchesMascotRequirements,
  BUY_ORDERS_PAGE_SIZE,
  BUY_ORDER_EXCLUDED_ITEM_TYPES,
  type BuyOrderView,
} from "@/lib/bazar-orders";

const MASCOT_FACTS_SELECT = {
  pokemonId: true, level: true, personality: true, hatchedFromEggType: true,
  statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
} as const;
// Só para tipar freeMascots (nunca chamada).
declare function loadFreeMascots(): Promise<{ pokemonId: number; level: number; personality: string; hatchedFromEggType: string | null; statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number }[]>;

/** Lista paginada de pedidos abertos + dicas de cobertura (3-4 queries pequenas e indexadas). */
export async function getBuyOrdersView(opts: {
  playerId: string | null;
  mine: boolean;
  kind?: "MASCOT" | "ITEM";
  page: number;
}): Promise<{ orders: BuyOrderView[]; total: number; page: number; totalPages: number }> {
  const now = new Date();
  const where = {
    status: "ACTIVE",
    expiresAt: { gt: now },
    ...(opts.mine && opts.playerId ? { buyerId: opts.playerId } : {}),
    ...(opts.kind ? { kind: opts.kind } : {}),
  };
  const total = await prisma.bazarBuyOrder.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / BUY_ORDERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page || 1), totalPages);
  const rows = await prisma.bazarBuyOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * BUY_ORDERS_PAGE_SIZE,
    take: BUY_ORDERS_PAGE_SIZE,
    include: { buyer: { select: { id: true, displayName: true } } },
  });
  if (rows.length === 0) return { orders: [], total, page, totalPages };

  const buyerIds = [...new Set(rows.map((r) => r.buyerId))];
  const wallets = await prisma.zikaCoinWallet.findMany({
    where: { playerId: { in: buyerIds } },
    select: { playerId: true, balance: true },
  });
  const balanceByBuyer = new Map(wallets.map((w) => [w.playerId, w.balance]));

  // O que o jogador logado já tem que atende a algum pedido da página.
  let freeMascots: Awaited<ReturnType<typeof loadFreeMascots>> = [];
  const itemHave = new Map<string, number>(); // shopItemId -> quantidade livre
  if (opts.playerId) {
    const pokemonIds = [...new Set(rows.flatMap((r) => (r.pokemonId != null ? [r.pokemonId] : [])))];
    const itemIds = [...new Set(rows.flatMap((r) => (r.shopItemId ? [r.shopItemId] : [])))];
    const [mascots, shopItems, inv, food] = await Promise.all([
      pokemonIds.length
        ? prisma.mascot.findMany({
            where: { playerId: opts.playerId, pokemonId: { in: pokemonIds }, bazarListed: false, isEquipped: false, operationsLocked: false, primordialBoundPlayerId: null },
            select: MASCOT_FACTS_SELECT,
          })
        : [],
      itemIds.length ? prisma.shopItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, type: true } }) : [],
      itemIds.length
        ? prisma.playerInventory.findMany({ where: { playerId: opts.playerId, itemId: { in: itemIds } }, select: { itemId: true, quantity: true, boundQuantity: true } })
        : [],
      itemIds.length ? prisma.mascotFoodItem.findMany({ where: { playerId: opts.playerId }, select: { type: true, quantity: true, boundQuantity: true } }) : [],
    ]);
    freeMascots = mascots;
    for (const i of inv) itemHave.set(i.itemId, i.quantity - i.boundQuantity);
    for (const s of shopItems) {
      if (s.type === "MASCOT_FOOD" || s.type === "MASCOT_SWEET") {
        const f = food.find((x) => x.type === (s.type === "MASCOT_FOOD" ? "FOOD" : "SWEET"));
        itemHave.set(s.id, f ? f.quantity - f.boundQuantity : 0);
      }
    }
  }

  const orders: BuyOrderView[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind === "MASCOT" ? "MASCOT" : "ITEM",
    label: r.label,
    pokemonId: r.pokemonId,
    minLevel: r.minLevel,
    personality: r.personality,
    eggType: r.eggType,
    topStats: r.topStats,
    quantity: r.quantity,
    imageUrl: r.imageUrl,
    priceCoins: r.priceCoins,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    buyer: r.buyer,
    mine: r.buyerId === opts.playerId,
    covered: (balanceByBuyer.get(r.buyerId) ?? 0) >= r.priceCoins,
    canFulfill:
      r.buyerId !== opts.playerId &&
      (r.kind === "MASCOT"
        ? freeMascots.some((m) => m.pokemonId === r.pokemonId && m.level >= r.minLevel && matchesMascotRequirements(r, m))
        : (itemHave.get(r.shopItemId ?? "") ?? 0) >= r.quantity),
  }));
  return { orders, total, page, totalPages };
}

/** Itens elegíveis para o formulário de novo pedido (só nome — sem imagens pesadas). */
export async function getOrderableItems() {
  const items = await prisma.shopItem.findMany({
    where: { active: true, inventoryEnabled: true, type: { notIn: [...BUY_ORDER_EXCLUDED_ITEM_TYPES] as never[] } },
    select: { id: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    take: 600,
  });
  return items.filter((i) => !i.type.startsWith("TRACE_"));
}
