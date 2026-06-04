"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { getPokemonName } from "@/lib/mascot-data";
import type { BazarItemCategory, BazarListingType, BazarListingStatus } from "@prisma/client";

function revalidateBazar() {
  revalidatePath("/bazar");
  revalidatePath("/bazar/meu-bazar");
}

// ── Catálogo de itens que o Miauvadão pode oferecer automaticamente ───────────
const MIAUVADAO_CATALOG = [
  { itemType: "EGG_COMMON",      name: "Ovo Comum",          basePrice: 1200,  discountRange: [15, 30] as [number,number] },
  { itemType: "EGG_RARE",        name: "Ovo Raro",           basePrice: 2800,  discountRange: [15, 35] as [number,number] },
  { itemType: "EGG_SPECIAL",     name: "Ovo Especial",       basePrice: 5000,  discountRange: [10, 25] as [number,number] },
  { itemType: "EGG_GEN1",        name: "Ovo Gen 1",          basePrice: 1800,  discountRange: [15, 30] as [number,number] },
  { itemType: "EGG_GEN2",        name: "Ovo Gen 2",          basePrice: 1800,  discountRange: [15, 30] as [number,number] },
  { itemType: "EGG_GEN3",        name: "Ovo Gen 3",          basePrice: 2000,  discountRange: [15, 30] as [number,number] },
  { itemType: "EGG_GEN4",        name: "Ovo Gen 4",          basePrice: 2000,  discountRange: [15, 30] as [number,number] },
  { itemType: "EGG_GEN5",        name: "Ovo Gen 5",          basePrice: 2000,  discountRange: [15, 30] as [number,number] },
  { itemType: "EGG_GEN6",        name: "Ovo Gen 6",          basePrice: 2200,  discountRange: [15, 30] as [number,number] },
  { itemType: "EGG_GEN7",        name: "Ovo Gen 7",          basePrice: 2200,  discountRange: [15, 30] as [number,number] },
  { itemType: "EGG_GEN8",        name: "Ovo Gen 8",          basePrice: 2200,  discountRange: [15, 30] as [number,number] },
  { itemType: "EGG_GEN9",        name: "Ovo Gen 9",          basePrice: 2200,  discountRange: [15, 30] as [number,number] },
  { itemType: "MASCOT_FOOD",     name: "Comida de Mascote",  basePrice: 120,   discountRange: [20, 40] as [number,number] },
  { itemType: "MASCOT_SWEET",    name: "Doce de Mascote",    basePrice: 350,   discountRange: [20, 40] as [number,number] },
  { itemType: "MASCOT_BUFF_EXP", name: "Vitamina Elétrica",  basePrice: 500,   discountRange: [10, 25] as [number,number] },
  { itemType: "MASCOT_BUFF_STAT",name: "Proteína Zika",      basePrice: 800,   discountRange: [10, 25] as [number,number] },
  { itemType: "MASCOT_BUFF_HAPPY",name:"Bala de Mel",        basePrice: 400,   discountRange: [15, 30] as [number,number] },
  { itemType: "MASCOT_BUFF_LUCK",name: "Amuleto da Sorte",   basePrice: 600,   discountRange: [10, 25] as [number,number] },
  { itemType: "MASCOT_BUFF_MOOD",name: "Água Sagrada",       basePrice: 350,   discountRange: [15, 35] as [number,number] },
];

function rollMiauvadaoOffers(vaultBalance: number): MiauvadaoOffer[] {
  // Quanto maior o cofre, maiores os descontos (até 50% extras com cofre cheio)
  const vaultBonus = Math.min(20, Math.floor(vaultBalance / 500)); // +1% por 500 ZC, máx +20%

  // Escolhe 3 itens aleatórios sem repetição
  const shuffled = [...MIAUVADAO_CATALOG].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, 3);
  const validUntil = new Date(Date.now() + 24 * 3600_000).toISOString();

  return chosen.map(item => {
    const [minDisc, maxDisc] = item.discountRange;
    const discountPct = minDisc + Math.floor(Math.random() * (maxDisc - minDisc + 1)) + vaultBonus;
    const finalPrice = Math.max(1, Math.round(item.basePrice * (1 - discountPct / 100)));
    return {
      itemType:      item.itemType,
      name:          item.name,
      originalPrice: item.basePrice,
      discountPct,
      finalPrice,
      stock:         5,
      sold:          0,
      validUntil,
    };
  });
}

