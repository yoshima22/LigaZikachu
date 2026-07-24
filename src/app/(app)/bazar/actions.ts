"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { getMascotRarity, getPokemonName, type MascotRarity } from "@/lib/mascot-data";
import { creditCoins } from "@/lib/zikacoins";
import { EGG_SHOP_TO_EGG_TYPE, MASCOT_SHOP_ITEM_TYPES } from "@/lib/shop-config";
import { getShopItemImages } from "@/lib/shop-cache";
import { getSessionPlayer } from "@/lib/session";
import { registerPokemonDiscovery } from "@/lib/pokemon-dex";
import { getActiveRaidSabotages, getOrderStepUnlockState } from "@/lib/raid-event";
import { isMegaStoneType } from "@/lib/mega-evolution";
import { cleanupExpiredArenaResting, syncDefeatedArenaTeams } from "@/lib/arena-z";
import { isMascotLockedInWeeklyLeague } from "@/lib/weekly-league-locks";
import { getMiauvadaoRotation } from "@/lib/miauvadao-rotation";
import {
  MIAUVADAO_FUSION_EGG_TYPES,
  rollFusionLootBonus,
  rollMiauvadaoFusion,
  type MiauvadaoFusionEggType,
} from "@/lib/miauvadao-egg-fusion";
import {
  getMaxShellBetForVault,
  getShellGamePrize,
  SHELL_MAX_BET,
  SHELL_MIN_BET,
} from "@/lib/miauvadao-shell-game";
import { EggType } from "@prisma/client";
import type { BazarItemCategory, BazarListingType, BazarListingStatus } from "@prisma/client";
import { publishLeagueTicker } from "@/lib/league-ticker";
import { ADMIN_LAB_RAINBOW_FEATHER_ID } from "@/lib/admin-lab-feather";

function revalidateBazar() {
  revalidatePath("/bazar");
  revalidatePath("/bazar/meu-bazar");
  revalidateTag("bazar-listings");
  revalidateTag("bazar-transactions");
}

type ProposalOfferItem = {
  type: string;
  quantity: number;
  displayName: string;
  mascotId?: string;
  pokemonId?: number;
  level?: number;
  shopItemId?: string;
  escrowed_egg_ids?: string[];
  escrowed?: boolean;
};

const EGG_OFFER_TYPES = [
  "COMMON","RARE","SPECIAL","EVENT","LAB",
  "EGG_GEN1","EGG_GEN2","EGG_GEN3","EGG_GEN4","EGG_GEN5",
  "EGG_GEN6","EGG_GEN7","EGG_GEN8","EGG_GEN9","EGG_GEN6PLUS",
];

function isEggOfferType(type: string) {
  return EGG_OFFER_TYPES.includes(type);
}

const TICKER_EGG_LABELS: Record<string, string> = {
  COMMON: "Ovo Comum",
  EVENT: "Ovo de Evento",
  RARE: "Ovo Raro",
  SPECIAL: "Ovo Especial",
  LAB: "Ovo de Laboratório",
};

function tickerEggOrigin(payload: Record<string, unknown>) {
  const type = typeof payload.hatchedFromEggType === "string" ? payload.hatchedFromEggType : null;
  return type ? TICKER_EGG_LABELS[type] ?? type.replaceAll("_", " ") : null;
}

function getListingQuantity(payload: Record<string, unknown>): number {
  const quantity = Number(payload.quantity ?? 1);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error("Quantidade invÃ¡lida no anÃºncio.");
  }
  return quantity;
}

const HIDDEN_BAZAR_ITEM_TYPES = new Set([
  "TRACE_MAP_SHORT",
  "TRACE_MAP_MEDIUM",
  "TRACE_MAP_LONG",
  "TRACE_MAP_WEEKLY",
  "TRACE_HUNT_TICKET",
  "TRACE_SIGNAL_FLARE",
  "TRACE_DECOY",
  "TRACE_SILENCE_POTION",
  "TRACE_ARMOR_VEST",
  "TRACE_MIST_SHIELD",
  "TRACE_INSTINCT_BOOST",
  "TRACE_GOLDEN_TICKET",
  "TRACE_SPECIAL_MAP",
]);

/** Nunca gravar data-URL base64 no payload do anúncio — um snapshot de imagem
 *  embutido chegou a 3,7MB e era transferido em toda listagem do Bazar. */
function sanitizePayloadImageUrl(url: string | null | undefined): string | null {
  if (!url || url.startsWith("data:")) return null;
  return url;
}

// Tipos de shop que o Miauvadão pode oferecer (excluindo cosméticos únicos)
const MIAUVADAO_ELIGIBLE_TYPES = [
  ...MASCOT_SHOP_ITEM_TYPES,
  "ZIKALOOT_TICKET",
];

const MIAUVADAO_MAX_DISCOUNT = 70;
const MIAUVADAO_MEGA_STONE_MAX_DISCOUNT = 20;
const MIAUVADAO_SLOT_REFRESH_COST = 250;
const MIAUVADAO_PURCHASE_RECHARGE_MS = 10 * 60_000;

// Faixa de desconto por raridade do item
const DISCOUNT_BY_RARITY: Record<string, [number, number]> = {
  COMMON:    [15, 35],
  UNCOMMON:  [12, 28],
  RARE:      [10, 25],
  EPIC:      [8,  20],
  LEGENDARY: [5,  15],
  MYTHIC:    [5,  12],
  RELIC:     [5,  10],
};

/** Sorteia 3 itens do shop ativo e aplica descontos */
async function rollMiauvadaoOffers(vaultBalance: number, extraBonus = 0): Promise<MiauvadaoOffer[]> {
  // Busca itens elegíveis do shop
  const shopItems = await prisma.shopItem.findMany({
    where: { active: true, type: { in: MIAUVADAO_ELIGIBLE_TYPES as never[] } },
    select: { id: true, name: true, type: true, price: true, imageUrl: true,
              description: true, rarity: true },
  });

  if (shopItems.length === 0) return [];

  // Quanto mais ZC no cofre, maior o bônus de desconto (máx +20%)
  const vaultBonus = Math.min(14, Math.floor(Math.sqrt(Math.max(0, vaultBalance) / 500) * 3));
  const validUntil = getMiauvadaoRotation().next.toISOString();

  // Sorteia até 3 itens distintos
  const shuffled = [...shopItems].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, 3);

  return chosen.map(item => {
    const [minDisc, maxDisc] = DISCOUNT_BY_RARITY[item.rarity] ?? [10, 25];
    const maxAllowedDiscount = isMegaStoneType(item.type)
      ? MIAUVADAO_MEGA_STONE_MAX_DISCOUNT
      : MIAUVADAO_MAX_DISCOUNT;
    const rawDiscount = minDisc + Math.floor(Math.random() * (maxDisc - minDisc + 1)) + vaultBonus + extraBonus;
    const discountPct = Math.min(
      maxAllowedDiscount,
      rawDiscount >= maxAllowedDiscount
        ? (Math.random() < 0.08 ? maxAllowedDiscount : maxAllowedDiscount - 1)
        : rawDiscount,
    );
    const finalPrice  = Math.max(1, Math.round(item.price * (1 - discountPct / 100)));
    return {
      shopItemId:    item.id,
      itemType:      item.type,
      name:          item.name,
      imageUrl:      item.imageUrl ?? undefined,
      description:   item.description ?? undefined,
      originalPrice: item.price,
      discountPct,
      finalPrice,
      stock:         5,
      sold:          0,
      validUntil,
    } satisfies MiauvadaoOffer;
  });
}

/** Checa se as ofertas expiraram e gera novas automaticamente a partir do shop */
// Retorna freshConfig quando rolou novas ofertas (evita re-fetch pelo cache no mesmo request)
export async function autoRefreshMiauvadaoIfNeeded(options?: {
  throwOnError?: boolean;
}): Promise<{ freshConfig: Awaited<ReturnType<typeof prisma.miauvadaoConfig.findUniqueOrThrow>> } | null> {
  try {
    // A rotação é uma escrita crítica: sempre confira o estado real do banco.
    // Usar o cache aqui pode fazer o cron enxergar o ciclo anterior como atual.
    const config = await prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" } })
      ?? await prisma.miauvadaoConfig.create({ data: { id: "singleton" } });

    const offers = (config.dailyOffers as unknown as MiauvadaoOffer[]) ?? [];
    const rotation = getMiauvadaoRotation();
    const firstOffer = offers[0];
    const expired = !firstOffer
      || !config.offersRefreshedAt
      || config.offersRefreshedAt < rotation.start
      || !firstOffer.shopItemId;

    if (!expired) return null;

    const newOffers = await rollMiauvadaoOffers(config.vaultBalance);
    if (newOffers.length === 0) return null;

    // Retorna o resultado do update diretamente — sem precisar re-buscar pelo cache
    const freshConfig = await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: {
        dailyOffers: newOffers as unknown as import("@prisma/client").Prisma.InputJsonValue,
        offersRefreshedAt: rotation.start,
        slotRefreshUsedCycle: null,
      },
    });
    try {
      revalidateTag("miauvadao-config");
    } catch (cacheError) {
      // A rotação no banco já foi concluída. Falha de invalidação não pode
      // transformar uma escrita bem-sucedida em falso negativo para o cron.
      console.warn("[Miauvadao] Rotacao concluida, mas o cache nao foi invalidado.", cacheError);
    }
    return { freshConfig };
  } catch (error) {
    console.error("[Miauvadao] Falha ao executar rotacao automatica.", error);
    if (options?.throwOnError) throw error;
    return null;
  }
}

// ── Buscar listagens ──────────────────────────────────────────────────────────

const LISTINGS_PAGE_SIZE = 12;

const BAZAR_RARITY_CANDIDATE_IDS = [
  ...Array.from({ length: 1100 }, (_, index) => index + 1),
  ...Array.from({ length: 401 }, (_, index) => 10000 + index),
];
const BAZAR_IDS_BY_RARITY = BAZAR_RARITY_CANDIDATE_IDS.reduce((map, pokemonId) => {
  map[getMascotRarity(pokemonId)].push(pokemonId);
  return map;
}, {
  MEGA: [], LEGENDARY: [], MYTHICAL: [], ULTRA_BEAST: [],
  PSEUDO_LEGENDARY: [], PARADOX: [], COMMON: [],
} as Record<MascotRarity, number[]>);
const BAZAR_NON_COMMON_IDS = (Object.keys(BAZAR_IDS_BY_RARITY) as MascotRarity[])
  .filter((rarity) => rarity !== "COMMON")
  .flatMap((rarity) => BAZAR_IDS_BY_RARITY[rarity]);

function mascotRarityListingFilter(rarity?: MascotRarity) {
  if (!rarity || !BAZAR_IDS_BY_RARITY[rarity]) return {};
  const ids = rarity === "COMMON" ? BAZAR_NON_COMMON_IDS : BAZAR_IDS_BY_RARITY[rarity];
  const conditions = ids.map((pokemonId) => ({ payload: { path: ["pokemonId"], equals: pokemonId } }));
  return {
    category: "MASCOT" as BazarItemCategory,
    ...(rarity === "COMMON" ? { NOT: { OR: conditions } } : { OR: conditions }),
  };
}

export async function getListings(filters?: {
  category?: BazarItemCategory;
  type?: BazarListingType;
  maxPrice?: number;
  search?: string;
  rarity?: MascotRarity;
  sortBy?: "newest" | "cheapest" | "expensive";
  page?: number;
}) {
  const page     = Math.max(1, filters?.page ?? 1);
  const skip     = (page - 1) * LISTINGS_PAGE_SIZE;
  const search   = filters?.search?.trim();

  // Filtro de busca textual: description + wantedDesc (case-insensitive)
  // e campos de payload via JSON path (case-sensitive, mas suficiente para nomes de itens)
  const searchFilter = search
    ? {
        OR: [
          { description: { contains: search, mode: "insensitive" as const } },
          { wantedDesc:   { contains: search, mode: "insensitive" as const } },
          { payload: { path: ["pokemonName"],  string_contains: search } },
          { payload: { path: ["displayName"],  string_contains: search } },
          { payload: { path: ["nickname"],     string_contains: search } },
        ],
      }
    : {};

  const where = {
    status: "ACTIVE" as BazarListingStatus,
    expiresAt: { gt: new Date() },
    ...(filters?.category ? { category: filters.category } : {}),
    ...(filters?.type     ? { listingType: filters.type }  : {}),
    ...(filters?.maxPrice !== undefined ? { priceCoins: { lte: filters.maxPrice } } : {}),
    ...mascotRarityListingFilter(filters?.rarity),
    ...searchFilter,
  };

  const orderBy =
    filters?.sortBy === "cheapest"  ? { priceCoins: "asc"  as const } :
    filters?.sortBy === "expensive" ? { priceCoins: "desc" as const } :
    { createdAt: "desc" as const };

  const select = {
    id: true, category: true, listingType: true, status: true,
    payload: true, priceCoins: true, description: true, wantedDesc: true,
    loanEnabled: true, loanAmountCoins: true, loanInterestPct: true,
    expiresAt: true, createdAt: true, views: true,
    minBidCoins: true, currentBidCoins: true, auctionEndsAt: true,
    player: { select: { id: true, displayName: true, avatarUrl: true } },
    _count: { select: { proposals: true, favorites: true } },
  };

  const [listings, total] = await Promise.all([
    prisma.bazarListing.findMany({ where, orderBy, select, skip, take: LISTINGS_PAGE_SIZE }),
    prisma.bazarListing.count({ where }),
  ]);

  return {
    listings,
    total,
    page,
    pageSize: LISTINGS_PAGE_SIZE,
    totalPages: Math.ceil(total / LISTINGS_PAGE_SIZE),
  };
}

