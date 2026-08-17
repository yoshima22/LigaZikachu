import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const players = await prisma.player.findMany({
    where: { displayName: { contains: "Glauco", mode: "insensitive" } },
    select: { id: true, displayName: true },
  });
  const gifts = await prisma.playerGift.findMany({
    where: {
      playerId: { in: players.map((player) => player.id) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      playerId: true,
      title: true,
      description: true,
      payload: true,
      status: true,
      createdAt: true,
    },
  });
  const item = await prisma.shopItem.findFirst({
    where: { type: "LEAGUE_ANNOYING_WHISTLE" },
    select: { id: true, type: true, name: true, description: true, active: true },
  });
  console.log(JSON.stringify({ players, gifts, item }, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
