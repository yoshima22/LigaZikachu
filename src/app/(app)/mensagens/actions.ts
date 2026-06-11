"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

async function requirePlayer() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true },
  });
  if (!player) redirect("/dashboard");
  return player;
}

export async function getConversationAction(otherPlayerId: string) {
  const me = await requirePlayer();

  const [messages, other, unread] = await Promise.all([
    prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: me.id, receiverId: otherPlayerId },
          { senderId: otherPlayerId, receiverId: me.id },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true, content: true, createdAt: true, readAt: true,
        senderId: true,
        sender: { select: { displayName: true, avatarUrl: true } },
      },
    }),
    prisma.player.findUnique({
      where: { id: otherPlayerId },
      select: { id: true, displayName: true, avatarUrl: true },
    }),
    prisma.directMessage.count({
      where: { senderId: otherPlayerId, receiverId: me.id, readAt: null },
    }),
  ]);

  if (!other) return { ok: false as const, error: "Jogador não encontrado." };

  // Marca como lidas
  if (unread > 0) {
    await prisma.directMessage.updateMany({
      where: { senderId: otherPlayerId, receiverId: me.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return { ok: true as const, me, other, messages };
}

export async function sendMessageAction(receiverId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 500) return { ok: false as const, error: "Mensagem inválida." };

  const me = await requirePlayer();
  if (me.id === receiverId) return { ok: false as const, error: "Não pode enviar mensagem para si mesmo." };

  const receiver = await prisma.player.findUnique({
    where: { id: receiverId },
    select: { id: true },
  });
  if (!receiver) return { ok: false as const, error: "Destinatário não encontrado." };

  const msg = await prisma.directMessage.create({
    data: { senderId: me.id, receiverId, content: trimmed },
    select: {
      id: true, content: true, createdAt: true, senderId: true,
      sender: { select: { displayName: true, avatarUrl: true } },
    },
  });

  return { ok: true as const, message: msg };
}

export async function getInboxAction() {
  const me = await requirePlayer();

  // Busca a última mensagem de cada conversa (enviadas e recebidas)
  const [lastSent, lastReceived, totalUnread] = await Promise.all([
    prisma.directMessage.findMany({
      where: { senderId: me.id },
      orderBy: { createdAt: "desc" },
      distinct: ["receiverId"],
      select: {
        id: true, content: true, createdAt: true, readAt: true, senderId: true,
        receiver: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    }),
    prisma.directMessage.findMany({
      where: { receiverId: me.id },
      orderBy: { createdAt: "desc" },
      distinct: ["senderId"],
      select: {
        id: true, content: true, createdAt: true, readAt: true, senderId: true,
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    }),
    prisma.directMessage.count({
      where: { receiverId: me.id, readAt: null },
    }),
  ]);

  // Mescla e deduplica por parceiro de conversa, mantendo a mais recente
  const map = new Map<string, {
    partnerId: string; partnerName: string; partnerAvatar: string | null;
    lastContent: string; lastAt: Date; unread: number;
  }>();

  for (const m of lastSent) {
    const p = m.receiver;
    if (!map.has(p.id) || map.get(p.id)!.lastAt < m.createdAt) {
      map.set(p.id, {
        partnerId: p.id, partnerName: p.displayName, partnerAvatar: p.avatarUrl,
        lastContent: m.content, lastAt: m.createdAt, unread: 0,
      });
    }
  }

  for (const m of lastReceived) {
    const p = m.sender;
    const existing = map.get(p.id);
    if (!existing || existing.lastAt < m.createdAt) {
      map.set(p.id, {
        partnerId: p.id, partnerName: p.displayName, partnerAvatar: p.avatarUrl,
        lastContent: m.content, lastAt: m.createdAt, unread: 0,
      });
    }
  }

  // Conta não lidas por remetente
  const unreadCounts = await prisma.directMessage.groupBy({
    by: ["senderId"],
    where: { receiverId: me.id, readAt: null },
    _count: { id: true },
  });
  for (const u of unreadCounts) {
    const entry = map.get(u.senderId);
    if (entry) entry.unread = u._count.id;
  }

  const conversations = Array.from(map.values()).sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

  return { ok: true as const, me, conversations, totalUnread };
}

export async function getUnreadCountAction() {
  const user = await getSessionUser();
  if (!user) return 0;
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!player) return 0;
  return prisma.directMessage.count({ where: { receiverId: player.id, readAt: null } });
}