/** Checa se as ofertas expiraram e gera novas automaticamente */
export async function autoRefreshMiauvadaoIfNeeded(): Promise<void> {
  try {
    const config = await prisma.miauvadaoConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });

    const offers = (config.dailyOffers as unknown as MiauvadaoOffer[]) ?? [];
    const firstOffer = offers[0];
    const expired = !firstOffer || new Date() > new Date(firstOffer.validUntil);

    if (expired) {
      const newOffers = rollMiauvadaoOffers(config.vaultBalance);
      await prisma.miauvadaoConfig.update({
        where: { id: "singleton" },
        data: { dailyOffers: newOffers as unknown as import("@prisma/client").Prisma.InputJsonValue, offersRefreshedAt: new Date() },
      });
    }
  } catch {
    // silencioso — não bloqueia o render da página
  }
}

// ── Buscar listagens ──────────────────────────────────────────────────────────

export async function getListings(filters?: {
  category?: BazarItemCategory;
  type?: BazarListingType;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: "newest" | "cheapest" | "expensive";
}) {
  const where = {
    status: "ACTIVE" as BazarListingStatus,
    expiresAt: { gt: new Date() },
    ...(filters?.category ? { category: filters.category } : {}),
    ...(filters?.type ? { listingType: filters.type } : {}),
    ...(filters?.minPrice !== undefined ? { priceCoins: { gte: filters.minPrice } } : {}),
    ...(filters?.maxPrice !== undefined ? { priceCoins: { lte: filters.maxPrice } } : {}),
  };

  const orderBy =
    filters?.sortBy === "cheapest" ? { priceCoins: "asc" as const } :
    filters?.sortBy === "expensive" ? { priceCoins: "desc" as const } :
    { createdAt: "desc" as const };

  return prisma.bazarListing.findMany({
    where,
    orderBy,
    include: {
      player: { select: { id: true, displayName: true, avatarUrl: true } },
      _count: { select: { proposals: true, favorites: true } },
    },
    take: 50,
  });
}

export async function getListing(id: string) {
  const listing = await prisma.bazarListing.findUnique({
    where: { id },
    include: {
      player: { select: { id: true, displayName: true, avatarUrl: true } },
      proposals: {
        include: {
          proposer: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { favorites: true } },
    },
  });
  if (listing) {
    // Incrementa views (fire & forget)
    prisma.bazarListing.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});
  }
  return listing;
}

