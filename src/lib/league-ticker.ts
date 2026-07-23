import { prisma } from "@/lib/prisma";

export type LeagueTickerItem = {
  id: string;
  type: string;
  message: string;
  href: string | null;
  priority: number;
  createdAt: Date;
};

type PublishLeagueTickerInput = {
  type: string;
  message: string;
  href?: string | null;
  eventKey?: string | null;
  priority?: number;
  ttlHours?: number;
  sampleRate?: number;
};

export async function publishLeagueTicker(input: PublishLeagueTickerInput): Promise<boolean> {
  const message = input.message.trim().replace(/\s+/g, " ");
  if (!message || message.length > 320) return false;
  const sampleRate = Math.max(0, Math.min(1, input.sampleRate ?? 1));
  if (sampleRate < 1 && Math.random() > sampleRate) return false;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(1, input.ttlHours ?? 12) * 3_600_000);
  try {
    if (input.eventKey) {
      await prisma.leagueTickerEvent.upsert({
        where: { eventKey: input.eventKey },
        create: {
          type: input.type,
          message,
          href: input.href,
          eventKey: input.eventKey,
          priority: input.priority ?? 0,
          expiresAt,
        },
        update: {
          message,
          href: input.href,
          priority: input.priority ?? 0,
          startsAt: now,
          expiresAt,
        },
      });
    } else {
      await prisma.leagueTickerEvent.create({
        data: {
          type: input.type,
          message,
          href: input.href,
          priority: input.priority ?? 0,
          expiresAt,
        },
      });
    }
    if (Math.random() < 0.05) {
      const expired = await prisma.leagueTickerEvent.findMany({
        where: { expiresAt: { lt: now } },
        select: { id: true },
        take: 200,
      });
      if (expired.length) {
        const ids = expired.map((event) => event.id);
        await prisma.$transaction([
          prisma.leagueTickerView.deleteMany({ where: { eventId: { in: ids } } }),
          prisma.leagueTickerEvent.deleteMany({ where: { id: { in: ids } } }),
        ]).catch(() => null);
      }
    }
    return true;
  } catch (error) {
    console.error("[LeagueTicker] Falha ao publicar evento", { type: input.type, error });
    return false;
  }
}

export async function getPendingLeagueTickerEvents(playerId: string, limit = 12): Promise<LeagueTickerItem[]> {
  const viewed = await prisma.leagueTickerView.findMany({
    where: { playerId },
    select: { eventId: true },
    orderBy: { seenAt: "desc" },
    take: 500,
  });
  return prisma.leagueTickerEvent.findMany({
    where: {
      startsAt: { lte: new Date() },
      expiresAt: { gt: new Date() },
      id: viewed.length ? { notIn: viewed.map((item) => item.eventId) } : undefined,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(20, limit)),
    select: { id: true, type: true, message: true, href: true, priority: true, createdAt: true },
  });
}

export async function markLeagueTickerEventSeen(playerId: string, eventId: string): Promise<void> {
  const exists = await prisma.leagueTickerEvent.count({ where: { id: eventId } });
  if (!exists) return;
  await prisma.leagueTickerView.upsert({
    where: { eventId_playerId: { eventId, playerId } },
    create: { eventId, playerId },
    update: { seenAt: new Date() },
  });
}
