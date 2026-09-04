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
import { CUSTOM_MEGA_POKEMON_IDS } from "@/lib/extra-mega-stones";
import { cleanupExpiredArenaResting, syncDefeatedArenaTeams } from "@/lib/arena-z";
import { isMascotLockedInWeeklyLeague } from "@/lib/weekly-league-locks";
import { getMiauvadaoRotation } from "@/lib/miauvadao-rotation";
import { recordPlayerActivity } from "@/lib/player-activity";
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
import { EggType, Prisma, ZikaCoinTxType } from "@prisma/client";
import type { BazarItemCategory, BazarListingType, BazarListingStatus } from "@prisma/client";
import { publishLeagueTicker } from "@/lib/league-ticker";
import { ADMIN_LAB_RAINBOW_FEATHER_ID } from "@/lib/admin-lab-feather";
import { createPlayerNotification } from "@/lib/nav-notifications";
import { sendNotificationToPlayers } from "@/lib/notifications";
import { after } from "next/server";
import { changeLigaCash, suggestedLigaCashPrice } from "@/lib/liga-cash-wallet";
import {
  MAX_ACTIVE_PREMIUM_LISTINGS,
  PREMIUM_LISTING_FEE,
  PREMIUM_LISTING_HOURS,
  addPremiumListingHighlights,
  publishDuePremiumBazarTicker,
} from "@/lib/bazar-premium";

const PLAYER_TRANSACTION_VAULT_SHARE = 0.10;

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
  personality?: string | null;
  statForce?: number;
  statAgility?: number;
  statCharisma?: number;
  statInstinct?: number;
  statVitality?: number;
  shopItemId?: string;
  escrowed_egg_ids?: string[];
  escrowed?: boolean;
  /** Bônus de raridade do ovo escolhido (pontos %). Diferencia ovos do mesmo tipo. */
  eggBonusPct?: number;
};

type DirectNegotiationState = {
  kind: "DIRECT_NEGOTIATION";
  accepted: boolean;
  // Fase 1 (trava): cada lado trava sua oferta reservando os ativos.
  ownerReady: boolean;
  participantReady: boolean;
  // Fase 2 (confirmação pós-trava): só liberada quando os dois estão travados.
  ownerConfirmed: boolean;
  participantConfirmed: boolean;
  ownerCoins: number;
  ownerCoinsEscrowed: boolean;
  ownerLigaCash: number;
  ownerLigaCashEscrowed: boolean;
  ownerItems: ProposalOfferItem[];
  ownerLoan: boolean;
  ownerInterestPct: number;
  participantLoan: boolean;
  participantInterestPct: number;
};

const EMPTY_DIRECT_STATE: DirectNegotiationState = {
  kind: "DIRECT_NEGOTIATION", accepted: false, ownerReady: false, participantReady: false,
  ownerConfirmed: false, participantConfirmed: false,
  ownerCoins: 0, ownerCoinsEscrowed: false, ownerLigaCash: 0, ownerLigaCashEscrowed: false, ownerItems: [], ownerLoan: false,
  ownerInterestPct: 0, participantLoan: false, participantInterestPct: 0,
};

// Assinatura canônica de uma oferta, para detectar mudança real (e só então
// invalidar a trava/confirmação do outro lado).
function directOfferSignature(items: ProposalOfferItem[] | null | undefined, coins: number, loan: boolean, interest: number, ligaCash = 0) {
  const norm = (items ?? []).map((i) => `${i.mascotId ?? i.type}:${i.mascotId ? 1 : i.quantity}`).sort();
  return JSON.stringify({ norm, coins, ligaCash, loan, interest });
}

function parseDirectState(value: string | null | undefined): DirectNegotiationState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DirectNegotiationState>;
    if (parsed.kind !== "DIRECT_NEGOTIATION") return null;
    return { ...EMPTY_DIRECT_STATE, ...parsed, ownerItems: Array.isArray(parsed.ownerItems) ? parsed.ownerItems : [] };
  } catch { return null; }
}

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
  EGG_GEN1: "Ovo de Geração 1",
  EGG_GEN2: "Ovo de Geração 2",
  EGG_GEN3: "Ovo de Geração 3",
  EGG_GEN4: "Ovo de Geração 4",
  EGG_GEN5: "Ovo de Geração 5",
  EGG_GEN6: "Ovo de Geração 6",
  EGG_GEN7: "Ovo de Geração 7",
  EGG_GEN8: "Ovo de Geração 8",
  EGG_GEN9: "Ovo de Geração 9",
  EGG_GEN6PLUS: "Ovo de Geração 6+",
};

function canonicalBazarItemName(itemType: string) {
  if (TICKER_EGG_LABELS[itemType]) return TICKER_EGG_LABELS[itemType];
  if (itemType === "FOOD") return "Comida de Mascote";
  if (itemType === "SWEET") return "Doce de Mascote";
  return itemType.replaceAll("_", " ");
}

/** Sufixo que distingue um ovo com chance de raridade aumentada de um sem nada. */
function eggBonusSuffix(bonusPct?: number | null) {
  return typeof bonusPct === "number" && bonusPct > 0 ? ` ★+${bonusPct}% raridade` : "";
}

/** Nome do ovo já com o marcador de bônus de raridade, quando houver. */
function eggDisplayName(itemType: string, bonusPct?: number | null) {
  return `${canonicalBazarItemName(itemType)}${eggBonusSuffix(bonusPct)}`;
}

function fullMascotPayloadName(payload: Record<string, unknown>) {
  const original = String(payload.pokemonName ?? "Mascote").trim();
  const nickname = typeof payload.nickname === "string" ? payload.nickname.trim() : "";
  return nickname && nickname.localeCompare(original, "pt-BR", { sensitivity: "base" }) !== 0
    ? `${original} (${nickname})`
    : original;
}

function listingDisplayName(listing: { category: string; payload: unknown }) {
  const payload = listing.payload as Record<string, unknown>;
  return listing.category === "MASCOT"
    ? fullMascotPayloadName(payload)
    : String(payload.displayName ?? payload.name ?? "Item do Bazar");
}

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
  // Pedras de mega custom (liberadas pelo toggle do admin) também entram no pool.
  ...CUSTOM_MEGA_POKEMON_IDS.map((id) => `MEGA_STONE_CUSTOM_${id}`),
];

const MIAUVADAO_MAX_DISCOUNT = 70;
const MIAUVADAO_MEGA_STONE_MAX_DISCOUNT = 20;
const MIAUVADAO_SLOT_REFRESH_COST = 250;
const DEFAULT_MIAUVADAO_PURCHASE_RECHARGE_MINUTES = 10;

function normalizedRechargeMinutes(value: number | null | undefined) {
  return Math.min(24 * 60, Math.max(1, Math.floor(value ?? DEFAULT_MIAUVADAO_PURCHASE_RECHARGE_MINUTES)));
}

