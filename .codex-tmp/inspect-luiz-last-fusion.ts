import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { displayName: { contains: "Luiz", mode: "insensitive" } },
        { ptcglNick: { contains: "Luiz", mode: "insensitive" } },
      ],
    },
    select: { id: true, displayName: true, ptcglNick: true },
  });
  for (const player of players) {
    const wallet = await prisma.zikaCoinWallet.findUnique({
      where: { playerId: player.id },
      include: {
        transactions: {
          where: { description: "Uso da Máquina de Fusão de Ovos do Miauvadão" },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
    const eggs = await prisma.mascotEgg.findMany({
      where: { playerId: player.id },
      orderBy: { obtainedAt: "desc" },
      take: 20,
      select: { id: true, type: true, origin: true, hatchRarityBonusPct: true, obtainedAt: true },
    });
    console.log(JSON.stringify({ player, wallet, eggs }, null, 2));
  }
  console.log(JSON.stringify(await prisma.miauvadaoConfig.findUnique({ where: { id: "singleton" } }), null, 2));
}

main().finally(() => prisma.$disconnect());
