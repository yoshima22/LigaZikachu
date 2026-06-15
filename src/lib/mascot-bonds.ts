import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addExp } from "@/lib/mascot";
import { getPokemonName } from "@/lib/mascot-data";

export type BondBehavior =
  | "FREE"
  | "FRIENDLY"
  | "COMPETITIVE"
  | "AVOID_CONFLICT"
  | "TRAINING"
  | "EXPEDITION"
  | "SOCIAL"
  | "PROTECT_FOOD"
  | "SHARE_RESOURCES"
  | "PROTECT_WEAK";

export type BondOption = {
  id: string;
  label: string;
  type: "POSITIVE" | "NEUTRAL" | "AGGRESSIVE";
  cost?: { kind: "FOOD" | "SWEET" | "COINS"; quantity: number };
  scoreDelta: number;
  happinessA?: number;
  happinessB?: number;
  expA?: number;
  expB?: number;
  cooldownBMinutes?: number;
  publicEligible?: boolean;
  blockedReason?: string;
};

export const BOND_BEHAVIOR_LABEL: Record<BondBehavior, string> = {
  FREE: "Temperamento Livre",
  FRIENDLY: "Incentivar Amizades",
  COMPETITIVE: "Espirito Competitivo",
  AVOID_CONFLICT: "Evitar Conflitos",
  TRAINING: "Foco em Treino",
  EXPEDITION: "Foco em Expedicao",
  SOCIAL: "Foco Social",
  PROTECT_FOOD: "Proteger Comida",
  SHARE_RESOURCES: "Compartilhar Recursos",
  PROTECT_WEAK: "Cuidar dos Mais Fracos",
};

export function relationTier(score: number) {
  if (score <= -80) return "Nemesis";
  if (score <= -60) return "Rival Direto";
  if (score <= -35) return "Rival Forte";
  if (score <= -15) return "Rival";
  if (score <= 14) return "Conhecido";
  if (score <= 34) return "Colega";
  if (score <= 59) return "Amigo";
  if (score <= 79) return "Grande Amigo";
  if (score <= 94) return "Melhor Amigo";
  return "Quase Irmaos";
}

export function relationTypeFromScore(score: number): "FRIEND" | "RIVAL" {
  return score >= 15 ? "FRIEND" : "RIVAL";
}

export function clampScore(score: number) {
  return Math.max(-100, Math.min(100, score));
}

export function normalizeBondOptions(options: unknown): BondOption[] {
  if (!Array.isArray(options)) return [];
  return options.filter((item): item is BondOption => {
    if (!item || typeof item !== "object") return false;
    const o = item as Record<string, unknown>;
    return typeof o.id === "string" && typeof o.label === "string" && typeof o.type === "string";
  });
}

export function defaultBondOptions(eventType: string): BondOption[] {
  if (eventType === "SHARE_SNACK") {
    return [
      { id: "share_food", label: "Dividir o lanche", type: "POSITIVE", cost: { kind: "FOOD", quantity: 1 }, scoreDelta: 10, happinessA: 4, happinessB: 8 },
      { id: "keep_calm", label: "Guardar e evitar confusao", type: "NEUTRAL", scoreDelta: 1, happinessA: 1 },
      { id: "eat_alone", label: "Deixar comer sozinho", type: "AGGRESSIVE", scoreDelta: -8, happinessA: 5, happinessB: -4 },
    ];
  }
  if (eventType === "EXP_STEAL") {
    return [
      { id: "train_together", label: "Treinar os dois juntos", type: "POSITIVE", cost: { kind: "SWEET", quantity: 1 }, scoreDelta: 8, expA: 20, expB: 20 },
      { id: "normal_training", label: "Deixar o treino seguir", type: "NEUTRAL", scoreDelta: 0, expA: 8 },
      { id: "take_advantage", label: "Incentivar vantagem", type: "AGGRESSIVE", scoreDelta: -12, expA: 35, happinessB: -5, publicEligible: true },
    ];
  }
  return [
    { id: "help", label: "Ajudar com cuidado", type: "POSITIVE", cost: { kind: "FOOD", quantity: 1 }, scoreDelta: 8, happinessA: 3, happinessB: 6 },
    { id: "observe", label: "Observar sem interferir", type: "NEUTRAL", scoreDelta: 0 },
    { id: "provoke", label: "Incentivar provocacao", type: "AGGRESSIVE", scoreDelta: -10, expA: 12, cooldownBMinutes: 10 },
  ];
}

