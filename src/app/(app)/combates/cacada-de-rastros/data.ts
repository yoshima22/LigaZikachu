import { prisma } from "@/lib/prisma";

export async function getTracePageData(playerId: string, displayName: string) {
  const [myRooms, openRooms, globalHistory, myInventory, allMascots, fullPlayer] =
    await Promise.all([
      prisma.traceRoom.findMany({
        where: {
          OR: [{ hiderId: playerId }, { hunterId: playerId }],
          status: { in: ["WAITING", "HUNTING"] },
        },
        include: {
          hider: { select: { displayName: true } },
          hiderMascot: {
            select: {
              pokemonId: true,
              nickname: true,
              statVitality: true,
              statInstinct: true,
              statAgility: true,
            },
          },
          hunter: { select: { displayName: true } },
          hunterMascot: {
            select: { pokemonId: true, nickname: true, statInstinct: true, statAgility: true },
          },
          moves: { orderBy: { createdAt: "asc" } },
          randomEvents: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.traceRoom.findMany({
        where: { status: "WAITING", hiderId: { not: playerId } },
        include: {
          hider: { select: { displayName: true } },
          hiderMascot: { select: { pokemonId: true, nickname: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.traceEventLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.playerInventory.findMany({
        where: {
          playerId,
          item: {
            type: {
              in: [
                "TRACE_MAP_SHORT",
                "TRACE_MAP_MEDIUM",
                "TRACE_MAP_LONG",
                "TRACE_MAP_WEEKLY",
                "TRACE_HUNT_TICKET",
                "TRACE_SIGNAL_FLARE",
                "TRACE_DECOY",
                "TRACE_SILENCE_POTION",
                "TRACE_ARMOR_VEST",
                "TRACE_MIST_SHIELD",
                "TRACE_INSTINCT_BOOST",
                "TRACE_GOLDEN_TICKET",
                "TRACE_SPECIAL_MAP",
              ],
            },
          },
          quantity: { gt: 0 },
        },
        include: { item: { select: { type: true, name: true } } },
      }),
      prisma.mascot.findMany({
        where: {
          playerId,
          arenaState: "FREE",
          expeditions: { none: { status: "ACTIVE" } },
          buffs: { none: { type: "VACATION", expiresAt: { gt: new Date() } } },
        },
        select: {
          id: true,
          pokemonId: true,
          nickname: true,
          statInstinct: true,
          statAgility: true,
          statVitality: true,
          statForce: true,
          statCharisma: true,
          level: true,
        },
        orderBy: { level: "desc" },
      }),
      prisma.goldenPawTransaction.aggregate({
        where: { playerId },
        _sum: { amount: true },
      }),
    ]);

  return {
    player: { id: playerId, displayName, goldenPaws: fullPlayer._sum.amount ?? 0 },
    myRooms,
    openRooms,
    globalHistory,
    myInventory,
    availableMascots: allMascots,
  };
}