export async function getListing(id: string) {
  const listing = await prisma.bazarListing.findUnique({
    where: { id },
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          pokemonWishlist: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { pokemonId: true },
          },
        },
      },
      proposals: {
        include: {
          proposer: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      auctionBids: {
        include: { player: { select: { id: true, displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { favorites: true } },
    },
  });
  // Não incrementar `views` aqui. Writes fire-and-forget em Server Actions podem
  // deixar transações abertas no runtime serverless e bloquear a oferta inteira
  // quando vários jogadores acompanham o mesmo leilão.
  return listing;
}

export async function getRecentTransactions(take = 10) {
  return prisma.bazarTransaction.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, category: true, coinsAmount: true,
      buyerName: true, sellerName: true, description: true, createdAt: true,
    },
    take,
  });
}

export async function getTransactionHistory({
  search,
  page = 1,
  pageSize = 20,
}: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const normalizedSearch = search?.trim();
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const where = normalizedSearch
    ? {
        OR: [
          { sellerName: { contains: normalizedSearch, mode: "insensitive" as const } },
          { buyerName: { contains: normalizedSearch, mode: "insensitive" as const } },
        ],
      }
    : {};

  const total = await prisma.bazarTransaction.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.floor(page)));
  const transactions = await prisma.bazarTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
    select: {
      id: true,
      listingId: true,
      category: true,
      coinsAmount: true,
      buyerName: true,
      sellerName: true,
      description: true,
      createdAt: true,
    },
  });

  const listings = transactions.length
    ? await prisma.bazarListing.findMany({
        where: { id: { in: transactions.map((transaction) => transaction.listingId) } },
        select: {
          id: true,
          listingType: true,
          payload: true,
          proposals: {
            where: { status: "ACCEPTED" },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { coinsOffer: true, itemsOffer: true },
          },
        },
      })
    : [];
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));

  return {
    transactions: transactions.map((transaction) => {
      const listing = listingById.get(transaction.listingId);
      const acceptedProposal = listing?.proposals[0] ?? null;
      return {
        ...transaction,
        listingType: listing?.listingType ?? null,
        payload: listing?.payload ?? null,
        offerCoins: acceptedProposal?.coinsOffer ?? transaction.coinsAmount,
        offerItems: acceptedProposal?.itemsOffer ?? null,
      };
    }),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}


const _getMiauvadaoConfigCached = unstable_cache(
  async () => {
    const cfg = await prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" } });
    if (cfg) return cfg;
    return prisma.miauvadaoConfig.create({ data: { id: "singleton" } });
  },
  ["miauvadao-config"],
  { revalidate: 300, tags: ["miauvadao-config"] },
);

export async function getMiauvadaoConfig() {
  return _getMiauvadaoConfigCached();
}

export async function invalidateMiauvadaoCache() {
  revalidateTag("miauvadao-config");
}

// ── Criar anúncio ─────────────────────────────────────────────────────────────

export interface CreateListingInput {
  category: BazarItemCategory;
  listingType: BazarListingType;
  priceCoins?: number;
  wantedDesc?: string;
  description?: string;
  loanEnabled?: boolean;
  loanAmountCoins?: number;
  loanInterestPct?: number;
  durationDays: 7 | 14 | 30;
  // Mascot
  mascotId?: string;
  // Item
  itemType?: string;
  shopItemId?: string;   // ID do ShopItem (para PlayerInventory — escrow preciso)
  imageUrl?: string;     // Imagem real do shop
  quantity?: number;
  displayName?: string;
}

export async function createListing(input: CreateListingInput): Promise<{ error?: string; id?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    await prepareBazarMascotAvailability(player.id);

    // Validação básica
    if (input.listingType !== "TRADE" && (!input.priceCoins || input.priceCoins < 1)) {
      return { error: "Defina um preço válido em ZikaCoins." };
    }
    const loanEnabled = Boolean(input.loanEnabled);
    const loanAmountCoins = Math.floor(Number(input.loanAmountCoins) || 0);
    const loanInterestPct = Math.floor(Number(input.loanInterestPct) || 0);
    if (loanEnabled && loanAmountCoins < 1) return { error: "Defina o valor financiado do empréstimo." };
    if (loanEnabled && (loanInterestPct < 0 || loanInterestPct > 100)) {
      return { error: "Os juros do empréstimo devem ficar entre 0% e 100%." };
    }

    // Limite de 8 anúncios ativos por jogador
    const MAX_ACTIVE_LISTINGS = 8;
    const activeCount = await prisma.bazarListing.count({
      where: { playerId: player.id, status: { in: ["ACTIVE", "RESERVED"] } },
    });
    if (activeCount >= MAX_ACTIVE_LISTINGS) {
      return { error: `Você já possui ${MAX_ACTIVE_LISTINGS} anúncios ativos. Cancele um antes de criar outro.` };
    }

    // Buscar config do Miauvadão (taxa)
    const config = await getMiauvadaoConfig();
    const fee = config.listingFee;

    // Verificar saldo para pagar taxa
    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < fee) {
      return { error: `Saldo insuficiente para pagar a taxa de anúncio (${fee} ZC).` };
    }

    let payload: Record<string, unknown> = {};
    const expiresAt = new Date(Date.now() + input.durationDays * 86400000);

    await prisma.$transaction(async (tx) => {
      // Cobrar taxa
      await tx.zikaCoinWallet.update({
        where: { playerId: player.id },
        data: { balance: { decrement: fee } },
      });
      // Taxa vai para o cofre do Miauvadão
      await tx.miauvadaoConfig.update({
        where: { id: "singleton" },
        data: { vaultBalance: { increment: fee } },
      });

      if (input.category === "MASCOT" && input.mascotId) {
        const mascot = await tx.mascot.findUnique({ where: { id: input.mascotId } });
        if (!mascot) throw new Error("Mascote não encontrado.");
        await assertMascotTradeableInBazar(tx, mascot, player.id);

        // Bloqueia mascote
        await tx.mascot.update({ where: { id: input.mascotId }, data: { bazarListed: true } });

        payload = {
          mascotId: mascot.id,
          pokemonId: mascot.pokemonId,
          pokemonName: getPokemonName(mascot.pokemonId),
          nickname: mascot.nickname,
          level: mascot.level,
          personality: mascot.personality,
          stats: {
            force: mascot.statForce, agility: mascot.statAgility,
            charisma: mascot.statCharisma, instinct: mascot.statInstinct,
            vitality: mascot.statVitality,
          },
          battleWins: mascot.battleWins,
          hatchedFromEggType: mascot.hatchedFromEggType,
          hatchedFromEggOrigin: mascot.hatchedFromEggOrigin,
        };

      } else if (input.category === "ITEM") {
        const qty = input.quantity ?? 1;
        if (qty < 1) throw new Error("Quantidade inválida.");
        if (!input.itemType) throw new Error("Tipo de item não especificado.");
        if (HIDDEN_BAZAR_ITEM_TYPES.has(input.itemType)) throw new Error("Este item ainda nao pode ser anunciado no Bazar.");

        // Deducir do inventário (escrow)
        if (input.itemType === "FOOD" || input.itemType === "SWEET") {
          const food = await tx.mascotFoodItem.findUnique({
            where: { playerId_type: { playerId: player.id, type: input.itemType as "FOOD" | "SWEET" } },
          });
          if (!food || food.quantity < qty) throw new Error("Itens insuficientes no inventário.");
          await tx.mascotFoodItem.update({
            where: { playerId_type: { playerId: player.id, type: input.itemType as "FOOD" | "SWEET" } },
            data: { quantity: { decrement: qty } },
          });
        } else if (isEggOfferType(input.itemType)) {
          // Ovos — conta quantos tem (exclui ovos já em escrow do bazar)
          const eggs = await tx.mascotEgg.findMany({
            where: {
              playerId: player.id,
              type: input.itemType as never,
              incubation: null,
              NOT: { origin: { startsWith: "bazar:" } },
            },
          });
          if (eggs.length < qty) throw new Error("Ovos insuficientes no inventário.");
          // Remove qty ovos do inventário (escrow)
          const toRemove = eggs.slice(0, qty).map(e => e.id);
          await tx.mascotEgg.updateMany({
            where: { id: { in: toRemove } },
            data: { origin: `bazar:${player.id}` }, // marca como em bazar para não aparecer na incubadora
          });
          // Guardar IDs dos ovos no payload para devolução
          payload = { ...payload, escrowed_egg_ids: toRemove };
        } else {
          // Item de PlayerInventory (buffs, tickets, cosméticos)
          // Usa shopItemId para localizar o item exato (escrow preciso)
          const inv = input.shopItemId
            ? await tx.playerInventory.findUnique({
                where: { playerId_itemId: { playerId: player.id, itemId: input.shopItemId } },
                include: { item: { select: { id: true, name: true, type: true, imageUrl: true } } },
              })
            : await tx.playerInventory.findFirst({
                where: { playerId: player.id, item: { type: input.itemType as never }, quantity: { gt: 0 } },
                include: { item: { select: { id: true, name: true, type: true, imageUrl: true } } },
              });
          if (!inv || inv.quantity < qty) throw new Error("Itens insuficientes no inventário.");
          if (inv.itemId === ADMIN_LAB_RAINBOW_FEATHER_ID) throw new Error("Este item administrativo não pode ser negociado.");
          // Desconta do inventário imediatamente (escrow — não pode usar durante o anúncio)
          await tx.playerInventory.update({
            where: { id: inv.id },
            data: { quantity: { decrement: qty } },
          });
          // Armazena shopItemId e imageUrl no payload para devolução/transferência correta
          payload = {
            ...payload,
            shopItemId: inv.itemId,
            imageUrl: sanitizePayloadImageUrl(inv.item.imageUrl ?? input.imageUrl),
          };
        }

        payload = {
          ...payload,
          itemType: input.itemType,
          quantity: qty,
          displayName: input.displayName ?? `${qty}x ${input.itemType}`,
        };
      }

      await tx.bazarListing.create({
        data: {
          playerId: player.id,
          category: input.category,
          listingType: input.listingType,
          payload: payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
          priceCoins: input.listingType !== "TRADE" ? input.priceCoins : null,
          wantedDesc: input.wantedDesc,
          description: input.description,
          loanEnabled,
          loanAmountCoins: loanEnabled ? loanAmountCoins : null,
          loanInterestPct: loanEnabled ? loanInterestPct : null,
          feeCharged: fee,
          expiresAt,
        },
      });
    });

    if (input.category === "MASCOT" && typeof payload.pokemonId === "number") {
      const rarity = getMascotRarity(payload.pokemonId);
      if (rarity === "LEGENDARY" || rarity === "MYTHICAL") {
        await publishLeagueTicker({
          type: "BAZAR_RARE_LISTING",
          message: `${player.displayName} anunciou ${payload.nickname ?? payload.pokemonName} no Bazar. É um mascote ${rarity === "MYTHICAL" ? "mítico" : "lendário"} — vá conferir!`,
          href: "/bazar",
          priority: 6,
          ttlHours: 10,
        });
      }
    }
    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar anúncio." };
  }
}

// ── Cancelar anúncio ──────────────────────────────────────────────────────────

