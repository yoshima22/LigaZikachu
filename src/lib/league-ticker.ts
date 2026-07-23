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

export async function publishLeagueTicker(input: PublishLeagueTickerInput): Promise<void> {
  const message = input.message.trim().replace(/\s+/g, " ");
  if (!message || message.length > 320) return;
  const sampleRate = Math.max(0, Math.min(1, input.sampleRate ?? 1));
  if (sampleRate < 1 && Math.random() > sampleRate) return;

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
      await prisma.leagueTickerEvent.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => null);
    }
  } catch (error) {
    console.error("[LeagueTicker] Falha ao publicar evento", { type: input.type, error });
  }
}

export async function getActiveLeagueTickerEvents(limit = 12): Promise<LeagueTickerItem[]> {
  return prisma.leagueTickerEvent.findMany({
    where: { startsAt: { lte: new Date() }, expiresAt: { gt: new Date() } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(20, limit)),
    select: { id: true, type: true, message: true, href: true, priority: true, createdAt: true },
  });
}
