const BRT_TIME_ZONE = "America/Sao_Paulo";
const TEAM_LOCK_START_MINUTE = 20 * 60;
const TEAM_LOCK_END_MINUTE = 20 * 60 + 30;

function getBrtParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "0";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minuteOfDay: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function nextLeagueDay(date: string) {
  const cursor = new Date(`${date}T12:00:00Z`);
  do {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  } while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6);
  return cursor.toISOString().slice(0, 10);
}

export function getWeeklyTeamEditWindow(now = new Date()) {
  const { date, minuteOfDay } = getBrtParts(now);
  const locked = minuteOfDay >= TEAM_LOCK_START_MINUTE && minuteOfDay < TEAM_LOCK_END_MINUTE;
  const preparingNextDay = minuteOfDay >= TEAM_LOCK_END_MINUTE;
  return {
    locked,
    battleDate: preparingNextDay ? nextLeagueDay(date) : date,
    preparingNextDay,
    lockStartsAt: "20:00",
    unlocksAt: "20:30",
  };
}

export const WEEKLY_TEAM_LOCK_MESSAGE =
  "As equipes ficam travadas durante os três combates, das 20:00 às 20:30 (BRT). Depois disso, você poderá preparar os times do próximo dia.";