export async function cancelListing(listingId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const listing = await prisma.bazarListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.playerId !== player.id) return { error: "Anúncio não encontrado." };
    if (listing.status !== "ACTIVE" && listing.status !== "RESERVED") {
      return { error: "Este anúncio não pode ser cancelado." };
    }
    // Leilão com lances não pode ser cancelado
    if (listing.listingType === "AUCTION" && listing.currentBidPlayerId) {
      return { error: "Leilões com lances não podem ser cancelados." };
    }

    let rejectedProposerUserIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.bazarListing.update({ where: { id: listingId }, data: { status: "CANCELLED" } });
      await _returnEscrow(tx, listing, player.id);
      // Rejeitar proposals pendentes e liberar mascotes oferecidos nelas.
      const pendingProposals = await tx.bazarProposal.findMany({
        where: { listingId, status: "PENDING" },
        select: { proposerId: true, coinsOffer: true, coinsEscrowed: true, itemsOffer: true, proposer: { select: { userId: true } } },
      });
      rejectedProposerUserIds = pendingProposals.map((proposal) => proposal.proposer.userId);
      for (const proposal of pendingProposals) {
        await _releaseProposalEscrow(tx, proposal);
      }
      await tx.bazarProposal.updateMany({
        where: { listingId, status: "PENDING" },
        data: { status: "REJECTED" },
      });
    });

    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    for (const proposerUserId of rejectedProposerUserIds) revalidateTag(`nav-${proposerUserId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

// ── Editar anúncio (dono pode alterar preço, descrição e procuro) ─────────────

export async function editListing(
  listingId: string,
  fields: { priceCoins?: number | null; description?: string; wantedDesc?: string },
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const listing = await prisma.bazarListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.playerId !== player.id) return { error: "Anúncio não encontrado." };
    if (listing.status !== "ACTIVE") return { error: "Só é possível editar anúncios ativos." };

    if (fields.priceCoins !== undefined && fields.priceCoins !== null && fields.priceCoins < 0) {
      return { error: "Preço não pode ser negativo." };
    }

    await prisma.bazarListing.update({
      where: { id: listingId },
      data: {
        priceCoins: fields.priceCoins,
        description: fields.description?.trim() || null,
        wantedDesc: fields.wantedDesc?.trim() || null,
      },
    });

    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

// ── Comprar direto (SALE) ─────────────────────────────────────────────────────

export async function buyListing(listingId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const listing = await prisma.bazarListing.findUnique({
      where: { id: listingId },
      include: { player: { select: { id: true, displayName: true, userId: true } } },
    });
    if (!listing) return { error: "Anúncio não encontrado." };
    if (listing.status !== "ACTIVE") return { error: "Este anúncio não está mais disponível." };
    if (listing.playerId === player.id) return { error: "Você não pode comprar seu próprio anúncio." };
    await assertBazarPairAllowed(prisma, player.id, listing.playerId);
    if (!listing.priceCoins) return { error: "Este anúncio não tem preço definido." };
    if (listing.listingType === "TRADE") return { error: "Este anúncio é somente troca. Envie uma proposta." };

    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < listing.priceCoins) {
      return { error: `Saldo insuficiente. Você tem ${wallet?.balance ?? 0} ZC, o item custa ${listing.priceCoins} ZC.` };
    }

    const buyerName = player.displayName;
    const sellerName = listing.player.displayName;

    await prisma.$transaction(async (tx) => {
      // Marcar como vendido
      await tx.bazarListing.update({ where: { id: listingId }, data: { status: "SOLD" } });

      // Transferir coins: comprador → vendedor
      await tx.zikaCoinWallet.update({
        where: { playerId: player.id },
        data: { balance: { decrement: listing.priceCoins! } },
      });
      await tx.zikaCoinWallet.upsert({
        where: { playerId: listing.playerId },
        update: { balance: { increment: listing.priceCoins! } },
        create: { playerId: listing.playerId, balance: listing.priceCoins!, totalEarned: listing.priceCoins! },
      });

      // Transferir item para o comprador
      await _transferItem(tx, listing, player.id);

      // Rejeitar proposals pendentes e liberar mascotes oferecidos nelas.
      const pendingProposals = await tx.bazarProposal.findMany({
        where: { listingId, status: "PENDING" },
        select: { proposerId: true, coinsOffer: true, coinsEscrowed: true, itemsOffer: true },
      });
      for (const proposal of pendingProposals) {
        await _releaseProposalEscrow(tx, proposal);
      }
      await tx.bazarProposal.updateMany({
        where: { listingId, status: "PENDING" },
        data: { status: "REJECTED" },
      });

      // Log de transação
      const payload = listing.payload as Record<string, unknown>;
      const desc = listing.category === "MASCOT"
        ? `${payload.nickname ?? payload.pokemonName} Nv.${payload.level} vendido por ${listing.priceCoins} ZC`
        : `${payload.displayName} vendido por ${listing.priceCoins} ZC`;

      await tx.bazarTransaction.create({
        data: {
          listingId,
          sellerId: listing.playerId,
          buyerId: player.id,
          sellerName,
          buyerName,
          description: desc,
          coinsAmount: listing.priceCoins!,
          category: listing.category,
        },
      });
    });

    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    revalidateTag(`nav-${listing.player.userId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao comprar." };
  }
}

// ── Proposta ──────────────────────────────────────────────────────────────────

