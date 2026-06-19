"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { EggType, FoodType, GiftStatus, ZikaCoinTxType, type Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { creditCoins } from "@/lib/zikacoins";
import { UNIQUE_ITEM_TYPES } from "@/lib/shop-config";
import { openStickerPackByName } from "@/app/(app)/passe-apoiador/pack-opener";

const claimGiftSchema = z.object({
  giftId: z.string().min(1),
});

const claimAllGiftsSchema = z.object({
  playerId: z.string().min(1),
});

type ClaimableGift = {
  id: string;
  type: string;
  title: string;
  payload: Prisma.JsonValue | null;
};

function getPayloadRecord(payload: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function isEggType(value: unknown): value is EggType {
  return typeof value === "string" && Object.values(EggType).includes(value as EggType);
}

function isFoodType(value: unknown): value is FoodType {
  return typeof value === "string" && Object.values(FoodType).includes(value as FoodType);
}

async function applyGiftReward(
  tx: Prisma.TransactionClient,
  playerId: string,
  gift: ClaimableGift
): Promise<{ autoSold?: { itemName: string; coins: number } }> {
  const payload = getPayloadRecord(gift.payload);

  if (gift.type === "STICKER" && payload) {
    const cardId = typeof payload.cardId === "string" ? payload.cardId : null;
    if (cardId) {
      const card = await tx.pokemonCard.findUnique({ where: { id: cardId }, select: { id: true } });
      if (!card) {
        console.error(`[claimGift] STICKER gift ${gift.id}: cardId "${cardId}" não encontrado em PokemonCard. Presente resgatado sem figurinha.`);
        return {};
      }
      await tx.playerSticker.upsert({
        where: { playerId_cardId: { playerId, cardId } },
        update: { quantity: { increment: 1 } },
        create: { playerId, cardId, quantity: 1, isFavorite: false }
      });
    }
    return {};
  }

  if (gift.type !== "CUSTOM" || !payload) return {};

  const rewardKind = typeof payload.rewardKind === "string" ? payload.rewardKind : null;

  if (rewardKind === "STICKER_PACK") {
    const packName = typeof payload.packName === "string" ? payload.packName : null;
    if (packName) {
      await openStickerPackByName(playerId, packName);
    }
    return {};
  }

  if (rewardKind === "MASCOT_EGG" && isEggType(payload.eggType)) {
    await tx.mascotEgg.create({
      data: {
        playerId,
        type: payload.eggType,
        origin: typeof payload.origin === "string" ? payload.origin : gift.title
      }
    });
    return {};
  }

  if (rewardKind === "MASCOT_FOOD" && isFoodType(payload.foodType)) {
    const quantity = typeof payload.quantity === "number" && payload.quantity > 0
      ? Math.floor(payload.quantity)
      : 1;
    await tx.mascotFoodItem.upsert({
      where: { playerId_type: { playerId, type: payload.foodType } },
      update: { quantity: { increment: quantity } },
      create: { playerId, type: payload.foodType, quantity }
    });
    return {};
  }

  if (rewardKind === "MASCOT_BUFF") {
    const buffType = typeof payload.buffType === "string" ? payload.buffType : null;
    const quantity = typeof payload.quantity === "number" && payload.quantity > 0
      ? Math.floor(payload.quantity)
      : 1;
    if (buffType) {
      const shopItem = await tx.shopItem.findFirst({
        where: { type: buffType as import("@prisma/client").ShopItemType },
        select: { id: true, name: true, price: true }
      });
      if (shopItem) {
        // Itens únicos: se o jogador já possui, vende automaticamente pela metade
        if (UNIQUE_ITEM_TYPES.has(buffType)) {
          const existing = await tx.playerInventory.findUnique({
            where: { playerId_itemId: { playerId, itemId: shopItem.id } }
          });
          if (existing) {
            const halfPrice = Math.floor(shopItem.price / 2);
            await creditCoins(tx, {
              playerId,
              type: ZikaCoinTxType.ACHIEVEMENT_REWARD,
              amount: halfPrice,
              description: `Reembolso automático: ${shopItem.name} (item único já possuído)`
            });
            return { autoSold: { itemName: shopItem.name, coins: halfPrice } };
          }
        }
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId, itemId: shopItem.id } },
          update: { quantity: { increment: quantity } },
          create: { playerId, itemId: shopItem.id, quantity, equipped: false }
        });
      }
    }
    return {};
  }

  const itemName = typeof payload.item === "string" ? payload.item.trim() : null;
  if (itemName) {
    const quantity = typeof payload.quantity === "number" && payload.quantity > 0
      ? Math.floor(payload.quantity)
      : 1;
    const shopItem = await tx.shopItem.findFirst({
      where: { name: { equals: itemName, mode: "insensitive" }, active: true },
      select: { id: true, name: true },
    });
    if (shopItem) {
      await tx.playerInventory.upsert({
        where: { playerId_itemId: { playerId, itemId: shopItem.id } },
        update: { quantity: { increment: quantity } },
        create: { playerId, itemId: shopItem.id, quantity, equipped: false },
      });
    }
    return {};
  }

  if (rewardKind === "ZIKA_COINS") {
    const amount = typeof payload.amount === "number" && payload.amount > 0
      ? Math.floor(payload.amount)
      : 0;
    if (amount > 0) {
      await creditCoins(tx, {
        playerId,
        type: ZikaCoinTxType.ACHIEVEMENT_REWARD,
        amount,
        description: `Presente: ${gift.title}`
      });
    }
  }
  return {};
}

