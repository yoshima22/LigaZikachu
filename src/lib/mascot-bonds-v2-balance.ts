import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";

export const BONDS_V2_BALANCE = {
  friend: { minScore: 40, expeditionTimeReductionPct: 3, trainingExpPct: 5 },
  superFriend: { minScore: 80, expeditionTimeReductionPct: 7, trainingExpPct: 10 },
  enemy: { maxScore: -50, damagePct: 5 },
  nemesis: { maxScore: -80, damagePct: 8, directRounds: 3 },
  motivation: { activationsPerMascotPerDay: 1 },
  caps: { expeditionTimeReductionPct: 8, trainingExpPct: 10 },
} as const;

/** Bônus real isolado para contas administrativas durante a prévia. */
export async function getBondsV2ExpeditionBonus(mascotId: string, mode: string) {
  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId },
    select: { player: { select: { user: { select: { role: true } } } } },
  });
  if (!mascot || (mascot.player.user.role !== "ADMIN" && mascot.player.user.role !== "SUPER_ADMIN")) {
    return { timeReductionPct: 0, trainingExpPct: 0, partnerName: null as string | null };
  }
  const best = await prisma.mascotRelation.findFirst({
    where: {
      mascotAId: mascotId,
      isActive: true,
      relationshipScore: { gte: BONDS_V2_BALANCE.friend.minScore },
      mascotB: { expeditions: { some: { status: "ACTIVE" } } },
    },
    orderBy: { relationshipScore: "desc" },
    select: { relationshipScore: true, mascotB: { select: { pokemonId: true, nickname: true } } },
  });
  if (!best) return { timeReductionPct: 0, trainingExpPct: 0, partnerName: null as string | null };
  const superFriend = best.relationshipScore >= BONDS_V2_BALANCE.superFriend.minScore;
  return {
    timeReductionPct: superFriend ? BONDS_V2_BALANCE.superFriend.expeditionTimeReductionPct : BONDS_V2_BALANCE.friend.expeditionTimeReductionPct,
    trainingExpPct: mode === "TRAINING" ? (superFriend ? BONDS_V2_BALANCE.superFriend.trainingExpPct : BONDS_V2_BALANCE.friend.trainingExpPct) : 0,
    partnerName: best.mascotB.nickname ?? getPokemonName(best.mascotB.pokemonId),
  };
}
