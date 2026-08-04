import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NavAlert = {
  id: string;
  category: "MESSAGE" | "BAZAR";
  title: string;
  body: string;
  href: string;
  entityId: string;
  createdAt: string;
  unreadCount?: number;
};

export type NavNotificationSnapshot = {
  messageCount: number;
  bazarCount: number;
  messageAlerts: NavAlert[];
  bazarAlerts: NavAlert[];
};

type NotificationDb = PrismaClient | Prisma.TransactionClient;

export async function createPlayerNotification(
  db: NotificationDb,
  input: {
    playerId: string;
    category: "BAZAR";
    type: string;
    title: string;
    body: string;
    href: string;
    entityId?: string;
    eventKey?: string;
  },
) {
  return db.playerNotification.upsert({
    where: { eventKey: input.eventKey ?? `notification:${crypto.randomUUID()}` },
    update: {},
    create: input,
  });
}

export async function getNavNotificationSnapshot(playerId: string): Promise<NavNotificationSnapshot> {
  const [messages, messageGroups, bazar, bazarCount] = await Promise.all([
    prisma.directMessage.findMany({
      where: { receiverId: playerId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        senderId: true,
        content: true,
        attachmentType: true,
        createdAt: true,
        sender: { select: { displayName: true } },
      },
    }),
    prisma.directMessage.groupBy({
      by: ["senderId"],
      where: { receiverId: playerId, readAt: null },
      _count: { _all: true },
    }),
    prisma.playerNotification.findMany({
      where: { playerId, category: "BAZAR", readAt: null },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, title: true, body: true, href: true, entityId: true, createdAt: true },
    }),
    prisma.playerNotification.count({
      where: { playerId, category: "BAZAR", readAt: null },
    }),
  ]);

  const senderCounts = new Map(messageGroups.map((group) => [group.senderId, group._count._all]));
  const seenSenders = new Set<string>();
  const messageAlerts = messages.flatMap((message): NavAlert[] => {
    if (seenSenders.has(message.senderId)) return [];
    seenSenders.add(message.senderId);
    const attachment = message.attachmentType === "MASCOT"
      ? "Mascote compartilhado"
      : message.attachmentType === "ITEM"
        ? "Item compartilhado"
        : "";
    return [{
      id: message.id,
      category: "MESSAGE",
      title: `Nova mensagem de ${message.sender.displayName}`,
      body: message.content.trim() || attachment || "Nova mensagem",
      href: `/mensagens/${message.senderId}`,
      entityId: message.senderId,
      createdAt: message.createdAt.toISOString(),
      unreadCount: senderCounts.get(message.senderId) ?? 1,
    }];
  }).slice(0, 4);

  return {
    messageCount: messageGroups.reduce((total, group) => total + group._count._all, 0),
    bazarCount,
    messageAlerts,
    bazarAlerts: bazar.slice(0, 5).map((notification) => ({
      id: notification.id,
      category: "BAZAR" as const,
      title: notification.title,
      body: notification.body,
      href: notification.href,
      entityId: notification.entityId ?? notification.id,
      createdAt: notification.createdAt.toISOString(),
    })),
  };
}
