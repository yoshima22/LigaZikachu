"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GiftStatus } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const claimGiftSchema = z.object({
  giftId: z.string().min(1),
});

const claimAllGiftsSchema = z.object({
  playerId: z.string().min(1),
});

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
  await prisma.$transaction([
    prisma.playerGift.update({
      where: { id: giftId },
      data: { status: GiftStatus.CLAIMED, claimedAt: now },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "playerGift",
        entityId: giftId,
        action: "player_gift.claimed",
        before: { status: gift.status },
        after: { status: GiftStatus.CLAIMED }
      }
    })
  ]);

  revalidatePath("/caixa-de-presentes");
  revalidatePath("/dashboard");
  revalidatePath("/codigos");
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
    select: { id: true, status: true }
  });

  if (gifts.length === 0) {
    return { success: true, claimed: 0 };
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const update = await tx.playerGift.updateMany({
      where: {
        id: { in: gifts.map((gift) => gift.id) },
        playerId: player.id,
        status: GiftStatus.UNCLAIMED,
      },
      data: {
        status: GiftStatus.CLAIMED,
        claimedAt: now,
      },
    });

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

    return update;
  });

  revalidatePath("/caixa-de-presentes");
  revalidatePath("/dashboard");
  revalidatePath("/codigos");
  return { success: true, claimed: result.count };
}