function stockOverridesFromJson(value: Prisma.JsonValue): Record<string, number> {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, stock]) => {
    const parsed = Math.floor(Number(stock));
    return Number.isFinite(parsed) && parsed > 0 ? [[key, parsed]] : [];
  }));
}

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
async function rollMiauvadaoOffers(
  vaultBalance: number,
  extraBonus = 0,
  stockOverrides: Record<string, number> = {},
): Promise<MiauvadaoOffer[]> {
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
  const chosen: typeof shopItems = [];
  let hasMegaStone = false;
  for (const item of shuffled) {
    const megaStone = isMegaStoneType(item.type);
    if (megaStone && hasMegaStone) continue;
    chosen.push(item);
    if (megaStone) hasMegaStone = true;
    if (chosen.length === 3) break;
  }

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
      stock:         stockOverrides[item.id] ?? stockOverrides[item.type] ?? 5,
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
      || config.offersRefreshedAt < rotation.start;

    if (!expired) return null;

    const newOffers = await rollMiauvadaoOffers(
      config.vaultBalance,
      0,
      stockOverridesFromJson(config.offerStockOverrides),
    );
    if (newOffers.length === 0) return null;

    // Retorna o resultado do update diretamente — sem precisar re-buscar pelo cache
    // Compare-and-swap: apenas a primeira requisição do ciclo publica o sorteio.
    // As demais recebem exatamente o conjunto vencedor, sem vitrine divergente.
    await prisma.miauvadaoConfig.updateMany({
      where: {
        id: "singleton",
        OR: [{ offersRefreshedAt: null }, { offersRefreshedAt: { lt: rotation.start } }],
      },
      data: {
        dailyOffers: newOffers as unknown as import("@prisma/client").Prisma.InputJsonValue,
        offersRefreshedAt: rotation.start,
        slotRefreshUsedCycle: null,
      },
    });
    const freshConfig = await prisma.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
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

// Injeta a avaliação atual do Laboratório (ivRating/ivScore/performanceTag) no
// payload dos anúncios de MASCOTE que ainda não a tenham gravada. Cobre anúncios
// antigos criados antes de a avaliação passar a ser guardada no payload. O
// mascote referenciado continua existindo (bazarListed) enquanto o anúncio ativo.
async function enrichMascotLabRatings(listings: { category: string; payload: unknown }[]) {
  const need = listings.filter((l) => {
    if (l.category !== "MASCOT") return false;
    const p = l.payload as Record<string, unknown> | null;
    return p && typeof p.mascotId === "string" && p.ivRating == null;
  });
  const ids = [...new Set(need.map((l) => String((l.payload as Record<string, unknown>).mascotId)))];
  if (ids.length === 0) return;
  const rated = await prisma.mascot.findMany({
    where: { id: { in: ids }, analyzedAt: { not: null } },
    select: { id: true, ivRating: true, ivScore: true, performanceTag: true },
  });
  const byId = new Map(rated.map((m) => [m.id, m]));
  for (const l of need) {
    const p = l.payload as Record<string, unknown>;
    const r = byId.get(String(p.mascotId));
    if (r?.ivRating) l.payload = { ...p, ivRating: r.ivRating, ivScore: r.ivScore, performanceTag: r.performanceTag };
  }
}

export async function getListings(filters?: {
  category?: BazarItemCategory;
  type?: BazarListingType;
  maxPrice?: number;
  search?: string;
  rarity?: MascotRarity;
  sortBy?: "newest" | "cheapest" | "expensive";
  page?: number;
  premiumMode?: "exclude" | "only" | "all";
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

  const now = new Date();
  const premiumFilter = filters?.premiumMode === "only"
    ? { premiumUntil: { gt: now } }
    : filters?.premiumMode === "all"
      ? {}
      : { OR: [{ premiumUntil: null }, { premiumUntil: { lte: now } }] };
  // AND explícito evita que filtros com OR (busca, raridade e premium) se
  // sobrescrevam quando usados ao mesmo tempo.
  const where = {
    AND: [
      { status: "ACTIVE" as BazarListingStatus, expiresAt: { gt: now } },
      premiumFilter,
      filters?.category ? { category: filters.category } : {},
      filters?.type ? { listingType: filters.type } : {},
      filters?.maxPrice !== undefined ? { priceCoins: { lte: filters.maxPrice } } : {},
      mascotRarityListingFilter(filters?.rarity),
      searchFilter,
    ],
  };

  const orderBy =
    filters?.sortBy === "cheapest"  ? { priceCoins: "asc"  as const } :
    filters?.sortBy === "expensive" ? { priceCoins: "desc" as const } :
    { createdAt: "desc" as const };

  const select = {
    id: true, category: true, listingType: true, status: true,
    payload: true, priceCoins: true, priceLigaCash: true, description: true, wantedDesc: true,
    loanEnabled: true, loanAmountCoins: true, loanInterestPct: true,
    expiresAt: true, premiumUntil: true, createdAt: true, views: true,
    minBidCoins: true, currentBidCoins: true, auctionEndsAt: true,
    player: { select: { id: true, displayName: true, avatarUrl: true } },
    _count: { select: { proposals: true, favorites: true } },
  };

  const [rawListings, total] = await Promise.all([
    prisma.bazarListing.findMany({ where, orderBy, select, skip, take: LISTINGS_PAGE_SIZE }),
    prisma.bazarListing.count({ where }),
  ]);
  const listings = filters?.premiumMode === "only"
    ? await addPremiumListingHighlights(rawListings)
    : rawListings.map((listing) => ({ ...listing, premiumHighlights: [] as string[] }));
  await enrichMascotLabRatings(listings);

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
          itemWishlist: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              itemId: true,
              item: { select: { name: true, type: true, rarity: true, imageUrl: true, description: true } },
            },
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
  if (!listing) return null;
  await enrichMascotLabRatings([listing]);

  // Propostas antigas guardavam apenas id/nome do mascote. Hidratamos o
  // snapshot na leitura para que atributos e personalidade apareçam também em
  // mesas já abertas, sem alterar a reserva nem o conteúdo assinado da oferta.
  const mascotIds = new Set<string>();
  const collectMascotIds = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const entry of value) {
      if (entry && typeof entry === "object" && "mascotId" in entry && typeof entry.mascotId === "string") mascotIds.add(entry.mascotId);
    }
  };
  for (const proposal of listing.proposals) {
    collectMascotIds(proposal.itemsOffer);
    try {
      const state = JSON.parse(proposal.message ?? "") as { ownerItems?: unknown };
      collectMascotIds(state.ownerItems);
    } catch { /* mensagens comuns não são JSON */ }
  }
  const mascotDetails = mascotIds.size > 0
    ? await prisma.mascot.findMany({
        where: { id: { in: [...mascotIds] } },
        select: {
          id: true, level: true, personality: true,
          statForce: true, statAgility: true, statCharisma: true,
          statInstinct: true, statVitality: true,
        },
      })
    : [];
  const mascotById = new Map(mascotDetails.map((mascot) => [mascot.id, mascot]));
  const enrichItems = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    return value.map((entry) => {
      if (!entry || typeof entry !== "object" || !("mascotId" in entry) || typeof entry.mascotId !== "string") return entry;
      const details = mascotById.get(entry.mascotId);
      return details ? { ...entry, ...details } : entry;
    });
  };
  const hydratedListing = {
    ...listing,
    proposals: listing.proposals.map((proposal) => {
      let message = proposal.message;
      try {
        const state = JSON.parse(message ?? "") as Record<string, unknown>;
        if (state.kind === "DIRECT_NEGOTIATION") message = JSON.stringify({ ...state, ownerItems: enrichItems(state.ownerItems) });
      } catch { /* mantém mensagens comuns exatamente como estão */ }
      return { ...proposal, message, itemsOffer: enrichItems(proposal.itemsOffer) };
    }),
  };
  // Não incrementar `views` aqui. Writes fire-and-forget em Server Actions podem
  // deixar transações abertas no runtime serverless e bloquear a oferta inteira
  // quando vários jogadores acompanham o mesmo leilão.
  const user = await getSessionUser().catch(() => null);
  const viewer = user ? await getSessionPlayer(user.id).catch(() => null) : null;
  if (viewer) {
    await prisma.playerNotification.updateMany({
      where: { playerId: viewer.id, category: "BAZAR", entityId: id, readAt: null },
      data: { readAt: new Date() },
    }).catch(() => undefined);
    revalidateTag(`nav-${user!.id}`);
  }
  return hydratedListing;
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
      detailsJson: true,
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
      const details = (transaction.detailsJson && typeof transaction.detailsJson === "object" && !Array.isArray(transaction.detailsJson))
        ? transaction.detailsJson as Record<string, unknown>
        : null;
      const direct = details?.direct === true;
      return {
        ...transaction,
        listingType: listing?.listingType ?? null,
        payload: listing?.payload ?? null,
        offerCoins: acceptedProposal?.coinsOffer ?? transaction.coinsAmount,
        offerItems: acceptedProposal?.itemsOffer ?? null,
        // Detalhe das duas pontas (negociação direta). Quando presente, o
        // histórico usa isto no lugar do payload do anúncio.
        direct,
        sellerItems: direct ? (details?.sellerItems ?? null) : null,
        sellerCoins: direct ? Number(details?.sellerCoins ?? 0) : 0,
        buyerItems: direct ? (details?.buyerItems ?? null) : null,
        buyerCoins: direct ? Number(details?.buyerCoins ?? 0) : 0,
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

/** Leitura autoritativa usada no limite da rotação; não pode reutilizar a vitrine anterior. */
export async function getCurrentMiauvadaoConfig() {
  const config = await prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" } });
  return config ?? prisma.miauvadaoConfig.create({ data: { id: "singleton" } });
}

export async function invalidateMiauvadaoCache() {
  revalidateTag("miauvadao-config");
}

// ── Criar anúncio ─────────────────────────────────────────────────────────────

export interface CreateListingInput {
  category: BazarItemCategory;
  listingType: BazarListingType;
  priceCoins?: number;
  priceLigaCash?: number;
  listingFeeCurrency?: "ZC" | "LC";
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
  /** Bônus de raridade do ovo escolhido (pontos %). Escolhe exatamente qual ovo anunciar. */
  eggBonusPct?: number;
  quantity?: number;
  displayName?: string;
  premium?: boolean;
  /** Cria uma sala sem ativo inicial; as duas ofertas serão reservadas depois. */
  directNegotiation?: boolean;
}

export async function createListing(input: CreateListingInput): Promise<{ error?: string; id?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    await prepareBazarMascotAvailability(player.id);

    // Validação básica
    if (!input.directNegotiation && input.listingType !== "TRADE" && (!input.priceCoins || input.priceCoins < 1) && (!input.priceLigaCash || input.priceLigaCash < 1)) {
      return { error: "Defina ao menos um preço válido em ZC ou LC." };
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
    const economy = await prisma.economySettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
    const premium = Boolean(input.premium);
    const feeCurrency: "ZC" | "LC" = premium ? "ZC" : (input.listingFeeCurrency ?? "ZC");
    if (feeCurrency === "LC" && !economy.allowLcBazar) return { error: "LigaCash está desativada no Bazar." };
    const fee = premium ? PREMIUM_LISTING_FEE : feeCurrency === "LC" ? economy.bazarListingFeeLc : economy.bazarListingFeeZc;

    // Verificar saldo para pagar taxa
    const wallet = feeCurrency === "LC"
      ? await prisma.ligaCoinWallet.findUnique({ where: { playerId: player.id } })
      : await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < fee) {
      return { error: `Saldo insuficiente para pagar a taxa de anúncio (${fee} ${feeCurrency}).` };
    }

    let payload: Record<string, unknown> = input.directNegotiation
      ? { directNegotiation: true, itemType: "DIRECT_NEGOTIATION", displayName: "Negociação direta", quantity: 0 }
      : {};
    const expiresAt = new Date(Date.now() + input.durationDays * 86400000);

    const premiumUntil = premium ? new Date(Date.now() + PREMIUM_LISTING_HOURS * 3_600_000) : null;
    let listingId = "";
    await prisma.$transaction(async (tx) => {
      if (premium) {
        // A função retorna `void`, que o Prisma não desserializa quando ela é
        // selecionada diretamente. Selecionar um inteiro a partir dela mantém
        // o lock transacional e devolve um tipo suportado.
        await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext('bazar-premium-listings'))`;
        const premiumWhere = { status: { in: ["ACTIVE", "RESERVED"] as BazarListingStatus[] }, premiumUntil: { gt: new Date() } };
        const [globalPremiumCount, ownPremiumCount] = await Promise.all([
          tx.bazarListing.count({ where: premiumWhere }),
          tx.bazarListing.count({ where: { ...premiumWhere, playerId: player.id } }),
        ]);
        if (ownPremiumCount > 0) throw new Error("Você já possui um anúncio premium ativo. Aguarde o destaque terminar ou encerre o anúncio atual.");
        if (globalPremiumCount >= MAX_ACTIVE_PREMIUM_LISTINGS) throw new Error("As 6 vitrines premium do Miauvadão estão ocupadas no momento. Tente novamente mais tarde.");
      }
      // Cobrar taxa
      if (feeCurrency === "ZC") {
        await tx.zikaCoinWallet.update({ where: { playerId: player.id }, data: { balance: { decrement: fee } } });
      } else {
        await changeLigaCash(tx, { playerId: player.id, amount: -fee, reason: "BAZAR_LISTING_FEE", referenceType: "BazarListing", spentDelta: fee });
      }
      // Taxa vai para o cofre do Miauvadão
      if (feeCurrency === "ZC") {
        await tx.miauvadaoConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton", vaultBalance: fee }, update: { vaultBalance: { increment: fee } } });
      }

      if (input.directNegotiation) {
        // A sala nasce vazia. Cada lado monta a própria oferta depois que o
        // anunciante aceitar um participante; nenhum ativo é retirado aqui.
      } else if (input.category === "MASCOT" && input.mascotId) {
        const mascot = await tx.mascot.findUnique({ where: { id: input.mascotId } });
        if (!mascot) throw new Error("Mascote não encontrado.");
        await assertMascotTradeableInBazar(tx, mascot, player.id);

        // Bloqueia mascote
        await tx.mascot.update({ where: { id: input.mascotId }, data: { bazarListed: true } });

        payload = {
          mascotId: mascot.id,
          pokemonId: mascot.pokemonId,
          pokemonName: mascot.speciesNameOverride || getPokemonName(mascot.pokemonId),
          primaryTypeOverride: mascot.primaryTypeOverride,
          secondaryTypeOverride: mascot.secondaryTypeOverride,
          staticSpriteUrlOverride: mascot.staticSpriteUrlOverride,
          animatedSpriteUrlOverride: mascot.animatedSpriteUrlOverride,
          nickname: mascot.nickname,
          level: mascot.level,
          personality: mascot.personality,
          isShiny: mascot.isShiny,
          stats: {
            force: mascot.statForce, agility: mascot.statAgility,
            charisma: mascot.statCharisma, instinct: mascot.statInstinct,
            vitality: mascot.statVitality,
          },
          battleWins: mascot.battleWins,
          hatchedFromEggType: mascot.hatchedFromEggType,
          hatchedFromEggOrigin: mascot.hatchedFromEggOrigin,
          // Avaliação do Laboratório (quando o mascote já foi analisado).
          ...(mascot.analyzedAt ? { ivRating: mascot.ivRating, ivScore: mascot.ivScore, performanceTag: mascot.performanceTag } : {}),
        };

      } else if (input.category === "ITEM") {
        const qty = input.quantity ?? 1;
        if (qty < 1) throw new Error("Quantidade inválida.");
        if (!input.itemType) throw new Error("Tipo de item não especificado.");
        if (HIDDEN_BAZAR_ITEM_TYPES.has(input.itemType)) throw new Error("Este item ainda nao pode ser anunciado no Bazar.");
        let canonicalDisplayName = canonicalBazarItemName(input.itemType);

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
          // Ovos — o jogador escolhe EXATAMENTE qual ovo anunciar (por tipo +
          // bônus de raridade). Ovos do mesmo tipo com bônus diferente são
          // distintos; filtramos pelo bônus escolhido quando informado.
          const bonusPct = typeof input.eggBonusPct === "number" ? input.eggBonusPct : null;
          const eggs = await tx.mascotEgg.findMany({
            where: {
              playerId: player.id,
              type: input.itemType as never,
              incubation: null,
              NOT: { origin: { startsWith: "bazar:" } },
              ...(bonusPct !== null ? { hatchRarityBonusPct: bonusPct } : {}),
            },
            orderBy: { hatchRarityBonusPct: "desc" },
          });
          if (eggs.length < qty) throw new Error("Ovos insuficientes no inventário para o ovo escolhido.");
          // Remove qty ovos do inventário (escrow)
          const escrowedEggs = eggs.slice(0, qty);
          const toRemove = escrowedEggs.map(e => e.id);
          // Captura a origem real antes de sobrescrever para "bazar:" (senão se perde).
          const origins = [...new Set(escrowedEggs.map(e => e.origin).filter(Boolean))];
          const escrowBonus = bonusPct !== null ? bonusPct : escrowedEggs[0]?.hatchRarityBonusPct ?? 0;
          canonicalDisplayName = eggDisplayName(input.itemType, escrowBonus);
          // Guardar IDs, origem e bônus dos ovos no payload (devolução e exibição).
          await tx.mascotEgg.updateMany({
            where: { id: { in: toRemove } },
            data: { origin: `bazar:${player.id}` }, // marca como em bazar para não aparecer na incubadora
          });
          payload = {
            ...payload,
            escrowed_egg_ids: toRemove,
            eggType: input.itemType,
            eggBonusPct: escrowBonus,
            // Só registra origem única quando todos os ovos compartilham a mesma.
            eggOrigin: origins.length === 1 ? origins[0] : null,
          };
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
          canonicalDisplayName = inv.item.name;
        }

        payload = {
          ...payload,
          itemType: input.itemType,
          quantity: qty,
          displayName: canonicalDisplayName,
        };
      }

      const created = await tx.bazarListing.create({
        data: {
          playerId: player.id,
          category: input.category,
          listingType: input.listingType,
          payload: payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
          priceCoins: input.listingType !== "TRADE" ? input.priceCoins : null,
          priceLigaCash: input.listingType !== "TRADE" ? input.priceLigaCash : null,
          listingFeeCurrency: feeCurrency,
          wantedDesc: input.wantedDesc,
          description: input.description,
          loanEnabled,
          loanAmountCoins: loanEnabled ? loanAmountCoins : null,
          loanInterestPct: loanEnabled ? loanInterestPct : null,
          feeCharged: fee,
          expiresAt,
          premiumUntil,
        },
      });
      listingId = created.id;
    });

    if (premium) {
      await publishDuePremiumBazarTicker().catch((error) => console.error("[Bazar Premium] Falha no chamariz inicial", error));
    } else if (input.category === "MASCOT" && typeof payload.pokemonId === "number") {
      const rarity = getMascotRarity(payload.pokemonId);
      if (rarity === "LEGENDARY" || rarity === "MYTHICAL") {
        await publishLeagueTicker({
          type: "BAZAR_RARE_LISTING",
          message: `${player.displayName} anunciou ${fullMascotPayloadName(payload)} no Bazar. É um mascote ${rarity === "MYTHICAL" ? "mítico" : "lendário"} — vá conferir!`,
          href: "/bazar",
          priority: 6,
          ttlHours: 10,
        });
      }
    }
    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    return { id: listingId };
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
        where: { listingId, status: { in: ["PENDING", "ACCEPTED"] } },
        select: { id: true, proposerId: true, coinsOffer: true, coinsEscrowed: true, ligaCashOffer: true, ligaCashEscrowed: true, itemsOffer: true, message: true, proposer: { select: { userId: true } } },
      });
      rejectedProposerUserIds = pendingProposals.map((proposal) => proposal.proposer.userId);
      for (const proposal of pendingProposals) {
        await _releaseProposalEscrow(tx, proposal);
        const direct = parseDirectState(proposal.message);
        if (direct) {
          await _releaseProposalOffers(tx, direct.ownerItems, player.id);
          if (direct.ownerCoinsEscrowed && direct.ownerCoins > 0) {
            await tx.zikaCoinWallet.upsert({ where: { playerId: player.id }, update: { balance: { increment: direct.ownerCoins } }, create: { playerId: player.id, balance: direct.ownerCoins, totalEarned: 0 } });
          }
        }
      }
      await tx.bazarProposal.updateMany({
        where: { listingId, status: { in: ["PENDING", "ACCEPTED"] } },
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
  fields: {
    priceCoins?: number | null;
    priceLigaCash?: number | null;
    description?: string;
    wantedDesc?: string;
    listingType?: "SALE" | "SALE_OR_TRADE" | "AUCTION";
    minBidCoins?: number | null;
    auctionDuration?: "12h" | "1d";
  },
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
    if (fields.priceLigaCash !== undefined && fields.priceLigaCash !== null && fields.priceLigaCash < 0) {
      return { error: "Preço em LigaCash não pode ser negativo." };
    }

    const wasAuction = listing.listingType === "AUCTION";
    const newType = fields.listingType ?? (wasAuction ? "AUCTION" : listing.listingType === "SALE" ? "SALE" : "SALE_OR_TRADE");
    const typeChanged = newType !== listing.listingType;

    // Leilão que já recebeu lances não pode mudar de tipo nem de lance mínimo.
    if ((wasAuction || newType === "AUCTION") && listing.currentBidPlayerId && (typeChanged || newType === "AUCTION")) {
      if (typeChanged) return { error: "Este leilão já recebeu lances e não pode mudar de tipo." };
    }

    const data: Prisma.BazarListingUpdateInput = {
      description: fields.description?.trim() || null,
      wantedDesc: fields.wantedDesc?.trim() || null,
      listingType: newType,
    };

    if (newType === "AUCTION") {
      const minBid = Math.trunc(Number(fields.minBidCoins) || 0);
      if (minBid < 1) return { error: "Defina um lance mínimo válido (>= 1 ZC) para o leilão." };
      if (listing.currentBidPlayerId) return { error: "Este leilão já recebeu lances; não é possível alterar o lance mínimo." };
      data.priceCoins = null;
      data.priceLigaCash = null;
      data.minBidCoins = minBid;
      data.currentBidCoins = null;
      data.currentBidPlayerId = null;
      // Ao converter para leilão, inicia o prazo a partir de agora. Editar um
      // leilão que já era leilão não reinicia o cronômetro.
      if (!wasAuction) {
        const durationMs = fields.auctionDuration === "12h" ? 12 * 3600_000 : 24 * 3600_000;
        const endsAt = new Date(Date.now() + durationMs);
        data.auctionEndsAt = endsAt;
        data.expiresAt = endsAt;
      }
    } else {
      // Venda ou Venda/Troca.
      if (newType === "SALE" && !fields.priceCoins && !fields.priceLigaCash) {
        return { error: "Um anúncio de venda precisa de um preço em ZC ou LC." };
      }
      data.priceCoins = fields.priceCoins ?? null;
      data.priceLigaCash = fields.priceLigaCash ?? null;
      // Ao sair de um leilão, limpa os campos de leilão.
      if (wasAuction) {
        data.minBidCoins = null;
        data.currentBidCoins = null;
        data.currentBidPlayerId = null;
        data.auctionEndsAt = null;
      }
    }

    await prisma.bazarListing.update({ where: { id: listingId }, data });

    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

// ── Comprar direto (SALE) ─────────────────────────────────────────────────────

export async function buyListing(listingId: string, currency: "ZC" | "LC" = "ZC"): Promise<{ error?: string }> {
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
    const price = currency === "LC" ? listing.priceLigaCash : listing.priceCoins;
    if (!price) return { error: `Este anúncio não aceita pagamento em ${currency}.` };
    if (listing.listingType === "TRADE") return { error: "Este anúncio é somente troca. Envie uma proposta." };
    const economy = await prisma.economySettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
    if (currency === "LC" && !economy.allowLcBazar) return { error: "LigaCash está desativada no Bazar." };

    const wallet = currency === "LC"
      ? await prisma.ligaCoinWallet.findUnique({ where: { playerId: player.id } })
      : await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < price) {
      return { error: `Saldo insuficiente. Você tem ${wallet?.balance ?? 0} ${currency}, o item custa ${price} ${currency}.` };
    }

    const buyerName = player.displayName;
    const sellerName = listing.player.displayName;

    await prisma.$transaction(async (tx) => {
      // Marcar como vendido
      await tx.bazarListing.update({ where: { id: listingId }, data: { status: "SOLD" } });

      // Transferir coins: comprador → vendedor
      if (currency === "ZC") {
        await tx.zikaCoinWallet.update({ where: { playerId: player.id }, data: { balance: { decrement: price } } });
        await tx.zikaCoinWallet.upsert({
          where: { playerId: listing.playerId },
          update: { balance: { increment: price } },
          create: { playerId: listing.playerId, balance: price, totalEarned: price },
        });
        await creditMiauvadaoVaultFromPlayerTransaction(tx, price);
      } else {
        await changeLigaCash(tx, { playerId: player.id, amount: -price, reason: "BAZAR_PURCHASE", referenceType: "BazarListing", referenceId: listingId, spentDelta: price });
        await changeLigaCash(tx, { playerId: listing.playerId, amount: price, reason: "BAZAR_SALE", referenceType: "BazarListing", referenceId: listingId });
      }

      // Transferir item para o comprador
      await _transferItem(tx, listing, player.id);

      // Rejeitar proposals pendentes e liberar mascotes oferecidos nelas.
      const pendingProposals = await tx.bazarProposal.findMany({
        where: { listingId, status: "PENDING" },
        select: { id: true, proposerId: true, coinsOffer: true, coinsEscrowed: true, ligaCashOffer: true, ligaCashEscrowed: true, itemsOffer: true },
      });
      for (const proposal of pendingProposals) {
        await _releaseProposalEscrow(tx, proposal);
        await createPlayerNotification(tx, {
          playerId: proposal.proposerId,
          category: "BAZAR",
          type: "PROPOSAL_REJECTED_SOLD",
          title: `Proposta encerrada: ${listingDisplayName(listing)}`,
          body: `O anúncio foi vendido para ${buyerName}; sua proposta foi devolvida.`,
          href: `/bazar/${listingId}`,
          entityId: listingId,
          eventKey: `bazar:proposal:sold:${proposal.id}`,
        });
      }
      await tx.bazarProposal.updateMany({
        where: { listingId, status: "PENDING" },
        data: { status: "REJECTED" },
      });

      // Log de transação
      const payload = listing.payload as Record<string, unknown>;
      const desc = listing.category === "MASCOT"
        ? `${fullMascotPayloadName(payload)} Nv.${payload.level} vendido por ${price} ${currency}`
        : `${payload.displayName} vendido por ${price} ${currency}`;

      await tx.bazarTransaction.create({
        data: {
          listingId,
          sellerId: listing.playerId,
          buyerId: player.id,
          sellerName,
          buyerName,
          description: desc,
          coinsAmount: currency === "ZC" ? price : 0,
          category: listing.category,
        },
      });
      const activityMetadata = { listingId, category: listing.category, payload: listing.payload } as import("@prisma/client").Prisma.InputJsonValue;
      await Promise.all([
        recordPlayerActivity(tx, {
          playerId: player.id, actorUserId: user.id, category: "BAZAR", action: "BAZAR_PURCHASE",
          summary: `Comprou de ${sellerName}: ${desc}`, source: "DIRECT_SALE", entityType: "bazarListing", entityId: listingId,
          amount: -price, unit: currency, metadata: activityMetadata,
        }),
        recordPlayerActivity(tx, {
          playerId: listing.playerId, category: "BAZAR", action: "BAZAR_SALE",
          summary: `Vendeu para ${buyerName}: ${desc}`, source: "DIRECT_SALE", entityType: "bazarListing", entityId: listingId,
          amount: price, unit: currency, metadata: activityMetadata,
        }),
      ]);
      await createPlayerNotification(tx, {
        playerId: listing.playerId,
        category: "BAZAR",
        type: "DIRECT_SALE",
        title: `Vendido: ${listingDisplayName(listing)}`,
        body: `${buyerName} comprou o anúncio por ${price.toLocaleString("pt-BR")} ${currency}.`,
        href: `/bazar/${listingId}`,
        entityId: listingId,
        eventKey: `bazar:sold:${listingId}`,
      });
    });

    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    revalidateTag(`nav-${listing.player.userId}`);
    after(() => Promise.allSettled([
      sendNotificationToPlayers([listing.playerId], { title: `Vendido: ${listingDisplayName(listing)}`, body: `${buyerName} comprou por ${price.toLocaleString("pt-BR")} ${currency}.`, url: `/bazar/${listingId}` }),
      sendNotificationToPlayers([player.id], { title: `Compra concluída: ${listingDisplayName(listing)}`, body: `O item foi entregue por ${price.toLocaleString("pt-BR")} ${currency}.`, url: `/bazar/${listingId}` }),
    ]).then(() => undefined));
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao comprar." };
  }
}

// ── Proposta ──────────────────────────────────────────────────────────────────

function isDirectNegotiationListing(listing: { payload: unknown }) {
  return (listing.payload as Record<string, unknown> | null)?.directNegotiation === true;
}

export async function requestDirectNegotiation(listingId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const listing = await prisma.bazarListing.findUnique({ where: { id: listingId }, include: { player: { select: { userId: true } } } });
    if (!listing || !isDirectNegotiationListing(listing) || listing.status !== "ACTIVE") return { error: "Sala de negociação indisponível." };
    if (listing.playerId === player.id) return { error: "Você já é o anunciante desta sala." };
    await assertBazarPairAllowed(prisma, player.id, listing.playerId);
    const exists = await prisma.bazarProposal.findFirst({ where: { listingId, proposerId: player.id, status: "PENDING" } });
    if (exists) return { error: "Seu pedido de entrada já está pendente." };
    const proposal = await prisma.bazarProposal.create({
      data: { listingId, proposerId: player.id, message: JSON.stringify(EMPTY_DIRECT_STATE) },
    });
    await createPlayerNotification(prisma, {
      playerId: listing.playerId, category: "BAZAR", type: "DIRECT_NEGOTIATION_REQUEST",
      title: "Pedido para negociar", body: `${player.displayName} quer entrar na sua mesa de negociação.`,
      href: `/bazar/${listingId}`, entityId: listingId, eventKey: `bazar:direct:request:${proposal.id}`,
    });
    revalidateBazar(); revalidateTag(`nav-${listing.player.userId}`);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro ao solicitar entrada." }; }
}

export async function acceptDirectNegotiationParticipant(proposalId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const owner = await getSessionPlayer(user.id);
    if (!owner) return { error: "Perfil não encontrado." };
    const proposal = await prisma.bazarProposal.findUnique({ where: { id: proposalId }, include: { listing: true, proposer: { select: { userId: true, displayName: true } } } });
    if (!proposal || proposal.listing.playerId !== owner.id || !isDirectNegotiationListing(proposal.listing)) return { error: "Pedido inválido." };
    if (proposal.status !== "PENDING" || proposal.listing.status !== "ACTIVE") return { error: "Este pedido não está mais disponível." };
    const state = parseDirectState(proposal.message) ?? { ...EMPTY_DIRECT_STATE };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${proposal.listingId}))`;
      const claimed = await tx.bazarListing.updateMany({ where: { id: proposal.listingId, status: "ACTIVE" }, data: { status: "RESERVED" } });
      if (claimed.count !== 1) throw new Error("Outro participante já ocupou esta mesa.");
      const accepted = await tx.bazarProposal.updateMany({ where: { id: proposal.id, status: "PENDING" }, data: { status: "ACCEPTED", message: JSON.stringify({ ...state, accepted: true }) } });
      if (accepted.count !== 1) throw new Error("Este pedido não está mais pendente.");
      const others = await tx.bazarProposal.findMany({ where: { listingId: proposal.listingId, id: { not: proposal.id }, status: "PENDING" } });
      for (const other of others) {
        await _releaseProposalEscrow(tx, other);
        await createPlayerNotification(tx, { playerId: other.proposerId, category: "BAZAR", type: "DIRECT_NEGOTIATION_CLOSED", title: "Mesa ocupada", body: "O anunciante aceitou outro jogador. Nenhum ativo seu ficou reservado.", href: `/bazar/${proposal.listingId}`, entityId: proposal.listingId, eventKey: `bazar:direct:closed:${other.id}` });
      }
      await tx.bazarProposal.updateMany({ where: { listingId: proposal.listingId, id: { not: proposal.id }, status: "PENDING" }, data: { status: "REJECTED" } });
      await createPlayerNotification(tx, { playerId: proposal.proposerId, category: "BAZAR", type: "DIRECT_NEGOTIATION_ACCEPTED", title: "Entrada aceita", body: `${owner.displayName} abriu a mesa para você montar sua oferta.`, href: `/bazar/${proposal.listingId}`, entityId: proposal.listingId, eventKey: `bazar:direct:accepted:${proposal.id}` });
    });
    revalidateBazar(); revalidateTag(`nav-${proposal.proposer.userId}`); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro ao aceitar participante." }; }
}

// Botão único "Travar minha proposta": reserva os ativos/ZC informados E trava
// o lado de quem chama (fase 1). Se a oferta mudou de fato, invalida a trava e a
// confirmação do outro lado (precisa reavaliar). Sempre zera a própria
// confirmação de fase 2 (é preciso reconfirmar após travar).
export async function updateDirectNegotiationOffer(input: {
  proposalId: string; coins: number; items: ProposalOfferItem[]; loan?: boolean; interestPct?: number; lock?: boolean; ligaCash?: number;
}): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await prepareBazarMascotAvailability(player.id);
    const proposal = await prisma.bazarProposal.findUnique({ where: { id: input.proposalId }, include: { listing: true } });
    if (!proposal || proposal.status !== "ACCEPTED" || proposal.listing.status !== "RESERVED" || !isDirectNegotiationListing(proposal.listing)) return { error: "Negociação não está ativa." };
    const isOwner = proposal.listing.playerId === player.id;
    if (!isOwner && proposal.proposerId !== player.id) return { error: "Sem permissão." };
    const lock = input.lock !== false; // padrão: travar ao salvar (botão único)
    const coins = Math.max(0, Math.floor(Number(input.coins) || 0));
    const ligaCash = Math.max(0, Math.floor(Number(input.ligaCash) || 0));
    const loan = Boolean(input.loan);
    const interestPct = Math.max(0, Math.min(100, Math.floor(Number(input.interestPct) || 0)));
    if (loan && coins < 1) return { error: "Informe o valor do empréstimo." };
    if (loan && ligaCash > 0) return { error: "Empréstimos são apenas em ZC; remova a LigaCash da oferta." };
    if (ligaCash > 0) {
      const economy = await prisma.economySettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
      if (!economy.allowLcBazar) return { error: "LigaCash está desativada no Bazar." };
    }
    const cleanItems = (input.items ?? []).map((item) => ({ ...item, quantity: item.mascotId ? 1 : Math.max(1, Math.floor(Number(item.quantity) || 1)) }));
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${proposal.listingId}))`;
      const fresh = await tx.bazarProposal.findUniqueOrThrow({ where: { id: proposal.id } });
      const state = parseDirectState(fresh.message);
      if (!state?.accepted) throw new Error("A mesa ainda não foi aceita.");
      const oldItems = isOwner ? state.ownerItems : (fresh.itemsOffer as ProposalOfferItem[] | null) ?? [];
      const oldCoins = isOwner ? state.ownerCoins : fresh.coinsOffer;
      const oldCoinsEscrowed = isOwner ? state.ownerCoinsEscrowed : fresh.coinsEscrowed;
      const oldLigaCash = isOwner ? state.ownerLigaCash : fresh.ligaCashOffer;
      const oldLigaCashEscrowed = isOwner ? state.ownerLigaCashEscrowed : fresh.ligaCashEscrowed;
      const oldLoan = isOwner ? state.ownerLoan : state.participantLoan;
      const oldInterest = isOwner ? state.ownerInterestPct : state.participantInterestPct;
      const changed = directOfferSignature(oldItems, oldCoins, oldLoan, oldInterest, oldLigaCash) !== directOfferSignature(cleanItems, coins, loan, interestPct, ligaCash);
      await _releaseProposalOffers(tx, oldItems, player.id);
      if (oldCoinsEscrowed && oldCoins > 0) {
        await tx.zikaCoinWallet.upsert({ where: { playerId: player.id }, update: { balance: { increment: oldCoins } }, create: { playerId: player.id, balance: oldCoins, totalEarned: 0 } });
      }
      if (oldLigaCashEscrowed && oldLigaCash > 0) {
        await changeLigaCash(tx, { playerId: player.id, amount: oldLigaCash, reason: "BAZAR_ESCROW_RELEASE", referenceType: "BazarProposal", referenceId: proposal.id });
      }
      const reservedItems = await _reserveProposalOffers(tx, player.id, cleanItems);
      // ZC postos na mesa saem da carteira AGORA (escrow), seja pagamento ou
      // empréstimo. No empréstimo o dinheiro é entregue ao outro lado no
      // fechamento e vira uma dívida dele para com quem emprestou.
      if (coins > 0) {
        const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
        if (!wallet || wallet.balance < coins) throw new Error(`Saldo insuficiente (${wallet?.balance ?? 0} ZC disponíveis).`);
        await tx.zikaCoinWallet.update({ where: { playerId: player.id }, data: { balance: { decrement: coins } } });
      }
      // LigaCash posta na mesa também sai da carteira ao travar (escrow).
      if (ligaCash > 0) {
        const lcWallet = await tx.ligaCoinWallet.findUnique({ where: { playerId: player.id } });
        if (!lcWallet || lcWallet.balance < ligaCash) throw new Error(`Saldo de LigaCash insuficiente (${lcWallet?.balance ?? 0} LC disponíveis).`);
        await changeLigaCash(tx, { playerId: player.id, amount: -ligaCash, reason: "BAZAR_ESCROW", referenceType: "BazarProposal", referenceId: proposal.id });
      }
      // Travar/editar o MEU lado nunca mexe na trava do outro (a trava é da
      // própria oferta). Mas, se a MINHA oferta mudou, a CONFIRMAÇÃO de fase 2 do
      // outro lado cai — ele concordou com um acordo que mudou.
      const base = { ...state };
      if (isOwner) {
        base.ownerReady = lock; base.ownerConfirmed = false;
        if (changed) base.participantConfirmed = false;
      } else {
        base.participantReady = lock; base.participantConfirmed = false;
        if (changed) base.ownerConfirmed = false;
      }
      if (isOwner) {
        await tx.bazarProposal.update({ where: { id: fresh.id }, data: { message: JSON.stringify({ ...base, ownerCoins: coins, ownerCoinsEscrowed: coins > 0, ownerLigaCash: ligaCash, ownerLigaCashEscrowed: ligaCash > 0, ownerItems: reservedItems, ownerLoan: loan, ownerInterestPct: interestPct }) } });
      } else {
        await tx.bazarProposal.update({ where: { id: fresh.id }, data: { coinsOffer: coins, coinsEscrowed: coins > 0, ligaCashOffer: ligaCash, ligaCashEscrowed: ligaCash > 0, itemsOffer: reservedItems as unknown as Prisma.InputJsonValue, message: JSON.stringify({ ...base, participantLoan: loan, participantInterestPct: interestPct }) } });
      }
      await createPlayerNotification(tx, {
        playerId: isOwner ? fresh.proposerId : proposal.listing.playerId,
        category: "BAZAR", type: "DIRECT_NEGOTIATION_OFFER_UPDATED", title: lock ? "Oferta travada" : "Oferta atualizada",
        body: `${player.displayName} ${lock ? "travou" : "atualizou"} a oferta${changed ? ". Reavalie e trave a sua novamente." : "."}`,
        href: `/bazar/${proposal.listingId}`, entityId: proposal.listingId,
        eventKey: `bazar:direct:offer:${fresh.id}:${Date.now()}`,
      });
    });
    revalidateBazar(); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro ao reservar a oferta." }; }
}

// Destrava a própria oferta (fase 1) e zera a própria confirmação (fase 2). O
// escrow reservado é mantido; ao travar de novo a oferta é reavaliada. Não mexe
// no lado do outro jogador.
export async function unlockDirectNegotiation(proposalId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id); if (!player) return { error: "Perfil não encontrado." };
    const proposal = await prisma.bazarProposal.findUnique({ where: { id: proposalId }, include: { listing: true } });
    if (!proposal || proposal.status !== "ACCEPTED") return { error: "Negociação indisponível." };
    const isOwner = proposal.listing.playerId === player.id;
    if (!isOwner && proposal.proposerId !== player.id) return { error: "Sem permissão." };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${proposal.listingId}))`;
      const fresh = await tx.bazarProposal.findUniqueOrThrow({ where: { id: proposal.id } });
      const state = parseDirectState(fresh.message);
      if (!state?.accepted) throw new Error("Mesa ainda não aceita.");
      const next = {
        ...state,
        ownerReady: isOwner ? false : state.ownerReady,
        participantReady: isOwner ? state.participantReady : false,
        ownerConfirmed: isOwner ? false : state.ownerConfirmed,
        participantConfirmed: isOwner ? state.participantConfirmed : false,
      };
      await tx.bazarProposal.update({ where: { id: proposalId }, data: { message: JSON.stringify(next) } });
      await createPlayerNotification(tx, {
        playerId: isOwner ? proposal.proposerId : proposal.listing.playerId,
        category: "BAZAR", type: "DIRECT_NEGOTIATION_CONFIRMED", title: "Trava removida",
        body: `${player.displayName} destravou a oferta para editar. Revise antes de travar novamente.`,
        href: `/bazar/${proposal.listingId}`, entityId: proposal.listingId,
        eventKey: `bazar:direct:unlock:${proposal.id}:${isOwner ? "owner" : "participant"}:${Date.now()}`,
      });
    });
    revalidateBazar(); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro ao destravar." }; }
}

