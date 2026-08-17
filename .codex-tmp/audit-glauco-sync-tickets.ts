import { prisma } from "../src/lib/prisma";

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { displayName: { contains: "Glauco", mode: "insensitive" } },
        { user: { name: { contains: "Glauco", mode: "insensitive" } } },
      ],
    },
    select: { id: true, displayName: true, user: { select: { name: true, email: true } } },
  });

  for (const player of players) {
    const [halves, inventory, complete, gifts] = await Promise.all([
      prisma.syncTicketHalf.groupBy({
        by: ["side", "status"],
        where: { ownerId: player.id },
        _count: { _all: true },
      }),
      prisma.playerInventory.findMany({
        where: { playerId: player.id, quantity: { gt: 0 }, item: { type: { in: ["SYNC_TICKET_FIRE_LEFT", "SYNC_TICKET_WATER_RIGHT", "SYNC_TICKET_COMPLETE"] } } },
        select: { quantity: true, item: { select: { id: true, name: true, type: true, active: true } } },
      }),
      prisma.syncTicket.groupBy({
        by: ["status"],
        where: { ownerId: player.id },
        _count: { _all: true },
      }),
      prisma.playerGift.findMany({
        where: { playerId: player.id },
        select: { id: true, claimedAt: true, title: true, payload: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const syncGifts = gifts.filter((gift) => JSON.stringify(gift.payload).includes("SYNC_TICKET"));
    console.log(JSON.stringify({ player, halves, inventory, complete, syncGifts }, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
