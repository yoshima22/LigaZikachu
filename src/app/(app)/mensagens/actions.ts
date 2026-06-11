"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { getStaticSpriteUrl, getShinySprite, getPokemonName } from "@/lib/mascot-data";

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

export type AttachmentData =
  | {
      type: "MASCOT";
      id: string; pokemonId: number; displayName: string; nickname: string | null;
      level: number; isShiny: boolean; spriteUrl: string;
      personality: string;
      statForce: number; statAgility: number; statCharisma: number;
      statInstinct: number; statVitality: number;
    }
  | { type: "ITEM"; id: string; name: string; imageUrl: string | null; itemType: string; rarity: string };

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
        senderId: true, attachmentType: true, attachmentData: true,
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

  if (unread > 0) {
    await prisma.directMessage.updateMany({
      where: { senderId: otherPlayerId, receiverId: me.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return { ok: true as const, me, other, messages };
}

export async function sendMessageAction(
  receiverId: string,
  content: string,
  attachment?: AttachmentData,
) {
  const trimmed = content.trim();
  if (!trimmed && !attachment) return { ok: false as const, error: "Mensagem ou anexo obrigatório." };
  if (trimmed.length > 500) return { ok: false as const, error: "Mensagem muito longa." };

  const me = await requirePlayer();
  if (me.id === receiverId) return { ok: false as const, error: "Não pode enviar mensagem para si mesmo." };

  const receiver = await prisma.player.findUnique({ where: { id: receiverId }, select: { id: true } });
  if (!receiver) return { ok: false as const, error: "Destinatário não encontrado." };

  const msg = await prisma.directMessage.create({
    data: {
      senderId: me.id,
      receiverId,
      content: trimmed,
      attachmentType: attachment?.type ?? null,
      attachmentData: attachment ?? undefined,
    },
    select: {
      id: true, content: true, createdAt: true, senderId: true,
      attachmentType: true, attachmentData: true,
      sender: { select: { displayName: true, avatarUrl: true } },
    },
  });

  return { ok: true as const, message: msg };
}

export async function getInboxAction() {
  const me = await requirePlayer();

  const [lastSent, lastReceived] = await Promise.all([
    prisma.directMessage.findMany({
      where: { senderId: me.id },
      orderBy: { createdAt: "desc" },
      distinct: ["receiverId"],
      select: {
        id: true, content: true, createdAt: true, attachmentType: true,
        receiver: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    }),
    prisma.directMessage.findMany({
      where: { receiverId: me.id },
      orderBy: { createdAt: "desc" },
      distinct: ["senderId"],
      select: {
        id: true, content: true, createdAt: true, attachmentType: true,
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    }),
  ]);

  const map = new Map<string, {
    partnerId: string; partnerName: string; partnerAvatar: string | null;
    lastContent: string; lastAttachmentType: string | null; lastAt: Date; unread: number;
  }>();

  for (const m of lastSent) {
    const p = m.receiver;
    if (!map.has(p.id) || map.get(p.id)!.lastAt < m.createdAt) {
      map.set(p.id, {
        partnerId: p.id, partnerName: p.displayName, partnerAvatar: p.avatarUrl,
        lastContent: m.content, lastAttachmentType: m.attachmentType,
        lastAt: m.createdAt, unread: 0,
      });
    }
  }
  for (const m of lastReceived) {
    const p = m.sender;
    const existing = map.get(p.id);
    if (!existing || existing.lastAt < m.createdAt) {
      map.set(p.id, {
        partnerId: p.id, partnerName: p.displayName, partnerAvatar: p.avatarUrl,
        lastContent: m.content, lastAttachmentType: m.attachmentType,
        lastAt: m.createdAt, unread: 0,
      });
    }
  }

  const unreadCounts = await prisma.directMessage.groupBy({
    by: ["senderId"],
    where: { receiverId: me.id, readAt: null },
    _count: { id: true },
  });
  for (const u of unreadCounts) {
    const entry = map.get(u.senderId);
    if (entry) entry.unread = u._count.id;
  }

  const totalUnread = unreadCounts.reduce((s, u) => s + u._count.id, 0);
  const conversations = Array.from(map.values()).sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

  // Todos os jogadores ativos para a busca
  const allPlayers = await prisma.player.findMany({
    where: { user: { status: "ACTIVE" }, id: { not: me.id } },
    select: { id: true, displayName: true, avatarUrl: true },
    orderBy: { displayName: "asc" },
  });

  return { ok: true as const, me, conversations, totalUnread, allPlayers };
}

export async function getMyAttachablesAction() {
  const me = await requirePlayer();

  const [mascots, inventoryItems] = await Promise.all([
    prisma.mascot.findMany({
      where: { playerId: me.id },
      select: {
        id: true, pokemonId: true, nickname: true, level: true, isShiny: true,
        personality: true,
        statForce: true, statAgility: true, statCharisma: true,
        statInstinct: true, statVitality: true,
      },
      orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
      take: 30,
    }),
    prisma.playerInventory.findMany({
      where: { playerId: me.id, quantity: { gt: 0 } },
      include: { item: { select: { id: true, name: true, imageUrl: true, type: true, rarity: true } } },
      orderBy: { purchasedAt: "desc" },
      take: 30,
    }),
  ]);

  const mascotAttachments: AttachmentData[] = mascots.map((m) => ({
    type: "MASCOT",
    id: m.id,
    pokemonId: m.pokemonId,
    displayName: getPokemonName(m.pokemonId),
    nickname: m.nickname,
    level: m.level,
    isShiny: m.isShiny ?? false,
    spriteUrl: m.isShiny ? getShinySprite(m.pokemonId) : getStaticSpriteUrl(m.pokemonId),
    personality: m.personality,
    statForce: m.statForce,
    statAgility: m.statAgility,
    statCharisma: m.statCharisma,
    statInstinct: m.statInstinct,
    statVitality: m.statVitality,
  }));

  const itemAttachments: AttachmentData[] = inventoryItems.map((inv) => ({
    type: "ITEM",
    id: inv.item.id,
    name: inv.item.name,
    imageUrl: inv.item.imageUrl,
    itemType: inv.item.type,
    rarity: inv.item.rarity,
  }));

  return { ok: true as const, mascots: mascotAttachments, items: itemAttachments };
}

export async function getUnreadCountAction() {
  const user = await getSessionUser();
  if (!user) return 0;
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) return 0;
  return prisma.directMessage.count({ where: { receiverId: player.id, readAt: null } });
}

export async function pollNewMessagesAction(otherPlayerId: string, afterIso: string) {
  const me = await requirePlayer();
  const after = new Date(afterIso);

  const messages = await prisma.directMessage.findMany({
    where: {
      createdAt: { gt: after },
      OR: [
        { senderId: me.id, receiverId: otherPlayerId },
        { senderId: otherPlayerId, receiverId: me.id },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, content: true, createdAt: true, senderId: true,
      attachmentType: true, attachmentData: true,
      sender: { select: { displayName: true, avatarUrl: true } },
    },
  });

  // Mark received messages as read
  const unreadIds = messages
    .filter((m) => m.senderId === otherPlayerId)
    .map((m) => m.id);
  if (unreadIds.length > 0) {
    await prisma.directMessage.updateMany({
      where: { id: { in: unreadIds } },
      data: { readAt: new Date() },
    });
  }

  return { ok: true as const, messages };
}
