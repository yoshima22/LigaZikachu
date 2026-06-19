import { prisma } from "@/lib/prisma";

type RewardDef = {
  coins: number;
  label: string;
  eggType: "EVENT" | "SPECIAL" | "RARE" | "COMMON" | null;
  eggQuantity?: number;
  foodGift: string | null;
};

const rewardsByPosition: Record<number, RewardDef> = {
  1: { coins: 1200, label: "1º lugar no Desafio Sincronizado", eggType: "EVENT", eggQuantity: 3, foodGift: "Amuleto da Sorte" },
  2: { coins: 800, label: "2º lugar no Desafio Sincronizado", eggType: "SPECIAL", foodGift: "Vitamina Chocante" },
  3: { coins: 500, label: "3º lugar no Desafio Sincronizado", eggType: "RARE", foodGift: "Bala de Mel" },
  4: { coins: 300, label: "4º lugar no Desafio Sincronizado", eggType: "COMMON", foodGift: "Água Fresca" },
};

const consolationReward: RewardDef = {
  coins: 150,
  label: "Participação no Desafio Sincronizado",
  eggType: "COMMON",
  foodGift: "Água Fresca",
};

export async function finalizeSyncEventRoomRewards(roomId: string) {
  const room = await prisma.syncEventRoom.findUnique({
    where: { id: roomId },
    include: { scores: { include: { player: { select: { id: true, displayName: true } } } } },
  });
  if (!room) throw new Error("Sala não encontrada.");

  const sorted = [...room.scores].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.damageDone !== a.damageDone) return b.damageDone - a.damageDone;
    return a.damageTaken - b.damageTaken;
  });

  const scoresByTeam = new Map<string, (typeof sorted)[0]>();
  for (const score of sorted) {
    const existing = scoresByTeam.get(score.teamId);
    if (!existing || score.wins > existing.wins) scoresByTeam.set(score.teamId, score);
  }

  const teamRanking = [...scoresByTeam.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.damageDone !== a.damageDone) return b.damageDone - a.damageDone;
    return a.damageTaken - b.damageTaken;
  });

  let granted = 0;
  for (let pos = 0; pos < teamRanking.length; pos++) {
    const position = pos + 1;
    const teamTopScore = teamRanking[pos];
    const reward = rewardsByPosition[position] ?? consolationReward;
    const allTeamScores = sorted.filter((score) => score.teamId === teamTopScore.teamId);

    for (const score of allTeamScores) {
      const fresh = await prisma.syncEventScore.findUnique({
        where: { id: score.id },
        select: { rewardGranted: true },
      });
      if (fresh?.rewardGranted) continue;

      let wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: score.playerId } });
      if (!wallet) {
        wallet = await prisma.zikaCoinWallet.create({
          data: { playerId: score.playerId, balance: 0, totalEarned: 0, totalSpent: 0 },
        });
      }

      await prisma.zikaCoinWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: reward.coins }, totalEarned: { increment: reward.coins } },
      });
      await prisma.zikaCoinTransaction.create({
        data: {
          walletId: wallet.id,
          type: "ADMIN_ADJUSTMENT",
          amount: reward.coins,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance + reward.coins,
          description: `Desafio Sincronizado — ${reward.label}`,
        },
      });

      if (reward.eggType) {
        const eggQuantity = Math.max(1, reward.eggQuantity ?? 1);
        await prisma.mascotEgg.createMany({
          data: Array.from({ length: eggQuantity }, () => ({
            playerId: score.playerId,
            type: reward.eggType!,
            origin: `Desafio Sincronizado — ${reward.label}`,
          })),
        });
      }

      if (reward.foodGift) {
        await prisma.playerGift.create({
          data: {
            playerId: score.playerId,
            type: "CUSTOM",
            title: "Recompensa Desafio Sincronizado",
            description: `${reward.label} — ${reward.foodGift}`,
            payload: { item: reward.foodGift, source: "sync-challenge" },
            status: "UNCLAIMED",
          },
        });
      }

      await prisma.syncEventScore.update({
        where: { id: score.id },
        data: { finalPosition: position, rewardGranted: true },
      });
      granted++;
    }
  }

  return { granted };
}
