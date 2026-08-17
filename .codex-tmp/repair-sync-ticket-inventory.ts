import { prisma } from "../src/lib/prisma";
import { reconcileSyncTicketInventory } from "../src/lib/sync-challenge";

async function main() {
  const rows = await prisma.playerInventory.findMany({
    where: { quantity: { gt: 0 }, item: { type: { in: ["SYNC_TICKET_FIRE_LEFT", "SYNC_TICKET_WATER_RIGHT", "SYNC_TICKET_COMPLETE"] } } },
    select: { playerId: true },
    distinct: ["playerId"],
  });
  const repaired: { playerId: string; converted: number }[] = [];
  for (const row of rows) {
    const converted = await prisma.$transaction((tx) => reconcileSyncTicketInventory(tx, row.playerId));
    repaired.push({ playerId: row.playerId, converted });
  }
  console.log(JSON.stringify(repaired));
}

main().catch(console.error).finally(() => prisma.$disconnect());
