import { prisma } from "../src/lib/prisma";

async function main() {
  const [halves, inventories] = await Promise.all([
    prisma.syncTicketHalf.groupBy({ by: ["ownerId", "side", "status"], _count: { _all: true } }),
    prisma.playerInventory.findMany({
      where: { quantity: { gt: 0 }, item: { type: { in: ["SYNC_TICKET_FIRE_LEFT", "SYNC_TICKET_WATER_RIGHT", "SYNC_TICKET_COMPLETE"] } } },
      select: { playerId: true, quantity: true, item: { select: { type: true } } },
    }),
  ]);
  const playerIds = [...new Set([...halves.map((row) => row.ownerId), ...inventories.map((row) => row.playerId)])];
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, displayName: true } });
  console.log(JSON.stringify({
    halves: halves.map((row) => ({ player: players.find((p) => p.id === row.ownerId)?.displayName, side: row.side, status: row.status, count: row._count._all })),
    legacyInventory: inventories.map((row) => ({ player: players.find((p) => p.id === row.playerId)?.displayName, type: row.item.type, quantity: row.quantity })),
  }));
}

main().catch(console.error).finally(() => prisma.$disconnect());
