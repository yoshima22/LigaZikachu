"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ORDER_EVENT_SLUG } from "@/lib/raid-event";

export async function markOrderIntroSeenAction() {
  const session = await getAppSession();
  if (!session?.user) return;

  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: { id: true, active: true },
  });
  if (!event?.active) return;

  await prisma.userRaidNotification.upsert({
    where: {
      raidEventId_userId_notificationType: {
        raidEventId: event.id,
        userId: session.user.id,
        notificationType: "ORDER_INTRO",
      },
    },
    create: {
      raidEventId: event.id,
      userId: session.user.id,
      notificationType: "ORDER_INTRO",
      seenAt: new Date(),
    },
    update: { seenAt: new Date() },
  });
}

export async function resetOrderIntroForMeAction() {
  const session = await getAppSession();
  if (!session?.user) return;

  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: { id: true },
  });
  if (!event) return;

  await prisma.userRaidNotification.deleteMany({
    where: {
      raidEventId: event.id,
      userId: session.user.id,
      notificationType: "ORDER_INTRO",
    },
  });
  revalidatePath("/", "layout");
  revalidatePath("/combates/ordem-da-trapaca");
}

export async function markOrderRewardSeenAction(notificationId: string) {
  const session = await getAppSession();
  if (!session?.user || !notificationId) return;

  await prisma.userRaidNotification.updateMany({
    where: {
      id: notificationId,
      userId: session.user.id,
      notificationType: {
        in: [
          "ORDER_REWARD_ZIKALOOT",
          "ORDER_REWARD_BAZAR",
          "ORDER_REWARD_LAB",
          "ORDER_REWARD_LEAGUE",
          "ORDER_REWARD_MASCOTS",
          "RAID_DEFEATED",
        ],
      },
    },
    data: { seenAt: new Date() },
  });
  revalidatePath("/", "layout");
}
