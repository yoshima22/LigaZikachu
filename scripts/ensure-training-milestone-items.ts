import { ensureTrainingMilestoneShopItems } from "../src/lib/training-milestone-shop";
import { prisma } from "../src/lib/prisma";
import { TRAINING_MILESTONE_ITEMS } from "../src/lib/training-catalog";

async function main() {
  await ensureTrainingMilestoneShopItems(true);
  const count = await prisma.shopItem.count({
    where: { type: { in: TRAINING_MILESTONE_ITEMS.map((item) => item.type) as never[] } },
  });
  if (count !== 13) throw new Error(`Esperados 13 Marcos de Postura; encontrados ${count}.`);
  console.log(`Marcos de Postura ativos: ${count}`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
