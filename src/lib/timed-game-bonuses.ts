import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ExpeditionDuration, ExpeditionMode } from "@/lib/mascot-data";

export const TIMED_GAME_BONUSES_KEY = "timed_game_bonus_events";
export const TIMED_GAME_BONUSES_TAG = "timed-game-bonus-events";
export const DEFAULT_ARENA_DAILY_ZC_LIMIT = 2000;

export type TimedGameBonusEvent = {
  id: string;
  name: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  expeditionExpBonusPct: number;
  expeditionModes: ExpeditionMode[];
  expeditionDurations: ExpeditionDuration[];
  eggRarityBonusPct: number;
  arenaDailyZcLimit: number | null;
  createdAt: string;
};

function numberInRange(value: unknown, min: number, max: number, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function normalizeTimedGameBonusEvent(value: unknown): TimedGameBonusEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<TimedGameBonusEvent>;
  if (!event.id || !event.name || !event.startsAt || !event.endsAt) return null;
  const validModes: ExpeditionMode[] = ["STANDARD", "TRAINING", "ITEMS"];
  const validDurations: ExpeditionDuration[] = ["30min", "1h", "3h", "6h"];
  return {
    id: String(event.id),
    name: String(event.name).slice(0, 80),
    enabled: event.enabled !== false,
    startsAt: String(event.startsAt),
    endsAt: String(event.endsAt),
    expeditionExpBonusPct: numberInRange(event.expeditionExpBonusPct, 0, 500),
    expeditionModes: Array.isArray(event.expeditionModes)
      ? event.expeditionModes.filter((mode): mode is ExpeditionMode => validModes.includes(mode as ExpeditionMode))
      : [],
    expeditionDurations: Array.isArray(event.expeditionDurations)
      ? event.expeditionDurations.filter((duration): duration is ExpeditionDuration => validDurations.includes(duration as ExpeditionDuration))
      : [],
    eggRarityBonusPct: numberInRange(event.eggRarityBonusPct, 0, 20),
    arenaDailyZcLimit: event.arenaDailyZcLimit == null
      ? null
      : Math.round(numberInRange(event.arenaDailyZcLimit, DEFAULT_ARENA_DAILY_ZC_LIMIT, 1_000_000, DEFAULT_ARENA_DAILY_ZC_LIMIT)),
    createdAt: event.createdAt ? String(event.createdAt) : new Date().toISOString(),
  };
}

export const getTimedGameBonusEvents = unstable_cache(
  async (): Promise<TimedGameBonusEvent[]> => {
    const setting = await prisma.appSetting.findUnique({
      where: { key: TIMED_GAME_BONUSES_KEY },
      select: { value: true },
    }).catch(() => null);
    const raw = setting?.value;
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeTimedGameBonusEvent).filter((event): event is TimedGameBonusEvent => event !== null);
  },
  [TIMED_GAME_BONUSES_KEY],
  { revalidate: 60, tags: [TIMED_GAME_BONUSES_TAG] },
);

export async function getActiveTimedGameBonuses(now = new Date()) {
  const timestamp = now.getTime();
  const events = (await getTimedGameBonusEvents()).filter(event =>
    event.enabled && new Date(event.startsAt).getTime() <= timestamp && new Date(event.endsAt).getTime() > timestamp
  );
  return {
    events,
    eggRarityBonusPct: Math.min(20, events.reduce((sum, event) => sum + event.eggRarityBonusPct, 0)),
    arenaDailyZcLimit: events.reduce(
      (limit, event) => Math.max(limit, event.arenaDailyZcLimit ?? DEFAULT_ARENA_DAILY_ZC_LIMIT),
      DEFAULT_ARENA_DAILY_ZC_LIMIT,
    ),
  };
}

export async function getExpeditionEventBonusPct(mode: ExpeditionMode, duration: ExpeditionDuration) {
  const { events } = await getActiveTimedGameBonuses();
  return Math.min(500, events.reduce((sum, event) => {
    const modeMatches = event.expeditionModes.length === 0 || event.expeditionModes.includes(mode);
    const durationMatches = event.expeditionDurations.length === 0 || event.expeditionDurations.includes(duration);
    return modeMatches && durationMatches ? sum + event.expeditionExpBonusPct : sum;
  }, 0));
}

export async function getActiveEggRarityBonusPct() {
  return (await getActiveTimedGameBonuses()).eggRarityBonusPct;
}

export async function getActiveArenaDailyZcLimit() {
  return (await getActiveTimedGameBonuses()).arenaDailyZcLimit;
}