export async function createProposal(
  listingId: string,
  coinsOffer: number,
  message?: string,
  itemsOffer?: ProposalOfferItem[],
  loanRequested = false,
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    await prepareBazarMascotAvailability(player.id);

    const listing = await prisma.bazarListing.findUnique({
      where: { id: listingId },
      include: { player: { select: { userId: true } } },
    });
    if (!listing || listing.status !== "ACTIVE") return { error: "Anúncio indisponível." };
    if (listing.playerId === player.id) return { error: "Você não pode propor no seu próprio anúncio." };
    await assertBazarPairAllowed(prisma, player.id, listing.playerId);

    if (loanRequested && !listing.loanEnabled) return { error: "Este anúncio não aceita empréstimo." };
    if (loanRequested && (!listing.loanAmountCoins || listing.loanAmountCoins < 1)) return { error: "O empréstimo deste anúncio está inválido." };
    if (loanRequested && (itemsOffer?.length || Number(coinsOffer) > 0)) {
      return { error: "A proposta de empréstimo não pode combinar entrada em ZC ou itens." };
    }
    const reservedCoins = loanRequested ? 0 : Math.max(0, Math.floor(Number(coinsOffer) || 0));

    if (reservedCoins > 0) {
      const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < reservedCoins) {
        return { error: `Saldo insuficiente (${wallet?.balance ?? 0} ZC disponíveis).` };
      }
    }

    const existing = await prisma.bazarProposal.findFirst({
      where: { listingId, proposerId: player.id, status: "PENDING" },
    });
    if (existing) return { error: "Você já tem uma proposta pendente neste anúncio. Cancele antes de enviar outra." };

    const cleanItems = await Promise.all((itemsOffer ?? []).map(async (item) => {
      const quantity = item.mascotId ? 1 : Math.max(1, Number(item.quantity) || 1);
      if (!item.mascotId) return { ...item, quantity };

      const mascot = await prisma.mascot.findUnique({
        where: { id: item.mascotId },
        select: { pokemonId: true, nickname: true, level: true },
      });
      return {
        ...item,
        quantity,
        displayName: mascot
          ? `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} Nv.${mascot.level}`
          : item.displayName,
        pokemonId: mascot?.pokemonId ?? item.pokemonId,
        level: mascot?.level ?? item.level,
      };
    }));

    await prisma.$transaction(async (tx) => {
      const reservedItems = await _reserveProposalOffers(tx, player.id, cleanItems);
      if (reservedCoins > 0) {
        await tx.zikaCoinWallet.update({
          where: { playerId: player.id },
          data: { balance: { decrement: reservedCoins } },
        });
      }

      await tx.bazarProposal.create({
        data: {
          listingId,
          proposerId: player.id,
          coinsOffer: reservedCoins,
          coinsEscrowed: reservedCoins > 0,
          message,
          loanRequested,
          itemsOffer: reservedItems.length > 0
            ? reservedItems as unknown as import("@prisma/client").Prisma.InputJsonValue
            : undefined,
        },
      });
    });

    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    // Notifica o vendedor que recebeu uma nova proposta
    revalidateTag(`nav-${listing.player.userId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function acceptProposal(proposalId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const proposal = await prisma.bazarProposal.findUnique({
      where: { id: proposalId },
      include: {
        listing: { include: { player: { select: { id: true, displayName: true } } } },
        proposer: { select: { id: true, displayName: true, userId: true } },
      },
    });
    if (!proposal) return { error: "Proposta não encontrada." };
    if (proposal.listing.playerId !== player.id) return { error: "Sem permissão." };
    if (proposal.status !== "PENDING") return { error: "Proposta não está mais pendente." };
    if (proposal.listing.status !== "ACTIVE") return { error: "Anúncio não está mais ativo." };
    await assertBazarPairAllowed(prisma, proposal.proposerId, proposal.listing.playerId);

    // Propostas novas jÃ¡ reservam ZC ao serem criadas. Este bloco preserva propostas antigas.
    if (!proposal.loanRequested && proposal.coinsOffer > 0 && !proposal.coinsEscrowed) {
      const proposerWallet = await prisma.zikaCoinWallet.findUnique({
        where: { playerId: proposal.proposerId },
      });
      if (!proposerWallet || proposerWallet.balance < proposal.coinsOffer) {
        return { error: "O proponente não tem saldo suficiente para concluir a troca." };
      }
    }

    const listing = proposal.listing;

    await prisma.$transaction(async (tx) => {
      // Marcar listing como vendido
      await tx.bazarListing.update({ where: { id: listing.id }, data: { status: "SOLD" } });

      // Aceitar proposta
      await tx.bazarProposal.update({ where: { id: proposalId }, data: { status: "ACCEPTED" } });

      // Rejeitar outras proposals e liberar mascotes que estavam reservados nelas.
      const rejectedProposals = await tx.bazarProposal.findMany({
        where: { listingId: listing.id, status: "PENDING", id: { not: proposalId } },
        select: { proposerId: true, coinsOffer: true, coinsEscrowed: true, itemsOffer: true },
      });
      for (const rejected of rejectedProposals) {
        await _releaseProposalEscrow(tx, rejected);
      }
      await tx.bazarProposal.updateMany({
        where: { listingId: listing.id, status: "PENDING", id: { not: proposalId } },
        data: { status: "REJECTED" },
      });

      // Transferir coins (proponente → dono do anúncio)
      if (!proposal.loanRequested && proposal.coinsOffer > 0) {
        if (!proposal.coinsEscrowed) {
          await tx.zikaCoinWallet.update({
            where: { playerId: proposal.proposerId },
            data: { balance: { decrement: proposal.coinsOffer } },
          });
        }
        await tx.zikaCoinWallet.upsert({
          where: { playerId: player.id },
          update: { balance: { increment: proposal.coinsOffer } },
          create: { playerId: player.id, balance: proposal.coinsOffer, totalEarned: proposal.coinsOffer },
        });
      }

      // Transfer items from proposer to seller (if any)
      const itemsOffer = proposal.itemsOffer as ProposalOfferItem[] | null;
      if (itemsOffer && itemsOffer.length > 0) {
        for (const item of itemsOffer) {
          if (item.mascotId) {
            const mascot = await tx.mascot.findUnique({ where: { id: item.mascotId } });
            if (!mascot || mascot.playerId !== proposal.proposerId) {
              throw new Error("Mascote da proposta não está mais disponível.");
            }
            await tx.mascot.update({
              where: { id: item.mascotId },
              data: { playerId: player.id, bazarListed: false, isEquipped: false },
            });
            await registerPokemonDiscovery({ playerId: player.id, pokemonId: mascot.pokemonId, source: "bazar-proposal" }, tx);
          } else if (item.type === "FOOD" || item.type === "SWEET") {
            await tx.mascotFoodItem.upsert({
              where: { playerId_type: { playerId: player.id, type: item.type as "FOOD" | "SWEET" } },
              update: { quantity: { increment: item.quantity } },
              create: { playerId: player.id, type: item.type as "FOOD" | "SWEET", quantity: item.quantity }
            });
          } else if (isEggOfferType(item.type)) {
            const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const eggIds = [...new Set(item.escrowed_egg_ids ?? [])];
            if (eggIds.length > 0) {
              if (eggIds.length !== quantity) throw new Error("A quantidade de ovos da proposta estÃ¡ inconsistente.");
              const delivered = await tx.mascotEgg.updateMany({
                where: { id: { in: eggIds }, playerId: proposal.proposerId },
                data: { playerId: player.id, origin: "Proposta de Bazar" }
              });
              if (delivered.count !== quantity) throw new Error("NÃ£o foi possÃ­vel entregar todos os ovos da proposta.");
            } else {
              const eggs = await tx.mascotEgg.findMany({
                where: { playerId: proposal.proposerId, type: item.type as never, incubation: null },
                take: quantity,
              });
              if (eggs.length < quantity) throw new Error(`Proposer doesn't have enough eggs`);
              const delivered = await tx.mascotEgg.updateMany({
                where: { id: { in: eggs.map(e => e.id) } },
                data: { playerId: player.id, origin: "Proposta de Bazar" }
              });
              if (delivered.count !== quantity) throw new Error("NÃ£o foi possÃ­vel entregar todos os ovos da proposta.");
            }
          } else {
            const inv = item.shopItemId
              ? { itemId: item.shopItemId }
              : await tx.playerInventory.findFirst({
                  where: { playerId: proposal.proposerId, item: { type: item.type as never }, quantity: { gte: item.quantity } },
                  select: { itemId: true },
                });
            if (!inv) throw new Error(`Proposer doesn't have enough of ${item.type}`);
            if (!item.shopItemId) {
              await tx.playerInventory.updateMany({
                where: { playerId: proposal.proposerId, itemId: inv.itemId },
                data: { quantity: { decrement: item.quantity } }
              });
            }
            await tx.playerInventory.upsert({
              where: { playerId_itemId: { playerId: player.id, itemId: inv.itemId } },
              update: { quantity: { increment: item.quantity } },
              create: { playerId: player.id, itemId: inv.itemId, quantity: item.quantity }
            });
          }
        }
      }

      // Transferir item para o proponente
      await _transferItem(tx, listing, proposal.proposerId);

      if (proposal.loanRequested) {
        const principal = listing.loanAmountCoins ?? 0;
        const interestPct = listing.loanInterestPct ?? 0;
        if (!listing.loanEnabled || principal < 1) throw new Error("As condições do empréstimo não estão mais disponíveis.");
        await tx.bazarLoan.create({
          data: {
            listingId: listing.id,
            proposalId: proposal.id,
            lenderId: player.id,
            borrowerId: proposal.proposerId,
            principalCoins: principal,
            interestPct,
            totalDueCoins: Math.ceil(principal * (100 + interestPct) / 100),
            itemSnapshot: listing.payload as import("@prisma/client").Prisma.InputJsonValue,
          },
        });
      }

      // Log
      const payload = listing.payload as Record<string, unknown>;
      const loanDescription = proposal.loanRequested
        ? ` por empréstimo de ${listing.loanAmountCoins} ZC a ${listing.loanInterestPct ?? 0}%`
        : proposal.coinsOffer > 0 ? ` por ${proposal.coinsOffer} ZC` : "";
      const desc = listing.category === "MASCOT"
        ? `${payload.nickname ?? payload.pokemonName} Nv.${payload.level} trocado${loanDescription}`
        : `${payload.displayName} trocado${loanDescription}`;

      await tx.bazarTransaction.create({
        data: {
          listingId: listing.id,
          sellerId: player.id,
          buyerId: proposal.proposerId,
          sellerName: listing.player.displayName,
          buyerName: proposal.proposer.displayName,
          description: desc,
          coinsAmount: proposal.loanRequested ? 0 : proposal.coinsOffer,
          category: listing.category,
        },
      });
    });

    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    // Notifica o proponente que sua proposta foi aceita
    revalidateTag(`nav-${proposal.proposer.userId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function rejectProposal(proposalId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const proposal = await prisma.bazarProposal.findUnique({
      where: { id: proposalId },
      include: {
        listing: { select: { playerId: true } },
        proposer: { select: { userId: true } },
      },
    });
    if (!proposal) return { error: "Proposta não encontrada." };
    if (proposal.listing.playerId !== player.id && proposal.proposerId !== player.id) {
      return { error: "Sem permissão." };
    }
    if (proposal.status !== "PENDING") return { error: "Proposta não está pendente." };

    const sellerIsRejecting = proposal.listing.playerId === player.id;
    const newStatus = sellerIsRejecting ? "REJECTED" : "CANCELLED";
    await prisma.$transaction(async (tx) => {
      await _releaseProposalOffers(tx, proposal.itemsOffer as ProposalOfferItem[] | null, proposal.proposerId);
      await _refundProposalCoins(tx, {
        proposerId: proposal.proposerId,
        coinsOffer: proposal.coinsOffer,
        coinsEscrowed: proposal.coinsEscrowed,
      });
      await tx.bazarProposal.update({ where: { id: proposalId }, data: { status: newStatus } });
    });

    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    // Se o vendedor rejeitou, notifica o proponente
    if (sellerIsRejecting) revalidateTag(`nav-${proposal.proposer.userId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

// ── Favorito ──────────────────────────────────────────────────────────────────

export async function toggleFavorite(listingId: string): Promise<{ error?: string; favorited?: boolean }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const existing = await prisma.bazarFavorite.findUnique({
      where: { playerId_listingId: { playerId: player.id, listingId } },
    });

    if (existing) {
      await prisma.bazarFavorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    } else {
      await prisma.bazarFavorite.create({ data: { playerId: player.id, listingId } });
      return { favorited: true };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

// ── Miauvadão ─────────────────────────────────────────────────────────────────

export type MiauvadaoPurchaseStatus = { available: number; rechargeAt: string[] };

function purchaseStatusFromQuota(
  quota: { chargeOneUsedAt: Date | null; chargeTwoUsedAt: Date | null } | null,
  now = new Date(),
): MiauvadaoPurchaseStatus {
  const rechargeAt = [quota?.chargeOneUsedAt, quota?.chargeTwoUsedAt]
    .filter((value): value is Date => Boolean(value))
    .map((value) => new Date(value.getTime() + MIAUVADAO_PURCHASE_RECHARGE_MS))
    .filter((value) => value > now)
    .sort((a, b) => a.getTime() - b.getTime());
  return { available: 2 - rechargeAt.length, rechargeAt: rechargeAt.map((value) => value.toISOString()) };
}

export async function payBazarLoan(loanId: string, requestedAmount: number): Promise<{ error?: string; paid?: number; remaining?: number }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const amount = Math.floor(Number(requestedAmount) || 0);
    if (amount < 1) return { error: "Informe uma parcela válida." };

    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.bazarLoan.findUnique({
        where: { id: loanId },
        include: {
          lender: { select: { userId: true, displayName: true } },
          borrower: { select: { displayName: true } },
        },
      });
      if (!loan || loan.borrowerId !== player.id) throw new Error("Empréstimo não encontrado.");
      if (loan.status !== "ACTIVE") throw new Error("Este empréstimo não está ativo.");

      const remainingBefore = loan.totalDueCoins - loan.amountPaidCoins;
      const payment = Math.min(amount, remainingBefore);
      const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < payment) throw new Error(`Saldo insuficiente. Disponível: ${wallet?.balance ?? 0} ZC.`);

      const lenderWallet = await tx.zikaCoinWallet.upsert({
        where: { playerId: loan.lenderId },
        update: {},
        create: { playerId: loan.lenderId, balance: 0 },
      });
      const remaining = remainingBefore - payment;
      const reserved = await tx.bazarLoan.updateMany({
        where: { id: loanId, status: "ACTIVE", amountPaidCoins: loan.amountPaidCoins },
        data: {
          amountPaidCoins: { increment: payment },
          status: remaining === 0 ? "PAID" : "ACTIVE",
          paidAt: remaining === 0 ? new Date() : null,
        },
      });
      if (reserved.count !== 1) throw new Error("A dívida foi atualizada em outra operação. Tente novamente.");

      await tx.zikaCoinWallet.update({
        where: { playerId: player.id },
        data: { balance: { decrement: payment }, totalSpent: { increment: payment } },
      });
      await tx.zikaCoinWallet.update({
        where: { playerId: loan.lenderId },
        data: { balance: { increment: payment }, totalEarned: { increment: payment } },
      });
      await tx.zikaCoinTransaction.createMany({
        data: [
          {
            walletId: wallet.id,
            type: "ADMIN_ADJUSTMENT",
            amount: -payment,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance - payment,
            description: `Parcela de empréstimo para ${loan.lender.displayName}`,
          },
          {
            walletId: lenderWallet.id,
            type: "ADMIN_ADJUSTMENT",
            amount: payment,
            balanceBefore: lenderWallet.balance,
            balanceAfter: lenderWallet.balance + payment,
            description: `Parcela de empréstimo recebida de ${loan.borrower.displayName}`,
          },
        ],
      });
      await tx.bazarLoanPayment.create({
        data: {
          loanId,
          payerId: player.id,
          receiverId: loan.lenderId,
          amountCoins: payment,
          remainingCoins: remaining,
        },
      });
      return { payment, remaining, lenderUserId: loan.lender.userId };
    });

    revalidatePath("/bazar/emprestimos");
    revalidatePath("/bazar/devedores");
    revalidateTag(`nav-${user.id}`);
    revalidateTag(`nav-${result.lenderUserId}`);
    return { paid: result.payment, remaining: result.remaining };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível pagar a parcela." };
  }
}

export async function getMiauvadaoPurchaseStatus(playerId: string | null): Promise<MiauvadaoPurchaseStatus> {
  if (!playerId) return { available: 0, rechargeAt: [] };
  return purchaseStatusFromQuota(
    await prisma.miauvadaoPurchaseQuota.findUnique({ where: { playerId } }),
  );
}

const MIAUVADAO_EGG_FUSION_VAULT_COST = 500;

export async function fuseMiauvadaoEggsAction(eggTypes: MiauvadaoFusionEggType[]): Promise<{
  error?: string;
  result?: "BROKEN" | MiauvadaoFusionEggType | "LAB";
  lootBonusPct?: number;
  newVaultBalance?: number;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    if (eggTypes.length !== 3 || eggTypes.some((type) => !MIAUVADAO_FUSION_EGG_TYPES.includes(type))) {
      return { error: "Selecione exatamente 3 ovos válidos." };
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const config = await tx.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
      if (config.vaultBalance < MIAUVADAO_EGG_FUSION_VAULT_COST) {
        throw new Error(`A máquina está desligada: o cofre precisa de pelo menos ${MIAUVADAO_EGG_FUSION_VAULT_COST} ZC para funcionar.`);
      }

      const required = eggTypes.reduce((map, type) => {
        map.set(type, (map.get(type) ?? 0) + 1);
        return map;
      }, new Map<MiauvadaoFusionEggType, number>());
      const consumedIds: string[] = [];
      for (const [type, quantity] of required) {
        const eggs = await tx.mascotEgg.findMany({
          where: {
            playerId: player.id,
            type: type as EggType,
            incubation: null,
            NOT: { origin: { startsWith: "bazar:" } },
          },
          orderBy: { obtainedAt: "asc" },
          take: quantity,
          select: { id: true },
        });
        if (eggs.length !== quantity) throw new Error(`Você não possui ${quantity} Ovo(s) ${type} disponível(is).`);
        consumedIds.push(...eggs.map((egg) => egg.id));
      }

      const result = rollMiauvadaoFusion(eggTypes);
      const lootBonusPct = rollFusionLootBonus(eggTypes, result);
      const consumed = await tx.mascotEgg.deleteMany({ where: { id: { in: consumedIds }, playerId: player.id } });
      if (consumed.count !== 3) {
        throw new Error("Os ovos mudaram enquanto a fusão era processada. Nada foi consumido; tente novamente.");
      }
      if (result !== "BROKEN") {
        await tx.mascotEgg.create({
          data: {
            playerId: player.id,
            type: result as EggType,
            origin: "Miauvadão: Fusão de Ovos",
            hatchRarityBonusPct: lootBonusPct,
          },
        });
      }
      const updatedConfig = await tx.miauvadaoConfig.update({
        where: { id: "singleton" },
        data: {
          vaultBalance: { decrement: MIAUVADAO_EGG_FUSION_VAULT_COST },
          lastNpcMessage: result === "BROKEN"
            ? `${player.displayName} arriscou três ovos, mas a máquina transformou tudo em casca quebrada! 💥`
            : `${player.displayName} fundiu três ovos e recebeu um Ovo ${result}${lootBonusPct ? ` com +${lootBonusPct} pontos percentuais de chance de alta raridade` : ""}! 🥚`,
          lastNpcMessageAt: new Date(),
        },
      });
      return { result, lootBonusPct, newVaultBalance: updatedConfig.vaultBalance };
    }, { isolationLevel: "Serializable" });

    revalidateTag("miauvadao-config");
    revalidatePath("/bazar");
    revalidatePath("/mascotes");
    return outcome;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "A fusão falhou." };
  }
}

