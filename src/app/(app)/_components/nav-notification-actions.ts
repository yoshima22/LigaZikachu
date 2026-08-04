"use server";

import { revalidateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getNavNotificationSnapshot, type NavNotificationSnapshot } from "@/lib/nav-notifications";

async function currentPlayer() {
  const user = await getSessionUser();
  if (!user) return null;
  const player = await getSessionPlayer(user.id);
  return player ? { playerId: player.id, userId: user.id } : null;
}

export async function refreshNavNotificationsAction(): Promise<NavNotificationSnapshot | null> {
  const current = await currentPlayer();
  return current ? getNavNotificationSnapshot(current.playerId) : null;
}

export async function markNavAlertViewedAction(input: {
  category: "MESSAGE" | "BAZAR";
  id: string;
  entityId: string;
}) {
  const current = await currentPlayer();
  if (!current) return;

  if (input.category === "MESSAGE") {
    await prisma.directMessage.updateMany({
      where: { receiverId: current.playerId, senderId: input.entityId, readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    await prisma.playerNotification.updateMany({
      where: { id: input.id, playerId: current.playerId, readAt: null },
      data: { readAt: new Date() },
    });
  }
  revalidateTag(`nav-${current.userId}`);
}