function revalidateGiftTargets(userId?: string, playerId?: string) {
  revalidatePath("/caixa-de-presentes");
  revalidatePath("/dashboard");
  revalidatePath("/codigos");
  revalidatePath("/mascotes");
  revalidatePath("/carteira");
  if (userId) revalidateTag(`nav-${userId}`);
  if (playerId) revalidateTag(`player-mascots-${playerId}`);
}

export async function claimGift(input: z.infer<typeof claimGiftSchema>) {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado" };

    const player = await prisma.player.findUnique({
      where: { userId: user.id },
      select: { id: true }
    });
    if (!player) return { error: "Jogador nao encontrado" };

    const { giftId } = claimGiftSchema.parse(input);

    const gift = await prisma.playerGift.findUnique({
      where: { id: giftId },
    });

    if (!gift || gift.playerId !== player.id) {
      return { error: "Presente nao encontrado" };
    }

    if (gift.status !== "UNCLAIMED") {
      return { error: "Presente ja foi resgatado ou expirou" };
    }

    const now = new Date();

    let autoSold: { itemName: string; coins: number } | undefined;
    await prisma.$transaction(async (tx) => {
      const result = await applyGiftReward(tx, player.id, gift);
      if (result.autoSold) autoSold = result.autoSold;
      await tx.playerGift.update({
        where: { id: giftId },
        data: { status: GiftStatus.CLAIMED, claimedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          entityType: "playerGift",
          entityId: giftId,
          action: "player_gift.claimed",
          before: { status: gift.status },
          after: { status: GiftStatus.CLAIMED }
        }
      });
    });

    revalidateGiftTargets(user.id, player.id);
    return { success: true, autoSold };
  } catch (err) {
    console.error("[claimGift] Erro ao resgatar presente:", err);
    return { error: err instanceof Error ? err.message : "Erro ao resgatar presente. Tente novamente." };
  }
}

export async function claimAllGifts(input: z.infer<typeof claimAllGiftsSchema>) {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado" };

    const player = await prisma.player.findUnique({
      where: { userId: user.id },
      select: { id: true }
    });
    if (!player) return { error: "Jogador nao encontrado" };

    const { playerId } = claimAllGiftsSchema.parse(input);
    if (playerId !== player.id) return { error: "Sem permissao" };

    const gifts = await prisma.playerGift.findMany({
      where: {
        playerId: player.id,
        status: GiftStatus.UNCLAIMED,
      },
      select: { id: true, status: true, type: true, title: true, payload: true }
    });

    if (gifts.length === 0) {
      return { success: true, claimed: 0 };
    }

    const now = new Date();
    const claimedIds: string[] = [];
    const autoSolds: { itemName: string; coins: number }[] = [];

    // Processa cada presente individualmente para que um erro não bloqueie todos os outros
    for (const gift of gifts) {
      try {
        await prisma.$transaction(async (tx) => {
          const current = await tx.playerGift.findFirst({
            where: { id: gift.id, playerId: player.id, status: GiftStatus.UNCLAIMED },
            select: { id: true, type: true, title: true, payload: true }
          });
          if (!current) return;

          const result = await applyGiftReward(tx, player.id, current);
          if (result.autoSold) autoSolds.push(result.autoSold);
          await tx.playerGift.update({
            where: { id: current.id },
            data: { status: GiftStatus.CLAIMED, claimedAt: now },
          });
          await tx.auditLog.create({
            data: {
              actorUserId: user.id,
              entityType: "playerGift",
              entityId: current.id,
              action: "player_gift.claimed",
              before: { status: GiftStatus.UNCLAIMED },
              after: { status: GiftStatus.CLAIMED },
            }
          });
        });
        claimedIds.push(gift.id);
      } catch (err) {
        // Loga o erro mas continua com os demais presentes
        console.error(`[claimAllGifts] Erro ao resgatar presente ${gift.id}:`, err);
      }
    }

    revalidateGiftTargets(user.id);
    return { success: true, claimed: claimedIds.length, autoSolds: autoSolds.length > 0 ? autoSolds : undefined };
  } catch (err) {
    console.error("[claimAllGifts] Erro geral:", err);
    return { error: err instanceof Error ? err.message : "Erro ao resgatar presentes." };
  }
}
