"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";

/** Marca a janela do presente como vista (o presente continua na Caixa de presentes). */
export async function dismissGiftPopupAction(giftId: string): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) return { ok: false };
  const gift = await prisma.playerGift.findUnique({ where: { id: giftId }, select: { playerId: true, payload: true } });
  if (!gift || gift.playerId !== player.id) return { ok: false };
  const payload = gift.payload && typeof gift.payload === "object" && !Array.isArray(gift.payload) ? (gift.payload as Record<string, unknown>) : {};
  await prisma.playerGift.update({ where: { id: giftId }, data: { payload: { ...payload, popupSeenAt: new Date().toISOString() } as Prisma.InputJsonObject } });
  return { ok: true };
}