export async function ensureDirectionalRelation(tx: Prisma.TransactionClient, mascotAId: string, mascotBId: string, delta: number) {
  const existing = await tx.mascotRelation.findUnique({
    where: { mascotAId_mascotBId: { mascotAId, mascotBId } },
    select: { relationshipScore: true, interactionCount: true },
  });
  const nextScore = clampScore((existing?.relationshipScore ?? 0) + delta);
  return tx.mascotRelation.upsert({
    where: { mascotAId_mascotBId: { mascotAId, mascotBId } },
    update: {
      relationshipScore: nextScore,
      type: relationTypeFromScore(nextScore),
      interactionCount: { increment: 1 },
      lastInteractionAt: new Date(),
      specialBondType: specialBondFromScore(nextScore),
    },
    create: {
      mascotAId,
      mascotBId,
      relationshipScore: nextScore,
      type: relationTypeFromScore(nextScore),
      interactionCount: 1,
      lastInteractionAt: new Date(),
      specialBondType: specialBondFromScore(nextScore),
    },
  });
}

function specialBondFromScore(score: number) {
  if (score >= 95) return "QUASE_IRMAOS";
  if (score <= -80) return "NEMESIS";
  if (score >= 60) return "GRANDE_AMIGO";
  if (score <= -60) return "RIVAL_DIRETO";
  return null;
}

export async function createBondEventForPlayer(playerId: string) {
  const mascots = await prisma.mascot.findMany({
    where: { playerId, arenaState: { not: "INJURED" } },
    select: { id: true, pokemonId: true, nickname: true, level: true },
    orderBy: [{ isEquipped: "desc" }, { isFavorite: "desc" }, { level: "desc" }],
    take: 12,
  });
  if (mascots.length < 2) throw new Error("Voce precisa de pelo menos 2 mascotes para gerar um evento de lacos.");

  const [a, b] = mascots.sort(() => Math.random() - 0.5).slice(0, 2);
  const eventType = Math.random() < 0.55 ? "SHARE_SNACK" : Math.random() < 0.5 ? "EXP_STEAL" : "REST_PROVOKE";
  const nameA = a.nickname ?? getPokemonName(a.pokemonId);
  const nameB = b.nickname ?? getPokemonName(b.pokemonId);
  const title = eventType === "SHARE_SNACK" ? "Dividir lanche" : eventType === "EXP_STEAL" ? "Treino disputado" : "Provocacao na recarga";
  const description =
    eventType === "SHARE_SNACK"
      ? `${nameA} encontrou um lanche. ${nameB} ficou olhando com vontade.`
      : eventType === "EXP_STEAL"
        ? `${nameA} viu uma chance de tomar para si parte do treino de ${nameB}.`
        : `${nameA} pode atrapalhar o descanso de ${nameB} antes da proxima atividade.`;

  return prisma.mascotSocialEvent.create({
    data: {
      ownerId: playerId,
      mascotAId: a.id,
      mascotBId: b.id,
      eventType,
      title,
      description,
      optionsJson: defaultBondOptions(eventType) as unknown as Prisma.InputJsonValue,
      visibility: "PRIVATE",
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    },
  });
}

export async function applyBondOption(eventId: string, playerId: string, optionId: string, resolvedBy: "USER" | "AUTO" = "USER") {
  return prisma.$transaction(async (tx) => {
    const event = await tx.mascotSocialEvent.findUnique({
      where: { id: eventId },
      include: {
        owner: { select: { id: true, mascotBondBehavior: true } },
        mascotA: { select: { id: true, playerId: true } },
        mascotB: { select: { id: true, playerId: true } },
      },
    });
    if (!event) throw new Error("Evento nao encontrado.");
    if (event.status !== "PENDING") throw new Error("Este evento ja foi resolvido.");
    if (event.ownerId !== playerId && resolvedBy === "USER") throw new Error("Voce nao pode resolver este evento.");

    const options = normalizeBondOptions(event.optionsJson);
    const option = resolvedBy === "AUTO"
      ? pickAutoOption(options, event.owner.mascotBondBehavior as BondBehavior)
      : options.find((o) => o.id === optionId);
    if (!option) throw new Error("Opcao invalida.");
    if (resolvedBy === "AUTO" && option.cost) throw new Error("Resolucao automatica nao pode consumir recursos.");

    if (option.cost && resolvedBy === "USER") {
      await consumeBondCost(tx, playerId, option.cost);
    }

    const mascotBId = event.mascotBId;
    if (mascotBId) {
      await ensureDirectionalRelation(tx, event.mascotAId, mascotBId, option.scoreDelta);
      await ensureDirectionalRelation(tx, mascotBId, event.mascotAId, option.scoreDelta);
    }

    if (option.happinessA) {
      await tx.mascot.update({ where: { id: event.mascotAId }, data: { happiness: { increment: option.happinessA } } });
    }
    if (option.happinessB && mascotBId) {
      await tx.mascot.update({ where: { id: mascotBId }, data: { happiness: { increment: option.happinessB } } });
    }
    if (option.cooldownBMinutes && mascotBId) {
      await tx.mascot.update({ where: { id: mascotBId }, data: { socialCooldownUntil: new Date(Date.now() + option.cooldownBMinutes * 60_000) } });
    }

    const resultJson = {
      scoreDelta: option.scoreDelta,
      happinessA: option.happinessA ?? 0,
      happinessB: option.happinessB ?? 0,
      expA: option.expA ?? 0,
      expB: option.expB ?? 0,
    };

    await tx.mascotSocialDecisionLog.create({
      data: {
        eventId: event.id,
        actorPlayerId: resolvedBy === "USER" ? playerId : null,
        affectedPlayerIds: [event.mascotA.playerId, event.mascotB?.playerId].filter(Boolean) as Prisma.InputJsonValue,
        mascotAId: event.mascotAId,
        mascotBId,
        optionId: option.id,
        optionLabel: option.label,
        optionType: option.type,
        resolvedBy,
        costJson: (option.cost ?? null) as Prisma.InputJsonValue,
        resultJson: resultJson as Prisma.InputJsonValue,
        visibility: option.publicEligible ? "PUBLIC" : event.visibility,
      },
    });

    await tx.mascotSocialEvent.update({
      where: { id: event.id },
      data: {
        status: resolvedBy === "AUTO" ? "AUTO_RESOLVED" : "RESOLVED",
        resolvedByPlayerId: resolvedBy === "USER" ? playerId : null,
        resolvedOptionId: option.id,
        resolvedBy,
        resultJson: resultJson as Prisma.InputJsonValue,
        resolvedAt: new Date(),
        autoResolvedAt: resolvedBy === "AUTO" ? new Date() : null,
      },
    });

    return { option, resultJson };
  }).then(async (result) => {
    if (result.option.expA) await addExp((await prisma.mascotSocialEvent.findUnique({ where: { id: eventId }, select: { mascotAId: true } }))!.mascotAId, result.option.expA);
    if (result.option.expB) {
      const e = await prisma.mascotSocialEvent.findUnique({ where: { id: eventId }, select: { mascotBId: true } });
      if (e?.mascotBId) await addExp(e.mascotBId, result.option.expB);
    }
    return result;
  });
}

