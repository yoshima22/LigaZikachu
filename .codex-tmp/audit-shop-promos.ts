import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  const promotions = await prisma.shopPromotion.findMany({
    select: { id: true, name: true, scope: true, itemId: true, items: { select: { itemId: true } } },
  });
  console.log(JSON.stringify(promotions, null, 2));
}
main().finally(() => prisma.$disconnect());
