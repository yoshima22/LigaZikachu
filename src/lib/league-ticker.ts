import { prisma } from "@/lib/prisma";
import { pilotEnabled } from "@/lib/companion/pilot";
import { weeklyTickerEvent } from "@/lib/companion/events";
import { publishCompanionNotification } from "@/lib/companion/event-store";

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
    let tickerId: string;
    if (input.eventKey) {
      const saved = await prisma.leagueTickerEvent.upsert({
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
      tickerId = saved.id;
    } else {
      const saved = await prisma.leagueTickerEvent.create({
        data: {
          type: input.type,
          message,
          href: input.href,
          priority: input.priority ?? 0,
          expiresAt,
        },
      });
      tickerId = saved.id;
    }
    if (pilotEnabled()) {
      const event = weeklyTickerEvent(input.type, tickerId, message, input.href);
      if (event) {
        const userIds = (process.env.ZIKACOMPANION_PILOT_USER_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean);
        await publishCompanionNotification(userIds, event, event, 'WEEKLY_TICKER').catch(() => undefined);
      }
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
  const now = new Date();
  const take = Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.floor(limit))) : 12;
  // Preserve the latest-500 seen window without transferring those IDs to the server.
  // Tagged parameters keep player IDs and limits out of the SQL text.
  return prisma.$queryRaw<LeagueTickerItem[]>`
    SELECT e.id, e.type, e.message, e.href, e.priority, e."createdAt"
    FROM league_ticker_events e
    WHERE e."startsAt" <= ${now} AND e."expiresAt" > ${now}
      AND e.id NOT IN (
        SELECT v."eventId" FROM league_ticker_views v
        WHERE v."playerId" = ${playerId}
        ORDER BY v."seenAt" DESC
        LIMIT 500
      )
    ORDER BY e.priority DESC, e."createdAt" DESC
    LIMIT ${take}
  `;
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
