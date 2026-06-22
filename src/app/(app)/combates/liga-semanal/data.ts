import { prisma } from "@/lib/prisma";

export async function getLeaguePageData(playerId: string, displayName: string) {
  // Current active league (if any)
  let currentLeague = null;
  let participants: unknown[] = [];
  let myTeams: unknown[] = [];
  let todayMatches: unknown[] = [];
  let allMascots: unknown[] = [];

  try {
    currentLeague = await (prisma as any).weeklyMascotLeague.findFirst({
      where: { status: { in: ["REGISTRATION", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
    });
  } catch { /* table may not exist yet */ }

  if (currentLeague) {
    try {
      participants = await (prisma as any).weeklyMascotLeagueParticipant.findMany({
        where: { leagueId: (currentLeague as any).id },
        orderBy: [{ points: "desc" }, { wins: "desc" }, { damageDealt: "desc" }],
      });
    } catch { /* table may not exist yet */ }

    const today = new Date().toISOString().slice(0, 10);
    try {
      myTeams = await (prisma as any).weeklyMascotLeagueDailyTeam.findMany({
        where: { leagueId: (currentLeague as any).id, playerId, battleDate: today },
        orderBy: { battleSlot: "asc" },
      });
    } catch { /* table may not exist yet */ }

    try {
      todayMatches = await (prisma as any).weeklyMascotLeagueMatch.findMany({
        where: { leagueId: (currentLeague as any).id, battleDate: today },
        orderBy: [{ battleSlot: "asc" }, { createdAt: "asc" }],
      });
    } catch { /* table may not exist yet */ }
  }

  let walletBalance = 0;
  let leagueInventory: { type: string; quantity: number }[] = [];

  try {
    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId }, select: { balance: true } });
    walletBalance = wallet?.balance ?? 0;
  } catch {}

  try {
    const inv = await prisma.playerInventory.findMany({
      where: {
        playerId,
        quantity: { gt: 0 },
        item: { type: { in: [
          "LEAGUE_CAPTAIN_BAND", "LEAGUE_FORMATION_WHISTLE", "LEAGUE_BENCH_SHIELD",
          "LEAGUE_CHEER_FLAG", "LEAGUE_ENGUICA_STRATEGY", "LEAGUE_ANALYSIS_LANTERN",
          "LEAGUE_ROUND_BOOTS", "LEAGUE_LOCKER_TONIC",
          "LEAGUE_CONFUSION_SPRAY", "LEAGUE_WRONG_SIGN", "LEAGUE_ANNOYING_WHISTLE",
          "LEAGUE_FIELD_SAND", "LEAGUE_EVIL_EYE", "LEAGUE_CROWD_NOISE",
          "LEAGUE_EMBARRASSING_TAPE", "LEAGUE_PROVOCATION_TICKET",
        ] } },
      },
      include: { item: { select: { type: true } } },
    });
    leagueInventory = inv.map(i => ({ type: i.item.type, quantity: i.quantity }));
  } catch {}

  try {
    allMascots = await prisma.mascot.findMany({
      where: { playerId },
      select: {
        id: true, pokemonId: true, nickname: true, level: true,
        statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
      },
      orderBy: { level: "desc" },
    });
  } catch { /* should always work */ }

  return {
    player: { id: playerId, displayName, walletBalance },
    currentLeague,
    participants,
    myTeams,
    todayMatches,
    availableMascots: allMascots,
    leagueInventory,
  };
}
