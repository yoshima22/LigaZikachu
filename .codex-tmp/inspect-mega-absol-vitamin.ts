import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const mascots = await prisma.mascot.findMany({
    where: {
      OR: [
        { nickname: { contains: "Absol", mode: "insensitive" } },
        { pokemonId: { in: [359, 10057] } },
      ],
    },
    select: {
      id: true,
      nickname: true,
      pokemonId: true,
      level: true,
      exp: true,
      player: { select: { id: true, displayName: true, ptcglNick: true } },
      buffs: { orderBy: { createdAt: "desc" }, take: 10 },
      expeditions: { orderBy: { startedAt: "desc" }, take: 10 },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  const vitamin = await prisma.shopItem.findFirst({
    where: { type: "MASCOT_BUFF_EXP" },
    select: { id: true, name: true, description: true, metadata: true },
  });
  console.log(JSON.stringify({ vitamin, mascots }, null, 2));
}

main().finally(() => prisma.$disconnect());
