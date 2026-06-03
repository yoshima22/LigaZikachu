"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EggType, FoodType, GiftStatus, ZikaCoinTxType, type Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { creditCoins } from "@/lib/zikacoins";

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
) {
  const payload = getPayloadRecord(gift.payload);

  if (gift.type === "STICKER" && payload) {
    const cardId = typeof payload.cardId === "string" ? payload.cardId : null;
    if (cardId) {
      await tx.playerSticker.upsert({
        where: { playerId_cardId: { playerId, cardId } },
        update: { quantity: { increment: 1 } },
        create: { playerId, cardId, quantity: 1 }
      });
    }
    return;
  }

  if (gift.type !== "CUSTOM" || !payload) return;

  const rewardKind = typeof payload.rewardKind === "string" ? payload.rewardKind : null;

  if (rewardKind === "MASCOT_EGG" && isEggType(payload.eggType)) {
    await tx.mascotEgg.create({
      data: {
        playerId,
        type: payload.eggType,
        origin: typeof payload.origin === "string" ? payload.origin : gift.title
      }
    });
    return;
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
    return;
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
}

function revalidateGiftTargets() {
  revalidatePath("/caixa-de-presentes");
  revalidatePath("/dashboard");
  revalidatePath("/codigos");
  revalidatePath("/mascotes");
  revalidatePath("/carteira");
}

export async function claimGift(input: z.infer<typeof claimGiftSchema>) {
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

  await prisma.$transaction(async (tx) => {
    await applyGiftReward(tx, player.id, gift);
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

  revalidateGiftTargets();
  return { success: true };
}

export async function claimAllGifts(input: z.infer<typeof claimAllGiftsSchema>) {
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
  const result = await prisma.$transaction(async (tx) => {
    let claimed = 0;

    for (const gift of gifts) {
      const current = await tx.playerGift.findFirst({
        where: { id: gift.id, playerId: player.id, status: GiftStatus.UNCLAIMED },
        select: { id: true, type: true, title: true, payload: true }
      });
      if (!current) continue;

      await applyGiftReward(tx, player.id, current);
      await tx.playerGift.update({
        where: { id: current.id },
        data: { status: GiftStatus.CLAIMED, claimedAt: now },
      });
      claimed++;
    }

    await tx.auditLog.createMany({
      data: gifts.map((gift) => ({
        actorUserId: user.id,
        entityType: "playerGift",
        entityId: gift.id,
        action: "player_gift.claimed",
        before: { status: gift.status },
        after: { status: GiftStatus.CLAIMED },
      }))
    });

    return { count: claimed };
  });

  revalidateGiftTargets();
  return { success: true, claimed: result.count };
}
