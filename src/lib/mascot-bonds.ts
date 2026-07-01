import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addExp } from "@/lib/mascot";
import { getPokemonName } from "@/lib/mascot-data";
import { registerPokemonDiscovery } from "@/lib/pokemon-dex";
import { isStandbyActive } from "@/lib/account-standby";

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
  costs?: { kind: "FOOD" | "SWEET" | "COINS"; quantity: number }[];
  scoreDelta: number;
  happinessA?: number;
  happinessB?: number;
  expA?: number;
  expB?: number;
  cooldownBMinutes?: number;
  publicEligible?: boolean;
  blockedReason?: string;
};

const RUNAWAY_WARNING_TYPE = "RUNAWAY_WARNING";
const RUNAWAY_RESCUE_TYPE = "RUNAWAY_RESCUE";
const RUNAWAY_WARNING_MS = 2 * 24 * 60 * 60_000;
const RUNAWAY_RESCUE_MS = 3 * 24 * 60 * 60_000;

type BondCost = NonNullable<BondOption["cost"]>;

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

export function legacyRelationScore(type: "FRIEND" | "RIVAL", interactionCount: number) {
  if (type === "FRIEND") return Math.min(94, 15 + Math.max(1, interactionCount) * 5);
  return Math.max(-79, -15 - Math.max(1, interactionCount) * 8);
}

