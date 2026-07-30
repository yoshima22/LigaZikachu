import { EggType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SyncRewardPosition = "1" | "2" | "3" | "4" | "participation";

export type SyncRewardDef = {
  coins: number;
  eggType: EggType | null;
  eggQuantity: number;
  shopItemId: string | null;
  shopItemQuantity: number;
};

export type SyncRewardsConfig = Record<SyncRewardPosition, SyncRewardDef>;

export const DEFAULT_SYNC_REWARDS: SyncRewardsConfig = {
  "1": { coins: 1200, eggType: EggType.EVENT, eggQuantity: 3, shopItemId: null, shopItemQuantity: 1 },
  "2": { coins: 800, eggType: EggType.SPECIAL, eggQuantity: 1, shopItemId: null, shopItemQuantity: 1 },
  "3": { coins: 500, eggType: EggType.RARE, eggQuantity: 1, shopItemId: null, shopItemQuantity: 1 },
  "4": { coins: 300, eggType: EggType.COMMON, eggQuantity: 1, shopItemId: null, shopItemQuantity: 1 },
  participation: { coins: 150, eggType: EggType.COMMON, eggQuantity: 1, shopItemId: null, shopItemQuantity: 1 },
};

const legacyItemNames: Record<SyncRewardPosition, string> = {
  "1": "Amuleto da Sorte",
  "2": "Vitamina Chocante",
  "3": "Bala de Mel",
  "4": "Água Fresca",
  participation: "Água Fresca",
};

function safeInt(value: unknown, fallback: number, max = 1_000_000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(max, Math.floor(parsed))) : fallback;
}

export function parseSyncRewardsConfig(value: Prisma.JsonValue | null | undefined): SyncRewardsConfig {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const result = structuredClone(DEFAULT_SYNC_REWARDS);
  for (const position of Object.keys(result) as SyncRewardPosition[]) {
    const raw = record[position];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const eggType = typeof item.eggType === "string" && Object.values(EggType).includes(item.eggType as EggType)
      ? item.eggType as EggType
      : null;
    result[position] = {
      coins: safeInt(item.coins, result[position].coins),
      eggType,
      eggQuantity: eggType ? Math.max(1, safeInt(item.eggQuantity, result[position].eggQuantity, 99)) : 0,
      shopItemId: typeof item.shopItemId === "string" && item.shopItemId.trim() ? item.shopItemId : null,
      shopItemQuantity: Math.max(1, safeInt(item.shopItemQuantity, 1, 99)),
    };
  }
  return result;
}

export async function getSyncRewardsConfig(): Promise<SyncRewardsConfig> {
  const config = await prisma.syncChallengeConfig.findUnique({ where: { id: "singleton" }, select: { rewardsJson: true } });
  const parsed = parseSyncRewardsConfig(config?.rewardsJson);
  if (config?.rewardsJson) return parsed;

  const legacyItems = await prisma.shopItem.findMany({
    where: { name: { in: Object.values(legacyItemNames) } },
    select: { id: true, name: true },
  });
  for (const position of Object.keys(legacyItemNames) as SyncRewardPosition[]) {
    parsed[position].shopItemId = legacyItems.find((item) => item.name === legacyItemNames[position])?.id ?? null;
  }
  return parsed;
}

function rewardLabel(position: number) {
  return position <= 4 ? `${position}º lugar no Desafio Sincronizado` : "Participação no Desafio Sincronizado";
}

export async function finalizeSyncEventRoomRewards(roomId: string) {
  const [room, rewards] = await Promise.all([
    prisma.syncEventRoom.findUnique({
      where: { id: roomId },
      include: { scores: { include: { player: { select: { id: true, displayName: true } } } } },
    }),
    getSyncRewardsConfig(),
  ]);
  if (!room) throw new Error("Sala não encontrada.");

  const sorted = [...room.scores].sort((a, b) => {
    if (a.finalPosition !== null && b.finalPosition !== null) return a.finalPosition - b.finalPosition;
    if (a.finalPosition !== null) return -1;
    if (b.finalPosition !== null) return 1;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.damageDone !== a.damageDone) return b.damageDone - a.damageDone;
    return a.damageTaken - b.damageTaken;
  });

  const scoresByTeam = new Map<string, (typeof sorted)[0]>();
  for (const score of sorted) if (!scoresByTeam.has(score.teamId)) scoresByTeam.set(score.teamId, score);
  const teamRanking = [...scoresByTeam.values()];
  const itemIds = [...new Set(Object.values(rewards).map((reward) => reward.shopItemId).filter(Boolean) as string[])];
  const shopItems = await prisma.shopItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } });
  const shopItemById = new Map(shopItems.map((item) => [item.id, item]));

  let granted = 0;
  for (let index = 0; index < teamRanking.length; index++) {
    const position = index + 1;
    const teamTopScore = teamRanking[index];
    const reward = rewards[position <= 4 ? String(position) as SyncRewardPosition : "participation"];
    const label = rewardLabel(position);
    const allTeamScores = sorted.filter((score) => score.teamId === teamTopScore.teamId);

    for (const score of allTeamScores) {
      const fresh = await prisma.syncEventScore.findUnique({ where: { id: score.id }, select: { rewardGranted: true } });
      if (fresh?.rewardGranted) continue;

      await prisma.$transaction(async (tx) => {
        if (reward.coins > 0) {
          const wallet = await tx.zikaCoinWallet.upsert({
            where: { playerId: score.playerId },
            update: {},
            create: { playerId: score.playerId, balance: 0, totalEarned: 0, totalSpent: 0 },
          });
          await tx.zikaCoinWallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: reward.coins }, totalEarned: { increment: reward.coins } },
          });
          await tx.zikaCoinTransaction.create({
            data: {
              walletId: wallet.id,
              type: "ADMIN_ADJUSTMENT",
              amount: reward.coins,
              balanceBefore: wallet.balance,
              balanceAfter: wallet.balance + reward.coins,
              description: `Desafio Sincronizado — ${label}`,
            },
          });
        }

        if (reward.eggType && reward.eggQuantity > 0) {
          await tx.mascotEgg.createMany({
            data: Array.from({ length: reward.eggQuantity }, () => ({
              playerId: score.playerId,
              type: reward.eggType!,
              origin: `Desafio Sincronizado — ${label}`,
            })),
          });
        }

        const shopItem = reward.shopItemId ? shopItemById.get(reward.shopItemId) : null;
        if (shopItem) {
          await tx.playerGift.create({
            data: {
              playerId: score.playerId,
              type: "CUSTOM",
              title: "Recompensa Desafio Sincronizado",
              description: `${label} — ${reward.shopItemQuantity}x ${shopItem.name}`,
              payload: { shopItemId: shopItem.id, quantity: reward.shopItemQuantity, source: "sync-challenge" },
              status: "UNCLAIMED",
            },
          });
        }

        await tx.syncEventScore.update({
          where: { id: score.id },
          data: { finalPosition: position, rewardGranted: true },
        });
      });
      granted++;
    }
  }

  return { granted };
}
