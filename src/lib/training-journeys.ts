import { Prisma, PrismaClient } from "@prisma/client";
import { buildTrainingJourney, TRAINING_STANCE_KEYS, type TrainingPersonality, type TrainingStanceKey } from "./training-milestones";
import { isTrainingMilestoneItemType } from "./training-catalog";
import { completeTrainingJourney } from "./training-journey-state";
import { EXPEDITION_MODES, expeditionProgressValue, PERSONALITY_NAMES_PT } from "./training-milestones";
import { extractBattleStats, type CombatLineupMascot, type CombatLogEntry } from "./training-combat-stats";

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
          detailsJson: { type: objective.type, label: objective.label, perBattleCap: objective.perBattleCap, ...(objective.param ? { param: objective.param } : {}), catalogVersion: 1 },
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
  input: { journeyId: string; mascotId: string; objectiveType: string; amount: number; mode?: string },
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
    const details = milestone.detailsJson as { perBattleCap?: number; modes?: Record<string, number> } | null;
    let next = Math.min(milestone.target, milestone.value + Math.max(0, Math.min(Math.floor(input.amount), details?.perBattleCap ?? input.amount)));
    let detailsJson: Prisma.InputJsonValue | undefined;
    if (input.objectiveType === "EXPEDITIONS" && input.mode && (EXPEDITION_MODES as readonly string[]).includes(input.mode)) {
      const modes = { ...(details?.modes ?? {}) };
      modes[input.mode] = (modes[input.mode] ?? 0) + 1;
      next = expeditionProgressValue(modes, milestone.target);
      detailsJson = { ...(details as object), modes } as Prisma.InputJsonValue;
    }
    if (next !== milestone.value || detailsJson) await tx.mascotTrainingMilestoneProgress.update({
      where: { journeyId_milestoneKey: { journeyId: journey.id, milestoneKey: milestone.milestoneKey } },
      data: { value: next, ...(detailsJson ? { detailsJson } : {}), ...(next >= milestone.target ? { completedAt: new Date() } : {}) },
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

const BATTLE_LEDGER_LIMIT = 300;

/**
 * Conta um combate de liga já resolvido (Semanal/Rush) nas jornadas ativas dos mascotes que lutaram.
 * Idempotente: o id do combate fica no "livro" do marco LEAGUE, então reprocessar não conta duas vezes.
 * `resolvedAt` impede que um combate anterior ao início da jornada conte.
 */
export async function recordLeagueBattleProgress(
  tx: Db,
  input: { battleId: string; resolvedAt: Date; log: CombatLogEntry[]; lineupA: CombatLineupMascot[]; lineupB: CombatLineupMascot[]; winner: "A" | "B" | "DRAW"; rounds: number },
) {
  const ids = [...input.lineupA, ...input.lineupB].map((m) => m.id);
  const journeys = await tx.mascotTrainingJourney.findMany({
    where: { mascotId: { in: ids }, status: "ACTIVE", startedAt: { lte: input.resolvedAt } },
    include: { milestones: true },
  });
  if (!journeys.length) return { counted: 0 };
  const stats = extractBattleStats(input);
  let counted = 0;
  for (const journey of journeys) {
    const league = journey.milestones.find((m) => (m.detailsJson as { type?: string } | null)?.type === "LEAGUE");
    const ledger = ((league?.detailsJson as { battles?: string[] } | null)?.battles ?? []);
    if (ledger.includes(input.battleId)) continue;
    const s = stats.get(journey.mascotId);
    if (!s) continue;
    counted++;
    for (const milestone of journey.milestones) {
      const d = (milestone.detailsJson ?? {}) as { type?: string; label?: string; param?: string; perBattleCap?: number; carry?: number; battles?: string[] };
      if (milestone.completedAt || !d.type) continue;
      let raw = 0;
      if (d.type === "LEAGUE") raw = 1;
      else if (d.type === "TYPE_KOS") raw = s.typeKos[d.param ?? ""] ?? 0;
      else if (d.type === "ROLE_KOS") raw = s.roleKos[d.param ?? ""] ?? 0;
      else if (d.type === "AFFINITY") {
        const key = Object.entries(PERSONALITY_NAMES_PT).find(([, name]) => d.label?.startsWith(`Personalidade ${name}:`))?.[0];
        raw = key ? (s.affinity[key] ?? 0) : 0;
      } else raw = (s.counts as Record<string, number | undefined>)[d.type] ?? 0;
      const capped = Math.max(0, Math.min(raw, d.perBattleCap ?? raw));
      const isLeague = d.type === "LEAGUE";
      if (capped === 0 && !isLeague) continue;
      let inc = Math.floor(capped);
      const details: Record<string, unknown> = { ...d };
      if (d.type === "DAMAGE") { const total = (d.carry ?? 0) + capped; inc = Math.floor(total); details.carry = total - inc; }
      if (isLeague) details.battles = [...ledger, input.battleId].slice(-BATTLE_LEDGER_LIMIT);
      const next = Math.min(milestone.target, milestone.value + inc);
      await tx.mascotTrainingMilestoneProgress.update({
        where: { journeyId_milestoneKey: { journeyId: journey.id, milestoneKey: milestone.milestoneKey } },
        data: { value: next, detailsJson: details as Prisma.InputJsonValue, ...(next >= milestone.target ? { completedAt: new Date() } : {}) },
      });
    }
    const updated = await tx.mascotTrainingMilestoneProgress.findMany({ where: { journeyId: journey.id }, select: { milestoneKey: true, target: true, value: true } });
    if (!completeTrainingJourney(updated)) continue;
    await tx.mascotTrainingJourney.update({ where: { id: journey.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.mascotStanceUnlock.upsert({
      where: { mascotId_stanceKey: { mascotId: journey.mascotId, stanceKey: journey.stanceKey } },
      update: {}, create: { mascotId: journey.mascotId, stanceKey: journey.stanceKey, journeyId: journey.id },
    });
  }
  return { counted };
}
