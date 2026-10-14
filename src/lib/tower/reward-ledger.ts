import type { TowerExpeditionV2 } from "./expedition-state";

export type TowerRewardStatus = "PENDING_FLOOR" | "SECURED" | "LOST";

export type TowerRewardInput = {
  id: string;
  kind: "COINS" | "EGG" | "ITEM" | "BOSS_BUNDLE";
  quantity: number;
  label: string;
  eggType?: string;
  itemId?: string;
  coins?: number;
  eggs?: { type: string; quantity: number }[];
  boss?: string;
};

export type TowerRewardEntry = TowerRewardInput & {
  floor: number;
  status: TowerRewardStatus;
};

export type RewardGrant = {
  runId: string;
  userId: string;
  reward: TowerRewardEntry;
};

export type RewardGrantStore = {
  /** Atomically grant reward + record its key inside the run transaction. */
  grantOnce(runId: string, userId: string, rewardId: string, reward: TowerRewardEntry): Promise<boolean>;
};

export type SettlementReport = { granted: number; alreadyGranted: number };

export function recordFloorDrop(
  state: TowerExpeditionV2,
  floor: number,
  reward: TowerRewardInput,
): TowerExpeditionV2 {
  if (!Number.isInteger(floor) || floor < 1 || floor > 7 || !reward.id || reward.quantity <= 0)
    throw new Error("Espólio da Torre inválido.");
  const ledger = state.rewardLedger ?? [];
  if (ledger.some((entry) => entry.id === reward.id)) return state;
  return {
    ...state,
    rewardLedger: [...ledger, { ...reward, floor, status: "PENDING_FLOOR" }],
  };
}

export function secureFloorDrops(state: TowerExpeditionV2, floor: number): TowerExpeditionV2 {
  return {
    ...state,
    rewardLedger: (state.rewardLedger ?? []).map((entry) =>
      entry.floor === floor && entry.status === "PENDING_FLOOR" ? { ...entry, status: "SECURED" as const } : entry),
  };
}

export function discardPendingFloorDrops(state: TowerExpeditionV2, floor: number): TowerExpeditionV2 {
  return {
    ...state,
    rewardLedger: (state.rewardLedger ?? []).map((entry) =>
      entry.floor === floor && entry.status === "PENDING_FLOOR" ? { ...entry, status: "LOST" as const } : entry),
  };
}

export function planRewardSettlement(state: TowerExpeditionV2, runId: string): RewardGrant[] {
  if (!runId) throw new Error("A liquidação exige o ID da run.");
  const recipients = Object.entries(state.members)
    .filter(([, member]) => member.status !== "AFK_ABANDONED")
    .map(([userId]) => userId);
  return (state.rewardLedger ?? [])
    .filter((entry) => entry.status === "SECURED")
    .flatMap((reward) => recipients.map((userId) => ({ runId, userId, reward })));
}

export async function settleRunRewards(store: RewardGrantStore, grants: RewardGrant[]): Promise<SettlementReport> {
  let granted = 0;
  let alreadyGranted = 0;
  for (const grant of grants) {
    if (await store.grantOnce(grant.runId, grant.userId, grant.reward.id, grant.reward)) granted++;
    else alreadyGranted++;
  }
  return { granted, alreadyGranted };
}
