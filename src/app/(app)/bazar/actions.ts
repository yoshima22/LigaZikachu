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

// Tipos de shop que o Miauvadão pode oferecer (excluindo cosméticos únicos)
const MIAUVADAO_ELIGIBLE_TYPES = [
  "EGG_COMMON","EGG_RARE","EGG_SPECIAL",
  "EGG_GEN1","EGG_GEN2","EGG_GEN3","EGG_GEN4","EGG_GEN5",
  "EGG_GEN6","EGG_GEN7","EGG_GEN8","EGG_GEN9","EGG_GEN6PLUS",
  "MASCOT_FOOD","MASCOT_SWEET",
  "MASCOT_BUFF_EXP","MASCOT_BUFF_STAT","MASCOT_BUFF_HAPPY",
  "MASCOT_BUFF_LUCK","MASCOT_BUFF_MOOD",
  "ZIKALOOT_TICKET",
];

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
  const vaultBonus = Math.min(20, Math.floor(vaultBalance / 500));
  const validUntil = new Date(Date.now() + 24 * 3600_000).toISOString();

  // Sorteia até 3 itens distintos
  const shuffled = [...shopItems].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, 3);

  return chosen.map(item => {
    const [minDisc, maxDisc] = DISCOUNT_BY_RARITY[item.rarity] ?? [10, 25];
    const discountPct = Math.min(75, minDisc + Math.floor(Math.random() * (maxDisc - minDisc + 1)) + vaultBonus + extraBonus);
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
export async function autoRefreshMiauvadaoIfNeeded(): Promise<void> {
  try {
    const config = await prisma.miauvadaoConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });

    const offers = (config.dailyOffers as unknown as MiauvadaoOffer[]) ?? [];
    const firstOffer = offers[0];
    // Expirou OU é oferta antiga sem shopItemId (gerada pelo catálogo estático anterior)
    const expired = !firstOffer
      || new Date() > new Date(firstOffer.validUntil)
      || !firstOffer.shopItemId;

    if (expired) {
      const newOffers = await rollMiauvadaoOffers(config.vaultBalance);
      if (newOffers.length > 0) {
        await prisma.miauvadaoConfig.update({
          where: { id: "singleton" },
          data: {
            dailyOffers: newOffers as unknown as import("@prisma/client").Prisma.InputJsonValue,
            offersRefreshedAt: new Date(),
          },
        });
      }
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
  message?: string,
  itemsOffer?: Array<{type: string; quantity: number; displayName: string}>
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
      data: {
        listingId,
        proposerId: player.id,
        coinsOffer,
        message,
        itemsOffer: itemsOffer && itemsOffer.length > 0
          ? itemsOffer as unknown as import("@prisma/client").Prisma.InputJsonValue
          : undefined,
      },
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

      // Transfer items from proposer to seller (if any)
      const itemsOffer = proposal.itemsOffer as Array<{type: string; quantity: number; displayName: string}> | null;
      if (itemsOffer && itemsOffer.length > 0) {
        for (const item of itemsOffer) {
          if (item.type === "FOOD" || item.type === "SWEET") {
            const food = await tx.mascotFoodItem.findUnique({
              where: { playerId_type: { playerId: proposal.proposerId, type: item.type as "FOOD" | "SWEET" } }
            });
            if (!food || food.quantity < item.quantity) throw new Error(`Proposer doesn't have enough ${item.type}`);
            await tx.mascotFoodItem.update({
              where: { playerId_type: { playerId: proposal.proposerId, type: item.type as "FOOD" | "SWEET" } },
              data: { quantity: { decrement: item.quantity } }
            });
            await tx.mascotFoodItem.upsert({
              where: { playerId_type: { playerId: player.id, type: item.type as "FOOD" | "SWEET" } },
              update: { quantity: { increment: item.quantity } },
              create: { playerId: player.id, type: item.type as "FOOD" | "SWEET", quantity: item.quantity }
            });
          } else if (["COMMON","RARE","SPECIAL","EVENT","EGG_GEN1","EGG_GEN2","EGG_GEN3","EGG_GEN4","EGG_GEN5","EGG_GEN6","EGG_GEN7","EGG_GEN8","EGG_GEN9"].includes(item.type)) {
            const eggs = await tx.mascotEgg.findMany({
              where: { playerId: proposal.proposerId, type: item.type as never, incubation: null },
              take: item.quantity,
            });
            if (eggs.length < item.quantity) throw new Error(`Proposer doesn't have enough eggs`);
            await tx.mascotEgg.updateMany({
              where: { id: { in: eggs.map(e => e.id) } },
              data: { playerId: player.id, origin: "Proposta de Bazar" }
            });
          } else {
            const inv = await tx.playerInventory.findFirst({
              where: { playerId: proposal.proposerId, item: { type: item.type as never }, quantity: { gte: item.quantity } }
            });
            if (!inv) throw new Error(`Proposer doesn't have enough of ${item.type}`);
            await tx.playerInventory.update({
              where: { id: inv.id },
              data: { quantity: { decrement: item.quantity } }
            });
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

    const coinsToVault = Math.floor(offer.finalPrice * 0.10);

    await prisma.$transaction(async (tx) => {
      // Cobrar player
      await tx.zikaCoinWallet.update({
        where: { playerId: player.id },
        data: { balance: { decrement: offer.finalPrice } },
      });

      // Atualizar sold na oferta + adicionar 10% ao cofre + mensagem NPC
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

export async function refreshMiauvadaoShopNow(): Promise<{ error?: string; newBalance?: number }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil não encontrado." };

    const REFRESH_COST = 80;
    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < REFRESH_COST) return { error: `Saldo insuficiente (precisa de ${REFRESH_COST} ZC).` };

    // Deduct cost, add to vault
    const [updatedWallet] = await prisma.$transaction([
      prisma.zikaCoinWallet.update({ where: { playerId: player.id }, data: { balance: { decrement: REFRESH_COST } } }),
      prisma.miauvadaoConfig.update({ where: { id: "singleton" }, data: { vaultBalance: { increment: REFRESH_COST } } }),
    ]);

    // Roll new offers with extra +10 flat discount points (premium refresh)
    const config = await prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" } });
    const newOffers = await rollMiauvadaoOffers(config?.vaultBalance ?? 0, 10);

    const msg = `O ${player.displayName} investiu ${REFRESH_COST} ZC e atualizou as ofertas! 🛍️`;
    await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: {
        dailyOffers: newOffers as unknown as import("@prisma/client").Prisma.InputJsonValue,
        lastNpcMessage: msg,
        lastNpcMessageAt: new Date(),
        // NOTE: offersRefreshedAt NOT updated — timer stays the same
      }
    });

    revalidatePath("/bazar");
    return { newBalance: updatedWallet.balance };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function adminAdjustVault(amount: number): Promise<{ error?: string; newBalance?: number }> {
  try {
    await requireAdmin();
    const config = await prisma.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: { vaultBalance: { increment: amount } }
    });
    revalidatePath("/bazar");
    return { newBalance: config.vaultBalance };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
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

// ── Shell Game ────────────────────────────────────────────────────────────────

const SHELL_MIN_BET = 50;
const SHELL_MAX_BET = 2000;
// Prêmio = aposta + 20% da aposta; o bonus (20%) é debitado do cofre
const SHELL_WIN_BONUS_PCT = 0.20;
const SHELL_COOLDOWN_MS = 5 * 60_000;

const MIAUVADAO_RAGE: string[] = [
  "IMPOSSÍVEL! {player} roubou {amount} ZC do meu cofre! 😾",
  "{player} me trapaceou e levou {amount} ZC! Tô boladão! 🤬",
  "Como?! {player} acertou e saiu com {amount} ZC! Não é justo! 😤",
  "{player} limpou parte do cofre! {amount} ZC voaram! Voltaaaa! 🙀",
  "Minha sorte acabou... {player} levou {amount} ZC. Me arruinou! 😿",
  "{player} ganhou {amount} ZC! Meu cofre tá chorando igual eu! 😭",
];

export async function startShellGameSession(betAmount: number): Promise<{
  error?: string; sessionId?: string; newBalance?: number; lastCooldownMs?: number; debugMode?: boolean;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const player = await prisma.player.findUnique({ where: { userId: user.id } });
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

    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < betAmount) return { error: `Saldo insuficiente (${wallet?.balance ?? 0} ZC).` };

    const ballPos = Math.floor(Math.random() * 3);
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const [session, updatedWallet] = await prisma.$transaction([
      prisma.shellGameSession.create({ data: { playerId: player.id, betAmount, ballPos, expiresAt } }),
      prisma.zikaCoinWallet.update({ where: { playerId: player.id }, data: { balance: { decrement: betAmount } } }),
    ]);
    return { sessionId: session.id, newBalance: updatedWallet.balance };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function resolveShellGame(sessionId: string, guessedPos: number): Promise<{
  error?: string; won?: boolean; actualPos?: number; prize?: number; newBalance?: number; debugMode?: boolean;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const player = await prisma.player.findUnique({ where: { userId: user.id } });
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
      // Prêmio correto: aposta + 20% da aposta. O bonus (20%) é o que sai do cofre.
      const vaultBonus = Math.floor(session.betAmount * SHELL_WIN_BONUS_PCT);
      prize = session.betAmount + vaultBonus; // ex: aposta 100 → recebe 120, cofre perde 20
      const template = MIAUVADAO_RAGE[Math.floor(Math.random() * MIAUVADAO_RAGE.length)];
      const message = template.replace("{player}", player.displayName).replace("{amount}", prize.toLocaleString("pt-BR"));
      const [updatedWallet] = await prisma.$transaction([
        prisma.zikaCoinWallet.update({ where: { playerId: player.id }, data: { balance: { increment: prize } } }),
        prisma.miauvadaoConfig.upsert({
          where: { id: "singleton" },
          update: { vaultBalance: { decrement: vaultBonus }, lastWinnerMessage: message, lastWinnerAt: new Date(), lastNpcMessage: message, lastNpcMessageAt: new Date() },
          create: { id: "singleton", lastWinnerMessage: message, lastWinnerAt: new Date(), lastNpcMessage: message, lastNpcMessageAt: new Date() },
        }),
        prisma.shellGameSession.update({ where: { id: sessionId }, data: { resolved: true, won: true } }),
      ]);
      newBalance = updatedWallet.balance;
    } else {
      await prisma.shellGameSession.update({ where: { id: sessionId }, data: { resolved: true, won: false } });
      const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
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
    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { cooldownMs: 0 };
    const last = await prisma.shellGameSession.findFirst({ where: { playerId: player.id }, orderBy: { createdAt: "desc" } });
    if (!last) return { cooldownMs: 0 };
    return { cooldownMs: Math.max(0, SHELL_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) };
  } catch { return { cooldownMs: 0 }; }
}