export async function buyMiauvadaoOffer(offerIndex: number): Promise<{ error?: string; purchaseStatus?: MiauvadaoPurchaseStatus }> {
  try {
    if (offerIndex === 1) {
      const [sabotages, stepState] = await Promise.all([
        getActiveRaidSabotages("BAZAR"),
        getOrderStepUnlockState("BAZAR_SLOT_SIX_CLICKS"),
      ]);
      const bazarSabotaged = sabotages.some((s) => s.sabotageType === "BLOCK_BAZAR_SLOT") || (stepState.active && stepState.unlocked && !stepState.resolved);
      if (bazarSabotaged) return { error: "O slot do meio foi sabotado pela Ordem da Trapaca." };
    }
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    await autoRefreshMiauvadaoIfNeeded();
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const config = await tx.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
      const offers = config.dailyOffers as unknown as MiauvadaoOffer[];
      const offer = offers[offerIndex];
      if (!offer) throw new Error("Oferta não encontrada.");
      if (offer.sold >= offer.stock) throw new Error("Estoque esgotado.");
      if (now > new Date(offer.validUntil)) throw new Error("Oferta expirada.");
      const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < offer.finalPrice) {
        throw new Error(`Saldo insuficiente (${wallet?.balance ?? 0} ZC disponíveis, oferta custa ${offer.finalPrice} ZC).`);
      }
      const quota = await tx.miauvadaoPurchaseQuota.upsert({
        where: { playerId: player.id },
        update: {},
        create: { playerId: player.id },
      });
      const chargeOneAvailable = !quota.chargeOneUsedAt
        || now.getTime() - quota.chargeOneUsedAt.getTime() >= MIAUVADAO_PURCHASE_RECHARGE_MS;
      const chargeTwoAvailable = !quota.chargeTwoUsedAt
        || now.getTime() - quota.chargeTwoUsedAt.getTime() >= MIAUVADAO_PURCHASE_RECHARGE_MS;
      if (!chargeOneAvailable && !chargeTwoAvailable) {
        const status = purchaseStatusFromQuota(quota, now);
        throw new Error(`Suas duas compras estão recarregando. Próxima disponível às ${new Date(status.rechargeAt[0]).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.`);
      }
      await tx.miauvadaoPurchaseQuota.update({
        where: { playerId: player.id },
        data: chargeOneAvailable ? { chargeOneUsedAt: now } : { chargeTwoUsedAt: now },
      });
      const coinsToVault = Math.floor(offer.finalPrice * 0.25);
      // Cobrar player
      await tx.zikaCoinWallet.update({
        where: { playerId: player.id },
        data: { balance: { decrement: offer.finalPrice } },
      });

      // Atualizar sold na oferta + adicionar 25% ao cofre + mensagem NPC
      const updatedOffers = [...offers];
      updatedOffers[offerIndex] = { ...offer, sold: offer.sold + 1 };
      await tx.miauvadaoConfig.update({
        where: { id: "singleton" },
        data: {
          dailyOffers: updatedOffers as unknown as import("@prisma/client").Prisma.InputJsonValue,
          vaultBalance: { increment: coinsToVault },
          lastNpcMessage: `${player.displayName} comprou ${offer.name} e deixou +${coinsToVault} ZC nos fundos! 💰`,
          lastNpcMessageAt: new Date(),
        },
      });

      // Entregar item (mesmo esquema da shop)
      if (offer.itemType.startsWith("EGG_") || ["EGG_COMMON","EGG_RARE","EGG_SPECIAL"].includes(offer.itemType)) {
        const eggType = EGG_SHOP_TO_EGG_TYPE[offer.itemType];
        if (!eggType) throw new Error(`Tipo de ovo não suportado pelo Miauvadão: ${offer.itemType}`);
        await tx.mascotEgg.create({
          data: { playerId: player.id, type: eggType as never, origin: "Miauvadão" },
        });
      } else if (offer.itemType === "MASCOT_FOOD") {
        await tx.mascotFoodItem.upsert({
          where: { playerId_type: { playerId: player.id, type: "FOOD" } },
          update: { quantity: { increment: 1 } },
          create: { playerId: player.id, type: "FOOD", quantity: 1 },
        });
      } else if (offer.itemType === "MASCOT_SWEET") {
        await tx.mascotFoodItem.upsert({
          where: { playerId_type: { playerId: player.id, type: "SWEET" } },
          update: { quantity: { increment: 1 } },
          create: { playerId: player.id, type: "SWEET", quantity: 1 },
        });
      } else if (offer.shopItemId) {
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: player.id, itemId: offer.shopItemId } },
          update: { quantity: { increment: 1 } },
          create: { playerId: player.id, itemId: offer.shopItemId, quantity: 1 },
        });
      }
      const updatedQuota = await tx.miauvadaoPurchaseQuota.findUniqueOrThrow({ where: { playerId: player.id } });
      return { purchaseStatus: purchaseStatusFromQuota(updatedQuota, now) };
    }, { isolationLevel: "Serializable" });

    revalidateTag("miauvadao-config");
    revalidatePath("/bazar");
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao comprar." };
  }
}

export interface MiauvadaoOffer {
  itemType: string;
  shopItemId?: string;
  name: string;
  imageUrl?: string;
  description?: string;
  originalPrice: number;
  discountPct: number;
  finalPrice: number;
  stock: number;
  sold: number;
  validUntil: string;
}

// Admin: definir ofertas do dia
export async function adminSetMiauvadaoOffers(offers: MiauvadaoOffer[]): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const validUntil = getMiauvadaoRotation().next.toISOString();
    const offersWithExpiry = offers.map(o => {
      const discountLimit = isMegaStoneType(o.itemType)
        ? MIAUVADAO_MEGA_STONE_MAX_DISCOUNT
        : MIAUVADAO_MAX_DISCOUNT;
      const discountPct = Math.max(0, Math.min(discountLimit, o.discountPct ?? 0));
      const finalPrice = Math.max(1, Math.round(o.originalPrice * (1 - discountPct / 100)));
      return { ...o, discountPct, finalPrice, validUntil, sold: 0 };
    });
    await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: { dailyOffers: offersWithExpiry as unknown as import("@prisma/client").Prisma.InputJsonValue, offersRefreshedAt: new Date() },
    });
    revalidatePath("/bazar");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function adminUpdateListingFee(fee: number): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.miauvadaoConfig.update({ where: { id: "singleton" }, data: { listingFee: fee } });
    revalidateTag("miauvadao-config");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function refreshMiauvadaoOfferSlot(offerIndex: number): Promise<{ error?: string; newBalance?: number }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    if (!Number.isInteger(offerIndex) || offerIndex < 0 || offerIndex > 2) return { error: "Slot inválido." };
    await autoRefreshMiauvadaoIfNeeded();
    const rotation = getMiauvadaoRotation();
    const result = await prisma.$transaction(async (tx) => {
      const config = await tx.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
      if (config.slotRefreshUsedCycle && config.slotRefreshUsedCycle >= rotation.start) {
        throw new Error("A troca de um slot já foi usada nesta rotação.");
      }
      const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < MIAUVADAO_SLOT_REFRESH_COST) {
        throw new Error(`Saldo insuficiente (precisa de ${MIAUVADAO_SLOT_REFRESH_COST} ZC).`);
      }
      const offers = config.dailyOffers as unknown as MiauvadaoOffer[];
      if (!offers[offerIndex]) throw new Error("Slot não encontrado.");
      const candidates = await rollMiauvadaoOffers(config.vaultBalance);
      const existingIds = new Set(offers.map((offer) => offer.shopItemId));
      const replacement = candidates.find((offer) => !existingIds.has(offer.shopItemId)) ?? candidates[0];
      if (!replacement) throw new Error("Nenhum item elegível para a troca.");
      const updatedOffers = [...offers];
      updatedOffers[offerIndex] = replacement;
      const updatedWallet = await tx.zikaCoinWallet.update({
        where: { playerId: player.id },
        data: { balance: { decrement: MIAUVADAO_SLOT_REFRESH_COST } },
      });
      await tx.miauvadaoConfig.update({
        where: { id: "singleton" },
        data: {
          dailyOffers: updatedOffers as unknown as import("@prisma/client").Prisma.InputJsonValue,
          slotRefreshUsedCycle: rotation.start,
          vaultBalance: { increment: MIAUVADAO_SLOT_REFRESH_COST },
          lastNpcMessage: `${player.displayName} pagou ${MIAUVADAO_SLOT_REFRESH_COST} ZC e trocou uma oferta para todo mundo! 🔄`,
          lastNpcMessageAt: new Date(),
        },
      });
      return { newBalance: updatedWallet.balance };
    }, { isolationLevel: "Serializable" });

    revalidateTag("miauvadao-config");
    revalidatePath("/bazar");
    return result;
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function adminAdjustVault(amount: number): Promise<{ error?: string; newBalance?: number }> {
  try {
    await requireAdmin();
    const config = await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: { vaultBalance: { increment: amount } }
    });
    revalidateTag("miauvadao-config");
    revalidatePath("/bazar");
    return { newBalance: config.vaultBalance };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function adminRefreshMiauvadaoShopNow(): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const config = await getMiauvadaoConfig();
    const newOffers = await rollMiauvadaoOffers(config.vaultBalance, 10);
    if (newOffers.length === 0) {
      return { error: "Nenhum item elegível ativo encontrado na ZikaShop." };
    }

    await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: {
        dailyOffers: newOffers as unknown as import("@prisma/client").Prisma.InputJsonValue,
        offersRefreshedAt: getMiauvadaoRotation().start,
        slotRefreshUsedCycle: null,
        lastNpcMessage: "Admin atualizou as ofertas do Miauvadão manualmente. 🛍️",
        lastNpcMessageAt: new Date(),
      },
    });

    revalidateTag("miauvadao-config");
    revalidatePath("/bazar");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

// ── Utilitários internos ──────────────────────────────────────────────────────

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function canonicalBazarPair(playerAId: string, playerBId: string) {
  return playerAId < playerBId
    ? { playerAId, playerBId }
    : { playerAId: playerBId, playerBId: playerAId };
}

export type BazarTradeBanAdminData = {
  players: Array<{ id: string; displayName: string }>;
  bans: Array<{
    id: string;
    playerAId: string;
    playerBId: string;
    playerAName: string;
    playerBName: string;
    reason: string | null;
    active: boolean;
    updatedAt: Date;
  }>;
};

export async function adminGetBazarTradeBanData(): Promise<BazarTradeBanAdminData> {
  await requireAdmin();
  const [players, bans] = await Promise.all([
    prisma.player.findMany({
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.bazarPlayerTradeBan.findMany({ orderBy: [{ active: "desc" }, { updatedAt: "desc" }] }),
  ]);
  const names = new Map(players.map((player) => [player.id, player.displayName]));
  return {
    players,
    bans: bans.map((ban) => ({
      ...ban,
      playerAName: names.get(ban.playerAId) ?? "Jogador removido",
      playerBName: names.get(ban.playerBId) ?? "Jogador removido",
    })),
  };
}

export async function adminSetBazarTradeBan(input: {
  playerAId: string;
  playerBId: string;
  active: boolean;
  reason?: string;
}): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();
    if (!input.playerAId || !input.playerBId || input.playerAId === input.playerBId) {
      return { error: "Selecione dois jogadores diferentes." };
    }
    const pair = canonicalBazarPair(input.playerAId, input.playerBId);
    const validPlayers = await prisma.player.count({ where: { id: { in: [pair.playerAId, pair.playerBId] } } });
    if (validPlayers !== 2) return { error: "Um dos jogadores nÃ£o foi encontrado." };
    await prisma.bazarPlayerTradeBan.upsert({
      where: { playerAId_playerBId: pair },
      update: { active: input.active, reason: input.reason?.trim() || null, createdByUserId: admin.id },
      create: { ...pair, active: input.active, reason: input.reason?.trim() || null, createdByUserId: admin.id },
    });
    revalidatePath("/bazar/admin");
    revalidateBazar();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao atualizar o bloqueio." };
  }
}

async function assertBazarPairAllowed(
  client: TxClient | typeof prisma,
  playerAId: string,
  playerBId: string,
) {
  if (await isBazarPairBanned(client, playerAId, playerBId)) {
    throw new Error("Negociações entre estes dois jogadores estão bloqueadas permanentemente pela administração.");
  }
}

async function isBazarPairBanned(
  client: TxClient | typeof prisma,
  playerAId: string,
  playerBId: string,
) {
  const pair = canonicalBazarPair(playerAId, playerBId);
  const ban = await client.bazarPlayerTradeBan.findUnique({
    where: { playerAId_playerBId: pair },
    select: { active: true },
  });
  return ban?.active === true;
}

async function prepareBazarMascotAvailability(playerId: string) {
  await Promise.all([
    cleanupExpiredArenaResting(playerId),
    syncDefeatedArenaTeams(playerId),
  ]).catch(() => null);
}

