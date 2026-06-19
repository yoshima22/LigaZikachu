import { prisma } from "@/lib/prisma";

const EXPIRED_REWARDS = { SHORT: 30, MEDIUM: 22, LONG: 16, WEEKLY: 50 } as const;

async function settleExpiredTraceRooms() {
  const expiredRooms = await prisma.traceRoom.findMany({
    where: { status: { in: ["WAITING", "HUNTING"] }, expiresAt: { lte: new Date() } },
    select: {
      id: true,
      hiderId: true,
      hiderMascotId: true,
      hunterMascotId: true,
      routeType: true,
      isAdminSim: true,
      hider: { select: { displayName: true } },
    },
    take: 10,
  });

  for (const room of expiredRooms) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.traceRoom.updateMany({
        where: { id: room.id, status: { in: ["WAITING", "HUNTING"] } },
        data: { status: "ESCAPED", resolvedAt: new Date(), updatedAt: new Date() },
      });
      if (updated.count !== 1) return;

      await tx.mascot.update({ where: { id: room.hiderMascotId }, data: { arenaState: "FREE", restingUntil: null } });
      if (room.hunterMascotId) {
        await tx.mascot.update({ where: { id: room.hunterMascotId }, data: { arenaState: "FREE", restingUntil: null } });
      }
      if (!room.isAdminSim) {
        await tx.goldenPawTransaction.create({
          data: {
            playerId: room.hiderId,
            amount: EXPIRED_REWARDS[room.routeType],
            reason: `Esconderijo expirou sem ser encontrado (${room.routeType})`,
          },
        });
      }
      await tx.traceEventLog.create({
        data: {
          roomId: room.id,
          playerName: room.hider.displayName,
          description: `${room.hider.displayName} resistiu ate o fim da rota ${room.routeType}.`,
        },
      });
    });
  }
}

export async function getTracePageData(playerId: string, displayName: string) {
  await settleExpiredTraceRooms();

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
          moves: { orderBy: { createdAt: "desc" }, take: 8 },
          randomEvents: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.traceRoom.findMany({
        where: { status: "WAITING", hiderId: { not: playerId } },
        include: {
          hider: { select: { displayName: true } },
          hiderMascot: { select: { pokemonId: true, nickname: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
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
          bazarListed: false,
          OR: [{ restingUntil: null }, { restingUntil: { lte: new Date() } }],
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
        take: 120,
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
