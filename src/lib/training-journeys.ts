import { Prisma, PrismaClient } from "@prisma/client";
import { buildTrainingJourney, TRAINING_STANCE_KEYS, type TrainingPersonality, type TrainingStanceKey } from "./training-milestones";
import { isTrainingMilestoneItemType } from "./training-catalog";
import { completeTrainingJourney } from "./training-journey-state";
import { EXPEDITION_MODES, expeditionProgressValue, PERSONALITY_NAMES_PT, validateArenaTrainingCredit } from "./training-milestones";
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
  input: { battleId: string; resolvedAt: Date; log: CombatLogEntry[]; lineupA: CombatLineupMascot[]; lineupB: CombatLineupMascot[]; winner: "A" | "B" | "DRAW"; rounds: number; source?: "LEAGUE" | "ARENA_Z" },
) {
  const source = input.source ?? "LEAGUE";
  const ids = [...input.lineupA, ...input.lineupB].map((m) => m.id);
  const journeys = await tx.mascotTrainingJourney.findMany({
    where: { mascotId: { in: ids }, status: "ACTIVE", startedAt: { lte: input.resolvedAt } },
    include: { milestones: true },
  });
  if (!journeys.length) return { counted: 0 };
  const stats = extractBattleStats(input);
  const ownerOf = (id: string) => [...input.lineupA, ...input.lineupB].find((m) => m.id === id)?.ownerId ?? null;
  const sideOf = (id: string) => (input.lineupA.some((m) => m.id === id) ? "A" : "B");
  const brDay = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
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
      let arenaCredit: { at: string; opp: string } | null = null;
      if (d.type === "LEAGUE") raw = source === "LEAGUE" ? 1 : 0;
      else if (d.type === "ARENA_Z") {
        const owner = ownerOf(journey.mascotId);
        const oppSide = sideOf(journey.mascotId) === "A" ? input.lineupB : input.lineupA;
        const opp = oppSide[0]?.ownerId ?? null;
        if (source === "ARENA_Z" && owner && opp) {
          const credits = await arenaCreditsOf(tx, owner);
          const result = validateArenaTrainingCredit({
            sourceMode: "ARENA_Z_PVP", ownerId: owner, opponentOwnerId: opp,
            ownMascots: (sideOf(journey.mascotId) === "A" ? input.lineupA : input.lineupB).length, opponentMascots: oppSide.length,
            resolvedActions: input.log.filter((e) => e.action === "ATTACK" || e.action === "HEAL").length,
            selectedTrainingMascot: true,
            pairLastCreditAt: credits.filter((c) => c.opp === opp).map((c) => new Date(c.at)).sort((x, y) => y.getTime() - x.getTime())[0] ?? null,
            now: input.resolvedAt,
            ownerCreditsToday: credits.filter((c) => brDay(new Date(c.at)) === brDay(input.resolvedAt)).length,
          });
          if (result.eligible) { raw = 1; arenaCredit = { at: input.resolvedAt.toISOString(), opp }; }
        }
      }
      else if (d.type === "TYPE_KOS") raw = s.typeKos[d.param ?? ""] ?? 0;
      else if (d.type === "ROLE_KOS") raw = s.roleKos[d.param ?? ""] ?? 0;
      else if (d.type === "AFFINITY") {
        const key = Object.entries(PERSONALITY_NAMES_PT).find(([, name]) => d.label?.startsWith(`Personalidade ${name}:`))?.[0];
        const special = d.label?.startsWith("Aplique 20 K.O.s em inimigos com status") ? "EXEC_COMPETITIVE"
          : d.label?.startsWith("Proteja 30 vezes o aliado") ? "PURIFIER_LOYAL"
          : d.label?.startsWith("Aplique 15 K.O.s") ? "COMMANDER_LOYAL" : null;
        raw = special ? (s.special[special] ?? 0) : key ? (s.affinity[key] ?? 0) : 0;
      } else raw = (s.counts as Record<string, number | undefined>)[d.type] ?? 0;
      const capped = Math.max(0, Math.min(raw, d.perBattleCap ?? raw));
      const isLeague = d.type === "LEAGUE";
      if (capped === 0 && !isLeague) continue;
      let inc = Math.floor(capped);
      const details: Record<string, unknown> = { ...d };
      if (d.type === "DAMAGE") { const total = (d.carry ?? 0) + capped; inc = Math.floor(total); details.carry = total - inc; }
      if (arenaCredit) details.credits = [...((d as { credits?: unknown[] }).credits ?? []), arenaCredit].slice(-60);
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

/** Créditos de Arena-Z já concedidos ao jogador (todas as jornadas dos mascotes dele): base do limite diário e do intervalo por dupla. */
async function arenaCreditsOf(tx: Db, playerId: string) {
  const rows = await tx.mascotTrainingMilestoneProgress.findMany({
    where: { milestoneKey: { startsWith: "arena_z" }, journey: { mascot: { playerId } } },
    select: { detailsJson: true },
  });
  return rows.flatMap((r) => ((r.detailsJson as { credits?: Array<{ at: string; opp: string }> } | null)?.credits ?? []));
}