async function assertMascotTradeableInBazar(
  client: TxClient | typeof prisma,
  mascot: {
    id: string;
    playerId: string;
    pokemonId: number;
    nickname: string | null;
    bazarListed: boolean;
    isEquipped: boolean;
    operationsLocked: boolean;
    arenaState: string;
    restingUntil: Date | null;
  },
  playerId: string,
  displayName?: string,
) {
  const name = displayName ?? mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const now = new Date();

  if (mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.operationsLocked) {
    throw new Error(`${name} está protegido. Desbloqueie-o na página de Mascotes antes de usar o Bazar.`);
  }
  if (mascot.bazarListed) throw new Error(`${name} já está reservado em outra oferta do Bazar.`);
  if (mascot.isEquipped) throw new Error(`Desequipe ${name} antes de oferecê-lo no Bazar.`);
  if (mascot.arenaState !== "FREE") {
    throw new Error(`${name} não está livre para o Bazar no momento (${mascot.arenaState}).`);
  }
  if (mascot.restingUntil && mascot.restingUntil > now) {
    const minutes = Math.ceil((mascot.restingUntil.getTime() - now.getTime()) / 60_000);
    throw new Error(`${name} ainda está em cooldown por ${minutes} min.`);
  }
  if (await isMascotLockedInWeeklyLeague(client, mascot.id, playerId)) {
    throw new Error(`${name} está escalado na Liga Semanal e não pode ser oferecido no Bazar.`);
  }

  const [activeExpedition, activeArenaMember] = await Promise.all([
    client.mascotExpedition.findFirst({
      where: { mascotId: mascot.id, status: "ACTIVE" },
      select: { id: true },
    }),
    client.arenaTeamMember.findFirst({
      where: { mascotId: mascot.id, team: { status: "ACTIVE" } },
      select: { id: true },
    }),
  ]);

  if (activeExpedition) throw new Error(`${name} está em expedição e não pode ser oferecido agora.`);
  if (activeArenaMember) throw new Error(`${name} está em uma equipe ativa da Arena Z.`);
}

async function _reserveProposalOffers(tx: TxClient, playerId: string, items: ProposalOfferItem[]): Promise<ProposalOfferItem[]> {
  const reserved: ProposalOfferItem[] = [];

  for (const item of items) {
    const quantity = item.mascotId ? 1 : Math.max(1, Math.floor(Number(item.quantity) || 1));
    const normalized: ProposalOfferItem = { ...item, quantity };

    if (!item.mascotId && (item.type === "FOOD" || item.type === "SWEET")) {
      const foodType = item.type as "FOOD" | "SWEET";
      const food = await tx.mascotFoodItem.findUnique({
        where: { playerId_type: { playerId, type: foodType } },
      });
      if (!food || food.quantity < quantity) {
        throw new Error(`Você não tem ${normalized.displayName} suficiente para esta proposta.`);
      }
      await tx.mascotFoodItem.update({
        where: { playerId_type: { playerId, type: foodType } },
        data: { quantity: { decrement: quantity } },
      });
      reserved.push({ ...normalized, escrowed: true });
      continue;
    }

    if (!item.mascotId && isEggOfferType(item.type)) {
      const eggs = await tx.mascotEgg.findMany({
        where: {
          playerId,
          type: item.type as never,
          incubation: null,
          NOT: { origin: { startsWith: "bazar:" } },
        },
        select: { id: true },
        take: quantity,
      });
      if (eggs.length < quantity) {
        throw new Error(`Você não tem ${normalized.displayName} suficiente para esta proposta.`);
      }
      const eggIds = eggs.map((egg) => egg.id);
      await tx.mascotEgg.updateMany({
        where: { id: { in: eggIds }, playerId },
        data: { origin: `bazar-proposal:${playerId}` },
      });
      reserved.push({ ...normalized, escrowed: true, escrowed_egg_ids: eggIds });
      continue;
    }

    if (!item.mascotId) {
      const inv = await tx.playerInventory.findFirst({
        where: { playerId, item: { type: item.type as never }, quantity: { gte: quantity } },
        select: { itemId: true },
      });
      if (!inv) {
        throw new Error(`Você não tem ${normalized.displayName} suficiente para esta proposta.`);
      }
      await tx.playerInventory.update({
        where: { playerId_itemId: { playerId, itemId: inv.itemId } },
        data: { quantity: { decrement: quantity } },
      });
      reserved.push({ ...normalized, escrowed: true, shopItemId: inv.itemId });
      continue;
    }

    const mascot = await tx.mascot.findUnique({ where: { id: item.mascotId } });
    if (!mascot) {
      throw new Error("Mascote da proposta não encontrado.");
    }
    await assertMascotTradeableInBazar(tx, mascot, playerId, item.displayName);

    await tx.mascot.update({
      where: { id: item.mascotId },
      data: { bazarListed: true },
    });
    reserved.push(normalized);
  }

  return reserved;
}

async function _releaseProposalOffers(tx: TxClient, items: ProposalOfferItem[] | null, ownerId: string) {
  if (!items) return;

  const mascotIds = items
    .map(item => item.mascotId)
    .filter((id): id is string => Boolean(id));

  if (mascotIds.length > 0) {
    await tx.mascot.updateMany({
      where: { id: { in: mascotIds }, playerId: ownerId },
      data: { bazarListed: false },
    });
  }

  for (const item of items) {
    if (item.mascotId) continue;

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));

    if (item.type === "FOOD" || item.type === "SWEET") {
      if (!item.escrowed) continue;
      const foodType = item.type as "FOOD" | "SWEET";
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId: ownerId, type: foodType } },
        update: { quantity: { increment: quantity } },
        create: { playerId: ownerId, type: foodType, quantity },
      });
      continue;
    }

    if (isEggOfferType(item.type)) {
      const eggIds = item.escrowed_egg_ids ?? [];
      if (eggIds.length > 0) {
        await tx.mascotEgg.updateMany({
          where: { id: { in: eggIds }, playerId: ownerId },
          data: { origin: "Devolvido do Bazar" },
        });
      }
      continue;
    }

    if (item.shopItemId) {
      await tx.playerInventory.upsert({
        where: { playerId_itemId: { playerId: ownerId, itemId: item.shopItemId } },
        update: { quantity: { increment: quantity } },
        create: { playerId: ownerId, itemId: item.shopItemId, quantity },
      });
    }
  }
}

async function _refundProposalCoins(
  tx: TxClient,
  proposal: { proposerId: string; coinsOffer: number; coinsEscrowed: boolean },
) {
  if (!proposal.coinsEscrowed || proposal.coinsOffer <= 0) return;

  await tx.zikaCoinWallet.upsert({
    where: { playerId: proposal.proposerId },
    update: { balance: { increment: proposal.coinsOffer } },
    create: {
      playerId: proposal.proposerId,
      balance: proposal.coinsOffer,
      totalEarned: 0,
    },
  });
}

async function _releaseProposalEscrow(
  tx: TxClient,
  proposal: {
    proposerId: string;
    coinsOffer: number;
    coinsEscrowed: boolean;
    itemsOffer: unknown;
  },
) {
  await _releaseProposalOffers(tx, proposal.itemsOffer as ProposalOfferItem[] | null, proposal.proposerId);
  await _refundProposalCoins(tx, proposal);
}

async function _transferItem(tx: TxClient, listing: { id: string; category: string; payload: unknown }, toBuyerId: string) {
  const payload = listing.payload as Record<string, unknown>;

  if (listing.category === "MASCOT") {
    const mascotId = payload.mascotId as string;
    await tx.mascot.update({
      where: { id: mascotId },
      data: { playerId: toBuyerId, bazarListed: false, isEquipped: false },
    });
    const pokemonId = Number(payload.pokemonId);
    if (Number.isFinite(pokemonId)) {
      await registerPokemonDiscovery({ playerId: toBuyerId, pokemonId, source: "bazar-purchase" }, tx);
    }
  } else if (listing.category === "ITEM") {
    const itemType = payload.itemType as string;
    const qty = getListingQuantity(payload);

    if (itemType === "FOOD" || itemType === "SWEET") {
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId: toBuyerId, type: itemType as "FOOD" | "SWEET" } },
        update: { quantity: { increment: qty } },
        create: { playerId: toBuyerId, type: itemType as "FOOD" | "SWEET", quantity: qty },
      });
    } else if (isEggOfferType(itemType)) {
      const eggIds = [...new Set((payload.escrowed_egg_ids as string[] | undefined) ?? [])];
      if (eggIds.length !== qty) throw new Error("A quantidade de ovos reservados nÃ£o corresponde ao anÃºncio.");
      const delivered = await tx.mascotEgg.updateMany({
        where: { id: { in: eggIds } },
        data: { playerId: toBuyerId, origin: "Comprado no Bazar" },
      });
      if (delivered.count !== qty) throw new Error("NÃ£o foi possÃ­vel entregar todos os ovos do anÃºncio.");
    } else {
      // PlayerInventory item
      const itemId = payload.shopItemId as string | undefined;
      if (itemId) {
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: toBuyerId, itemId } },
          update: { quantity: { increment: qty } },
          create: { playerId: toBuyerId, itemId, quantity: qty },
        });
      }
    }
  }
}

async function _returnEscrow(tx: TxClient, listing: { id: string; category: string; payload: unknown }, ownerId: string) {
  const payload = listing.payload as Record<string, unknown>;

  if (listing.category === "MASCOT") {
    const mascotId = payload.mascotId as string;
    await tx.mascot.update({ where: { id: mascotId }, data: { bazarListed: false } });
  } else if (listing.category === "ITEM") {
    const itemType = payload.itemType as string;
    const qty = getListingQuantity(payload);

    if (itemType === "FOOD" || itemType === "SWEET") {
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId: ownerId, type: itemType as "FOOD" | "SWEET" } },
        update: { quantity: { increment: qty } },
        create: { playerId: ownerId, type: itemType as "FOOD" | "SWEET", quantity: qty },
      });
    } else if (isEggOfferType(itemType)) {
      const eggIds = payload.escrowed_egg_ids as string[] | undefined;
      if (eggIds && eggIds.length > 0) {
        await tx.mascotEgg.updateMany({
          where: { id: { in: eggIds } },
          data: { playerId: ownerId, origin: "Devolvido do Bazar" },
        });
      }
    } else {
      const itemId = payload.shopItemId as string | undefined;
      if (itemId) {
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: ownerId, itemId } },
          update: { quantity: { increment: qty } },
          create: { playerId: ownerId, itemId, quantity: qty },
        });
      }
    }
  }
}

// ── Shell Game ────────────────────────────────────────────────────────────────

const SHELL_COOLDOWN_MS = 5 * 60_000;

const MIAUVADAO_RAGE: string[] = [
  "IMPOSSIVEL! {player} ganhou {prize} ZC e tirou {debit} ZC do meu cofre!",
  "{player} acertou e me custou {debit} ZC! Premio total: {prize} ZC.",
  "Como?! {player} venceu {prize} ZC e tudo saiu do meu cofre... ainda doi!",
  "{player} pegou {prize} ZC no total. Meu cofre perdeu {debit} ZC! Voltaaaa!",
  "Minha sorte acabou... {player} ganhou {prize} ZC e eu banquei {debit} ZC.",
  "{player} ganhou {prize} ZC! Meu cofre chora pelos {debit} ZC.",
];