function pickAutoOption(options: BondOption[], behavior: BondBehavior) {
  const freeOptions = options.filter((o) => !o.cost);
  const neutral = freeOptions.filter((o) => o.type === "NEUTRAL");
  const aggressive = freeOptions.filter((o) => o.type === "AGGRESSIVE");
  if (behavior === "COMPETITIVE" && aggressive[0]) return aggressive[0];
  if (behavior === "AVOID_CONFLICT" && neutral[0]) return neutral[0];
  if (behavior === "FRIENDLY" || behavior === "SOCIAL") return neutral.find((o) => o.scoreDelta >= 0) ?? neutral[0] ?? freeOptions[0];
  return neutral[0] ?? aggressive[0] ?? freeOptions[0];
}

async function consumeBondCost(tx: Prisma.TransactionClient, playerId: string, cost: NonNullable<BondOption["cost"]>) {
  if (cost.kind === "FOOD" || cost.kind === "SWEET") {
    const item = await tx.mascotFoodItem.findUnique({ where: { playerId_type: { playerId, type: cost.kind } } });
    if (!item || item.quantity < cost.quantity) throw new Error(cost.kind === "FOOD" ? "Voce precisa de Comida de Mascote." : "Voce precisa de Doce de Mascote.");
    await tx.mascotFoodItem.update({ where: { playerId_type: { playerId, type: cost.kind } }, data: { quantity: { decrement: cost.quantity } } });
    return;
  }
  const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId } });
  if (!wallet || wallet.balance < cost.quantity) throw new Error("ZikaCoins insuficientes.");
  await tx.zikaCoinWallet.update({ where: { playerId }, data: { balance: { decrement: cost.quantity } } });
}

export async function autoResolveExpiredBondEvents(playerId: string) {
  const events = await prisma.mascotSocialEvent.findMany({
    where: { ownerId: playerId, status: "PENDING", expiresAt: { lte: new Date() } },
    select: { id: true },
    take: 10,
  });
  for (const event of events) {
    await applyBondOption(event.id, playerId, "AUTO", "AUTO").catch(() => null);
  }
}

export async function getBondCombatModifier(mascotIds: string[]) {
  if (mascotIds.length < 2) return new Map<string, number>();
  const relations = await prisma.mascotRelation.findMany({
    where: { mascotAId: { in: mascotIds }, mascotBId: { in: mascotIds } },
    select: { mascotAId: true, mascotBId: true, relationshipScore: true, specialBondType: true },
    take: mascotIds.length * 8,
  }).catch(() => []);
  const modifier = new Map<string, number>();
  for (const id of mascotIds) modifier.set(id, 1);
  for (const rel of relations) {
    const score = rel.relationshipScore ?? (rel.specialBondType === "NEMESIS" ? -80 : 0);
    const delta = score >= 80 ? 0.05 : score >= 60 ? 0.035 : score >= 35 ? 0.02 : score <= -80 ? -0.04 : score <= -60 ? -0.025 : 0;
    if (delta !== 0) modifier.set(rel.mascotAId, Math.max(0.9, Math.min(1.08, (modifier.get(rel.mascotAId) ?? 1) + delta)));
  }
  return modifier;
}
