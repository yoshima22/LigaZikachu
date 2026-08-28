"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { getStaticSpriteUrl, getShinySprite, getPokemonName } from "@/lib/mascot-data";
import { sendNotificationToUser } from "@/lib/notifications";
import { after } from "next/server";

async function requirePlayer(returnTo?: string) {
  const user = await getSessionUser();
  if (!user) {
    const destination = returnTo?.startsWith("/") && !returnTo.startsWith("//")
      ? `/login?returnTo=${encodeURIComponent(returnTo)}`
      : "/login";
    redirect(destination);
  }
  const player = await getSessionPlayer(user.id);
  if (!player) redirect("/dashboard");
  return { id: player.id, displayName: player.displayName, userId: user.id };
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
  | { type: "ITEM"; id: string; name: string; imageUrl: string | null; itemType: string; rarity: string; description: string | null };

type ChatMessageRow = {
  attachmentType: string | null;
  attachmentData: unknown;
};

async function hydrateItemAttachments<T extends ChatMessageRow>(messages: T[]): Promise<T[]> {
  const itemIds = Array.from(new Set(messages.flatMap((m) => {
    const data = m.attachmentData as Partial<AttachmentData> | null;
    return data?.type === "ITEM" && data.id ? [data.id] : [];
  })));
  if (itemIds.length === 0) return messages;

  const items = await prisma.shopItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, name: true, imageUrl: true, type: true, rarity: true, description: true },
  });
  const byId = new Map(items.map((item) => [item.id, item]));

  return messages.map((message) => {
    const data = message.attachmentData as Partial<AttachmentData> | null;
    if (data?.type !== "ITEM" || !data.id) return message;
    const current = byId.get(data.id);
    if (!current) return message;
    return {
      ...message,
      attachmentData: {
        type: "ITEM",
        id: current.id,
        name: current.name,
        imageUrl: current.imageUrl,
        itemType: current.type,
        rarity: current.rarity,
        description: current.description ?? null,
      } satisfies AttachmentData,
    };
  });
}

export async function getConversationAction(otherPlayerId: string) {
  const safePlayerId = otherPlayerId.trim();
  const me = await requirePlayer(`/mensagens/${encodeURIComponent(safePlayerId)}`);

  if (!safePlayerId || safePlayerId.length > 80) {
    return { ok: false as const, error: "Conversa inválida.", retryable: false as const };
  }

  try {
    const [newestMessages, other, unread] = await Promise.all([
    prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: me.id, receiverId: safePlayerId },
          { senderId: safePlayerId, receiverId: me.id },
        ],
      },
      // Busca a janela mais recente e só então a coloca em ordem cronológica.
      // `asc + take` mantinha para sempre as 50 mensagens mais antigas.
      orderBy: { createdAt: "desc" },
      take: 50,
      // sender join removido: numa conversa 1-a-1 os dois participantes são
      // conhecidos — repetir avatar (potencialmente base64) por mensagem
      // multiplicava o egress por 50.
      select: {
        id: true, content: true, createdAt: true, readAt: true,
        senderId: true, attachmentType: true, attachmentData: true,
      },
    }),
    prisma.player.findUnique({
      where: { id: safePlayerId },
      select: { id: true, displayName: true, avatarUrl: true },
    }),
    prisma.directMessage.count({
      where: { senderId: safePlayerId, receiverId: me.id, readAt: null },
    }),
    ]);

    if (!other) return { ok: false as const, error: "Jogador não encontrado.", retryable: false as const };

    if (unread > 0) {
      await prisma.directMessage.updateMany({
        where: { senderId: safePlayerId, receiverId: me.id, readAt: null },
        data: { readAt: new Date() },
      });
      revalidateTag(`nav-${me.userId}`);
    }

    const messages = newestMessages.reverse();
    return { ok: true as const, me, other, messages: await hydrateItemAttachments(messages) };
  } catch (error) {
    console.error("[messages] failed to load conversation", {
      otherPlayerId: safePlayerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false as const,
      error: "Não foi possível sincronizar esta conversa agora.",
      retryable: true as const,
    };
  }
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

  const receiver = await prisma.player.findUnique({ where: { id: receiverId }, select: { id: true, userId: true } });
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
    },
  });

  const [message] = await hydrateItemAttachments([msg]);
  revalidateTag(`nav-${receiver.userId}`);
  after(() => sendNotificationToUser(receiver.userId, {
      title: `Nova mensagem de ${me.displayName}`,
      body: trimmed || (attachment?.type === "MASCOT" ? "Enviou um mascote." : "Enviou um item."),
      url: `/mensagens/${me.id}`,
      data: { source: "direct-message", senderId: me.id },
    }).catch(() => undefined));
  return { ok: true as const, message: { ...message, sender: { displayName: me.displayName, avatarUrl: null } } };
}

/** Busca dados dos remetentes uma única vez (em vez de repetir o join — e o
 *  avatar potencialmente base64 — em cada linha de mensagem). */
async function attachSenders<T extends { senderId: string }>(messages: T[]) {
  const senderIds = [...new Set(messages.map((m) => m.senderId))];
  const senders = senderIds.length > 0
    ? await prisma.player.findMany({
        where: { id: { in: senderIds } },
        select: { id: true, displayName: true, avatarUrl: true },
      })
    : [];
  const byId = new Map(senders.map((s) => [s.id, { displayName: s.displayName, avatarUrl: s.avatarUrl }]));
  return messages.map((m) => ({
    ...m,
    sender: byId.get(m.senderId) ?? { displayName: "?", avatarUrl: null },
  }));
}