export async function startShellGameSession(betAmount: number): Promise<{
  error?: string; sessionId?: string; newBalance?: number; lastCooldownMs?: number; debugMode?: boolean;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    if (isAdmin) {
      return { sessionId: "debug-" + Math.random(), newBalance: 9999, debugMode: true };
    }

    if (betAmount < SHELL_MIN_BET) return { error: `Aposta mínima: ${SHELL_MIN_BET} ZC.` };
    if (betAmount > SHELL_MAX_BET) return { error: `Aposta máxima: ${SHELL_MAX_BET} ZC.` };

    const lastSession = await prisma.shellGameSession.findFirst({
      where: { playerId: player.id }, orderBy: { createdAt: "desc" },
    });
    if (lastSession) {
      const elapsed = Date.now() - lastSession.createdAt.getTime();
      if (elapsed < SHELL_COOLDOWN_MS) return { lastCooldownMs: SHELL_COOLDOWN_MS - elapsed };
    }

    const [wallet, config] = await Promise.all([
      prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } }),
      prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" }, select: { vaultBalance: true } }),
    ]);
    if (!wallet || wallet.balance < betAmount) return { error: `Saldo insuficiente (${wallet?.balance ?? 0} ZC).` };
    const vaultBalance = config?.vaultBalance ?? 0;
    const maxVaultBet = getMaxShellBetForVault(vaultBalance);
    if (betAmount > maxVaultBet) {
      return {
        error: maxVaultBet < SHELL_MIN_BET
          ? `O cofre possui apenas ${vaultBalance.toLocaleString("pt-BR")} ZC e não consegue pagar nem a aposta mínima em caso de vitória.`
          : `Com ${vaultBalance.toLocaleString("pt-BR")} ZC no cofre, a aposta máxima segura é ${maxVaultBet.toLocaleString("pt-BR")} ZC.`,
      };
    }

    const ballPos = Math.floor(Math.random() * 3);
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.shellGameSession.create({
        data: { playerId: player.id, betAmount, ballPos, expiresAt },
      });
      await creditCoins(tx, {
        playerId: player.id,
        type: "BET_PLACED",
        amount: -betAmount,
        description: `Aposta no Jogo do Miauvadão (${betAmount.toLocaleString("pt-BR")} ZC)`,
      });
      const updatedWallet = await tx.zikaCoinWallet.findUniqueOrThrow({
        where: { playerId: player.id },
        select: { balance: true },
      });
      return { session, updatedWallet };
    });
    return { sessionId: result.session.id, newBalance: result.updatedWallet.balance };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function resolveShellGame(sessionId: string, guessedPos: number): Promise<{
  error?: string; won?: boolean; actualPos?: number; prize?: number; newBalance?: number; debugMode?: boolean;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    if (isAdmin && sessionId.startsWith("debug-")) {
      return { won: Math.random() > 0.5, actualPos: Math.floor(Math.random() * 3), prize: 0, newBalance: 9999, debugMode: true };
    }

    const session = await prisma.shellGameSession.findUnique({ where: { id: sessionId } });
    if (!session || session.playerId !== player.id) return { error: "Sessão inválida." };
    if (session.resolved) return { error: "Sessão já resolvida." };
    if (new Date() > session.expiresAt) return { error: "Sessão expirada — jogue de novo." };

    const won = session.ballPos === guessedPos;
    let prize = 0;
    let newBalance = 0;

    if (won) {
      // Premio correto: aposta + 65% da aposta; o premio total sai do cofre.
      prize = getShellGamePrize(session.betAmount); // ex: aposta 100 -> recebe 165
      const vaultBonus = prize - session.betAmount;
      const vaultDebit = prize;
      const template = MIAUVADAO_RAGE[Math.floor(Math.random() * MIAUVADAO_RAGE.length)];
      const message = template
        .replace("{player}", player.displayName)
        .replace("{prize}", prize.toLocaleString("pt-BR"))
        .replace("{bonus}", vaultBonus.toLocaleString("pt-BR"))
        .replace("{debit}", vaultDebit.toLocaleString("pt-BR"));
      const updatedWallet = await prisma.$transaction(async (tx) => {
        const paidByVault = await tx.miauvadaoConfig.updateMany({
          where: { id: "singleton", vaultBalance: { gte: vaultDebit } },
          data: {
            vaultBalance: { decrement: vaultDebit },
            lastWinnerMessage: message,
            lastWinnerAt: new Date(),
            lastNpcMessage: message,
            lastNpcMessageAt: new Date(),
          },
        });
        if (paidByVault.count === 0) {
          throw new Error("O cofre mudou durante a partida e não consegue pagar este prêmio agora. Tente revelar o resultado novamente após o cofre receber fundos.");
        }
        await creditCoins(tx, {
          playerId: player.id,
          type: "BET_WON",
          amount: prize,
          description: `Vitória no Jogo do Miauvadão: recebeu ${prize.toLocaleString("pt-BR")} ZC`,
        });
        await tx.shellGameSession.update({ where: { id: sessionId }, data: { resolved: true, won: true } });
        return tx.zikaCoinWallet.findUniqueOrThrow({
          where: { playerId: player.id },
          select: { balance: true },
        });
      });
      newBalance = updatedWallet.balance;
    } else {
      const message = `${player.displayName} perdeu ${session.betAmount.toLocaleString("pt-BR")} ZC no Jogo do Miauvadão. O cofre agradece.`;
      const wallet = await prisma.$transaction(async (tx) => {
        await tx.shellGameSession.update({ where: { id: sessionId }, data: { resolved: true, won: false } });
        const currentWallet = await tx.zikaCoinWallet.findUniqueOrThrow({
          where: { playerId: player.id },
          select: { id: true, balance: true },
        });
        await tx.zikaCoinTransaction.create({
          data: {
            walletId: currentWallet.id,
            type: "BET_LOST",
            amount: 0,
            balanceBefore: currentWallet.balance,
            balanceAfter: currentWallet.balance,
            description: `Derrota no Jogo do Miauvadão: ${session.betAmount.toLocaleString("pt-BR")} ZC foram para o cofre`,
          },
        });
        await tx.miauvadaoConfig.upsert({
          where: { id: "singleton" },
          update: {
            vaultBalance: { increment: session.betAmount },
            lastNpcMessage: message,
            lastNpcMessageAt: new Date(),
          },
          create: {
            id: "singleton",
            vaultBalance: session.betAmount,
            lastNpcMessage: message,
            lastNpcMessageAt: new Date(),
          },
        });
        return tx.zikaCoinWallet.findUnique({
          where: { playerId: player.id },
          select: { balance: true },
        });
      });
      newBalance = wallet?.balance ?? 0;
    }

    revalidatePath("/bazar");
    return { won, actualPos: session.ballPos, prize, newBalance };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function getShellGameCooldown(): Promise<{ cooldownMs: number }> {
  try {
    const user = await getSessionUser();
    if (!user) return { cooldownMs: 0 };
    const player = await getSessionPlayer(user.id);
    if (!player) return { cooldownMs: 0 };
    const last = await prisma.shellGameSession.findFirst({ where: { playerId: player.id }, orderBy: { createdAt: "desc" } });
    if (!last) return { cooldownMs: 0 };
    return { cooldownMs: Math.max(0, SHELL_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) };
  } catch { return { cooldownMs: 0 }; }
}

// ── Auto-cleanup silencioso (chamado no page load do bazar) ──────────────────

const EGG_TYPES_SET = new Set(EGG_OFFER_TYPES);
const FOOD_TYPES_SET = new Set(["FOOD","SWEET","MASCOT_FOOD","MASCOT_SWEET"]);

/** Verifica se o item de um listing ainda existe em escrow */
async function isListingItemStale(listing: { id: string; playerId: string; payload: unknown }): Promise<boolean> {
  const payload = listing.payload as Record<string, unknown>;
  const itemType = payload.itemType as string | undefined;
  const qty = (payload.quantity as number) ?? 1;
  if (!itemType) return false;

  // ── Ovos (marcados com origin: "bazar:") ─────────────────────────────────
  if (EGG_TYPES_SET.has(itemType)) {
    const eggIds = payload.escrowed_egg_ids as string[] | undefined;
    if (eggIds && eggIds.length > 0) {
      const existing = await prisma.mascotEgg.count({
        where: { id: { in: eggIds }, origin: { startsWith: "bazar:" } },
      });
      return existing === 0; // todos os ovos sumiram
    }
    return false;
  }

  // ── Comida / Doce (quantidade decrementada no escrow) ────────────────────
  const foodKey = itemType === "MASCOT_FOOD" ? "FOOD" : itemType === "MASCOT_SWEET" ? "SWEET" : itemType;
  if (FOOD_TYPES_SET.has(foodKey)) {
    const food = await prisma.mascotFoodItem.findUnique({
      where: { playerId_type: { playerId: listing.playerId, type: foodKey as "FOOD" | "SWEET" } },
    });
    // Se a linha não existe, o escrow foi perdido (bug ou remoção externa)
    if (!food) return true;
    // Se quantidade ficou negativa (não deveria, mas por segurança)
    return food.quantity < 0;
  }

  // ── Itens do PlayerInventory (buffs, tickets, etc.) ──────────────────────
  const shopItemId = payload.shopItemId as string | undefined;
  if (shopItemId) {
    const inv = await prisma.playerInventory.findUnique({
      where: { playerId_itemId: { playerId: listing.playerId, itemId: shopItemId } },
    });
    // Linha desapareceu ou quantidade negativa
    if (!inv) return true;
    return inv.quantity < 0;
  }

  return false;
}

export async function autoCleanupStaleBazarListings(): Promise<void> {
  try {
    const activeListings = await prisma.bazarListing.findMany({
      where: { status: "ACTIVE", category: "ITEM" },
      select: { id: true, playerId: true, payload: true },
      take: 50,
    });
    const staleIds: string[] = [];
    for (const listing of activeListings) {
      if (await isListingItemStale(listing).catch(() => false)) {
        staleIds.push(listing.id);
      }
    }
    if (staleIds.length > 0) {
      await prisma.$transaction([
        prisma.bazarListing.updateMany({ where: { id: { in: staleIds } }, data: { status: "CANCELLED" } }),
        prisma.bazarProposal.updateMany({ where: { listingId: { in: staleIds }, status: "PENDING" }, data: { status: "REJECTED" } }),
      ]);
      revalidateBazar();
    }
  } catch { /* silencioso — nunca bloqueia o bazar */ }
}

// ── Admin: limpar listagens com itens inexistentes ────────────────────────────

export async function adminCleanupStaleBazarListings(): Promise<{ error?: string; cancelled: number; details: string[] }> {
  try {
    await requireAdmin();

    const activeListings = await prisma.bazarListing.findMany({
      where: { status: "ACTIVE", category: "ITEM" },
      select: { id: true, playerId: true, payload: true },
    });

    const cancelled: string[] = [];

    for (const listing of activeListings) {
      const payload = listing.payload as Record<string, unknown>;
      const itemType = payload.itemType as string | undefined;
      const qty = (payload.quantity as number) ?? 1;
      let itemExists = true;
      let reason = "";

      if (itemType === "FOOD" || itemType === "SWEET") {
        const food = await prisma.mascotFoodItem.findUnique({
          where: { playerId_type: { playerId: listing.playerId, type: itemType as "FOOD" | "SWEET" } },
        });
        // Food is debited on listing - if the item doesn't exist OR was over-consumed
        itemExists = !!food && food.quantity >= 0; // just check table exists
        if (!food) { itemExists = false; reason = "Comida não encontrada no inventário"; }
      } else if (isEggOfferType(itemType ?? "")) {
        const eggIds = payload.escrowed_egg_ids as string[] | undefined;
        if (eggIds && eggIds.length > 0) {
          const existingEggs = await prisma.mascotEgg.count({
            where: { id: { in: eggIds }, origin: { startsWith: "bazar:" } },
          });
          if (existingEggs < qty) {
            itemExists = false;
            reason = `Ovo(s) em escrow não encontrado(s) — provavelmente já foram usados (${existingEggs}/${qty} restantes)`;
          }
        }
      } else if (payload.shopItemId) {
        const shopItemId = payload.shopItemId as string;
        const inv = await prisma.playerInventory.findUnique({
          where: { playerId_itemId: { playerId: listing.playerId, itemId: shopItemId } },
        });
        // Items are debited on listing. If inv row missing entirely something went wrong.
        if (!inv) { itemExists = false; reason = "Item não encontrado no inventário do vendedor"; }
      }

      if (!itemExists) {
        await prisma.$transaction(async (tx) => {
          await tx.bazarListing.update({
            where: { id: listing.id },
            data: { status: "CANCELLED" },
          });
          await tx.bazarProposal.updateMany({
            where: { listingId: listing.id, status: "PENDING" },
            data: { status: "REJECTED" },
          });
        });
        cancelled.push(`${listing.id} — ${itemType ?? "?"} — ${reason}`);
      }
    }

    revalidateBazar();
    return { cancelled: cancelled.length, details: cancelled };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro.", cancelled: 0, details: [] };
  }
}


// ── Leilão ────────────────────────────────────────────────────────────────────

export interface CreateAuctionInput {
  category: BazarItemCategory;
  minBidCoins: number;
  auctionDuration: "12h" | "1d";
  description?: string;
  // Mascot
  mascotId?: string;
  // Item
  itemType?: string;
  shopItemId?: string;
  imageUrl?: string;
  quantity?: number;
  displayName?: string;
}

export async function createAuctionListing(input: CreateAuctionInput): Promise<{ error?: string; id?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    await prepareBazarMascotAvailability(player.id);

    if (!input.minBidCoins || input.minBidCoins < 1) return { error: "Lance mínimo inválido." };

    const MAX_ACTIVE_LISTINGS = 8;
    const activeCount = await prisma.bazarListing.count({
      where: { playerId: player.id, status: { in: ["ACTIVE", "RESERVED"] } },
    });
    if (activeCount >= MAX_ACTIVE_LISTINGS) {
      return { error: `Você já possui ${MAX_ACTIVE_LISTINGS} anúncios ativos.` };
    }

    const config = await getMiauvadaoConfig();
    const fee = config.listingFee;
    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < fee) {
      return { error: `Saldo insuficiente para a taxa de anúncio (${fee} ZC).` };
    }

    const durationMs = input.auctionDuration === "12h" ? 12 * 3600_000 : 24 * 3600_000;
    const auctionEndsAt = new Date(Date.now() + durationMs);

    let payload: Record<string, unknown> = {};

    await prisma.$transaction(async (tx) => {
      await tx.zikaCoinWallet.update({ where: { playerId: player.id }, data: { balance: { decrement: fee } } });
      await tx.miauvadaoConfig.update({ where: { id: "singleton" }, data: { vaultBalance: { increment: fee } } });

      if (input.category === "MASCOT" && input.mascotId) {
        const mascot = await tx.mascot.findUnique({ where: { id: input.mascotId } });
        if (!mascot) throw new Error("Mascote não encontrado.");
        await assertMascotTradeableInBazar(tx, mascot, player.id);
        await tx.mascot.update({ where: { id: input.mascotId }, data: { bazarListed: true } });
        payload = {
          mascotId: mascot.id, pokemonId: mascot.pokemonId,
          pokemonName: getPokemonName(mascot.pokemonId), nickname: mascot.nickname,
          level: mascot.level, personality: mascot.personality,
          stats: { force: mascot.statForce, agility: mascot.statAgility, charisma: mascot.statCharisma, instinct: mascot.statInstinct, vitality: mascot.statVitality },
          battleWins: mascot.battleWins,
          hatchedFromEggType: mascot.hatchedFromEggType,
          hatchedFromEggOrigin: mascot.hatchedFromEggOrigin,
        };
      } else if (input.category === "ITEM") {
        const qty = input.quantity ?? 1;
        if (!input.itemType) throw new Error("Tipo de item não especificado.");
        if (HIDDEN_BAZAR_ITEM_TYPES.has(input.itemType)) throw new Error("Este item não pode ser leiloado.");
        if (input.itemType === "FOOD" || input.itemType === "SWEET") {
          const food = await tx.mascotFoodItem.findUnique({ where: { playerId_type: { playerId: player.id, type: input.itemType as "FOOD" | "SWEET" } } });
          if (!food || food.quantity < qty) throw new Error("Itens insuficientes.");
          await tx.mascotFoodItem.update({ where: { playerId_type: { playerId: player.id, type: input.itemType as "FOOD" | "SWEET" } }, data: { quantity: { decrement: qty } } });
        } else if (isEggOfferType(input.itemType)) {
          const eggs = await tx.mascotEgg.findMany({ where: { playerId: player.id, type: input.itemType as never, incubation: null, NOT: { origin: { startsWith: "bazar:" } } } });
          if (eggs.length < qty) throw new Error("Ovos insuficientes.");
          await tx.mascotEgg.updateMany({ where: { id: { in: eggs.slice(0, qty).map(e => e.id) } }, data: { origin: `bazar:${player.id}` } });
          payload = { ...payload, escrowed_egg_ids: eggs.slice(0, qty).map(e => e.id) };
        } else {
          const inv = input.shopItemId
            ? await tx.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: input.shopItemId } }, include: { item: { select: { id: true, name: true, type: true, imageUrl: true } } } })
            : await tx.playerInventory.findFirst({ where: { playerId: player.id, item: { type: input.itemType as never }, quantity: { gt: 0 } }, include: { item: { select: { id: true, name: true, type: true, imageUrl: true } } } });
          if (!inv || inv.quantity < qty) throw new Error("Itens insuficientes no inventário.");
          if (inv.itemId === ADMIN_LAB_RAINBOW_FEATHER_ID) throw new Error("Este item administrativo não pode ser leiloado.");
          await tx.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: qty } } });
          payload = { ...payload, shopItemId: inv.itemId, imageUrl: sanitizePayloadImageUrl(inv.item.imageUrl ?? input.imageUrl) };
        }
        payload = { ...payload, itemType: input.itemType, quantity: qty, displayName: input.displayName ?? `${qty}x ${input.itemType}` };
      }

      await tx.bazarListing.create({
        data: {
          playerId: player.id, category: input.category,
          listingType: "AUCTION", payload: payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
          priceCoins: null, description: input.description,
          feeCharged: fee, expiresAt: auctionEndsAt,
          minBidCoins: input.minBidCoins, auctionEndsAt,
        },
      });
    });

    if (input.category === "MASCOT") {
      const mascotName = String(payload.nickname ?? payload.pokemonName ?? "mascote");
      const eggOrigin = tickerEggOrigin(payload);
      await publishLeagueTicker({
        type: "BAZAR_MASCOT_AUCTION",
        message: `${player.displayName} criou um leilão com ${mascotName}${eggOrigin ? `, nascido de ${eggOrigin}` : ""}. Dê seu lance!`,
        href: "/bazar?listingType=AUCTION",
        priority: 4,
        ttlHours: input.auctionDuration === "12h" ? 12 : 24,
        sampleRate: 0.75,
      });
    }
    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar leilão." };
  }
}