// Fase 2 — confirmação pós-trava. Só é permitida quando OS DOIS estão travados.
// Marca a confirmação do lado de quem chama; quando os dois confirmam, a troca
// é fechada e os ativos entregues automaticamente.
export async function confirmDirectNegotiation(proposalId: string): Promise<{ error?: string; done?: boolean }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id); if (!player) return { error: "Perfil não encontrado." };
    const proposal = await prisma.bazarProposal.findUnique({
      where: { id: proposalId },
      include: { listing: { include: { player: { select: { id: true, displayName: true, userId: true } } } }, proposer: { select: { id: true, displayName: true, userId: true } } },
    });
    if (!proposal || proposal.status !== "ACCEPTED" || !isDirectNegotiationListing(proposal.listing)) return { error: "Negociação indisponível." };
    const isOwner = proposal.listing.playerId === player.id;
    if (!isOwner && proposal.proposerId !== player.id) return { error: "Sem permissão." };
    const ownerId = proposal.listing.playerId;
    const proposerId = proposal.proposerId;
    await assertBazarPairAllowed(prisma, ownerId, proposerId);
    let done = false;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${proposal.listingId}))`;
      const listing = await tx.bazarListing.findUniqueOrThrow({ where: { id: proposal.listingId } });
      if (listing.status !== "RESERVED") throw new Error("A negociação já foi concluída ou cancelada.");
      const fresh = await tx.bazarProposal.findUniqueOrThrow({ where: { id: proposal.id } });
      const state = parseDirectState(fresh.message);
      if (!state?.accepted) throw new Error("Mesa ainda não aceita.");
      if (!state.ownerReady || !state.participantReady) throw new Error("Os dois lados precisam TRAVAR a oferta antes de confirmar.");
      const next = {
        ...state,
        ownerConfirmed: isOwner ? true : state.ownerConfirmed,
        participantConfirmed: isOwner ? state.participantConfirmed : true,
      };
      await tx.bazarProposal.update({ where: { id: proposal.id }, data: { message: JSON.stringify(next) } });
      if (next.ownerConfirmed && next.participantConfirmed) {
        await _deliverDirectNegotiation(tx, {
          listingId: proposal.listingId, proposalId: proposal.id,
          ownerId, ownerName: proposal.listing.player.displayName,
          proposerId, proposerName: proposal.proposer.displayName,
        });
        done = true;
      } else {
        await createPlayerNotification(tx, {
          playerId: isOwner ? proposerId : ownerId,
          category: "BAZAR", type: "DIRECT_NEGOTIATION_CONFIRMED", title: "Confirmação registrada",
          body: `${player.displayName} confirmou o fechamento. Falta o outro lado confirmar para concluir.`,
          href: `/bazar/${proposal.listingId}`, entityId: proposal.listingId,
          eventKey: `bazar:direct:confirm2:${proposal.id}:${isOwner ? "owner" : "participant"}:${Date.now()}`,
        });
      }
    });
    revalidateBazar();
    if (done) { revalidateTag(`nav-${proposal.proposer.userId}`); revalidateTag(`nav-${proposal.listing.player.userId}`); }
    return { done };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro ao confirmar." }; }
}

// Entrega os ativos das duas pontas e conclui a negociação direta. Exige os dois
// travados E os dois confirmados. Reutilizado pela confirmação de fase 2.
async function _deliverDirectNegotiation(tx: TxClient, args: {
  listingId: string; proposalId: string; ownerId: string; ownerName: string; proposerId: string; proposerName: string;
}) {
  const freshProposal = await tx.bazarProposal.findUniqueOrThrow({ where: { id: args.proposalId } });
  const freshState = parseDirectState(freshProposal.message);
  if (!freshState?.ownerReady || !freshState.participantReady) throw new Error("Os dois jogadores precisam travar as ofertas.");
  if (!freshState.ownerConfirmed || !freshState.participantConfirmed) throw new Error("Os dois jogadores precisam confirmar o fechamento.");
  if (freshState.ownerLoan && freshState.participantLoan) throw new Error("Apenas um dos lados pode usar empréstimo na mesma negociação.");
  await _deliverProposalOffers(tx, freshState.ownerItems, args.ownerId, args.proposerId);
  await _deliverProposalOffers(tx, (freshProposal.itemsOffer as ProposalOfferItem[] | null) ?? [], args.proposerId, args.ownerId);
  // Os ZC postos na mesa (já em escrow) são entregues ao OUTRO lado — inclusive
  // quando são empréstimo: quem empresta entrega o dinheiro agora. O lado que é
  // empréstimo NÃO alimenta o cofre (o valor volta depois; nada de faucet).
  if (freshState.ownerCoins > 0) await _creditEscrowedCoins(tx, args.proposerId, freshState.ownerCoins, !freshState.ownerLoan);
  if (freshProposal.coinsOffer > 0) await _creditEscrowedCoins(tx, args.ownerId, freshProposal.coinsOffer, !freshState.participantLoan);
  // LigaCash (já em escrow) é entregue ao outro lado. LC não participa de
  // empréstimos, então é sempre transferência definitiva.
  if (freshState.ownerLigaCash > 0) await changeLigaCash(tx, { playerId: args.proposerId, amount: freshState.ownerLigaCash, reason: "BAZAR_SALE", referenceType: "BazarProposal", referenceId: args.proposalId });
  if (freshProposal.ligaCashOffer > 0) await changeLigaCash(tx, { playerId: args.ownerId, amount: freshProposal.ligaCashOffer, reason: "BAZAR_SALE", referenceType: "BazarProposal", referenceId: args.proposalId });
  const loanSide = freshState.ownerLoan ? "owner" : freshState.participantLoan ? "participant" : null;
  if (loanSide) {
    // Quem marcou "empréstimo" é o CREDOR (entregou os ZC agora); o outro lado é
    // o DEVEDOR e passa a dever o principal + juros (acordo de boa-fé).
    const principal = loanSide === "owner" ? freshState.ownerCoins : freshProposal.coinsOffer;
    const interest = loanSide === "owner" ? freshState.ownerInterestPct : freshState.participantInterestPct;
    const lenderId = loanSide === "owner" ? args.ownerId : args.proposerId;
    const borrowerId = loanSide === "owner" ? args.proposerId : args.ownerId;
    await tx.bazarLoan.create({ data: { listingId: args.listingId, proposalId: args.proposalId, lenderId, borrowerId, principalCoins: principal, interestPct: interest, totalDueCoins: Math.ceil(principal * (100 + interest) / 100), itemSnapshot: { directNegotiation: true, ownerItems: freshState.ownerItems, participantItems: freshProposal.itemsOffer } } });
  }
  await tx.bazarListing.update({ where: { id: args.listingId }, data: { status: "SOLD" } });
  const participantItems = (freshProposal.itemsOffer as ProposalOfferItem[] | null) ?? [];
  await tx.bazarTransaction.create({ data: {
    listingId: args.listingId, sellerId: args.ownerId, buyerId: args.proposerId,
    sellerName: args.ownerName, buyerName: args.proposerName,
    description: "Negociação direta concluída", coinsAmount: freshState.ownerCoins + freshProposal.coinsOffer, category: "ITEM",
    detailsJson: {
      direct: true,
      sellerItems: freshState.ownerItems, sellerCoins: freshState.ownerCoins, sellerLigaCash: freshState.ownerLigaCash, sellerLoan: freshState.ownerLoan,
      buyerItems: participantItems, buyerCoins: freshProposal.coinsOffer, buyerLigaCash: freshProposal.ligaCashOffer, buyerLoan: freshState.participantLoan,
    } as unknown as Prisma.InputJsonValue,
  } });
  await Promise.all([
    createPlayerNotification(tx, { playerId: args.ownerId, category: "BAZAR", type: "DIRECT_NEGOTIATION_DONE", title: "Negociação concluída", body: `Sua troca com ${args.proposerName} foi concluída e os ativos foram entregues.`, href: `/bazar/${args.listingId}`, entityId: args.listingId, eventKey: `bazar:direct:done:owner:${args.proposalId}` }),
    createPlayerNotification(tx, { playerId: args.proposerId, category: "BAZAR", type: "DIRECT_NEGOTIATION_DONE", title: "Negociação concluída", body: `Sua troca com ${args.ownerName} foi concluída e os ativos foram entregues.`, href: `/bazar/${args.listingId}`, entityId: args.listingId, eventKey: `bazar:direct:done:participant:${args.proposalId}` }),
  ]);
}

// Cancela a negociação em andamento (dono OU participante). Libera os ativos/ZC
// reservados dos dois lados e REABRE a mesa (listing volta para ACTIVE) para
// outros jogadores entrarem, sem cobrar novo anúncio. Não conclui a troca.
export async function cancelDirectNegotiation(proposalId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id); if (!player) return { error: "Perfil não encontrado." };
    const proposal = await prisma.bazarProposal.findUnique({
      where: { id: proposalId },
      include: { listing: { select: { id: true, playerId: true, payload: true } }, proposer: { select: { userId: true, displayName: true } } },
    });
    if (!proposal || !isDirectNegotiationListing(proposal.listing)) return { error: "Negociação não encontrada." };
    const isOwner = proposal.listing.playerId === player.id;
    const isParticipant = proposal.proposerId === player.id;
    if (!isOwner && !isParticipant) return { error: "Sem permissão." };
    if (proposal.status !== "ACCEPTED") return { error: "Esta negociação não está mais ativa." };

    const ownerUserId = await prisma.player.findUnique({ where: { id: proposal.listing.playerId }, select: { userId: true } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${proposal.listingId}))`;
      const fresh = await tx.bazarProposal.findUniqueOrThrow({ where: { id: proposal.id } });
      if (fresh.status !== "ACCEPTED") throw new Error("Esta negociação não está mais ativa.");
      const state = parseDirectState(fresh.message);
      // Devolve a oferta do participante (itens + ZC em escrow).
      await _releaseProposalEscrow(tx, fresh);
      // Devolve a oferta do anunciante (itens reservados + ZC/LC em escrow).
      if (state) {
        await _releaseProposalOffers(tx, state.ownerItems, proposal.listing.playerId);
        if (state.ownerCoinsEscrowed && state.ownerCoins > 0) {
          await tx.zikaCoinWallet.upsert({ where: { playerId: proposal.listing.playerId }, update: { balance: { increment: state.ownerCoins } }, create: { playerId: proposal.listing.playerId, balance: state.ownerCoins, totalEarned: 0 } });
        }
        if (state.ownerLigaCashEscrowed && state.ownerLigaCash > 0) {
          await changeLigaCash(tx, { playerId: proposal.listing.playerId, amount: state.ownerLigaCash, reason: "BAZAR_ESCROW_RELEASE", referenceType: "BazarProposal", referenceId: fresh.id });
        }
      }
      await tx.bazarProposal.update({ where: { id: fresh.id }, data: { status: "CANCELLED", coinsOffer: 0, coinsEscrowed: false, ligaCashOffer: 0, ligaCashEscrowed: false, itemsOffer: Prisma.DbNull, message: JSON.stringify(EMPTY_DIRECT_STATE) } });
      // Reabre a mesa para novos participantes sem novo anúncio.
      await tx.bazarListing.updateMany({ where: { id: proposal.listingId, status: "RESERVED" }, data: { status: "ACTIVE" } });
      await createPlayerNotification(tx, {
        playerId: isOwner ? proposal.proposerId : proposal.listing.playerId,
        category: "BAZAR", type: "DIRECT_NEGOTIATION_CANCELLED", title: "Negociação cancelada",
        body: `${player.displayName} cancelou a negociação. Os ativos reservados foram devolvidos e a mesa foi reaberta.`,
        href: `/bazar/${proposal.listingId}`, entityId: proposal.listingId,
        eventKey: `bazar:direct:cancelled:${proposal.id}:${Date.now()}`,
      });
    });
    revalidateBazar();
    if (ownerUserId?.userId) revalidateTag(`nav-${ownerUserId.userId}`);
    revalidateTag(`nav-${proposal.proposer.userId}`);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro ao cancelar negociação." }; }
}

