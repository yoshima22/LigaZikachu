import { Prisma, PrismaClient } from "@prisma/client";
import { buildTrainingJourney, TRAINING_STANCE_KEYS, type TrainingPersonality, type TrainingStanceKey } from "./training-milestones";
import { isTrainingMilestoneItemType } from "./training-catalog";
import { completeTrainingJourney } from "./training-journey-state";

type Db = PrismaClient | Prisma.TransactionClient;

export type TrainingJourneyError = "MASCOT_NOT_FOUND" | "ITEM_NOT_FOUND" | "ITEM_MISMATCH" | "ITEM_UNAVAILABLE";

/**
 * Consumes exactly one Marco and writes its immutable objective snapshot. The
 * transaction is deliberately the only place allowed to replace a journey.
 */
export async function activateTrainingJourney(
  tx: Db,
  input: { playerId: string; mascotId: string; itemId: string; replaceActive: boolean },
) {
  const mascot = await tx.mascot.findFirst({
    where: { id: input.mascotId, playerId: input.playerId },
    select: { id: true, personality: true },
  });
  if (!mascot) throw new Error("MASCOT_NOT_FOUND");

  const item = await tx.shopItem.findUnique({
    where: { id: input.itemId },
    select: { id: true, type: true, name: true, metadata: true },
  });
  if (!item || !isTrainingMilestoneItemType(item.type)) throw new Error("ITEM_MISMATCH");
  const stanceKey = item.type.replace("TRAINING_MILESTONE_", "") as TrainingStanceKey;
  if (!(TRAINING_STANCE_KEYS as readonly string[]).includes(stanceKey)) throw new Error("ITEM_MISMATCH");

  const inventory = await tx.playerInventory.findUnique({
    where: { playerId_itemId: { playerId: input.playerId, itemId: input.itemId } },
    select: { quantity: true, boundQuantity: true },
  });
  if (!inventory || inventory.quantity - inventory.boundQuantity < 1) throw new Error("ITEM_UNAVAILABLE");

  const active = await tx.mascotTrainingJourney.findFirst({
    where: { mascotId: mascot.id, status: "ACTIVE" }, select: { id: true },
  });
  if (active && !input.replaceActive) return { needsReplacementConfirmation: true as const, journeyId: active.id };
  const now = new Date();
  if (active) {
    await tx.mascotTrainingJourney.update({ where: { id: active.id }, data: { status: "CANCELED_REPLACED", cancelledAt: now } });
  }

  // Consume only after every validation passed; neither cancellation nor
  // replacement returns the consumed item.
  await tx.playerInventory.update({
    where: { playerId_itemId: { playerId: input.playerId, itemId: input.itemId } },
    data: { quantity: { decrement: 1 } },
  });
  const seed = Math.floor(Math.random() * 2_147_483_647);
  const snapshot = buildTrainingJourney({ stance: stanceKey, personality: mascot.personality as TrainingPersonality, seed });
  const journey = await tx.mascotTrainingJourney.create({
    data: {
      mascotId: mascot.id, stanceKey, seed, sourceItemId: item.id,
      milestones: {
        create: snapshot.objectives.map((objective) => ({
          milestoneKey: objective.id, target: objective.target,
          detailsJson: { type: objective.type, label: objective.label, perBattleCap: objective.perBattleCap, catalogVersion: 1 },
        })),
      },
    },
    include: { milestones: { orderBy: { milestoneKey: "asc" } } },
  });
  return { needsReplacementConfirmation: false as const, journey };
}

export async function cancelTrainingJourney(tx: Db, input: { playerId: string; mascotId: string }) {
  const journey = await tx.mascotTrainingJourney.findFirst({
    where: { mascotId: input.mascotId, mascot: { playerId: input.playerId }, status: "ACTIVE" },
    select: { id: true },
  });
  if (!journey) return false;
  await tx.mascotTrainingJourney.update({ where: { id: journey.id }, data: { status: "CANCELED", cancelledAt: new Date() } });
  return true;
}

/** Records an immutable, source-validated increment and unlocks exactly once. */
export async function recordTrainingJourneyProgress(
  tx: Db,
  input: { journeyId: string; mascotId: string; objectiveType: string; amount: number },
) {
  const journey = await tx.mascotTrainingJourney.findFirst({
    where: { id: input.journeyId, mascotId: input.mascotId, status: "ACTIVE" },
    include: { milestones: true },
  });
  if (!journey) return { recorded: false, completed: false };
  const candidates = journey.milestones.filter((milestone) => {
    const details = milestone.detailsJson as { type?: string; perBattleCap?: number } | null;
    return details?.type === input.objectiveType;
  });
  for (const milestone of candidates) {
    const details = milestone.detailsJson as { perBattleCap?: number } | null;
    const next = Math.min(milestone.target, milestone.value + Math.max(0, Math.min(Math.floor(input.amount), details?.perBattleCap ?? input.amount)));
    if (next !== milestone.value) await tx.mascotTrainingMilestoneProgress.update({
      where: { journeyId_milestoneKey: { journeyId: journey.id, milestoneKey: milestone.milestoneKey } },
      data: { value: next, ...(next >= milestone.target ? { completedAt: new Date() } : {}) },
    });
  }
  const updated = await tx.mascotTrainingMilestoneProgress.findMany({ where: { journeyId: journey.id }, select: { milestoneKey: true, target: true, value: true } });
  if (!completeTrainingJourney(updated)) return { recorded: candidates.length > 0, completed: false };
  await tx.mascotTrainingJourney.update({ where: { id: journey.id }, data: { status: "COMPLETED", completedAt: new Date() } });
  await tx.mascotStanceUnlock.upsert({
    where: { mascotId_stanceKey: { mascotId: journey.mascotId, stanceKey: journey.stanceKey } },
    update: {}, create: { mascotId: journey.mascotId, stanceKey: journey.stanceKey, journeyId: journey.id },
  });
  return { recorded: candidates.length > 0, completed: true };
}