async function _sendBazarSystemDM(receiverId: string, content: string): Promise<void> {
  try {
    const admin = await prisma.player.findFirst({ where: { user: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } }, select: { id: true } });
    if (!admin || admin.id === receiverId) return;
    await prisma.directMessage.create({ data: { senderId: admin.id, receiverId, content } });
  } catch { /* silencioso */ }
}

export async function placeBid(listingId: string, amount: number): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    if (!Number.isSafeInteger(amount) || amount <= 0) return { error: "Lance inválido." };

    const bid = await prisma.$transaction(async (tx) => {
      // Um leilão por vez: dois lances simultâneos esperam nesta trava curta e
      // o segundo relê o valor atualizado antes de validar o lance mínimo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listingId}))`;

      const listing = await tx.bazarListing.findUnique({
        where: { id: listingId },
        include: { player: { select: { id: true, displayName: true } } },
      });
      if (!listing) throw new Error("Anúncio não encontrado.");
      if (listing.listingType !== "AUCTION") throw new Error("Este anúncio não é um leilão.");
      if (listing.status !== "ACTIVE") throw new Error("Este leilão não está mais ativo.");
      if (listing.playerId === player.id) throw new Error("Você não pode dar lance no próprio leilão.");
      await assertBazarPairAllowed(tx, player.id, listing.playerId);

      // Um bloqueio tambÃ©m impede que o par dispute o mesmo leilÃ£o por terceiros.
      if (listing.currentBidPlayerId) {
        await assertBazarPairAllowed(tx, player.id, listing.currentBidPlayerId);
      }

      const endsAt = listing.auctionEndsAt ?? listing.expiresAt;
      if (new Date() >= endsAt) throw new Error("Este leilão já encerrou.");
      const minBid = listing.currentBidCoins ? listing.currentBidCoins + 100 : (listing.minBidCoins ?? 1);
      if (amount < minBid) throw new Error(`Lance mínimo é ${minBid} ZC.`);
      if (listing.currentBidPlayerId === player.id) throw new Error("Você já é o maior lance.");

      const prevBidderId = listing.currentBidPlayerId;
      const prevBidAmount = listing.currentBidCoins ?? 0;
      const msLeft = endsAt.getTime() - Date.now();
      const newEndsAt = msLeft < 5 * 60_000 ? new Date(endsAt.getTime() + 30 * 60_000) : endsAt;

      // Débito condicional: impede duas requisições concorrentes de gastarem o
      // mesmo saldo depois de ambas terem lido a carteira.
      const debit = await tx.zikaCoinWallet.updateMany({
        where: { playerId: player.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (debit.count !== 1) {
        const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } });
        throw new Error(`Saldo insuficiente (${wallet?.balance ?? 0} ZC disponíveis).`);
      }

      // Devolve coins ao licitante anterior
      if (prevBidderId && prevBidAmount > 0) {
        await tx.zikaCoinWallet.upsert({
          where: { playerId: prevBidderId },
          update: { balance: { increment: prevBidAmount } },
          create: { playerId: prevBidderId, balance: prevBidAmount, totalEarned: prevBidAmount },
        });
      }

      // Registra o lance
      await tx.bazarAuctionBid.create({ data: { listingId, playerId: player.id, amount } });

      // Atualiza listing
      await tx.bazarListing.update({
        where: { id: listingId },
        data: { currentBidCoins: amount, currentBidPlayerId: player.id, auctionEndsAt: newEndsAt, expiresAt: newEndsAt },
      });
      return { listing, prevBidderId, prevBidAmount };
    });

    // Notifica o licitante anterior por mensagem privada
    if (bid.prevBidderId && bid.prevBidderId !== player.id) {
      const desc = bid.listing.category === "MASCOT"
        ? `${(bid.listing.payload as Record<string, unknown>).nickname ?? (bid.listing.payload as Record<string, unknown>).pokemonName}`
        : `${(bid.listing.payload as Record<string, unknown>).displayName}`;
      await _sendBazarSystemDM(bid.prevBidderId, `Seu lance de ${bid.prevBidAmount} ZC no leilão de "${desc}" foi superado por um lance de ${amount} ZC. Os seus ZC foram devolvidos à carteira.`);
      revalidateTag(`nav-${user.id}`);
    }

    revalidateBazar();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao dar lance." };
  }
}

export async function finalizeAuction(listingId: string): Promise<{ error?: string; finalized?: boolean }> {
  try {
    const listing = await prisma.bazarListing.findUnique({
      where: { id: listingId },
      include: { player: { select: { id: true, displayName: true, userId: true } } },
    });
    if (!listing) return { error: "Anúncio não encontrado." };
    if (listing.listingType !== "AUCTION") return {};
    if (listing.status !== "ACTIVE") return { finalized: false };

    const endsAt = listing.auctionEndsAt ?? listing.expiresAt;
    if (new Date() < endsAt) return { finalized: false }; // ainda não encerrou

    const winnerId = listing.currentBidPlayerId;
    const winnerBid = listing.currentBidCoins ?? 0;

    if (!winnerId || winnerBid === 0) {
      // Sem lances: expira e devolve item
      const claimed = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listingId}))`;
        const update = await tx.bazarListing.updateMany({
          where: { id: listingId, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        if (update.count !== 1) return false;
        await _returnEscrow(tx, listing, listing.playerId);
        return true;
      });
      if (!claimed) return { finalized: false };
      revalidateBazar();
      return { finalized: true };
    }

    // Com vencedor: transfere item, credita coins ao vendedor
    const winner = await prisma.player.findUnique({ where: { id: winnerId }, select: { id: true, displayName: true, userId: true } });
    if (!winner) return { error: "Vencedor não encontrado." };

    const sellerName = listing.player.displayName;
    const buyerName = winner.displayName;
    const payloadDesc = listing.category === "MASCOT"
      ? `${(listing.payload as Record<string, unknown>).nickname ?? (listing.payload as Record<string, unknown>).pokemonName} Nv.${(listing.payload as Record<string, unknown>).level} leiloado por ${winnerBid} ZC`
      : `${(listing.payload as Record<string, unknown>).displayName} leiloado por ${winnerBid} ZC`;

    const claimed = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listingId}))`;
      const update = await tx.bazarListing.updateMany({
        where: { id: listingId, status: "ACTIVE" },
        data: { status: "SOLD" },
      });
      if (update.count !== 1) return false;

      // Transfere coins (já foram debitados do vencedor ao dar lance)
      await tx.zikaCoinWallet.upsert({
        where: { playerId: listing.playerId },
        update: { balance: { increment: winnerBid } },
        create: { playerId: listing.playerId, balance: winnerBid, totalEarned: winnerBid },
      });

      // Transfere item ao vencedor
      await _transferItem(tx, listing, winnerId);

      await tx.bazarTransaction.create({
        data: {
          listingId, sellerId: listing.playerId, buyerId: winnerId,
          sellerName, buyerName, description: payloadDesc,
          coinsAmount: winnerBid, category: listing.category,
        },
      });
      return true;
    });
    if (!claimed) return { finalized: false };

    revalidateBazar();
    if (listing.player.userId) revalidateTag(`nav-${listing.player.userId}`);
    if (winner.userId) revalidateTag(`nav-${winner.userId}`);

    // Notifica o vencedor
    await _sendBazarSystemDM(winnerId, `Parabéns! Você venceu o leilão de "${(listing.payload as Record<string, unknown>).nickname ?? (listing.payload as Record<string, unknown>).pokemonName ?? (listing.payload as Record<string, unknown>).displayName}" com ${winnerBid} ZC. O item foi transferido para você.`);

    return { finalized: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao finalizar leilão." };
  }
}

export async function markBazarProposalsViewed(): Promise<void> {
  try {
    const user = await getSessionUser();
    if (!user) return;
    const player = await getSessionPlayer(user.id);
    if (!player) return;
    await prisma.bazarProposal.updateMany({
      where: { proposerId: player.id, status: { in: ["ACCEPTED", "REJECTED"] }, viewedByProposerAt: null },
      data: { viewedByProposerAt: new Date() },
    });
    revalidateTag(`nav-${user.id}`);
  } catch {
    // fire-and-forget — não bloqueia a página
  }
}