export function effectiveRelationScore(relation: { relationshipScore?: number | null; type: "FRIEND" | "RIVAL"; interactionCount: number }) {
  if (typeof relation.relationshipScore === "number" && relation.relationshipScore !== 0) {
    return relation.relationshipScore;
  }
  return legacyRelationScore(relation.type, relation.interactionCount);
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
  if (eventType === RUNAWAY_WARNING_TYPE) {
    return [
      {
        id: "care_food",
        label: "Cuidar com carinho, brincadeira e comida",
        type: "POSITIVE",
        costs: [{ kind: "FOOD", quantity: 1 }],
        scoreDelta: 0,
        happinessA: 55,
      },
      {
        id: "care_sweet",
        label: "Cuidar com carinho, brincadeira e doce",
        type: "POSITIVE",
        costs: [{ kind: "SWEET", quantity: 1 }],
        scoreDelta: 0,
        happinessA: 65,
      },
      {
        id: "let_run",
        label: "Deixar fugir",
        type: "NEUTRAL",
        scoreDelta: 0,
        happinessA: -5,
        publicEligible: true,
      },
    ];
  }
  if (eventType === RUNAWAY_RESCUE_TYPE) {
    return [
      {
        id: "rescue_food",
        label: "Acolher com carinho, brincadeira e comida",
        type: "POSITIVE",
        costs: [{ kind: "FOOD", quantity: 1 }],
        scoreDelta: 0,
        happinessA: 55,
        publicEligible: true,
      },
      {
        id: "rescue_sweet",
        label: "Acolher com carinho, brincadeira e doce",
        type: "POSITIVE",
        costs: [{ kind: "SWEET", quantity: 1 }],
        scoreDelta: 0,
        happinessA: 65,
        publicEligible: true,
      },
      {
        id: "leave_alone",
        label: "Deixar seguir caminho",
        type: "NEUTRAL",
        scoreDelta: 0,
      },
    ];
  }
  if (eventType === "SHARE_SNACK") {
    return [
      { id: "share_food", label: "Dividir o lanche", type: "POSITIVE", cost: { kind: "FOOD", quantity: 2 }, scoreDelta: 12, happinessA: 4, happinessB: 10 },
      { id: "keep_calm", label: "Guardar e evitar confusao", type: "NEUTRAL", scoreDelta: 1, happinessA: 1 },
      { id: "eat_alone", label: "Comer sozinho e provocar inveja", type: "AGGRESSIVE", scoreDelta: -10, happinessA: 6, happinessB: -6, publicEligible: true },
    ];
  }
  if (eventType === "EXP_STEAL") {
    return [
      { id: "train_together", label: "Treinar os dois juntos", type: "POSITIVE", cost: { kind: "SWEET", quantity: 2 }, scoreDelta: 10, expA: 24, expB: 24 },
      { id: "normal_training", label: "Deixar o treino seguir", type: "NEUTRAL", scoreDelta: 0, expA: 8 },
      { id: "take_advantage", label: "Tomar parte do treino", type: "AGGRESSIVE", scoreDelta: -14, expA: 42, happinessB: -7, publicEligible: true },
    ];
  }
  if (eventType === "REST_PROVOKE") {
    return [
      { id: "guard_rest", label: "Proteger o descanso", type: "POSITIVE", cost: { kind: "FOOD", quantity: 2 }, scoreDelta: 9, happinessA: 2, happinessB: 9 },
      { id: "let_rest", label: "Deixar descansar", type: "NEUTRAL", scoreDelta: 1, happinessB: 2 },
      { id: "wake_up", label: "Atrapalhar o descanso", type: "AGGRESSIVE", scoreDelta: -12, expA: 14, happinessB: -8, cooldownBMinutes: 18, publicEligible: true },
    ];
  }
  if (eventType === "FOOD_ENVY") {
    return [
      { id: "offer_snack", label: "Oferecer comida tambem", type: "POSITIVE", cost: { kind: "FOOD", quantity: 2 }, scoreDelta: 11, happinessA: 3, happinessB: 9 },
      { id: "change_subject", label: "Distrair sem gastar comida", type: "NEUTRAL", scoreDelta: 0, happinessB: 1 },
      { id: "show_off_food", label: "Exibir a comida e causar inveja", type: "AGGRESSIVE", scoreDelta: -13, happinessA: 5, happinessB: -9, publicEligible: true },
    ];
  }
  return [
    { id: "help", label: "Ajudar com cuidado", type: "POSITIVE", cost: { kind: "FOOD", quantity: 2 }, scoreDelta: 8, happinessA: 3, happinessB: 6 },
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
    select: { id: true, playerId: true, pokemonId: true, nickname: true, level: true, player: { select: { displayName: true } } },
    orderBy: [{ isEquipped: "desc" }, { isFavorite: "desc" }, { level: "desc" }],
    take: 12,
  });
  if (mascots.length < 1) throw new Error("Voce precisa de pelo menos 1 mascote para gerar um evento de lacos.");

  const otherMascots = await prisma.mascot.findMany({
    where: {
      playerId: { not: playerId },
      arenaState: { not: "INJURED" },
      player: { user: { role: "PLAYER" } },
    },
    select: { id: true, playerId: true, pokemonId: true, nickname: true, level: true, player: { select: { displayName: true } } },
    orderBy: [{ lastInteractedAt: "desc" }, { level: "desc" }],
    take: 48,
  });

  const a = mascots[Math.floor(Math.random() * mascots.length)];
  const externalPool = otherMascots.length > 0 ? otherMascots : mascots.filter((m) => m.id !== a.id);
  const b = externalPool[Math.floor(Math.random() * externalPool.length)];
  if (!b) throw new Error("Nao ha outro mascote disponivel para gerar um evento de lacos.");

  const roll = Math.random();
  const eventType =
    roll < 0.30 ? "SHARE_SNACK" :
    roll < 0.58 ? "EXP_STEAL" :
    roll < 0.82 ? "REST_PROVOKE" :
    "FOOD_ENVY";
  const nameA = a.nickname ?? getPokemonName(a.pokemonId);
  const nameB = b.nickname ?? getPokemonName(b.pokemonId);
  const ownerA = a.player.displayName;
  const ownerB = b.player.displayName;
  const labelA = `${nameA} (${ownerA})`;
  const labelB = `${nameB} (${ownerB})`;
  const title =
    eventType === "SHARE_SNACK" ? "Dividir lanche" :
    eventType === "EXP_STEAL" ? "Treino disputado" :
    eventType === "FOOD_ENVY" ? "Inveja de comida" :
    "Provocacao na recarga";
  const description =
    eventType === "SHARE_SNACK"
      ? `${labelA} encontrou um lanche. ${labelB} ficou olhando com vontade.`
      : eventType === "EXP_STEAL"
        ? `${labelA} viu uma chance de tomar para si parte do treino de ${labelB}.`
        : eventType === "FOOD_ENVY"
          ? `${labelA} esta com comida por perto, e ${labelB} percebeu. Isso pode virar amizade ou inveja.`
          : `${labelA} pode atrapalhar o descanso de ${labelB} antes da proxima atividade.`;

  return prisma.mascotSocialEvent.create({
    data: {
      ownerId: playerId,
      mascotAId: a.id,
      mascotBId: b.id,
      eventType,
      title,
      description,
      optionsJson: defaultBondOptions(eventType) as unknown as Prisma.InputJsonValue,
      visibility: a.playerId === b.playerId ? "PRIVATE" : "INVOLVED_PLAYERS",
      affectedPlayerIds: [a.playerId, b.playerId] as unknown as Prisma.InputJsonValue,
      publicEligible: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    },
  });
}