export async function getGeneralChatAction() {
  const me = await requirePlayer();
  try {
    const messages = await prisma.generalChatMessage.findMany({
      orderBy: { createdAt: "asc" },
      take: 80,
      select: {
        id: true, content: true, createdAt: true, senderId: true,
        attachmentType: true, attachmentData: true,
      },
    });

    return { ok: true as const, me, messages: await hydrateItemAttachments(await attachSenders(messages)) };
  } catch {
    return { ok: true as const, me, messages: [] };
  }
}

export async function sendGeneralMessageAction(content: string, attachment?: AttachmentData) {
  try {
    const trimmed = content.trim();
    if (!trimmed && !attachment) return { ok: false as const, error: "Mensagem ou anexo obrigatorio." };
    if (trimmed.length > 500) return { ok: false as const, error: "Mensagem muito longa." };

    const me = await requirePlayer();
    const msg = await prisma.generalChatMessage.create({
      data: {
        senderId: me.id,
        content: trimmed,
        attachmentType: attachment?.type ?? null,
        attachmentData: attachment ?? undefined,
      },
      select: {
        id: true, content: true, createdAt: true, senderId: true,
        attachmentType: true, attachmentData: true,
      },
    });

    const [message] = await hydrateItemAttachments([msg]);
    return { ok: true as const, message: { ...message, sender: { displayName: me.displayName, avatarUrl: null } } };
  } catch {
    return { ok: false as const, error: "Chat geral ainda nao esta disponivel. Aplique o schema do banco e tente novamente." };
  }
}

export async function getInboxAction() {
  const me = await requirePlayer("/mensagens");

  try {
    const [lastSent, lastReceived] = await Promise.all([
    prisma.directMessage.findMany({
      where: { senderId: me.id },
      orderBy: { createdAt: "desc" },
      distinct: ["receiverId"],
      take: 80,
      select: {
        id: true, content: true, createdAt: true, attachmentType: true,
        receiver: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    }),
    prisma.directMessage.findMany({
      where: { receiverId: me.id },
      orderBy: { createdAt: "desc" },
      distinct: ["senderId"],
      take: 80,
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

    return { ok: true as const, me, conversations, totalUnread };
  } catch (error) {
    console.error("[messages] failed to load inbox", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false as const, error: "Não foi possível sincronizar suas conversas agora." };
  }
}

/** Busca destinatarios sem exigir que ja exista uma conversa entre as contas. */
export async function searchMessageRecipientsAction(rawQuery: string) {
  const me = await requirePlayer();
  const query = rawQuery.trim().slice(0, 80);
  if (!query) return { ok: true as const, players: [] };

  const players = await prisma.player.findMany({
    where: {
      id: { not: me.id },
      active: true,
      // Contas novas podem receber a primeira mensagem antes da aprovacao e
      // encontra-la assim que entrarem. Suspensos e rejeitados ficam ocultos.
      user: { status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { ptcglNick: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, displayName: true, avatarUrl: true, ptcglNick: true },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: 24,
  });

  const normalized = query.toLocaleLowerCase("pt-BR");
  const ordered = players
    .sort((a, b) => {
      const aStarts = a.displayName.toLocaleLowerCase("pt-BR").startsWith(normalized)
        || a.ptcglNick?.toLocaleLowerCase("pt-BR").startsWith(normalized) ? 0 : 1;
      const bStarts = b.displayName.toLocaleLowerCase("pt-BR").startsWith(normalized)
        || b.ptcglNick?.toLocaleLowerCase("pt-BR").startsWith(normalized) ? 0 : 1;
      return aStarts - bStarts || a.displayName.localeCompare(b.displayName, "pt-BR");
    })
    .slice(0, 12)
    .map(({ id, displayName, avatarUrl }) => ({ id, displayName, avatarUrl }));

  return { ok: true as const, players: ordered };
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
    }),
    prisma.playerInventory.findMany({
      where: { playerId: me.id, quantity: { gt: 0 } },
      include: { item: { select: { id: true, name: true, imageUrl: true, type: true, rarity: true, description: true } } },
      orderBy: { purchasedAt: "desc" },
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
    description: inv.item.description ?? null,
  }));

  return { ok: true as const, mascots: mascotAttachments, items: itemAttachments };
}

export async function getUnreadCountAction() {
  const user = await getSessionUser();
  if (!user) return 0;
  const player = await getSessionPlayer(user.id);
  if (!player) return 0;
  return prisma.directMessage.count({ where: { receiverId: player.id, readAt: null } });
}

export async function pollNewMessagesAction(otherPlayerId: string, afterIso: string) {
  const me = await requirePlayer();
  const parsedAfter = new Date(afterIso);
  const after = Number.isNaN(parsedAfter.getTime()) ? new Date(0) : parsedAfter;

  const messages = await prisma.directMessage.findMany({
    where: {
      createdAt: { gt: after },
      OR: [
        { senderId: me.id, receiverId: otherPlayerId },
        { senderId: otherPlayerId, receiverId: me.id },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    // sender join removido: o cliente já conhece os dois participantes
    select: {
      id: true, content: true, createdAt: true, senderId: true,
      attachmentType: true, attachmentData: true,
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
    revalidateTag(`nav-${me.userId}`);
  }

  return { ok: true as const, messages: await hydrateItemAttachments(messages) };
}

export async function pollGeneralMessagesAction(afterIso: string) {
  await requirePlayer();
  const after = new Date(afterIso);
  try {
    const messages = await prisma.generalChatMessage.findMany({
      where: { createdAt: { gt: after } },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true, content: true, createdAt: true, senderId: true,
        attachmentType: true, attachmentData: true,
      },
    });

    return { ok: true as const, messages: await hydrateItemAttachments(await attachSenders(messages)) };
  } catch {
    return { ok: true as const, messages: [] };
  }
}
