import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import { BONDS_V2_BALANCE } from "@/lib/mascot-bonds-v2-config";

export { BONDS_V2_BALANCE };

/** Bônus do Laços Alpha para todos os jogadores. */
export async function getBondsV2ExpeditionBonus(mascotId: string, mode: string) {
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