// Conclusão direta pelo anunciante (fallback). Continua exigindo os dois
// travados E os dois confirmados (mesma regra do fechamento por confirmação).
export async function finalizeDirectNegotiation(proposalId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Não autenticado." };
    const owner = await getSessionPlayer(user.id); if (!owner) return { error: "Perfil não encontrado." };
    const proposal = await prisma.bazarProposal.findUnique({ where: { id: proposalId }, include: { listing: true, proposer: { select: { displayName: true, userId: true } } } });
    if (!proposal || proposal.listing.playerId !== owner.id || !isDirectNegotiationListing(proposal.listing)) return { error: "Somente o anunciante pode concluir." };
    await assertBazarPairAllowed(prisma, owner.id, proposal.proposerId);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${proposal.listingId}))`;
      const fresh = await tx.bazarListing.findUniqueOrThrow({ where: { id: proposal.listingId } });
      if (fresh.status !== "RESERVED") throw new Error("A negociação já foi concluída ou cancelada.");
      await _deliverDirectNegotiation(tx, {
        listingId: proposal.listingId, proposalId: proposal.id,
        ownerId: owner.id, ownerName: owner.displayName,
        proposerId: proposal.proposerId, proposerName: proposal.proposer.displayName,
      });
    });
    revalidateBazar(); revalidateTag(`nav-${proposal.proposer.userId}`); revalidateTag(`nav-${user.id}`); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro ao concluir negociação." }; }
}

export async function createProposal(
  listingId: string,
  coinsOffer: number,
  message?: string,
  itemsOffer?: ProposalOfferItem[],
  loanRequested = false,
  ligaCashOffer = 0,
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
    if (loanRequested && (itemsOffer?.length || Number(coinsOffer) > 0 || Number(ligaCashOffer) > 0)) {
      return { error: "A proposta de empréstimo não pode combinar entrada em ZC, LC ou itens." };
    }
    const reservedCoins = loanRequested ? 0 : Math.max(0, Math.floor(Number(coinsOffer) || 0));
    const reservedLigaCash = loanRequested ? 0 : Math.max(0, Math.floor(Number(ligaCashOffer) || 0));

    if (reservedCoins > 0) {
      const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < reservedCoins) {
        return { error: `Saldo insuficiente (${wallet?.balance ?? 0} ZC disponíveis).` };
      }
    }
    if (reservedLigaCash > 0) {
      const economy = await prisma.economySettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
      if (!economy.allowLcBazar) return { error: "LigaCash está desativada no Bazar." };
      const mixesAssets = reservedCoins > 0 || (itemsOffer?.length ?? 0) > 0;
      if (mixesAssets && !economy.allowMixedProposals) return { error: "Propostas combinando LigaCash com outros ativos estão desativadas." };
      const lcWallet = await prisma.ligaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!lcWallet || lcWallet.balance < reservedLigaCash) {
        return { error: `Saldo de LigaCash insuficiente (${lcWallet?.balance ?? 0} LC disponíveis).` };
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

      const proposal = await tx.bazarProposal.create({
        data: {
          listingId,
          proposerId: player.id,
          coinsOffer: reservedCoins,
          coinsEscrowed: reservedCoins > 0,
          ligaCashOffer: reservedLigaCash,
          ligaCashEscrowed: reservedLigaCash > 0,
          message,
          loanRequested,
          itemsOffer: reservedItems.length > 0
            ? reservedItems as unknown as import("@prisma/client").Prisma.InputJsonValue
            : undefined,
        },
      });
      // Reserva a LigaCash (sai da carteira agora; volta em cancelamento/recusa).
      if (reservedLigaCash > 0) {
        await changeLigaCash(tx, {
          playerId: player.id,
          amount: -reservedLigaCash,
          reason: "BAZAR_ESCROW",
          referenceType: "BazarProposal",
          referenceId: proposal.id,
        });
      }
      const offered = loanRequested
        ? `solicitou o empréstimo de ${listing.loanAmountCoins?.toLocaleString("pt-BR")} ZC`
        : [
            reservedCoins > 0 ? `${reservedCoins.toLocaleString("pt-BR")} ZC` : "",
            reservedLigaCash > 0 ? `${reservedLigaCash.toLocaleString("pt-BR")} LC` : "",
            ...cleanItems.map((item) => `${item.quantity}x ${item.displayName ?? canonicalBazarItemName(item.type)}`),
          ].filter(Boolean).join(" + ") || "enviou uma proposta";
      await createPlayerNotification(tx, {
        playerId: listing.playerId,
        category: "BAZAR",
        type: "NEW_PROPOSAL",
        title: `Nova proposta: ${listingDisplayName(listing)}`,
        body: `${player.displayName} ofereceu ${offered}.`,
        href: `/bazar/${listingId}`,
        entityId: listingId,
        eventKey: `bazar:proposal:new:${proposal.id}`,
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
        select: { id: true, proposerId: true, coinsOffer: true, coinsEscrowed: true, ligaCashOffer: true, ligaCashEscrowed: true, itemsOffer: true },
      });
      for (const rejected of rejectedProposals) {
        await _releaseProposalEscrow(tx, rejected);
        await createPlayerNotification(tx, {
          playerId: rejected.proposerId,
          category: "BAZAR",
          type: "PROPOSAL_REJECTED_OTHER_ACCEPTED",
          title: `Outra proposta venceu: ${listingDisplayName(listing)}`,
          body: "O vendedor aceitou outra proposta; sua oferta foi devolvida.",
          href: `/bazar/${listing.id}`,
          entityId: listing.id,
          eventKey: `bazar:proposal:other-accepted:${rejected.id}`,
        });
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
        await creditMiauvadaoVaultFromPlayerTransaction(tx, proposal.coinsOffer);
      }

      // Transferir LigaCash (proponente → dono). Se estava em escrow, o proponente
      // já foi debitado na criação; senão (proposta antiga) debita agora.
      if (!proposal.loanRequested && proposal.ligaCashOffer > 0) {
        if (!proposal.ligaCashEscrowed) {
          await changeLigaCash(tx, { playerId: proposal.proposerId, amount: -proposal.ligaCashOffer, reason: "BAZAR_PURCHASE", referenceType: "BazarProposal", referenceId: proposal.id });
        }
        await changeLigaCash(tx, { playerId: player.id, amount: proposal.ligaCashOffer, reason: "BAZAR_SALE", referenceType: "BazarProposal", referenceId: proposal.id });
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
            if (mascot.primordialBoundPlayerId) {
              throw new Error("Mascote vinculado pela Pena Arco-Íris Primordial não pode ser transferido.");
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
      const paidParts = [
        proposal.coinsOffer > 0 ? `${proposal.coinsOffer} ZC` : "",
        proposal.ligaCashOffer > 0 ? `${proposal.ligaCashOffer} LC` : "",
      ].filter(Boolean).join(" + ");
      const loanDescription = proposal.loanRequested
        ? ` por empréstimo de ${listing.loanAmountCoins} ZC a ${listing.loanInterestPct ?? 0}%`
        : paidParts ? ` por ${paidParts}` : "";
      const desc = listing.category === "MASCOT"
        ? `${fullMascotPayloadName(payload)} Nv.${payload.level} trocado${loanDescription}`
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
      const activityMetadata = {
        listingId: listing.id,
        proposalId: proposal.id,
        category: listing.category,
        payload: listing.payload,
        itemsOffer: proposal.itemsOffer,
        loanRequested: proposal.loanRequested,
      } as import("@prisma/client").Prisma.InputJsonValue;
      await Promise.all([
        recordPlayerActivity(tx, {
          playerId: player.id, actorUserId: user.id, category: "BAZAR", action: "BAZAR_PROPOSAL_ACCEPTED",
          summary: `Aceitou proposta de ${proposal.proposer.displayName}: ${desc}`,
          source: proposal.loanRequested ? "LOAN" : "TRADE", entityType: "bazarProposal", entityId: proposal.id,
          amount: proposal.loanRequested ? 0 : proposal.coinsOffer, unit: "ZC", metadata: activityMetadata,
        }),
        recordPlayerActivity(tx, {
          playerId: proposal.proposerId, category: "BAZAR", action: "BAZAR_PROPOSAL_WON",
          summary: `Proposta aceita por ${listing.player.displayName}: ${desc}`,
          source: proposal.loanRequested ? "LOAN" : "TRADE", entityType: "bazarProposal", entityId: proposal.id,
          amount: proposal.loanRequested ? 0 : -proposal.coinsOffer, unit: "ZC", metadata: activityMetadata,
        }),
      ]);
      await createPlayerNotification(tx, {
        playerId: proposal.proposerId,
        category: "BAZAR",
        type: "PROPOSAL_ACCEPTED",
        title: `Proposta aceita: ${listingDisplayName(listing)}`,
        body: `${listing.player.displayName} aceitou sua proposta${proposal.loanRequested ? " de empréstimo" : ""}.`,
        href: `/bazar/${listing.id}`,
        entityId: listing.id,
        eventKey: `bazar:proposal:accepted:${proposal.id}`,
      });
    });

    revalidateBazar();
    revalidateTag(`nav-${user.id}`);
    // Notifica o proponente que sua proposta foi aceita
    revalidateTag(`nav-${proposal.proposer.userId}`);
    after(() => Promise.allSettled([
      sendNotificationToPlayers([proposal.proposerId], { title: `Proposta aceita: ${listingDisplayName(listing)}`, body: `${listing.player.displayName} aceitou sua proposta.`, url: `/bazar/${listing.id}` }),
      sendNotificationToPlayers([listing.playerId], { title: `Troca concluída: ${listingDisplayName(listing)}`, body: `A proposta foi aceita e os conteúdos foram entregues.`, url: `/bazar/${listing.id}` }),
    ]).then(() => undefined));
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
        listing: { select: { id: true, playerId: true, category: true, payload: true, player: { select: { displayName: true } } } },
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
        id: proposal.id,
        proposerId: proposal.proposerId,
        coinsOffer: proposal.coinsOffer,
        coinsEscrowed: proposal.coinsEscrowed,
        ligaCashOffer: proposal.ligaCashOffer,
        ligaCashEscrowed: proposal.ligaCashEscrowed,
      });
      await tx.bazarProposal.update({ where: { id: proposalId }, data: { status: newStatus } });
      if (sellerIsRejecting) {
        await createPlayerNotification(tx, {
          playerId: proposal.proposerId,
          category: "BAZAR",
          type: "PROPOSAL_REJECTED",
          title: `Proposta recusada: ${listingDisplayName(proposal.listing)}`,
          body: `${proposal.listing.player.displayName} recusou sua proposta; a oferta foi devolvida.`,
          href: `/bazar/${proposal.listing.id}`,
          entityId: proposal.listing.id,
          eventKey: `bazar:proposal:rejected:${proposal.id}`,
        });
      }
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
  rechargeMinutes = DEFAULT_MIAUVADAO_PURCHASE_RECHARGE_MINUTES,
): MiauvadaoPurchaseStatus {
  const rechargeMs = normalizedRechargeMinutes(rechargeMinutes) * 60_000;
  const rechargeAt = [quota?.chargeOneUsedAt, quota?.chargeTwoUsedAt]
    .filter((value): value is Date => Boolean(value))
    .map((value) => new Date(value.getTime() + rechargeMs))
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
  const [quota, config] = await Promise.all([
    prisma.miauvadaoPurchaseQuota.findUnique({ where: { playerId } }),
    prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" }, select: { purchaseRechargeMinutes: true } }),
  ]);
  return purchaseStatusFromQuota(quota, new Date(), config?.purchaseRechargeMinutes);
}

const MIAUVADAO_EGG_FUSION_VAULT_COST = 250;
const MIAUVADAO_EGG_FUSION_PLAYER_COST = 250;

export async function fuseMiauvadaoEggsAction(eggIds: string[]): Promise<{
  error?: string;
  result?: "BROKEN" | MiauvadaoFusionEggType | "LAB";
  lootBonusPct?: number;
  newVaultBalance?: number;
  newPlayerBalance?: number;
  newEgg?: { id: string; type: MiauvadaoFusionEggType; hatchRarityBonusPct: number };
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const uniqueEggIds = [...new Set(eggIds)];
    if (eggIds.length !== 3 || uniqueEggIds.length !== 3) {
      return { error: "Selecione exatamente 3 ovos diferentes." };
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const config = await tx.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
      if (config.vaultBalance < MIAUVADAO_EGG_FUSION_VAULT_COST) {
        throw new Error(`A máquina está desligada: o cofre precisa de pelo menos ${MIAUVADAO_EGG_FUSION_VAULT_COST} ZC para funcionar.`);
      }
      const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < MIAUVADAO_EGG_FUSION_PLAYER_COST) {
        throw new Error(`Saldo insuficiente: você precisa de ${MIAUVADAO_EGG_FUSION_PLAYER_COST} ZC para usar a máquina.`);
      }

      // Carrega os ovos ESPECÍFICOS escolhidos pelo jogador e valida elegibilidade,
      // para nunca consumir um ovo diferente do selecionado (ex.: um com bônus de raridade).
      const eggs = await tx.mascotEgg.findMany({
        where: {
          id: { in: uniqueEggIds },
          playerId: player.id,
          type: { in: MIAUVADAO_FUSION_EGG_TYPES as unknown as EggType[] },
          incubation: null,
          NOT: { origin: { startsWith: "bazar:" } },
        },
        select: { id: true, type: true },
      });
      if (eggs.length !== 3) {
        throw new Error("Um ou mais ovos selecionados não estão mais disponíveis. Atualize a página e tente novamente.");
      }
      const eggTypes = eggs.map((egg) => egg.type as MiauvadaoFusionEggType);
      const consumedIds = eggs.map((egg) => egg.id);

      const result = rollMiauvadaoFusion(eggTypes);
      const lootBonusPct = rollFusionLootBonus(eggTypes, result);
      const consumed = await tx.mascotEgg.deleteMany({ where: { id: { in: consumedIds }, playerId: player.id } });
      if (consumed.count !== 3) {
        throw new Error("Os ovos mudaram enquanto a fusão era processada. Nada foi consumido; tente novamente.");
      }
      await creditCoins(tx, {
        playerId: player.id,
        type: "SHOP_PURCHASE",
        amount: -MIAUVADAO_EGG_FUSION_PLAYER_COST,
        description: "Uso da Máquina de Fusão de Ovos do Miauvadão",
      });
      let newEgg: { id: string; type: MiauvadaoFusionEggType; hatchRarityBonusPct: number } | undefined;
      if (result !== "BROKEN") {
        const created = await tx.mascotEgg.create({
          data: {
            playerId: player.id,
            type: result as EggType,
            origin: "Miauvadão: Fusão de Ovos",
            hatchRarityBonusPct: lootBonusPct,
          },
          select: { id: true, type: true, hatchRarityBonusPct: true },
        });
        // Só devolvemos para a UI da máquina os ovos que ela lista (LAB não entra).
        if ((MIAUVADAO_FUSION_EGG_TYPES as readonly string[]).includes(created.type)) {
          newEgg = { id: created.id, type: created.type as MiauvadaoFusionEggType, hatchRarityBonusPct: created.hatchRarityBonusPct };
        }
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
      return {
        result,
        lootBonusPct,
        newVaultBalance: updatedConfig.vaultBalance,
        newPlayerBalance: wallet.balance - MIAUVADAO_EGG_FUSION_PLAYER_COST,
        newEgg,
      };
    }, { isolationLevel: "Serializable" });

    revalidateTag("miauvadao-config");
    revalidatePath("/bazar");
    revalidatePath("/mascotes");
    return outcome;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "A fusão falhou." };
  }
}

export async function buyMiauvadaoOffer(offerIndex: number, currency: "ZC" | "LC" = "ZC"): Promise<{ error?: string; purchaseStatus?: MiauvadaoPurchaseStatus }> {
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
      // Preço em LC na mesma proporção da ZikaShop (definida na economia central).
      const economy = await tx.economySettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
      if (currency === "LC" && !economy.allowLcShop) throw new Error("Pagamentos em LigaCash estão desativados no momento.");
      const priceLc = suggestedLigaCashPrice(offer.finalPrice, economy.shopLcValueMultiplier, economy.zcPerLcReference);
      const price = currency === "LC" ? priceLc : offer.finalPrice;
      const wallet = currency === "LC"
        ? await tx.ligaCoinWallet.findUnique({ where: { playerId: player.id } })
        : await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < price) {
        throw new Error(`Saldo insuficiente (${wallet?.balance ?? 0} ${currency} disponíveis, oferta custa ${price} ${currency}).`);
      }
      const quota = await tx.miauvadaoPurchaseQuota.upsert({
        where: { playerId: player.id },
        update: {},
        create: { playerId: player.id },
      });
      const rechargeMs = normalizedRechargeMinutes(config.purchaseRechargeMinutes) * 60_000;
      const chargeOneAvailable = !quota.chargeOneUsedAt
        || now.getTime() - quota.chargeOneUsedAt.getTime() >= rechargeMs;
      const chargeTwoAvailable = !quota.chargeTwoUsedAt
        || now.getTime() - quota.chargeTwoUsedAt.getTime() >= rechargeMs;
      if (!chargeOneAvailable && !chargeTwoAvailable) {
        const status = purchaseStatusFromQuota(quota, now, config.purchaseRechargeMinutes);
        throw new Error(`Suas duas compras estão recarregando. Próxima disponível às ${new Date(status.rechargeAt[0]).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.`);
      }
      await tx.miauvadaoPurchaseQuota.update({
        where: { playerId: player.id },
        data: chargeOneAvailable ? { chargeOneUsedAt: now } : { chargeTwoUsedAt: now },
      });
      // Só compras em ZC alimentam o cofre (o cofre é em ZC).
      const coinsToVault = currency === "ZC" ? Math.floor(price * 0.25) : 0;
      // Cobrança e extrato fazem parte da mesma transação da entrega.
      if (currency === "ZC") {
        await creditCoins(tx, {
          playerId: player.id,
          type: ZikaCoinTxType.SHOP_PURCHASE,
          amount: -price,
          description: `Miauvadão: compra de ${offer.name}`,
        });
      } else {
        await changeLigaCash(tx, {
          playerId: player.id,
          amount: -price,
          reason: "SHOP_PURCHASE",
          referenceType: "MiauvadaoOffer",
          referenceId: offer.shopItemId ?? offer.itemType,
          spentDelta: price,
          metadata: { offerIndex, name: offer.name },
        });
      }

      // Atualizar sold na oferta + adicionar 25% ao cofre (só ZC) + mensagem NPC
      const updatedOffers = [...offers];
      updatedOffers[offerIndex] = { ...offer, sold: offer.sold + 1 };
      await tx.miauvadaoConfig.update({
        where: { id: "singleton" },
        data: {
          dailyOffers: updatedOffers as unknown as import("@prisma/client").Prisma.InputJsonValue,
          ...(coinsToVault > 0 ? { vaultBalance: { increment: coinsToVault } } : {}),
          lastNpcMessage: currency === "ZC"
            ? `${player.displayName} comprou ${offer.name} e deixou +${coinsToVault} ZC nos fundos! 💰`
            : `${player.displayName} comprou ${offer.name} pagando com LigaCash! 💎`,
          lastNpcMessageAt: new Date(),
        },
      });

      // Entregar item (mesmo esquema da shop)
      await _deliverMiauvadaoItem(tx, player.id, offer);
      await recordPlayerActivity(tx, {
        playerId: player.id,
        actorUserId: user.id,
        category: "BAZAR",
        action: "MIAUVADAO_PURCHASE",
        summary: `Comprou ${offer.name} no Miauvadão por ${price} ${currency}`,
        source: "MIAUVADAO_GLOBAL_SLOT",
        entityType: "shopItem",
        entityId: offer.shopItemId ?? offer.itemType,
        amount: 1,
        unit: "ITEM",
        metadata: { offerIndex, itemType: offer.itemType, shopItemId: offer.shopItemId ?? null, price, currency },
      });
      const updatedQuota = await tx.miauvadaoPurchaseQuota.findUniqueOrThrow({ where: { playerId: player.id } });
      return { purchaseStatus: purchaseStatusFromQuota(updatedQuota, now, config.purchaseRechargeMinutes) };
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
  /** Marca a oferta pessoal (roleta exclusiva do jogador). */
  personal?: boolean;
}

// Entrega 1 unidade do item de uma oferta do Miauvadão ao jogador.
async function _deliverMiauvadaoItem(tx: Prisma.TransactionClient, playerId: string, offer: MiauvadaoOffer) {
  if (offer.itemType.startsWith("EGG_") || ["EGG_COMMON", "EGG_RARE", "EGG_SPECIAL"].includes(offer.itemType)) {
    const eggType = EGG_SHOP_TO_EGG_TYPE[offer.itemType];
    if (!eggType) throw new Error(`Tipo de ovo não suportado pelo Miauvadão: ${offer.itemType}`);
    await tx.mascotEgg.create({ data: { playerId, type: eggType as never, origin: "Miauvadão" } });
  } else if (offer.itemType === "MASCOT_FOOD") {
    await tx.mascotFoodItem.upsert({ where: { playerId_type: { playerId, type: "FOOD" } }, update: { quantity: { increment: 1 } }, create: { playerId, type: "FOOD", quantity: 1 } });
  } else if (offer.itemType === "MASCOT_SWEET") {
    await tx.mascotFoodItem.upsert({ where: { playerId_type: { playerId, type: "SWEET" } }, update: { quantity: { increment: 1 } }, create: { playerId, type: "SWEET", quantity: 1 } });
  } else if (offer.shopItemId) {
    await tx.playerInventory.upsert({ where: { playerId_itemId: { playerId, itemId: offer.shopItemId } }, update: { quantity: { increment: 1 } }, create: { playerId, itemId: offer.shopItemId, quantity: 1, source: "MIAUVADAO" } });
  } else {
    // Nunca cobre uma oferta que o sistema não sabe entregar.
    throw new Error(`Item do Miauvadão sem regra de entrega: ${offer.itemType}`);
  }
}

// ── Slot pessoal do Miauvadão (roleta exclusiva por jogador) ──────────────────
// Cada jogador tem uma oferta própria, determinística por (jogador + rotação),
// que só aparece para ele e não pode ser trocada/resetada por outros. Estoque
// fixo de 2 (independente da quantidade padrão da vitrine geral).
const PERSONAL_SLOT_STOCK = 2;

function _hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function _mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function _computePersonalOffer(playerId: string, vaultBalance: number, excludedItemIds: string[] = []): Promise<MiauvadaoOffer | null> {
  const shopItems = await prisma.shopItem.findMany({
    where: { active: true, type: { in: MIAUVADAO_ELIGIBLE_TYPES as never[] } },
    select: { id: true, name: true, type: true, price: true, imageUrl: true, description: true, rarity: true },
  });
  if (shopItems.length === 0) return null;
  const rotation = getMiauvadaoRotation();
  const rng = _mulberry32(_hashSeed(`${playerId}|${rotation.start.toISOString()}`));
  const excluded = new Set(excludedItemIds);
  const eligible = shopItems.filter((item) => !excluded.has(item.id));
  const sorted = [...(eligible.length > 0 ? eligible : shopItems)].sort((a, b) => a.id.localeCompare(b.id)); // ordem base estável
  const item = sorted[Math.floor(rng() * sorted.length)];
  const [minDisc, maxDisc] = DISCOUNT_BY_RARITY[item.rarity] ?? [10, 25];
  const maxAllowed = isMegaStoneType(item.type) ? MIAUVADAO_MEGA_STONE_MAX_DISCOUNT : MIAUVADAO_MAX_DISCOUNT;
  const vaultBonus = Math.min(14, Math.floor(Math.sqrt(Math.max(0, vaultBalance) / 500) * 3));
  const discountPct = Math.min(maxAllowed, minDisc + Math.floor(rng() * (maxDisc - minDisc + 1)) + vaultBonus);
  const finalPrice = Math.max(1, Math.round(item.price * (1 - discountPct / 100)));
  return {
    shopItemId: item.id, itemType: item.type, name: item.name,
    imageUrl: item.imageUrl ?? undefined, description: item.description ?? undefined,
    originalPrice: item.price, discountPct, finalPrice,
    stock: PERSONAL_SLOT_STOCK, sold: 0, validUntil: rotation.next.toISOString(), personal: true,
  };
}

type PersonalSlotState = {
  personalCycle?: string;
  personalSold?: number;
  personalOffer?: MiauvadaoOffer;
  personalHistory?: string[];
};

function _personalSoldCount(prd: unknown, playerId: string, rotationStartIso: string): number {
  const entry = (prd as Record<string, PersonalSlotState> | null)?.[playerId];
  if (!entry || entry.personalCycle !== rotationStartIso) return 0;
  return Math.max(0, Math.floor(Number(entry.personalSold ?? 0)));
}

function _storedPersonalOffer(prd: unknown, playerId: string, rotationStartIso: string) {
  const entry = (prd as Record<string, PersonalSlotState> | null)?.[playerId];
  return entry?.personalCycle === rotationStartIso && entry.personalOffer ? entry.personalOffer : null;
}

async function _getOrCreatePersonalOffer(playerId: string) {
  const rotation = getMiauvadaoRotation();
  const rotationIso = rotation.start.toISOString();
  const config = await prisma.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const prd = (config.playerRefreshData as Record<string, PersonalSlotState>) ?? {};
  const stored = _storedPersonalOffer(prd, playerId, rotationIso);
  if (stored) return { offer: stored, sold: _personalSoldCount(prd, playerId, rotationIso) };

  const previous = prd[playerId];
  const history = [...new Set([
    ...(previous?.personalOffer?.shopItemId ? [previous.personalOffer.shopItemId] : []),
    ...(previous?.personalHistory ?? []),
  ])].slice(0, 4);
  const offer = await _computePersonalOffer(playerId, config.vaultBalance, history);
  if (!offer) return null;
  const nextEntry: PersonalSlotState = {
    ...previous,
    personalCycle: rotationIso,
    personalSold: 0,
    personalOffer: offer,
    personalHistory: history,
  };
  // Atualiza somente a chave deste jogador. Evita que dois acessos simultâneos
  // sobrescrevam as ofertas pessoais um do outro no JSON compartilhado.
  await prisma.$executeRaw(Prisma.sql`
    UPDATE miauvadao_config
    SET "playerRefreshData" = jsonb_set(
      COALESCE("playerRefreshData", '{}'::jsonb),
      ARRAY[${playerId}],
      ${JSON.stringify(nextEntry)}::jsonb,
      true
    )
    WHERE id = 'singleton'
  `);
  return { offer, sold: 0 };
}

/** Oferta pessoal do jogador logado + quantas ele já comprou nesta rotação. */
export async function getPersonalMiauvadaoOffer(): Promise<{ offer: MiauvadaoOffer; sold: number } | null> {
  const user = await getSessionUser(); if (!user) return null;
  const player = await getSessionPlayer(user.id); if (!player) return null;
  return _getOrCreatePersonalOffer(player.id);
}

/** Compra 1 unidade da oferta pessoal (até o estoque de 2 por rotação). */
export async function buyPersonalMiauvadaoSlot(): Promise<{ error?: string; sold?: number }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id); if (!player) return { error: "Perfil não encontrado." };
    const rotation = getMiauvadaoRotation();
    const rotationIso = rotation.start.toISOString();
    const prepared = await _getOrCreatePersonalOffer(player.id);
    if (!prepared) return { error: "Você não tem oferta pessoal disponível agora." };
    let soldAfter = 0;
    await prisma.$transaction(async (tx) => {
      const config = await tx.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
      const offer = _storedPersonalOffer(config.playerRefreshData, player.id, rotationIso);
      if (!offer) throw new Error("Você não tem oferta pessoal disponível agora.");
      if (new Date() > new Date(offer.validUntil)) throw new Error("Sua oferta pessoal expirou. Recarregue a página.");
      const prd = (config.playerRefreshData as Record<string, PersonalSlotState>) ?? {};
      const already = _personalSoldCount(prd, player.id, rotationIso);
      if (already >= PERSONAL_SLOT_STOCK) throw new Error("Você já esgotou sua oferta pessoal desta rotação.");
      const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < offer.finalPrice) throw new Error(`Saldo insuficiente (${wallet?.balance ?? 0} ZC, oferta custa ${offer.finalPrice} ZC).`);
      const coinsToVault = Math.floor(offer.finalPrice * 0.25);
      await creditCoins(tx, {
        playerId: player.id,
        type: ZikaCoinTxType.SHOP_PURCHASE,
        amount: -offer.finalPrice,
        description: `Miauvadão: oferta exclusiva de ${offer.name}`,
      });
      await _deliverMiauvadaoItem(tx, player.id, offer);
      soldAfter = already + 1;
      const nextEntry = { ...(prd[player.id] ?? {}), personalCycle: rotationIso, personalSold: soldAfter };
      await tx.$executeRaw(Prisma.sql`
        UPDATE miauvadao_config
        SET "playerRefreshData" = jsonb_set(
          COALESCE("playerRefreshData", '{}'::jsonb),
          ARRAY[${player.id}],
          ${JSON.stringify(nextEntry)}::jsonb,
          true
        )
        WHERE id = 'singleton'
      `);
      await tx.miauvadaoConfig.update({
        where: { id: "singleton" },
        data: { vaultBalance: { increment: coinsToVault } },
      });
      await recordPlayerActivity(tx, {
        playerId: player.id,
        actorUserId: user.id,
        category: "BAZAR",
        action: "MIAUVADAO_PERSONAL_PURCHASE",
        summary: `Comprou ${offer.name} no slot exclusivo por ${offer.finalPrice} ZC`,
        source: "MIAUVADAO_PERSONAL_SLOT",
        entityType: "shopItem",
        entityId: offer.shopItemId ?? offer.itemType,
        amount: 1,
        unit: "ITEM",
        metadata: { cycle: rotationIso, itemType: offer.itemType, shopItemId: offer.shopItemId ?? null, price: offer.finalPrice },
      });
    }, { isolationLevel: "Serializable" });
    revalidateTag("miauvadao-config");
    revalidatePath("/bazar");
    return { sold: soldAfter };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro ao comprar." }; }
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
    const current = await prisma.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
    const stockOverrides = stockOverridesFromJson(current.offerStockOverrides);
    for (const offer of offersWithExpiry) {
      stockOverrides[offer.shopItemId ?? offer.itemType] = Math.max(1, Math.floor(offer.stock));
    }
    await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: {
        dailyOffers: offersWithExpiry as unknown as import("@prisma/client").Prisma.InputJsonValue,
        offerStockOverrides: stockOverrides as Prisma.InputJsonValue,
        offersRefreshedAt: new Date(),
      },
    });
    revalidatePath("/bazar");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

// Quantidade padrão (estoque) por TIPO de item que pode aparecer na vitrine do
// Miauvadão. Substitui o 5 fixo: qualquer item sorteado daquele tipo passa a
// entrar com a quantidade definida aqui.
export async function adminGetMiauvadaoStockDefaults(): Promise<Record<string, number>> {
  await requireAdmin();
  const config = await prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" }, select: { offerStockOverrides: true } });
  return stockOverridesFromJson(config?.offerStockOverrides ?? {});
}

export async function adminSetMiauvadaoStockDefaults(defaultsByType: Record<string, number>): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const current = await prisma.miauvadaoConfig.findUniqueOrThrow({ where: { id: "singleton" } });
    const overrides = stockOverridesFromJson(current.offerStockOverrides);
    for (const [type, qty] of Object.entries(defaultsByType)) {
      const n = Math.floor(Number(qty));
      if (!type) continue;
      if (!Number.isFinite(n) || n < 1) { delete overrides[type]; continue; } // vazio/0 = volta ao padrão 5
      overrides[type] = Math.min(999, n);
    }
    await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: { offerStockOverrides: overrides as Prisma.InputJsonValue },
    });
    revalidateTag("miauvadao-config");
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

export async function adminUpdateMiauvadaoPurchaseSettings(rechargeMinutes: number): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: { purchaseRechargeMinutes: normalizedRechargeMinutes(rechargeMinutes) },
    });
    revalidateTag("miauvadao-config");
    revalidatePath("/bazar");
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
      const candidates = await rollMiauvadaoOffers(config.vaultBalance, 0, stockOverridesFromJson(config.offerStockOverrides));
      const existingIds = new Set(offers.map((offer) => offer.shopItemId));
      const anotherMegaStoneExists = offers.some((offer, index) => index !== offerIndex && isMegaStoneType(offer.itemType));
      const eligibleCandidates = candidates.filter((offer) => !anotherMegaStoneExists || !isMegaStoneType(offer.itemType));
      const replacement = eligibleCandidates.find((offer) => !existingIds.has(offer.shopItemId)) ?? eligibleCandidates[0];
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
    const newOffers = await rollMiauvadaoOffers(config.vaultBalance, 10, stockOverridesFromJson(config.offerStockOverrides));
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

async function creditMiauvadaoVaultFromPlayerTransaction(tx: TxClient, transactionCoins: number) {
  const generatedCoins = Math.floor(transactionCoins * PLAYER_TRANSACTION_VAULT_SHARE);
  if (generatedCoins < 1) return;

  await tx.miauvadaoConfig.upsert({
    where: { id: "singleton" },
    update: { vaultBalance: { increment: generatedCoins } },
    create: { id: "singleton", vaultBalance: generatedCoins },
  });
}

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
    primordialBoundPlayerId: string | null;
    arenaState: string;
    restingUntil: Date | null;
  },
  playerId: string,
  displayName?: string,
) {
  const name = displayName ?? mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const now = new Date();

  if (mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.primordialBoundPlayerId) {
    throw new Error(`${name} foi vinculado permanentemente à conta que utilizou a Pena Arco-Íris Primordial e não pode ser negociado.`);
  }
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
      // Ovo escolhido exatamente (tipo + bônus de raridade), igual ao anúncio.
      const bonusPct = typeof item.eggBonusPct === "number" ? item.eggBonusPct : null;
      const eggs = await tx.mascotEgg.findMany({
        where: {
          playerId,
          type: item.type as never,
          incubation: null,
          NOT: { origin: { startsWith: "bazar:" } },
          ...(bonusPct !== null ? { hatchRarityBonusPct: bonusPct } : {}),
        },
        select: { id: true, hatchRarityBonusPct: true },
        orderBy: { hatchRarityBonusPct: "desc" },
        take: quantity,
      });
      if (eggs.length < quantity) {
        throw new Error(`Você não tem ${normalized.displayName} suficiente para esta proposta.`);
      }
      const eggIds = eggs.map((egg) => egg.id);
      const escrowBonus = bonusPct !== null ? bonusPct : eggs[0]?.hatchRarityBonusPct ?? 0;
      await tx.mascotEgg.updateMany({
        where: { id: { in: eggIds }, playerId },
        data: { origin: `bazar-proposal:${playerId}` },
      });
      reserved.push({
        ...normalized,
        escrowed: true,
        escrowed_egg_ids: eggIds,
        eggBonusPct: escrowBonus,
        displayName: eggDisplayName(item.type, escrowBonus),
      });
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

async function _creditEscrowedCoins(tx: TxClient, playerId: string, amount: number, feedVault = true) {
  if (amount <= 0) return;
  await tx.zikaCoinWallet.upsert({
    where: { playerId },
    update: { balance: { increment: amount }, totalEarned: { increment: amount } },
    create: { playerId, balance: amount, totalEarned: amount },
  });
  // Empréstimos de mesa direta não geram o faucet de 10%: o dinheiro vai e volta,
  // então não deve cunhar ZC no cofre a cada entrega.
  if (feedVault) await creditMiauvadaoVaultFromPlayerTransaction(tx, amount);
}

/** Entrega uma oferta que já foi reservada, sem descontá-la novamente. */
async function _deliverProposalOffers(tx: TxClient, items: ProposalOfferItem[], fromPlayerId: string, toPlayerId: string) {
  for (const item of items) {
    const quantity = item.mascotId ? 1 : Math.max(1, Math.floor(Number(item.quantity) || 1));
    if (item.mascotId) {
      const mascot = await tx.mascot.findUnique({ where: { id: item.mascotId } });
      if (!mascot || mascot.playerId !== fromPlayerId || !mascot.bazarListed) throw new Error(`${item.displayName} não está mais reservado.`);
      if (mascot.primordialBoundPlayerId) throw new Error("Mascote vinculado pela Pena Arco-Íris Primordial não pode ser transferido.");
      await tx.mascot.update({ where: { id: mascot.id }, data: { playerId: toPlayerId, bazarListed: false, isEquipped: false } });
      await registerPokemonDiscovery({ playerId: toPlayerId, pokemonId: mascot.pokemonId, source: "bazar-direct-negotiation" }, tx);
      continue;
    }
    if (item.type === "FOOD" || item.type === "SWEET") {
      await tx.mascotFoodItem.upsert({ where: { playerId_type: { playerId: toPlayerId, type: item.type as "FOOD" | "SWEET" } }, update: { quantity: { increment: quantity } }, create: { playerId: toPlayerId, type: item.type as "FOOD" | "SWEET", quantity } });
      continue;
    }
    if (isEggOfferType(item.type)) {
      const eggIds = [...new Set(item.escrowed_egg_ids ?? [])];
      if (eggIds.length !== quantity) throw new Error(`A reserva de ${item.displayName} está inconsistente.`);
      const moved = await tx.mascotEgg.updateMany({ where: { id: { in: eggIds }, playerId: fromPlayerId, origin: { startsWith: "bazar-proposal:" } }, data: { playerId: toPlayerId, origin: "Negociação direta do Bazar" } });
      if (moved.count !== quantity) throw new Error(`Não foi possível entregar ${item.displayName}.`);
      continue;
    }
    if (!item.shopItemId) throw new Error(`A reserva de ${item.displayName} não foi encontrada.`);
    await tx.playerInventory.upsert({ where: { playerId_itemId: { playerId: toPlayerId, itemId: item.shopItemId } }, update: { quantity: { increment: quantity } }, create: { playerId: toPlayerId, itemId: item.shopItemId, quantity } });
  }
}

async function _refundProposalCoins(
  tx: TxClient,
  proposal: { proposerId: string; coinsOffer: number; coinsEscrowed: boolean; ligaCashOffer?: number; ligaCashEscrowed?: boolean; id?: string },
) {
  if (proposal.coinsEscrowed && proposal.coinsOffer > 0) {
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
  // Devolve LigaCash reservada (escrow) na proposta.
  if (proposal.ligaCashEscrowed && (proposal.ligaCashOffer ?? 0) > 0) {
    await changeLigaCash(tx, {
      playerId: proposal.proposerId,
      amount: proposal.ligaCashOffer as number,
      reason: "BAZAR_ESCROW_RELEASE",
      referenceType: "BazarProposal",
      referenceId: proposal.id,
    });
  }
}

async function _releaseProposalEscrow(
  tx: TxClient,
  proposal: {
    id?: string;
    proposerId: string;
    coinsOffer: number;
    coinsEscrowed: boolean;
    ligaCashOffer?: number;
    ligaCashEscrowed?: boolean;
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
    const mascot = await tx.mascot.findUnique({
      where: { id: mascotId },
      select: { primordialBoundPlayerId: true },
    });
    if (!mascot) throw new Error("Mascote anunciado não foi encontrado.");
    if (mascot.primordialBoundPlayerId) {
      throw new Error("Mascote vinculado pela Pena Arco-Íris Primordial não pode ser transferido.");
    }
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

  // Mesa de negociação direta não tem ativo escrowado no próprio anúncio (as
  // ofertas dos dois lados são liberadas à parte, pela proposta/estado direto).
  // Além disso o payload usa quantity:0, que faria getListingQuantity lançar e
  // reverter silenciosamente o cancelamento. Nada a devolver aqui.
  if (payload?.directNegotiation === true || payload?.itemType === "DIRECT_NEGOTIATION") return;

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
  eggBonusPct?: number;
  quantity?: number;
  displayName?: string;
  premium?: boolean; // leilão em destaque na vitrine premium do Miauvadão
  currency?: "ZC" | "LC"; // moeda única do leilão (todos os lances nela)
}

export async function createAuctionListing(input: CreateAuctionInput): Promise<{ error?: string; id?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    await prepareBazarMascotAvailability(player.id);

    if (!input.minBidCoins || input.minBidCoins < 1) return { error: "Lance mínimo inválido." };
    const auctionCurrency: "ZC" | "LC" = input.currency === "LC" ? "LC" : "ZC";
    if (auctionCurrency === "LC") {
      const economy = await prisma.economySettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
      if (!economy.allowLcAuctions) return { error: "Leilões em LigaCash estão desativados." };
    }

    const MAX_ACTIVE_LISTINGS = 8;
    const activeCount = await prisma.bazarListing.count({
      where: { playerId: player.id, status: { in: ["ACTIVE", "RESERVED"] } },
    });
    if (activeCount >= MAX_ACTIVE_LISTINGS) {
      return { error: `Você já possui ${MAX_ACTIVE_LISTINGS} anúncios ativos.` };
    }

    const config = await getMiauvadaoConfig();
    const premium = Boolean(input.premium);
    const fee = premium ? PREMIUM_LISTING_FEE : config.listingFee;
    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < fee) {
      return { error: `Saldo insuficiente para a taxa de anúncio (${fee} ZC).` };
    }

    const durationMs = input.auctionDuration === "12h" ? 12 * 3600_000 : 24 * 3600_000;
    const auctionEndsAt = new Date(Date.now() + durationMs);
    const premiumUntil = premium ? new Date(Date.now() + PREMIUM_LISTING_HOURS * 3_600_000) : null;

    let payload: Record<string, unknown> = {};

    await prisma.$transaction(async (tx) => {
      if (premium) {
        await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext('bazar-premium-listings'))`;
        const premiumWhere = { status: { in: ["ACTIVE", "RESERVED"] as BazarListingStatus[] }, premiumUntil: { gt: new Date() } };
        const [globalPremiumCount, ownPremiumCount] = await Promise.all([
          tx.bazarListing.count({ where: premiumWhere }),
          tx.bazarListing.count({ where: { ...premiumWhere, playerId: player.id } }),
        ]);
        if (ownPremiumCount > 0) throw new Error("Você já possui um anúncio premium ativo. Aguarde o destaque terminar ou encerre o anúncio atual.");
        if (globalPremiumCount >= MAX_ACTIVE_PREMIUM_LISTINGS) throw new Error("As 6 vitrines premium do Miauvadão estão ocupadas no momento. Tente novamente mais tarde.");
      }
      await tx.zikaCoinWallet.update({ where: { playerId: player.id }, data: { balance: { decrement: fee } } });
      await tx.miauvadaoConfig.update({ where: { id: "singleton" }, data: { vaultBalance: { increment: fee } } });

      if (input.category === "MASCOT" && input.mascotId) {
        const mascot = await tx.mascot.findUnique({ where: { id: input.mascotId } });
        if (!mascot) throw new Error("Mascote não encontrado.");
        await assertMascotTradeableInBazar(tx, mascot, player.id);
        await tx.mascot.update({ where: { id: input.mascotId }, data: { bazarListed: true } });
        payload = {
          mascotId: mascot.id, pokemonId: mascot.pokemonId,
          pokemonName: mascot.speciesNameOverride || getPokemonName(mascot.pokemonId), nickname: mascot.nickname,
          primaryTypeOverride: mascot.primaryTypeOverride,
          secondaryTypeOverride: mascot.secondaryTypeOverride,
          staticSpriteUrlOverride: mascot.staticSpriteUrlOverride,
          animatedSpriteUrlOverride: mascot.animatedSpriteUrlOverride,
          level: mascot.level, personality: mascot.personality, isShiny: mascot.isShiny,
          stats: { force: mascot.statForce, agility: mascot.statAgility, charisma: mascot.statCharisma, instinct: mascot.statInstinct, vitality: mascot.statVitality },
          battleWins: mascot.battleWins,
          hatchedFromEggType: mascot.hatchedFromEggType,
          hatchedFromEggOrigin: mascot.hatchedFromEggOrigin,
          ...(mascot.analyzedAt ? { ivRating: mascot.ivRating, ivScore: mascot.ivScore, performanceTag: mascot.performanceTag } : {}),
        };
      } else if (input.category === "ITEM") {
        const qty = input.quantity ?? 1;
        if (!input.itemType) throw new Error("Tipo de item não especificado.");
        if (HIDDEN_BAZAR_ITEM_TYPES.has(input.itemType)) throw new Error("Este item não pode ser leiloado.");
        let canonicalDisplayName = canonicalBazarItemName(input.itemType);
        if (input.itemType === "FOOD" || input.itemType === "SWEET") {
          const food = await tx.mascotFoodItem.findUnique({ where: { playerId_type: { playerId: player.id, type: input.itemType as "FOOD" | "SWEET" } } });
          if (!food || food.quantity < qty) throw new Error("Itens insuficientes.");
          await tx.mascotFoodItem.update({ where: { playerId_type: { playerId: player.id, type: input.itemType as "FOOD" | "SWEET" } }, data: { quantity: { decrement: qty } } });
        } else if (isEggOfferType(input.itemType)) {
          const bonusPct = typeof input.eggBonusPct === "number" ? input.eggBonusPct : null;
          const eggs = await tx.mascotEgg.findMany({
            where: { playerId: player.id, type: input.itemType as never, incubation: null, NOT: { origin: { startsWith: "bazar:" } }, ...(bonusPct !== null ? { hatchRarityBonusPct: bonusPct } : {}) },
            orderBy: { hatchRarityBonusPct: "desc" },
          });
          if (eggs.length < qty) throw new Error("Ovos insuficientes para o ovo escolhido.");
          const escrowedEggs = eggs.slice(0, qty);
          const escrowBonus = bonusPct !== null ? bonusPct : escrowedEggs[0]?.hatchRarityBonusPct ?? 0;
          await tx.mascotEgg.updateMany({ where: { id: { in: escrowedEggs.map(e => e.id) } }, data: { origin: `bazar:${player.id}` } });
          payload = { ...payload, escrowed_egg_ids: escrowedEggs.map(e => e.id), eggType: input.itemType, eggBonusPct: escrowBonus };
          canonicalDisplayName = eggDisplayName(input.itemType, escrowBonus);
        } else {
          const inv = input.shopItemId
            ? await tx.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: input.shopItemId } }, include: { item: { select: { id: true, name: true, type: true, imageUrl: true } } } })
            : await tx.playerInventory.findFirst({ where: { playerId: player.id, item: { type: input.itemType as never }, quantity: { gt: 0 } }, include: { item: { select: { id: true, name: true, type: true, imageUrl: true } } } });
          if (!inv || inv.quantity < qty) throw new Error("Itens insuficientes no inventário.");
          if (inv.itemId === ADMIN_LAB_RAINBOW_FEATHER_ID) throw new Error("Este item administrativo não pode ser leiloado.");
          await tx.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: qty } } });
          payload = { ...payload, shopItemId: inv.itemId, imageUrl: sanitizePayloadImageUrl(inv.item.imageUrl ?? input.imageUrl) };
          canonicalDisplayName = inv.item.name;
        }
        payload = { ...payload, itemType: input.itemType, quantity: qty, displayName: canonicalDisplayName };
      }

      await tx.bazarListing.create({
        data: {
          playerId: player.id, category: input.category,
          listingType: "AUCTION", payload: payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
          priceCoins: null, description: input.description,
          feeCharged: fee, expiresAt: auctionEndsAt,
          minBidCoins: input.minBidCoins, auctionEndsAt, auctionCurrency,
          premiumUntil,
        },
      });
    });

    if (premium) {
      await publishDuePremiumBazarTicker().catch((error) => console.error("[Bazar Premium] Falha no chamariz inicial do leilão", error));
    }

    if (input.category === "MASCOT") {
      const mascotName = fullMascotPayloadName(payload);
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

      const currency: "ZC" | "LC" = listing.auctionCurrency === "LC" ? "LC" : "ZC";
      const endsAt = listing.auctionEndsAt ?? listing.expiresAt;
      if (new Date() >= endsAt) throw new Error("Este leilão já encerrou.");
      // Incremento mínimo por moeda: ZC sobe de 100 em 100; LC (≈10× o valor) de 10 em 10.
      const bidStep = currency === "LC" ? 10 : 100;
      const minBid = listing.currentBidCoins ? listing.currentBidCoins + bidStep : (listing.minBidCoins ?? 1);
      if (amount < minBid) throw new Error(`Lance mínimo é ${minBid} ${currency}.`);
      if (listing.currentBidPlayerId === player.id) throw new Error("Você já é o maior lance.");

      const prevBidderId = listing.currentBidPlayerId;
      const prevBidAmount = listing.currentBidCoins ?? 0;
      const msLeft = endsAt.getTime() - Date.now();
      const newEndsAt = msLeft < 5 * 60_000 ? new Date(endsAt.getTime() + 30 * 60_000) : endsAt;

      // Débito do lance (escrow). Estamos sob advisory lock por listing, então a
      // checagem de saldo não-atômica da LC é segura aqui.
      if (currency === "ZC") {
        const debit = await tx.zikaCoinWallet.updateMany({
          where: { playerId: player.id, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });
        if (debit.count !== 1) {
          const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } });
          throw new Error(`Saldo insuficiente (${wallet?.balance ?? 0} ZC disponíveis).`);
        }
      } else {
        const lcWallet = await tx.ligaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } });
        if (!lcWallet || lcWallet.balance < amount) throw new Error(`Saldo de LigaCash insuficiente (${lcWallet?.balance ?? 0} LC disponíveis).`);
        await changeLigaCash(tx, { playerId: player.id, amount: -amount, reason: "BAZAR_ESCROW", referenceType: "BazarListing", referenceId: listingId });
      }

      // Devolve o lance ao licitante anterior
      if (prevBidderId && prevBidAmount > 0) {
        if (currency === "ZC") {
          await tx.zikaCoinWallet.upsert({
            where: { playerId: prevBidderId },
            update: { balance: { increment: prevBidAmount } },
            create: { playerId: prevBidderId, balance: prevBidAmount, totalEarned: prevBidAmount },
          });
        } else {
          await changeLigaCash(tx, { playerId: prevBidderId, amount: prevBidAmount, reason: "BAZAR_ESCROW_RELEASE", referenceType: "BazarListing", referenceId: listingId });
        }
      }

      // Registra o lance
      await tx.bazarAuctionBid.create({ data: { listingId, playerId: player.id, amount } });

      // Atualiza listing
      await tx.bazarListing.update({
        where: { id: listingId },
        data: { currentBidCoins: amount, currentBidPlayerId: player.id, auctionEndsAt: newEndsAt, expiresAt: newEndsAt },
      });
      return { listing, prevBidderId, prevBidAmount, currency };
    });

    // Notifica o licitante anterior por mensagem privada
    if (bid.prevBidderId && bid.prevBidderId !== player.id) {
      const cur = bid.currency;
      const desc = bid.listing.category === "MASCOT"
        ? fullMascotPayloadName(bid.listing.payload as Record<string, unknown>)
        : `${(bid.listing.payload as Record<string, unknown>).displayName}`;
      await _sendBazarSystemDM(bid.prevBidderId, `Seu lance de ${bid.prevBidAmount} ${cur} no leilão de "${desc}" foi superado por um lance de ${amount} ${cur}. Os seus ${cur} foram devolvidos à carteira.`);
      await createPlayerNotification(prisma, {
        playerId: bid.prevBidderId,
        category: "BAZAR",
        type: "AUCTION_OUTBID",
        title: `Lance superado: ${desc}`,
        body: `Seu lance de ${bid.prevBidAmount.toLocaleString("pt-BR")} ${cur} foi superado por ${amount.toLocaleString("pt-BR")} ${cur}. O valor foi devolvido.`,
        href: `/bazar/${listingId}`,
        entityId: listingId,
        eventKey: `bazar:auction:outbid:${listingId}:${bid.prevBidderId}:${amount}`,
      });
      after(() => sendNotificationToPlayers([bid.prevBidderId!], {
        title: `Lance superado: ${desc}`,
        body: `Seu lance foi coberto por ${amount.toLocaleString("pt-BR")} ${cur}. O valor anterior foi devolvido.`,
        url: `/bazar/${listingId}`,
      }));
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
    const currency: "ZC" | "LC" = listing.auctionCurrency === "LC" ? "LC" : "ZC";

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
      }, { maxWait: 10_000, timeout: 20_000 });
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
      ? `${fullMascotPayloadName(listing.payload as Record<string, unknown>)} Nv.${(listing.payload as Record<string, unknown>).level} leiloado por ${winnerBid} ${currency}`
      : `${(listing.payload as Record<string, unknown>).displayName} leiloado por ${winnerBid} ${currency}`;

    const claimed = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listingId}))`;
      const update = await tx.bazarListing.updateMany({
        where: { id: listingId, status: "ACTIVE" },
        data: { status: "SOLD" },
      });
      if (update.count !== 1) return false;

      // Transfere o valor (já debitado do vencedor ao dar lance) ao vendedor.
      if (currency === "ZC") {
        await tx.zikaCoinWallet.upsert({
          where: { playerId: listing.playerId },
          update: { balance: { increment: winnerBid } },
          create: { playerId: listing.playerId, balance: winnerBid, totalEarned: winnerBid },
        });
        await creditMiauvadaoVaultFromPlayerTransaction(tx, winnerBid);
      } else {
        await changeLigaCash(tx, { playerId: listing.playerId, amount: winnerBid, reason: "BAZAR_SALE", referenceType: "BazarListing", referenceId: listingId });
      }

      // Transfere item ao vencedor
      await _transferItem(tx, listing, winnerId);

      await tx.bazarTransaction.create({
        data: {
          listingId, sellerId: listing.playerId, buyerId: winnerId,
          sellerName, buyerName, description: payloadDesc,
          coinsAmount: currency === "ZC" ? winnerBid : 0, category: listing.category,
        },
      });
      const activityMetadata = { listingId, category: listing.category, payload: listing.payload } as import("@prisma/client").Prisma.InputJsonValue;
      await Promise.all([
        recordPlayerActivity(tx, {
          playerId: winnerId, category: "BAZAR", action: "BAZAR_AUCTION_WON",
          summary: `Venceu leilão de ${sellerName}: ${payloadDesc}`, source: "AUCTION", entityType: "bazarListing", entityId: listingId,
          amount: -winnerBid, unit: currency, metadata: activityMetadata,
        }),
        recordPlayerActivity(tx, {
          playerId: listing.playerId, category: "BAZAR", action: "BAZAR_AUCTION_SOLD",
          summary: `Leilão vencido por ${buyerName}: ${payloadDesc}`, source: "AUCTION", entityType: "bazarListing", entityId: listingId,
          amount: winnerBid, unit: currency, metadata: activityMetadata,
        }),
      ]);
      await Promise.all([
        createPlayerNotification(tx, {
          playerId: winnerId,
          category: "BAZAR",
          type: "AUCTION_WON",
          title: `Leilão vencido: ${listingDisplayName(listing)}`,
          body: `Você venceu com ${winnerBid.toLocaleString("pt-BR")} ${currency}; o item já foi entregue.`,
          href: `/bazar/${listingId}`,
          entityId: listingId,
          eventKey: `bazar:auction:won:${listingId}`,
        }),
        createPlayerNotification(tx, {
          playerId: listing.playerId,
          category: "BAZAR",
          type: "AUCTION_SOLD",
          title: `Leilão encerrado: ${listingDisplayName(listing)}`,
          body: `${buyerName} venceu por ${winnerBid.toLocaleString("pt-BR")} ${currency}.`,
          href: `/bazar/${listingId}`,
          entityId: listingId,
          eventKey: `bazar:auction:sold:${listingId}`,
        }),
      ]);
      return true;
    }, { maxWait: 10_000, timeout: 20_000 });
    if (!claimed) return { finalized: false };

    revalidateBazar();
    if (listing.player.userId) revalidateTag(`nav-${listing.player.userId}`);
    if (winner.userId) revalidateTag(`nav-${winner.userId}`);

    // Notifica o vencedor
    const wonPayload = listing.payload as Record<string, unknown>;
    const wonName = listing.category === "MASCOT" ? fullMascotPayloadName(wonPayload) : String(wonPayload.displayName ?? "Item");
    await _sendBazarSystemDM(winnerId, `Parabéns! Você venceu o leilão de "${wonName}" com ${winnerBid} ${currency}. O item foi transferido para você.`);
    after(() => Promise.allSettled([
      sendNotificationToPlayers([winnerId], { title: `Leilão vencido: ${wonName}`, body: `Você venceu com ${winnerBid.toLocaleString("pt-BR")} ${currency} e o item já foi entregue.`, url: `/bazar/${listingId}` }),
      sendNotificationToPlayers([listing.playerId], { title: `Leilão vendido: ${wonName}`, body: `${buyerName} venceu por ${winnerBid.toLocaleString("pt-BR")} ${currency}.`, url: `/bazar/${listingId}` }),
    ]).then(() => undefined));

    return { finalized: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao finalizar leilão." };
  }
}

/**
 * Encerra leilões vencidos sem depender de alguém manter a página do anúncio
 * aberta. O processamento é limitado por execução para preservar o banco no
 * ambiente serverless; o cron seguinte continua de onde esta rodada parou.
 */
export async function finalizeExpiredAuctions(limit = 25) {
  const now = new Date();
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const listings = await prisma.bazarListing.findMany({
    where: {
      listingType: "AUCTION",
      status: "ACTIVE",
      OR: [
        { auctionEndsAt: { lte: now } },
        { auctionEndsAt: null, expiresAt: { lte: now } },
      ],
    },
    orderBy: { expiresAt: "asc" },
    take: safeLimit,
    select: { id: true },
  });

  let finalized = 0;
  const errors: Array<{ listingId: string; error: string }> = [];
  for (const listing of listings) {
    const result = await finalizeAuction(listing.id);
    if (result.finalized) finalized += 1;
    else if (result.error) errors.push({ listingId: listing.id, error: result.error });
  }

  return { checked: listings.length, finalized, errors };
}

/**
 * Expira anúncios de venda (não-leilão) cujo prazo passou: marca como EXPIRED,
 * devolve o item ao anunciante, rejeita/estorna propostas pendentes e avisa o
 * vendedor (notificação + DM). Sem isso, o anúncio ficava "0 dias" preso como
 * ativo e o item nunca voltava. Roda no mesmo cron dos leilões.
 */
export async function finalizeExpiredListings(limit = 25) {
  const now = new Date();
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const listings = await prisma.bazarListing.findMany({
    where: {
      listingType: { not: "AUCTION" },
      status: { in: ["ACTIVE", "RESERVED"] },
      expiresAt: { lte: now },
    },
    orderBy: { expiresAt: "asc" },
    take: safeLimit,
    include: { player: { select: { id: true, displayName: true, userId: true } } },
  });

  let expired = 0;
  const errors: Array<{ listingId: string; error: string }> = [];
  const userIdsToRevalidate = new Set<string>();

  for (const listing of listings) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listing.id}))`;
        const update = await tx.bazarListing.updateMany({
          where: { id: listing.id, status: { in: ["ACTIVE", "RESERVED"] }, expiresAt: { lte: now } },
          data: { status: "EXPIRED" },
        });
        if (update.count !== 1) return { changed: false, proposerUserIds: [] as string[] };

        // Devolve o item ao anunciante
        await _returnEscrow(tx, listing, listing.playerId);

        // Rejeita propostas pendentes e estorna seus escrows
        const pendingProposals = await tx.bazarProposal.findMany({
          where: { listingId: listing.id, status: { in: ["PENDING", "ACCEPTED"] } },
          select: { id: true, proposerId: true, coinsOffer: true, coinsEscrowed: true, ligaCashOffer: true, ligaCashEscrowed: true, itemsOffer: true, message: true, proposer: { select: { userId: true } } },
        });
        for (const proposal of pendingProposals) {
          await _releaseProposalEscrow(tx, proposal);
          const direct = parseDirectState(proposal.message);
          if (direct) {
            await _releaseProposalOffers(tx, direct.ownerItems, listing.playerId);
            if (direct.ownerCoinsEscrowed && direct.ownerCoins > 0) {
              await tx.zikaCoinWallet.upsert({ where: { playerId: listing.playerId }, update: { balance: { increment: direct.ownerCoins } }, create: { playerId: listing.playerId, balance: direct.ownerCoins, totalEarned: 0 } });
            }
          }
        }
        await tx.bazarProposal.updateMany({
          where: { listingId: listing.id, status: { in: ["PENDING", "ACCEPTED"] } },
          data: { status: "REJECTED" },
        });

        // Notifica o vendedor (sino)
        await createPlayerNotification(tx, {
          playerId: listing.playerId,
          category: "BAZAR",
          type: "LISTING_EXPIRED",
          title: `Anúncio expirado: ${listingDisplayName(listing)}`,
          body: "Seu anúncio expirou sem venda e o item voltou para o seu inventário.",
          href: "/bazar",
          entityId: listing.id,
          eventKey: `bazar:listing:expired:${listing.id}`,
        });

        return { changed: true, proposerUserIds: pendingProposals.map((proposal) => proposal.proposer.userId) };
      }, { maxWait: 10_000, timeout: 20_000 });

      if (!result.changed) continue;
      expired += 1;

      // DM ao vendedor
      await _sendBazarSystemDM(
        listing.playerId,
        `Seu anúncio de "${listingDisplayName(listing)}" expirou sem venda. O item foi devolvido ao seu inventário.`,
      );

      if (listing.player.userId) userIdsToRevalidate.add(listing.player.userId);
      for (const proposerUserId of result.proposerUserIds) if (proposerUserId) userIdsToRevalidate.add(proposerUserId);
    } catch (err) {
      errors.push({ listingId: listing.id, error: err instanceof Error ? err.message : "Erro" });
    }
  }

  if (expired > 0) revalidateBazar();
  for (const userId of userIdsToRevalidate) revalidateTag(`nav-${userId}`);
  return { checked: listings.length, expired, errors };
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
