import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensureBeginnerOnboarding } from "../src/lib/beginner-onboarding";
import {
  TIMED_GAME_BONUSES_KEY,
  type TimedGameBonusEvent,
} from "../src/lib/timed-game-bonuses";

const prisma = new PrismaClient();

const WEEKENDS: Array<{ id: string; name: string; startsAt: string; endsAt: string }> = [
  { id: "johto-august-weekend-2026-08-08", name: "Rumo a Johto — Fim de semana 1", startsAt: "2026-08-08T00:00:00-03:00", endsAt: "2026-08-10T00:00:00-03:00" },
  { id: "johto-august-weekend-2026-08-15", name: "Rumo a Johto — Fim de semana 2", startsAt: "2026-08-15T00:00:00-03:00", endsAt: "2026-08-17T00:00:00-03:00" },
  { id: "johto-august-weekend-2026-08-22", name: "Rumo a Johto — Fim de semana 3", startsAt: "2026-08-22T00:00:00-03:00", endsAt: "2026-08-24T00:00:00-03:00" },
];

async function main() {
  const beginner = await prisma.passScheduleConfig.findUnique({ where: { id: "Passe Iniciante" } });
  if (!beginner || !Array.isArray(beginner.schedule)) throw new Error("Passe Iniciante não encontrado.");
  const sevenDays = beginner.schedule.slice(0, 7);
  await prisma.passScheduleConfig.update({
    where: { id: "Passe Iniciante" },
    data: {
      schedule: sevenDays,
      displayTitle: "Passe Iniciante",
      description: "Sete dias de recompensas para começar sua jornada na Liga Zikachu.",
      flavorText: "Todo grande treinador começou chocando o primeiro ovo.",
    },
  });

  const setting = await prisma.appSetting.findUnique({ where: { key: TIMED_GAME_BONUSES_KEY } });
  const current = Array.isArray(setting?.value) ? setting.value as unknown as TimedGameBonusEvent[] : [];
  const eventIds = new Set(WEEKENDS.map(event => event.id));
  const kept = current.filter(event => !eventIds.has(event.id));
  const createdAt = new Date().toISOString();
  const alreadyConfiguredPeriods = new Set(kept.filter(event =>
    event.enabled && event.expeditionExpBonusPct === 10 && event.eggRarityBonusPct === 1 && event.arenaDailyZcLimit === 3000
  ).map(event => `${new Date(event.startsAt).getTime()}:${new Date(event.endsAt).getTime()}`));
  const weekendEvents: TimedGameBonusEvent[] = WEEKENDS.filter(event =>
    !alreadyConfiguredPeriods.has(`${new Date(event.startsAt).getTime()}:${new Date(event.endsAt).getTime()}`)
  ).map(event => ({
    ...event,
    enabled: true,
    expeditionExpBonusPct: 10,
    expeditionModes: [],
    expeditionDurations: [],
    eggRarityBonusPct: 1,
    arenaDailyZcLimit: 3000,
    createdAt,
  }));
  await prisma.appSetting.upsert({
    where: { key: TIMED_GAME_BONUSES_KEY },
    create: { key: TIMED_GAME_BONUSES_KEY, value: [...kept, ...weekendEvents] as object[] },
    update: { value: [...kept, ...weekendEvents] as object[] },
  });

  const cutoff = new Date(Date.now() - 15 * 86_400_000);
  const recentPlayers = await prisma.player.findMany({
    where: { user: { createdAt: { gte: cutoff }, role: "PLAYER" } },
    select: { id: true, displayName: true },
  });
  const delivered: string[] = [];
  for (const player of recentPlayers) {
    const result = await ensureBeginnerOnboarding(player.id);
    if (result.passCreated) delivered.push(player.displayName);
  }

  console.log(JSON.stringify({
    beginnerPassDays: sevenDays.length,
    weekendEvents: weekendEvents.map(event => ({ name: event.name, startsAt: event.startsAt, endsAt: event.endsAt })),
    recentPlayersProcessed: recentPlayers.map(player => player.displayName),
    newPassesDelivered: delivered,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