export async function getRecentTransactions(take = 15) {
  return prisma.bazarTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getMiauvadaoConfig() {
  return prisma.miauvadaoConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

// ── Criar anúncio ─────────────────────────────────────────────────────────────

export interface CreateListingInput {
  category: BazarItemCategory;
  listingType: BazarListingType;
  priceCoins?: number;
  wantedDesc?: string;
  description?: string;
  durationDays: 7 | 14 | 30;
  // Mascot
  mascotId?: string;
  // Item
  itemType?: string;
  quantity?: number;
  displayName?: string;
}

export async function createListing(input: CreateListingInput): Promise<{ error?: string; id?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil não encontrado." };

    // Validação básica
    if (input.listingType !== "TRADE" && (!input.priceCoins || input.priceCoins < 1)) {
      return { error: "Defina um preço válido em ZikaCoins." };
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
        if (!mascot || mascot.playerId !== player.id) throw new Error("Mascote não encontrado.");
        if (mascot.bazarListed) throw new Error("Mascote já está anunciado no Bazar.");
        if (mascot.isEquipped) throw new Error("Desequipe o mascote antes de anunciá-lo.");

        const activeExp = await tx.mascotExpedition.findFirst({
          where: { mascotId: mascot.id, status: "ACTIVE" },
        });
        if (activeExp) throw new Error("Mascote está em expedição — aguarde o retorno.");

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
        };

      } else if (input.category === "ITEM") {
        const qty = input.quantity ?? 1;
        if (qty < 1) throw new Error("Quantidade inválida.");
        if (!input.itemType) throw new Error("Tipo de item não especificado.");

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
        } else if (["COMMON","RARE","SPECIAL","EVENT","EGG_GEN1","EGG_GEN2","EGG_GEN3","EGG_GEN4","EGG_GEN5","EGG_GEN6","EGG_GEN7","EGG_GEN8","EGG_GEN9"].includes(input.itemType)) {
          // Ovos — conta quantos tem
          const eggs = await tx.mascotEgg.findMany({
            where: { playerId: player.id, type: input.itemType as never, incubation: null },
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
          // Item de PlayerInventory (buffs, cosmetics)
          const inv = await tx.playerInventory.findFirst({
            where: { playerId: player.id, item: { type: input.itemType as never }, quantity: { gt: 0 } },
            include: { item: true },
          });
          if (!inv || inv.quantity < qty) throw new Error("Itens insuficientes no inventário.");
          await tx.playerInventory.update({
            where: { id: inv.id },
            data: { quantity: { decrement: qty } },
          });
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
          feeCharged: fee,
          expiresAt,
        },
      });
    });

    revalidateBazar();
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

    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil não encontrado." };

    const listing = await prisma.bazarListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.playerId !== player.id) return { error: "Anúncio não encontrado." };
    if (listing.status !== "ACTIVE" && listing.status !== "RESERVED") {
      return { error: "Este anúncio não pode ser cancelado." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.bazarListing.update({ where: { id: listingId }, data: { status: "CANCELLED" } });
      await _returnEscrow(tx, listing, player.id);
      // Rejeitar proposals pendentes
      await tx.bazarProposal.updateMany({
        where: { listingId, status: "PENDING" },
        data: { status: "REJECTED" },
      });
    });

    revalidateBazar();
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

    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil não encontrado." };

    const listing = await prisma.bazarListing.findUnique({
      where: { id: listingId },
      include: { player: { select: { id: true, displayName: true } } },
    });
    if (!listing) return { error: "Anúncio não encontrado." };
    if (listing.status !== "ACTIVE") return { error: "Este anúncio não está mais disponível." };
    if (listing.playerId === player.id) return { error: "Você não pode comprar seu próprio anúncio." };
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

      // Rejeitar proposals pendentes
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
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao comprar." };
  }
}

// ── Proposta ──────────────────────────────────────────────────────────────────

