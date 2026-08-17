import { getSyncRewardsConfig } from "../src/lib/sync-event-rewards";
import { prisma } from "../src/lib/prisma";

async function main() {
  const config = await getSyncRewardsConfig();
  const itemIds = Object.values(config).map((reward) => reward.shopItemId).filter(Boolean) as string[];
  const items = await prisma.shopItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } });
  console.log(JSON.stringify({ config, items }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