export async function ensureRunawayWarningsForPlayer(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { notes: true },
  });
  if (isStandbyActive(player?.notes)) {
    await prisma.mascotSocialEvent.updateMany({
      where: { ownerId: playerId, eventType: RUNAWAY_WARNING_TYPE, status: "PENDING" },
      data: {
        status: "RESOLVED",
        resolvedBy: "SYSTEM",
        resolvedOptionId: "account_standby",
        resolvedAt: new Date(),
        resultJson: { special: RUNAWAY_WARNING_TYPE, recoveredBy: "ACCOUNT_STANDBY" } as Prisma.InputJsonValue,
      },
    });
    return;
  }

  const pendingWarnings = await prisma.mascotSocialEvent.findMany({
    where: {
      ownerId: playerId,
      eventType: RUNAWAY_WARNING_TYPE,
      status: "PENDING",
    },
    select: { mascotAId: true },
    take: 20,
  });
  for (const warning of pendingWarnings) {
    await clearRunawayWarningIfRecovered(playerId, warning.mascotAId).catch(() => false);
  }

  const staleFoodAt = new Date(Date.now() - 48 * 60 * 60_000);
  const candidates = await prisma.mascot.findMany({
    where: {
      playerId,
      arenaState: "FREE",
      bazarListed: false,
      expeditions: { none: { status: "ACTIVE" } },
      // Só entra em fuga se estiver faminto E com felicidade baixa
      happiness: { lt: 25 },
      OR: [
        { mood: "HUNGRY" },
        { lastFedAt: null },
        { lastFedAt: { lt: staleFoodAt } },
      ],
    },
    select: {
      id: true,
      pokemonId: true,
      nickname: true,
      playerId: true,
      player: { select: { displayName: true } },
    },
    orderBy: [{ isEquipped: "desc" }, { happiness: "asc" }, { lastFedAt: "asc" }],
    take: 4,
  });

  for (const mascot of candidates) {
    const existingWarnings = await prisma.mascotSocialEvent.findMany({
      where: {
        mascotAId: mascot.id,
        eventType: RUNAWAY_WARNING_TYPE,
        status: "PENDING",
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (existingWarnings.length > 0) {
      const [, ...duplicates] = existingWarnings;
      if (duplicates.length > 0) {
        await prisma.mascotSocialEvent.updateMany({
          where: { id: { in: duplicates.map((event) => event.id) } },
          data: {
            status: "RESOLVED",
            resolvedBy: "SYSTEM",
            resolvedOptionId: "duplicate_runaway_warning",
            resolvedAt: new Date(),
          },
        });
      }
      continue;
    }

    const rescueExisting = await prisma.mascotSocialEvent.findFirst({
      where: { mascotAId: mascot.id, eventType: RUNAWAY_RESCUE_TYPE, status: "PENDING" },
      select: { id: true },
    });
    if (rescueExisting) continue;

    const name = mascot.nickname ?? getPokemonName(mascot.pokemonId);
    await prisma.mascotSocialEvent.create({
      data: {
        ownerId: playerId,
        mascotAId: mascot.id,
        eventType: RUNAWAY_WARNING_TYPE,
        title: "Risco de fuga",
        description: `${name} esta faminto ou muito triste. Ele ficara 2 dias nesta aba antes de fugir. Para manter o mascote, faca o combo de carinho + brincadeira + comida ou doce.`,
        optionsJson: defaultBondOptions(RUNAWAY_WARNING_TYPE) as unknown as Prisma.InputJsonValue,
        visibility: "PRIVATE",
        affectedPlayerIds: [playerId] as unknown as Prisma.InputJsonValue,
        publicEligible: false,
        expiresAt: new Date(Date.now() + RUNAWAY_WARNING_MS),
      },
    });
  }
}

export async function clearRunawayWarningIfRecovered(playerId: string, mascotId: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const mascot = await client.mascot.findFirst({
    where: { id: mascotId, playerId },
    select: { id: true, happiness: true, lastFedAt: true },
  });
  if (!mascot?.lastFedAt) return false;

  const fedRecently = Date.now() - mascot.lastFedAt.getTime() < 24 * 60 * 60_000;
  const recovered = fedRecently && mascot.happiness >= 25;
  if (!recovered) return false;

  const result = await client.mascotSocialEvent.updateMany({
    where: {
      ownerId: playerId,
      mascotAId: mascotId,
      eventType: RUNAWAY_WARNING_TYPE,
      status: "PENDING",
    },
    data: {
      status: "RESOLVED",
      resolvedBy: "SYSTEM",
      resolvedOptionId: "recovered_by_feeding",
      resolvedAt: new Date(),
      resultJson: {
        special: RUNAWAY_WARNING_TYPE,
        recoveredBy: "DIRECT_FEEDING",
      } as Prisma.InputJsonValue,
    },
  });

  if (result.count > 0) {
    await client.mascot.update({
      where: { id: mascotId },
      data: {
        mood: "HAPPY",
        socialCooldownUntil: null,
      },
    });
  }

  return result.count > 0;
}

export async function applyBondOption(eventId: string, playerId: string, optionId: string, resolvedBy: "USER" | "AUTO" = "USER") {
  return prisma.$transaction(async (tx) => {
    const event = await tx.mascotSocialEvent.findUnique({
      where: { id: eventId },
      include: {
        owner: { select: { id: true, mascotBondBehavior: true } },
        mascotA: { select: { id: true, playerId: true, pokemonId: true } },
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
    if (resolvedBy === "AUTO" && (option.cost || option.costs?.length)) throw new Error("Resolucao automatica nao pode consumir recursos.");

    const optionCosts = option.costs ?? (option.cost ? [option.cost] : []);
    if (optionCosts.length > 0 && resolvedBy === "USER") {
      for (const cost of optionCosts) {
        await consumeBondCost(tx, playerId, cost);
      }
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
      special: event.eventType,
    };

    if (event.eventType === RUNAWAY_WARNING_TYPE) {
      if (option.id === "care_food" || option.id === "care_sweet") {
        await tx.mascot.update({
          where: { id: event.mascotAId },
          data: {
            happiness: 85,
            mood: "HAPPY",
            lastInteractedAt: new Date(),
            lastPlayedAt: new Date(),
            lastPettedAt: new Date(),
            lastFedAt: new Date(),
            socialCooldownUntil: null,
          },
        });
      }
    }

    if (event.eventType === RUNAWAY_RESCUE_TYPE && (option.id === "rescue_food" || option.id === "rescue_sweet")) {
      await tx.mascotExpedition.deleteMany({ where: { mascotId: event.mascotAId, status: "ACTIVE" } });
      await tx.mascot.update({
        where: { id: event.mascotAId },
        data: {
          playerId,
          isEquipped: false,
          isFavorite: false,
          bazarListed: false,
          arenaState: "FREE",
          expLocked: false,
          happiness: 75,
          mood: "HAPPY",
          lastInteractedAt: new Date(),
          lastPlayedAt: new Date(),
          lastPettedAt: new Date(),
          lastFedAt: new Date(),
          socialCooldownUntil: null,
          restingUntil: null,
          injuredAt: null,
        },
      });
      await tx.mascotRelation.deleteMany({
        where: { OR: [{ mascotAId: event.mascotAId }, { mascotBId: event.mascotAId }] },
      });
      await registerPokemonDiscovery({
        playerId,
        pokemonId: event.mascotA.pokemonId,
        source: "Resgate em Lacos",
        obtainedAt: new Date(),
      }, tx);
    }

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
        costJson: (optionCosts.length ? optionCosts : null) as Prisma.InputJsonValue,
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

    return { option, resultJson, eventType: event.eventType, mascotAId: event.mascotAId, ownerId: event.ownerId };
  }).then(async (result) => {
    if (result.eventType === RUNAWAY_WARNING_TYPE && result.option.id === "let_run") {
      await createRunawayRescueEvent(result.mascotAId, result.ownerId).catch(() => null);
    }
    if (result.option.expA) await addExp((await prisma.mascotSocialEvent.findUnique({ where: { id: eventId }, select: { mascotAId: true } }))!.mascotAId, result.option.expA);
    if (result.option.expB) {
      const e = await prisma.mascotSocialEvent.findUnique({ where: { id: eventId }, select: { mascotBId: true } });
      if (e?.mascotBId) await addExp(e.mascotBId, result.option.expB);
    }
    return result;
  });
}

function pickAutoOption(options: BondOption[], behavior: BondBehavior) {
  const runaway = options.find((o) => o.id === "let_run") ?? options.find((o) => o.id === "leave_alone");
  if (runaway) return runaway;
  const freeOptions = options.filter((o) => !o.cost && !o.costs?.length);
  const neutral = freeOptions.filter((o) => o.type === "NEUTRAL");
  const aggressive = freeOptions.filter((o) => o.type === "AGGRESSIVE");
  if (behavior === "COMPETITIVE" && aggressive[0]) return aggressive[0];
  if (behavior === "AVOID_CONFLICT" && neutral[0]) return neutral[0];
  if (behavior === "FRIENDLY" || behavior === "SOCIAL") return neutral.find((o) => o.scoreDelta >= 0) ?? neutral[0] ?? freeOptions[0];
  return neutral[0] ?? aggressive[0] ?? freeOptions[0];
}

async function createRunawayRescueEvent(mascotId: string, previousOwnerId: string) {
  const [mascot, target] = await Promise.all([
    prisma.mascot.findUnique({
      where: { id: mascotId },
      select: { id: true, pokemonId: true, nickname: true, player: { select: { displayName: true } } },
    }),
    prisma.player.findFirst({
      where: { id: { not: previousOwnerId }, user: { role: "PLAYER" } },
      select: { id: true, displayName: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  if (!mascot || !target) return;

  const name = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  await prisma.mascot.update({
    where: { id: mascotId },
    data: {
      socialCooldownUntil: new Date(Date.now() + RUNAWAY_RESCUE_MS),
      isEquipped: false,
      isFavorite: false,
    },
  });
  await prisma.mascotSocialEvent.create({
    data: {
      ownerId: target.id,
      mascotAId: mascotId,
      eventType: RUNAWAY_RESCUE_TYPE,
      title: "Mascote perdido encontrado",
      description: `${name} fugiu de ${mascot.player.displayName} e apareceu perto de voce. Se ajudar com carinho + brincadeira + comida ou doce, ele passa a morar com voce.`,
      optionsJson: defaultBondOptions(RUNAWAY_RESCUE_TYPE) as unknown as Prisma.InputJsonValue,
      visibility: "INVOLVED_PLAYERS",
      affectedPlayerIds: [previousOwnerId, target.id] as unknown as Prisma.InputJsonValue,
      publicEligible: true,
      expiresAt: new Date(Date.now() + RUNAWAY_RESCUE_MS),
    },
  });
}

async function consumeBondCost(tx: Prisma.TransactionClient, playerId: string, cost: BondCost) {
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
    select: { mascotAId: true, mascotBId: true, relationshipScore: true, specialBondType: true, type: true, interactionCount: true },
    take: mascotIds.length * 8,
  }).catch(() => []);
  const modifier = new Map<string, number>();
  for (const id of mascotIds) modifier.set(id, 1);
  for (const rel of relations) {
    const score = effectiveRelationScore(rel);
    const delta = score >= 80 ? 0.05 : score >= 60 ? 0.035 : score >= 35 ? 0.02 : score <= -80 ? -0.04 : score <= -60 ? -0.025 : 0;
    if (delta !== 0) modifier.set(rel.mascotAId, Math.max(0.9, Math.min(1.08, (modifier.get(rel.mascotAId) ?? 1) + delta)));
  }
  return modifier;
}
