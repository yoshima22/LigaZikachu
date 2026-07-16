import { prisma } from "@/lib/prisma";

type WeeklyLeagueLockClient = Pick<
  typeof prisma,
  "weeklyMascotLeague" | "weeklyMascotLeagueDailyTeam" | "weeklyMascotLeagueMatch"
>;

function readMascotIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export function getTodayBrt(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function teamKey(leagueId: string, battleDate: string, battleSlot: number) {
  return `${leagueId}:${battleDate}:${battleSlot}`;
}

function uniqueTargets(targets: Array<{ leagueId: string; battleDate: string; battleSlot: number }>) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = teamKey(target.leagueId, target.battleDate, target.battleSlot);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Mascotes usados na Liga Semanal ficam fora do Bazar enquanto houver confronto
 * pendente. Isso inclui times gravados para hoje/futuro e times que a tela da
 * Liga mostra por heranca antes do cron materializar a linha INHERITED_AUTO.
 */
export async function getWeeklyLeagueLockedMascotIds(
  client: WeeklyLeagueLockClient,
  playerId: string,
  now = new Date(),
) {
  const today = getTodayBrt(now);
  const locked = new Set<string>();

  const leagues = await client.weeklyMascotLeague.findMany({
    where: {
      status: { in: ["REGISTRATION", "ACTIVE"] },
      participants: { some: { playerId } },
    },
    select: { id: true },
  });
  const leagueIds = leagues.map((league) => league.id);
  if (!leagueIds.length) return locked;

  const explicitTeams = await client.weeklyMascotLeagueDailyTeam.findMany({
    where: {
      playerId,
      leagueId: { in: leagueIds },
      battleDate: { gte: today },
    },
    select: { leagueId: true, battleDate: true, battleSlot: true, mascotIdsJson: true },
  });

  const explicitKeys = new Set<string>();
  for (const team of explicitTeams) {
    explicitKeys.add(teamKey(team.leagueId, team.battleDate, team.battleSlot));
    for (const mascotId of readMascotIds(team.mascotIdsJson)) locked.add(mascotId);
  }

  const visibleTodayInheritedSlots = leagueIds.flatMap((leagueId) =>
    [1, 2, 3]
      .filter((battleSlot) => !explicitKeys.has(teamKey(leagueId, today, battleSlot)))
      .map((battleSlot) => ({ leagueId, battleDate: today, battleSlot })),
  );

  const pendingMatches = await client.weeklyMascotLeagueMatch.findMany({
    where: {
      leagueId: { in: leagueIds },
      battleDate: { gte: today },
      status: { in: ["SCHEDULED"] },
      OR: [{ playerAId: playerId }, { playerBId: playerId }],
    },
    select: { leagueId: true, battleDate: true, battleSlot: true },
  });

  const inheritedTargets = uniqueTargets([
    ...visibleTodayInheritedSlots,
    ...pendingMatches,
  ]);

  const inheritedLookups = inheritedTargets
    .filter((match) => !explicitKeys.has(teamKey(match.leagueId, match.battleDate, match.battleSlot)))
    .map((match) =>
      client.weeklyMascotLeagueDailyTeam.findFirst({
        where: {
          leagueId: match.leagueId,
          playerId,
          battleSlot: match.battleSlot,
          battleDate: { lt: match.battleDate },
        },
        orderBy: { battleDate: "desc" },
        select: { mascotIdsJson: true },
      }),
    );

  const inheritedTeams = await Promise.all(inheritedLookups);
  for (const team of inheritedTeams) {
    for (const mascotId of readMascotIds(team?.mascotIdsJson)) locked.add(mascotId);
  }

  return locked;
}

export async function isMascotLockedInWeeklyLeague(
  client: WeeklyLeagueLockClient,
  mascotId: string,
  playerId: string,
) {
  const lockedIds = await getWeeklyLeagueLockedMascotIds(client, playerId);
  return lockedIds.has(mascotId);
}