export async function createProposal(
  listingId: string,
  coinsOffer: number,
  message?: string
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil não encontrado." };

    const listing = await prisma.bazarListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== "ACTIVE") return { error: "Anúncio indisponível." };
    if (listing.playerId === player.id) return { error: "Você não pode propor no seu próprio anúncio." };

    if (coinsOffer > 0) {
      const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < coinsOffer) {
        return { error: `Saldo insuficiente (${wallet?.balance ?? 0} ZC disponíveis).` };
      }
    }

    const existing = await prisma.bazarProposal.findFirst({
      where: { listingId, proposerId: player.id, status: "PENDING" },
    });
    if (existing) return { error: "Você já tem uma proposta pendente neste anúncio. Cancele antes de enviar outra." };

    await prisma.bazarProposal.create({
      data: { listingId, proposerId: player.id, coinsOffer, message },
    });

    revalidateBazar();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function acceptProposal(proposalId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil não encontrado." };

    const proposal = await prisma.bazarProposal.findUnique({
      where: { id: proposalId },
      include: {
        listing: { include: { player: { select: { id: true, displayName: true } } } },
        proposer: { select: { id: true, displayName: true } },
      },
    });
    if (!proposal) return { error: "Proposta não encontrada." };
    if (proposal.listing.playerId !== player.id) return { error: "Sem permissão." };
    if (proposal.status !== "PENDING") return { error: "Proposta não está mais pendente." };
    if (proposal.listing.status !== "ACTIVE") return { error: "Anúncio não está mais ativo." };

    // Verificar saldo do proponente
    if (proposal.coinsOffer > 0) {
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

      // Rejeitar outras proposals
      await tx.bazarProposal.updateMany({
        where: { listingId: listing.id, status: "PENDING", id: { not: proposalId } },
        data: { status: "REJECTED" },
      });

      // Transferir coins (proponente → dono do anúncio)
      if (proposal.coinsOffer > 0) {
        await tx.zikaCoinWallet.update({
          where: { playerId: proposal.proposerId },
          data: { balance: { decrement: proposal.coinsOffer } },
        });
        await tx.zikaCoinWallet.upsert({
          where: { playerId: player.id },
          update: { balance: { increment: proposal.coinsOffer } },
          create: { playerId: player.id, balance: proposal.coinsOffer, totalEarned: proposal.coinsOffer },
        });
      }

      // Transferir item para o proponente
      await _transferItem(tx, listing, proposal.proposerId);

      // Log
      const payload = listing.payload as Record<string, unknown>;
      const desc = listing.category === "MASCOT"
        ? `${payload.nickname ?? payload.pokemonName} Nv.${payload.level} trocado${proposal.coinsOffer > 0 ? ` por ${proposal.coinsOffer} ZC` : ""}`
        : `${payload.displayName} trocado${proposal.coinsOffer > 0 ? ` por ${proposal.coinsOffer} ZC` : ""}`;

      await tx.bazarTransaction.create({
        data: {
          listingId: listing.id,
          sellerId: player.id,
          buyerId: proposal.proposerId,
          sellerName: listing.player.displayName,
          buyerName: proposal.proposer.displayName,
          description: desc,
          coinsAmount: proposal.coinsOffer,
          category: listing.category,
        },
      });
    });

    revalidateBazar();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function rejectProposal(proposalId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil não encontrado." };

    const proposal = await prisma.bazarProposal.findUnique({
      where: { id: proposalId },
      include: { listing: { select: { playerId: true } } },
    });
    if (!proposal) return { error: "Proposta não encontrada." };
    if (proposal.listing.playerId !== player.id && proposal.proposerId !== player.id) {
      return { error: "Sem permissão." };
    }
    if (proposal.status !== "PENDING") return { error: "Proposta não está pendente." };

    const newStatus = proposal.listing.playerId === player.id ? "REJECTED" : "CANCELLED";
    await prisma.bazarProposal.update({ where: { id: proposalId }, data: { status: newStatus } });

    revalidateBazar();
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
    const player = await prisma.player.findUnique({ where: { userId: user.id } });
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

export async function buyMiauvadaoOffer(offerIndex: number): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil não encontrado." };

    const config = await getMiauvadaoConfig();
    const offers = config.dailyOffers as unknown as MiauvadaoOffer[];
    const offer = offers[offerIndex];

    if (!offer) return { error: "Oferta não encontrada." };
    if (offer.sold >= offer.stock) return { error: "Estoque esgotado." };
    if (new Date() > new Date(offer.validUntil)) return { error: "Oferta expirada." };

    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < offer.finalPrice) {
      return { error: `Saldo insuficiente (${wallet?.balance ?? 0} ZC disponíveis, oferta custa ${offer.finalPrice} ZC).` };
    }

    await prisma.$transaction(async (tx) => {
      // Cobrar player
      await tx.zikaCoinWallet.update({
        where: { playerId: player.id },
        data: { balance: { decrement: offer.finalPrice } },
      });

      // Atualizar sold na oferta
      const updatedOffers = [...offers];
      updatedOffers[offerIndex] = { ...offer, sold: offer.sold + 1 };
      await tx.miauvadaoConfig.update({
        where: { id: "singleton" },
        data: { dailyOffers: updatedOffers as unknown as import("@prisma/client").Prisma.InputJsonValue },
      });

      // Entregar item (mesmo esquema da shop)
      if (offer.itemType.startsWith("EGG_") || ["EGG_COMMON","EGG_RARE","EGG_SPECIAL"].includes(offer.itemType)) {
        const eggTypeMap: Record<string, string> = {
          EGG_COMMON: "COMMON", EGG_RARE: "RARE", EGG_SPECIAL: "SPECIAL",
          EGG_GEN1: "EGG_GEN1", EGG_GEN2: "EGG_GEN2", EGG_GEN3: "EGG_GEN3",
          EGG_GEN4: "EGG_GEN4", EGG_GEN5: "EGG_GEN5", EGG_GEN6: "EGG_GEN6",
          EGG_GEN7: "EGG_GEN7", EGG_GEN8: "EGG_GEN8", EGG_GEN9: "EGG_GEN9",
        };
        await tx.mascotEgg.create({
          data: { playerId: player.id, type: (eggTypeMap[offer.itemType] ?? "COMMON") as never, origin: "Miauvadão" },
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
    });

    revalidatePath("/bazar");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao comprar." };
  }
}

export interface MiauvadaoOffer {
  itemType: string;
  shopItemId?: string;
  name: string;
  imageUrl?: string;
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
    const validUntil = new Date(Date.now() + 24 * 3600000).toISOString();
    const offersWithExpiry = offers.map(o => ({ ...o, validUntil, sold: 0 }));
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
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

// ── Utilitários internos ──────────────────────────────────────────────────────

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function _transferItem(tx: TxClient, listing: { id: string; category: string; payload: unknown }, toBuyerId: string) {
  const payload = listing.payload as Record<string, unknown>;

  if (listing.category === "MASCOT") {
    const mascotId = payload.mascotId as string;
    await tx.mascot.update({
      where: { id: mascotId },
      data: { playerId: toBuyerId, bazarListed: false, isEquipped: false },
    });
  } else if (listing.category === "ITEM") {
    const itemType = payload.itemType as string;
    const qty = (payload.quantity as number) ?? 1;

    if (itemType === "FOOD" || itemType === "SWEET") {
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId: toBuyerId, type: itemType as "FOOD" | "SWEET" } },
        update: { quantity: { increment: qty } },
        create: { playerId: toBuyerId, type: itemType as "FOOD" | "SWEET", quantity: qty },
      });
    } else if (["COMMON","RARE","SPECIAL","EVENT","EGG_GEN1","EGG_GEN2","EGG_GEN3","EGG_GEN4","EGG_GEN5","EGG_GEN6","EGG_GEN7","EGG_GEN8","EGG_GEN9"].includes(itemType)) {
      const eggIds = payload.escrowed_egg_ids as string[] | undefined;
      if (eggIds && eggIds.length > 0) {
        await tx.mascotEgg.updateMany({
          where: { id: { in: eggIds } },
          data: { playerId: toBuyerId, origin: "Comprado no Bazar" },
        });
      }
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
    const qty = (payload.quantity as number) ?? 1;

    if (itemType === "FOOD" || itemType === "SWEET") {
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId: ownerId, type: itemType as "FOOD" | "SWEET" } },
        update: { quantity: { increment: qty } },
        create: { playerId: ownerId, type: itemType as "FOOD" | "SWEET", quantity: qty },
      });
    } else if (["COMMON","RARE","SPECIAL","EVENT","EGG_GEN1","EGG_GEN2","EGG_GEN3","EGG_GEN4","EGG_GEN5","EGG_GEN6","EGG_GEN7","EGG_GEN8","EGG_GEN9"].includes(itemType)) {
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
