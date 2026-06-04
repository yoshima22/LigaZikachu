/**
 * Serviço de mascotes — lógica de negócio do sistema.
 */

import { prisma } from "@/lib/prisma";
import {
  EGG_POOLS, LEGENDARY_POOL, EVOLUTION_MAP, PERSONALITIES, INCUBATION_DURATION_MS,
  EXPEDITION_DURATIONS, expForLevel, expToNextLevel, EXP_REWARDS,
  getSpriteUrl, getPokemonName, getPokemonElement, getTypeAdvantageMultiplier,
} from "@/lib/mascot-data";
import type { ExpeditionDuration } from "@/lib/mascot-data";
import type { MascotMood, MascotPersonality } from "@prisma/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPersonality(): MascotPersonality {
  return randomFrom([...PERSONALITIES]) as MascotPersonality;
}

/** Sorteio de pokemonId a partir do tipo de ovo */
export function rollPokemonFromEgg(eggType: string): number {
  // Pool aleatório (COMMON sem gen específica) = todas as 9 gerações
  const pool = eggType === "COMMON" || eggType === "EVENT"
    ? (EGG_POOLS.RANDOM.length > 0 ? EGG_POOLS.RANDOM : EGG_POOLS.COMMON)
    : (EGG_POOLS[eggType] ?? EGG_POOLS.RANDOM);

  // Chance lendária por raridade
  // SPECIAL: 2% | GEN eggs / RARE: 1% | COMMON (aleatório, todas gens): 1% (bônus por diversidade) | EVENT: 0.3%
  const legendaryChance =
    eggType === "SPECIAL" ? 0.02 :
    eggType === "RARE" || eggType.startsWith("EGG_GEN") ? 0.01 :
    eggType === "COMMON" ? 0.01 :   // modo aleatório: +1% de bônus
    0.003;

  if (Math.random() < legendaryChance) {
    return randomFrom(LEGENDARY_POOL);
  }

  return randomFrom(pool);
}

// ── Incubação ─────────────────────────────────────────────────────────────────

export async function startIncubation(playerId: string, eggId: string) {
  const existing = await prisma.mascotIncubator.findUnique({ where: { playerId } });
  if (existing) throw new Error("Você já tem um ovo na incubadora.");

  const egg = await prisma.mascotEgg.findUnique({ where: { id: eggId } });
  if (!egg || egg.playerId !== playerId) throw new Error("Ovo não encontrado.");

  const finishAt = new Date(Date.now() + INCUBATION_DURATION_MS);
  return prisma.mascotIncubator.create({
    data: { playerId, eggId, finishAt }
  });
}

export async function hatchEgg(playerId: string): Promise<{ mascotId: string; pokemonId: number; name: string; isNew: boolean }> {
  const incubator = await prisma.mascotIncubator.findUnique({
    where: { playerId },
    include: { egg: true }
  });
  if (!incubator) throw new Error("Sem ovo na incubadora.");
  if (incubator.hatched) throw new Error("Ovo já chocado.");
  if (new Date() < incubator.finishAt) throw new Error("O ovo ainda não está pronto.");

  const pokemonId = rollPokemonFromEgg(incubator.egg.type);
  const personality = randomPersonality();

  const mascot = await prisma.$transaction(async (tx) => {
    // Cria o mascote
    const m = await tx.mascot.create({
      data: {
        playerId,
        pokemonId,
        personality,
        statForce:    randomInt(8, 14),
        statAgility:  randomInt(8, 14),
        statCharisma: randomInt(8, 14),
        statInstinct: randomInt(8, 14),
        statVitality: randomInt(8, 14),
      }
    });
    // Marca incubadora como chocada
    await tx.mascotIncubator.update({ where: { playerId }, data: { hatched: true } });
    // Remove ovo do inventário e incubadora
    await tx.mascotIncubator.delete({ where: { playerId } });
    await tx.mascotEgg.delete({ where: { id: incubator.eggId } });
    return m;
  });

  return { mascotId: mascot.id, pokemonId, name: getPokemonName(pokemonId), isNew: true };
}

// ── Equipar mascote ───────────────────────────────────────────────────────────

export async function equipMascot(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");

  // Verifica se o mascote atualmente equipado está em expedição
  const equippedInExpedition = await prisma.mascot.findFirst({
    where: { playerId, isEquipped: true, id: { not: mascotId } },
    include: { expeditions: { where: { status: "ACTIVE" }, take: 1 } }
  });
  if (equippedInExpedition?.expeditions?.length) {
    throw new Error("Seu mascote atual está em expedição. Aguarde o retorno ou cancele a expedição antes de trocar.");
  }

  await prisma.$transaction([
    prisma.mascot.updateMany({ where: { playerId }, data: { isEquipped: false } }),
    prisma.mascot.update({ where: { id: mascotId }, data: { isEquipped: true } }),
  ]);
}

export async function unequipMascot(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");

  // Verifica se há expedição ativa
  const activeExpedition = await prisma.mascotExpedition.findFirst({
    where: { mascotId, status: "ACTIVE" }
  });
  if (activeExpedition) throw new Error("Não é possível desequipar um mascote em expedição. Aguarde o retorno.");

  await prisma.mascot.update({ where: { id: mascotId }, data: { isEquipped: false } });
}

// ── EXP e level up ────────────────────────────────────────────────────────────

export interface LevelUpResult {
  leveled: boolean;
  newLevel: number;
  evolved: boolean;
  newPokemonId?: number;
}

export async function addExp(mascotId: string, amount: number): Promise<LevelUpResult> {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot) throw new Error("Mascote não encontrado.");
  // EXP agora é dado a qualquer mascote (equipado ou no banco)
  // Mascotes no banco recebem 50% do EXP (interações presenciais são menos intensas)
  if (!mascot.isEquipped) amount = Math.max(1, Math.floor(amount * 0.5));

  // Check for active EXP_BOOST buff
  const expBoostBuff = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: "EXP_BOOST", expiresAt: { gt: new Date() } }
  });
  if (expBoostBuff) amount = Math.floor(amount * 2);

  let { level, exp, pokemonId } = mascot;
  exp += amount;
  let leveled = false;
  let evolved = false;
  let newPokemonId: number | undefined;

  // Verifica level ups em cadeia
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level++;
    leveled = true;

    // Verifica evolução
    const evo = EVOLUTION_MAP.get(pokemonId);
    if (evo && level >= evo.level) {
      pokemonId = evo.to;
      evolved = true;
      newPokemonId = pokemonId;
    }
  }

  // Auto-rename: se o nickname era o nome padrão do Pokémon antes da evolução,
  // atualiza para o nome da nova forma automaticamente
  let nicknameUpdate: { nickname: null } | Record<string, never> = {};
  if (evolved && newPokemonId) {
    const oldDefaultName = getPokemonName(mascot.pokemonId);
    const wasDefault = !mascot.nickname || mascot.nickname === oldDefaultName;
    if (wasDefault) nicknameUpdate = { nickname: null }; // null = mostra nome novo do pokemonId
  }

  // Bônus de stat por level up
  const statUpdates = leveled ? {
    statForce:    mascot.statForce    + (mascot.personality === "COMPETITIVE" ? 2 : 1),
    statAgility:  mascot.statAgility  + 1,
    statCharisma: mascot.statCharisma + (mascot.personality === "LOYAL" ? 2 : 1),
    statInstinct: mascot.statInstinct + 1,
    statVitality: mascot.statVitality + (mascot.personality === "DRAMATIC" ? 0 : 1),
  } : {};

  await prisma.mascot.update({
    where: { id: mascotId },
    data: { level, exp, pokemonId, ...statUpdates, ...nicknameUpdate }
  });

  return { leveled, newLevel: level, evolved, newPokemonId };
}

/** Dá EXP a todos os mascotes equipados de um jogador */
export async function rewardEquippedMascot(
  playerId: string,
  reason: keyof typeof EXP_REWARDS
): Promise<void> {
  const mascot = await prisma.mascot.findFirst({
    where: { playerId, isEquipped: true }
  });
  if (!mascot) return;

  const amount = EXP_REWARDS[reason] ?? 0;
  if (amount > 0) await addExp(mascot.id, amount).catch(() => { /* ignora falhas silenciosas */ });
}

// ── Interações ────────────────────────────────────────────────────────────────

export type InteractionType = "PLAY" | "PET" | "FEED_FOOD" | "FEED_SWEET";

export interface InteractionResult {
  success: boolean;
  message: string;
  happinessChange: number;
  expGained: number;
  newMood?: MascotMood;
  refused?: boolean;
}

export async function interactWithMascot(
  playerId: string,
  mascotId: string,
  type: InteractionType,
  skipCooldown = false
): Promise<InteractionResult> {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");

  const now = new Date();
  const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutos
  if (!skipCooldown && mascot.lastInteractedAt && now.getTime() - mascot.lastInteractedAt.getTime() < COOLDOWN_MS) {
    return { success: false, message: "Espere um pouco antes de interagir novamente.", happinessChange: 0, expGained: 0 };
  }

  // Bônus por nível — cada 10 níveis aumenta eficácia das interações
  const lvlBonus = Math.floor(mascot.level / 10);

  let happinessChange = 0;
  let expGained = 0;
  let refused = false;
  let newMood: MascotMood | undefined;
  let message = "";

  switch (type) {
    case "PLAY": {
      // PLAY: +8 base → cresce com nível. Brincalhão tem bônus extra.
      const playHappy = 8 + lvlBonus * 2 + (mascot.personality === "PLAYFUL" ? 3 : 0);
      const playExp   = EXP_REWARDS.PLAY_WITH + lvlBonus * 3;
      happinessChange = playHappy;
      expGained = playExp;
      newMood = mascot.personality === "LAZY" ? "TIRED" : "HAPPY";
      message = mascot.personality === "LAZY"
        ? `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} é preguiçoso — brincou um pouco mas logo cansou. (+${playHappy} felicidade)`
        : `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} adorou brincar! (+${playHappy} felicidade, +${playExp} EXP)`;
      break;
    }
    case "PET": {
      if (mascot.personality === "TIMID" && mascot.happiness < 40) {
        refused = true;
        message = `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} é muito tímido e está com a felicidade baixa (${mascot.happiness}/100) — recusou o carinho.`;
        break;
      }
      if (mascot.mood === "ANGRY") {
        refused = true;
        message = `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} está com raiva agora. Espere a raiva passar antes de tentar o carinho!`;
        break;
      }
      // PET é mais gentil que PLAY: menos felicidade base, mas cresce mais com nível
      // Razão: Carinho fortalece vínculo gradualmente; brincar é mais intenso
      const petHappy = 5 + lvlBonus + (mascot.personality === "LOYAL" ? 2 : 0);
      const petExp   = EXP_REWARDS.PET + lvlBonus;
      happinessChange = petHappy;
      expGained = petExp;
      newMood = mascot.happiness + petHappy >= 80 ? "HAPPY" :
                mascot.mood === "TIRED" ? "NEUTRAL" :
                mascot.mood === "NEEDY" ? "NEUTRAL" : undefined;
      message = mascot.personality === "PROUD"
        ? `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} aceitou o carinho com dignidade! 👑 (+${petHappy} felicidade, +${petExp} EXP)`
        : `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} gostou do carinho! 💛 (+${petHappy} felicidade, +${petExp} EXP)`;
      break;
    }

    case "FEED_FOOD": {
      const food = await prisma.mascotFoodItem.findUnique({
        where: { playerId_type: { playerId, type: "FOOD" } }
      });
      if (!food || food.quantity <= 0) {
        return { success: false, message: "Você não tem comida no inventário.", happinessChange: 0, expGained: 0 };
      }
      await prisma.mascotFoodItem.update({
        where: { playerId_type: { playerId, type: "FOOD" } },
        data: { quantity: { decrement: 1 } }
      });
      happinessChange = 25; // ganho maior para garantir saída do status SAD (threshold 40)
      expGained = EXP_REWARDS.FEED_FOOD;
      newMood = "HAPPY";
      message = `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} comeu e está satisfeito!`;
      break;
    }

    case "FEED_SWEET": {
      const sweet = await prisma.mascotFoodItem.findUnique({
        where: { playerId_type: { playerId, type: "SWEET" } }
      });
      if (!sweet || sweet.quantity <= 0) {
        return { success: false, message: "Você não tem doces no inventário.", happinessChange: 0, expGained: 0 };
      }
      await prisma.mascotFoodItem.update({
        where: { playerId_type: { playerId, type: "SWEET" } },
        data: { quantity: { decrement: 1 } }
      });
      happinessChange = 35; // doce dá grande boost de felicidade
      expGained = EXP_REWARDS.FEED_SWEET;
      newMood = "EXCITED";
      message = `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} amou o doce! Olha aquela energia!`;
      break;
    }
  }

  if (refused) {
    return { success: false, message, happinessChange: 0, expGained: 0, refused: true };
  }

  // EXP sempre aplicado — addExp já reduz 50% para mascotes no banco
  // Atualiza felicidade (0-100)
  const newHappiness = Math.min(100, Math.max(0, mascot.happiness + happinessChange));

  // Felicidade alta pode mudar humor para CONFIDENT
  const finalMood: MascotMood = newHappiness >= 90
    ? "CONFIDENT"
    : newMood ?? mascot.mood;

  await prisma.mascot.update({
    where: { id: mascotId },
    data: {
      happiness: newHappiness,
      mood: finalMood,
      lastInteractedAt: now,
      lastFedAt: type.startsWith("FEED") ? now : mascot.lastFedAt,
    }
  });

  if (expGained > 0) await addExp(mascotId, expGained).catch(() => {});

  return { success: true, message, happinessChange, expGained, newMood: finalMood };
}

// ── Mood decay (recalcula humor baseado em última interação) ──────────────────

export async function recalculateMood(mascotId: string): Promise<void> {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot) return;

  const now = Date.now();
  const decayMultiplier = mascot.isEquipped ? 1 : 0.25;
  const thresholdMultiplier = mascot.isEquipped ? 1 : 4;
  const hoursSinceInteraction = mascot.lastInteractedAt
    ? (now - mascot.lastInteractedAt.getTime()) / (1000 * 60 * 60)
    : 999;
  const hoursSinceFed = mascot.lastFedAt
    ? (now - mascot.lastFedAt.getTime()) / (1000 * 60 * 60)
    : 999;

  let happinessDecay = 0;
  let newMood: MascotMood = mascot.mood;

  if (hoursSinceInteraction > 48 * thresholdMultiplier) {
    newMood = "TIRED";
    happinessDecay = Math.max(happinessDecay, Math.ceil(5 * decayMultiplier));
  } else if (hoursSinceInteraction > 24 * thresholdMultiplier) {
    newMood = "NEEDY";
    happinessDecay = Math.max(happinessDecay, Math.ceil(2 * decayMultiplier));
  }

  if (hoursSinceFed > 36 * thresholdMultiplier) {
    newMood = "HUNGRY";
    happinessDecay = Math.max(happinessDecay, Math.ceil(4 * decayMultiplier));
  }

  if (happinessDecay > 0) {
    // Usa decrement atômico para evitar race condition com interações simultâneas
    // (lê e sobrescreve em uma única operação do banco, não na memória)
    await prisma.mascot.update({
      where: { id: mascotId },
      data: {
        happiness: { decrement: happinessDecay },
        mood: newMood
      }
    });
    // Garante que happiness não fique negativo (Prisma não tem clamp nativo)
    await prisma.mascot.updateMany({
      where: { id: mascotId, happiness: { lt: 0 } },
      data: { happiness: 0 }
    });
  } else if (newMood !== mascot.mood) {
    await prisma.mascot.update({
      where: { id: mascotId },
      data: { mood: newMood }
    });
  }
}

// ── Expedições ────────────────────────────────────────────────────────────────

export type ExpeditionReward =
  | { type: "EGG";       eggType: string }
  | { type: "FOOD";      foodType: "FOOD" | "SWEET"; quantity: number }
  | { type: "COINS";     amount: number }
  | { type: "NOTHING" };

async function rollExpeditionReward(
  mascot: { id: string; level: number; statInstinct: number; statCharisma: number },
  durationKey: ExpeditionDuration = "1h",
  allyCount = 0
): Promise<ExpeditionReward> {
  const luckBuff = await prisma.mascotBuff.findFirst({
    where: { mascotId: mascot.id, type: "LUCK_BOOST", expiresAt: { gt: new Date() } }
  });
  const hasLuckBuff = !!luckBuff;
  const luckMultiplier = hasLuckBuff ? 2 : 1;
  const dur = EXPEDITION_DURATIONS[durationKey];
  const rewardBonus = dur.rewardBonus; // 0, 5, 15, 30

  // Luck escala melhor com nível (a cada 5 níveis)
  const luck = (mascot.statInstinct + Math.floor(mascot.level / 5)) * luckMultiplier;
  // Bônus de nível para mascotes baixos — garante que sempre valha a pena
  const levelFloor = Math.min(30, mascot.level * 2); // Nv1=2, Nv5=10, Nv15=30
  // Bônus de aliados — cada amigo melhora as chances
  const allyBonus = Math.min(20, allyCount * 4);

  // ── Chance de NOTHING: máx 5%, zero com buff de sorte ou 3+ aliados ─────────
  const nothingChance = hasLuckBuff || allyCount >= 3 ? 0 : Math.max(0, 5 - allyCount * 1.5);
  if (Math.random() * 100 < nothingChance) return { type: "NOTHING" };

  // ── Distribuição ponderada dos tipos de recompensa ───────────────────────────
  // Pesos somam ~100; mais luck/duração = maior chance de ovo e sweet
  const eggWeight   = 8  + Math.min(22, luck * 0.6) + rewardBonus * 0.6 + allyBonus;
  const sweetWeight = 15 + rewardBonus * 0.4 + (hasLuckBuff ? 10 : 0);
  const foodWeight  = 35 + levelFloor * 0.5 + rewardBonus * 0.2;
  const coinWeight  = 42 + levelFloor * 0.5;
  const total       = eggWeight + sweetWeight + foodWeight + coinWeight;
  const roll        = Math.random() * total;

  // Ovo: qualidade cresce com duração e nível
  let eggType = "COMMON";
  if (durationKey === "6h")                            eggType = luck > 10 ? "SPECIAL" : "RARE";
  else if (durationKey === "3h" && luck > 12)          eggType = "RARE";
  else if ((durationKey === "1h" || durationKey === "30min") && luck > 20) eggType = "RARE";

  // Quantidade de comida melhora com duração
  const foodQtyMax = 1 + Math.floor(rewardBonus / 8);

  // Valor de moedas escala com duração e nível
  const coinMin = Math.max(50, 50 + rewardBonus * 6 + mascot.level * 2);
  const coinMax = coinMin + 100 + rewardBonus * 12 + mascot.level * 3;

  const cumEgg   = eggWeight;
  const cumSweet = cumEgg + sweetWeight;
  const cumFood  = cumSweet + foodWeight;

  if (roll < cumEgg)   return { type: "EGG",   eggType };
  if (roll < cumSweet) return { type: "FOOD",  foodType: "SWEET", quantity: 1 };
  if (roll < cumFood)  return { type: "FOOD",  foodType: "FOOD",  quantity: randomInt(1, 1 + foodQtyMax) };
  return { type: "COINS", amount: randomInt(coinMin, coinMax) };
}

function describeExpeditionReward(reward: ExpeditionReward) {
  switch (reward.type) {
    case "EGG": {
      const eggLabel = reward.eggType === "SPECIAL" ? "Especial" : reward.eggType === "RARE" ? "Raro" : "Comum";
      return {
        title: `Ovo ${eggLabel} encontrado!`,
        description: "Seu mascote voltou da expedição carregando um ovo.",
        payload: {
          rewardKind: "MASCOT_EGG",
          eggType: reward.eggType,
          origin: "Expedição de mascote",
          rewardLabel: `Ovo ${eggLabel}`,
        }
      };
    }
    case "FOOD":
      return {
        title: reward.foodType === "SWEET" ? "Doce de Mascote encontrado" : "Comida de Mascote encontrada",
        description: `Seu mascote trouxe ${reward.quantity} item(ns) da expedição.`,
        payload: {
          rewardKind: "MASCOT_FOOD",
          foodType: reward.foodType,
          quantity: reward.quantity,
          rewardLabel: reward.foodType === "SWEET" ? "Doce de Mascote" : "Comida de Mascote",
        }
      };
    case "COINS":
      return {
        title: "ZikaCoins encontradas",
        description: `Seu mascote trouxe ${reward.amount} ZikaCoins da expedição.`,
        payload: {
          rewardKind: "ZIKA_COINS",
          amount: reward.amount,
          rewardLabel: `${reward.amount} ZikaCoins`,
        }
      };
    case "NOTHING":
      return null;
  }
}

export async function startExpedition(playerId: string, mascotId: string, durationKey: ExpeditionDuration = "1h") {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (!mascot.isEquipped) throw new Error("Apenas o mascote equipado pode sair em expedição.");

  const active = await prisma.mascotExpedition.findFirst({
    where: { mascotId, status: "ACTIVE" }
  });
  if (active) throw new Error("Mascote já está em expedição.");

  const dur = EXPEDITION_DURATIONS[durationKey];
  const finishAt = new Date(Date.now() + dur.ms);
  return prisma.mascotExpedition.create({
    data: { mascotId, finishAt, rewardJson: { durationKey } } // guarda duration para calcular recompensa
  });
}

/** Jogador cancela expedição — sem recompensa, mascote volta imediatamente */
export async function cancelExpedition(playerId: string, expeditionId: string): Promise<void> {
  const expedition = await prisma.mascotExpedition.findUnique({
    where: { id: expeditionId },
    include: { mascot: { select: { playerId: true, pokemonId: true, nickname: true, id: true } } }
  });
  if (!expedition) throw new Error("Expedição não encontrada.");
  if (expedition.mascot.playerId !== playerId) throw new Error("Sem permissão.");
  if (expedition.status !== "ACTIVE") throw new Error("Expedição já concluída.");

  await prisma.mascotExpedition.update({
    where: { id: expeditionId },
    data: { status: "CLAIMED", rewardJson: { type: "NOTHING", cancelled: true } }
  });

  const name = expedition.mascot.nickname ?? getPokemonName(expedition.mascot.pokemonId);
  await logEvent(expedition.mascot.id, "🏃", `${name} voltou da expedição antes do fim.`).catch(() => {});
}

/** Admin: encerra expedição imediatamente (skip timer) */
export async function skipExpedition(expeditionId: string) {
  await prisma.mascotExpedition.update({
    where: { id: expeditionId },
    data: { finishAt: new Date(Date.now() - 1000) } // 1s atrás = pronto
  });
}

async function claimExpeditionLegacy(
  playerId: string,
  expeditionId: string
): Promise<{ reward: ExpeditionReward; mascotId: string }> {
  const expedition = await prisma.mascotExpedition.findUnique({
    where: { id: expeditionId },
    include: { mascot: true }
  });
  if (!expedition || expedition.mascot.playerId !== playerId) throw new Error("Expedição não encontrada.");
  if (expedition.status !== "ACTIVE") throw new Error("Expedição já coletada.");
  if (new Date() < expedition.finishAt) throw new Error("A expedição ainda não terminou.");

  const reward = await rollExpeditionReward(expedition.mascot);

  await prisma.$transaction(async (tx) => {
    await tx.mascotExpedition.update({ where: { id: expeditionId }, data: { status: "CLAIMED", rewardJson: reward } });

    // Aplica recompensa
    if (reward.type === "EGG") {
      await tx.mascotEgg.create({ data: { playerId, type: reward.eggType as "COMMON" | "RARE", origin: "Expedição" } });
    } else if (reward.type === "FOOD") {
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId, type: reward.foodType } },
        update: { quantity: { increment: reward.quantity } },
        create: { playerId, type: reward.foodType, quantity: reward.quantity }
      });
    } else if (reward.type === "COINS") {
      // Credita ZikaCoins via wallet
      await tx.zikaCoinWallet.updateMany({
        where: { playerId },
        data: { balance: { increment: reward.amount } }
      });
    }

    // EXP pela expedição
    await addExp(expedition.mascotId, EXP_REWARDS.EXPEDITION);
  });

  return { reward, mascotId: expedition.mascotId };
}

export async function claimExpedition(
  playerId: string,
  expeditionId: string
): Promise<{ reward: ExpeditionReward; mascotId: string }> {
  const expedition = await prisma.mascotExpedition.findUnique({
    where: { id: expeditionId },
    include: { mascot: true }
  });
  if (!expedition || expedition.mascot.playerId !== playerId) throw new Error("Expedição não encontrada.");
  if (expedition.status !== "ACTIVE") throw new Error("Expedição já coletada.");
  if (new Date() < expedition.finishAt) throw new Error("A expedição ainda não terminou.");

  // Recupera a duração armazenada no rewardJson durante startExpedition
  const storedDuration = (expedition.rewardJson as Record<string, unknown> | null)?.durationKey as ExpeditionDuration | undefined;
  const durationKey: ExpeditionDuration = storedDuration ?? "1h";
  const dur = EXPEDITION_DURATIONS[durationKey];

  // Busca aliados ANTES de rolar recompensa (influenciam as chances)
  const friends = await prisma.mascotRelation.findMany({
    where: { mascotAId: expedition.mascotId, type: "FRIEND" },
    include: { mascotB: { select: { id: true, statCharisma: true, nickname: true, pokemonId: true, playerId: true } } }
  });
  const allyCount = friends.length;
  const expeditorName = expedition.mascot.nickname ?? getPokemonName(expedition.mascot.pokemonId);

  const reward = await rollExpeditionReward(expedition.mascot, durationKey, allyCount);
  const gift = describeExpeditionReward(reward);

  // EXP: base × duração × nível × bônus de aliados
  const expBase = EXP_REWARDS.EXPEDITION;
  const levelMult = 1 + Math.floor(expedition.mascot.level / 20) * 0.25;
  const allyExpBonus = 1 + allyCount * 0.1; // cada aliado = +10% EXP (máx +50%)
  const expeditionExp = Math.round(expBase * dur.expMultiplier * levelMult * allyExpBonus);

  await prisma.$transaction(async (tx) => {
    await tx.mascotExpedition.update({
      where: { id: expeditionId },
      data: { status: "CLAIMED", rewardJson: reward }
    });

    if (gift) {
      const allyNote = allyCount > 0
        ? ` (${allyCount} aliado${allyCount > 1 ? "s" : ""} apoiaram!)`
        : "";
      await tx.playerGift.create({
        data: {
          playerId,
          type: "CUSTOM",
          title: `Expedição: ${gift.title}`,
          description: gift.description + allyNote,
          payload: {
            ...gift.payload,
            mascotId: expedition.mascotId,
            pokemonId: expedition.mascot.pokemonId,
          }
        }
      });
    }

    // ── Bônus e presentes dos aliados ──────────────────────────────────────
    for (const rel of friends) {
      const friendName = rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId);
      const allyPlayerId = rel.mascotB.playerId;

      // EXP para o mascote aliado também (participação remota)
      await addExp(rel.mascotB.id, Math.round(EXP_REWARDS.EXPEDITION * 0.3)).catch(() => {});

      // Presente para o dono do aliado: moedas ou comida dependendo do carisma
      const charisma = rel.mascotB.statCharisma;
      if (charisma >= 15) {
        // Alto carisma: envia comida ou doce como presente
        const foodType = Math.random() < 0.4 ? "SWEET" : "FOOD";
        await tx.playerGift.create({
          data: {
            playerId: allyPlayerId,
            type: "CUSTOM",
            title: `Presente de ${expeditorName}`,
            description: `${expeditorName} voltou da expedição e trouxe algo para ${friendName}! 🤝`,
            payload: {
              rewardKind: "MASCOT_FOOD",
              foodType,
              quantity: 1,
              rewardLabel: foodType === "SWEET" ? "Doce de Mascote" : "Comida de Mascote",
            }
          }
        });
      } else {
        // Carisma normal: envia moedas
        const bonusCoins = randomInt(30, 80);
        await tx.playerGift.create({
          data: {
            playerId: allyPlayerId,
            type: "CUSTOM",
            title: `Presente de ${expeditorName}`,
            description: `${expeditorName} voltou da expedição e enviou ${bonusCoins} ZC para o dono de ${friendName}! 🤝`,
            payload: {
              rewardKind: "ZIKA_COINS",
              amount: bonusCoins,
              rewardLabel: `${bonusCoins} ZikaCoins`,
            }
          }
        });
      }

      // Log de evento nos dois mascotes
      await logEvent(rel.mascotB.id, "🤝", `Apoiou ${expeditorName} em expedição de ${dur.label} e ganhou recompensa!`).catch(() => {});
      await logEvent(expedition.mascotId, "💚", `${friendName} apoiou e turbinou a expedição! (+${Math.round(allyExpBonus * 100 - 100)}% EXP)`).catch(() => {});
    }
  });

  await addExp(expedition.mascotId, expeditionExp).catch(() => {});

  // Roda eventos sociais automaticamente ao coletar expedição (fire-and-forget)
  triggerSocialEvents().catch(() => {});

  return { reward, mascotId: expedition.mascotId };
}

// ── Evento de log ─────────────────────────────────────────────────────────────

async function logEvent(mascotId: string, emoji: string, description: string) {
  await prisma.mascotEvent.create({ data: { mascotId, emoji, description } }).catch(() => {});
}

// ── Efeito do resultado da partida do treinador ───────────────────────────────

export async function applyMatchResultToMascot(playerId: string, won: boolean): Promise<void> {
  const mascot = await prisma.mascot.findFirst({
    where: { playerId, isEquipped: true }
  });
  if (!mascot) return;

  const happinessChange = won ? 8 : -5;
  const newHappiness = Math.min(100, Math.max(0, mascot.happiness + happinessChange));
  let newMood: MascotMood = mascot.mood;

  if (won) {
    newMood = newHappiness >= 85 ? "CONFIDENT" : "HAPPY";
    await addExp(mascot.id, EXP_REWARDS.MATCH_WIN).catch(() => {});
    await logEvent(mascot.id, "🏆", `Treinador venceu uma partida! ${mascot.nickname ?? getPokemonName(mascot.pokemonId)} ficou orgulhoso.`);
  } else {
    if (newHappiness < 30) newMood = "NEEDY";
    else if (newHappiness < 50) newMood = "TIRED";
    await addExp(mascot.id, EXP_REWARDS.MATCH_PLAYED).catch(() => {});
    await logEvent(mascot.id, "😔", `Treinador perdeu uma partida. ${mascot.nickname ?? getPokemonName(mascot.pokemonId)} ficou entristecido.`);
  }

  await prisma.mascot.update({
    where: { id: mascot.id },
    data: { happiness: newHappiness, mood: newMood }
  });
}

// ── Sistema de batalha entre mascotes ────────────────────────────────────────

export interface BattleResult {
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  winnerMultiplier: number;
  loserMultiplier: number;
  summary: string;
}

function battleScore(m: { statForce: number; statAgility: number; statVitality: number; happiness: number; mood: string }, multiplier: number): number {
  const base = m.statForce * 0.4 + m.statAgility * 0.3 + m.statVitality * 0.3;
  const bonus = m.happiness / 10 + (m.mood === "CONFIDENT" ? 10 : m.mood === "ANGRY" ? 5 : 0);
  return (base + bonus + Math.random() * 15) * multiplier;
}

export async function battleMascots(mascotAId: string, mascotBId: string): Promise<BattleResult> {
  const [a, b] = await Promise.all([
    prisma.mascot.findUnique({ where: { id: mascotAId } }),
    prisma.mascot.findUnique({ where: { id: mascotBId } }),
  ]);
  if (!a || !b) throw new Error("Mascote não encontrado.");
  if (a.playerId === b.playerId) throw new Error("Pokémon do mesmo treinador não batalham.");

  // Skip if either mascot belongs to an admin
  const adminRoles = ["ADMIN", "SUPER_ADMIN"];
  const [playerA, playerB] = await Promise.all([
    prisma.player.findUnique({ where: { id: a.playerId }, select: { user: { select: { role: true } } } }),
    prisma.player.findUnique({ where: { id: b.playerId }, select: { user: { select: { role: true } } } }),
  ]);
  if (adminRoles.includes(playerA?.user.role ?? "") || adminRoles.includes(playerB?.user.role ?? "")) {
    throw new Error("Batalhas envolvendo mascotes de admins não são registradas.");
  }

  const elemA = getPokemonElement(a.pokemonId);
  const elemB = getPokemonElement(b.pokemonId);
  const multA = getTypeAdvantageMultiplier(elemA, elemB);
  const multB = getTypeAdvantageMultiplier(elemB, elemA);

  const scoreA = battleScore(a, multA);
  const scoreB = battleScore(b, multB);
  const aWins = scoreA >= scoreB;

  const winner = aWins ? a : b;
  const loser  = aWins ? b : a;
  const wMult  = aWins ? multA : multB;
  const lMult  = aWins ? multB : multA;

  const winnerName = winner.nickname ?? getPokemonName(winner.pokemonId);
  const loserName  = loser.nickname  ?? getPokemonName(loser.pokemonId);

  const typeNote = wMult > 1 ? ` (vantagem de tipo ${getPokemonElement(winner.pokemonId).toUpperCase()})` : "";
  const summary  = `${winnerName} venceu ${loserName}${typeNote}!`;

  await prisma.$transaction(async (tx) => {
    // Atualiza contadores
    await tx.mascot.update({ where: { id: winner.id }, data: { battleWins: { increment: 1 }, happiness: Math.min(100, winner.happiness + 10), mood: "PROUD" as MascotMood } });
    await tx.mascot.update({ where: { id: loser.id  }, data: { battleLosses: { increment: 1 }, happiness: Math.max(0, loser.happiness - 8) } });

    // Relação entre mascotes
    await tx.mascotRelation.upsert({
      where: { mascotAId_mascotBId: { mascotAId: a.id, mascotBId: b.id } },
      update: aWins ? { wins: { increment: 1 }, type: "RIVAL" } : { losses: { increment: 1 }, type: "RIVAL" },
      create: { mascotAId: a.id, mascotBId: b.id, type: "RIVAL", wins: aWins ? 1 : 0, losses: aWins ? 0 : 1 },
    });
    // Relação inversa (para B poder consultar)
    await tx.mascotRelation.upsert({
      where: { mascotAId_mascotBId: { mascotAId: b.id, mascotBId: a.id } },
      update: aWins ? { losses: { increment: 1 }, type: "RIVAL" } : { wins: { increment: 1 }, type: "RIVAL" },
      create: { mascotAId: b.id, mascotBId: a.id, type: "RIVAL", wins: aWins ? 0 : 1, losses: aWins ? 1 : 0 },
    });
  });

  await Promise.all([
    logEvent(winner.id, "⚔️", `Venceu batalha contra ${loserName}!${typeNote}`),
    logEvent(loser.id,  "💀", `Perdeu batalha para ${winnerName}.`),
  ]);

  return { winnerId: winner.id, loserId: loser.id, winnerName, loserName, winnerMultiplier: wMult, loserMultiplier: lMult, summary };
}

// Amizade entre mascotes do mesmo treinador
export async function formFriendship(mascotAId: string, mascotBId: string): Promise<void> {
  const [a, b] = await Promise.all([
    prisma.mascot.findUnique({ where: { id: mascotAId } }),
    prisma.mascot.findUnique({ where: { id: mascotBId } }),
  ]);
  if (!a || !b) return;

  // Skip if either mascot belongs to an admin
  const adminRoles = ["ADMIN", "SUPER_ADMIN"];
  const [playerA, playerB] = await Promise.all([
    prisma.player.findUnique({ where: { id: a.playerId }, select: { user: { select: { role: true } } } }),
    prisma.player.findUnique({ where: { id: b.playerId }, select: { user: { select: { role: true } } } }),
  ]);
  if (adminRoles.includes(playerA?.user.role ?? "") || adminRoles.includes(playerB?.user.role ?? "")) return;

  await prisma.$transaction([
    prisma.mascotRelation.upsert({
      where: { mascotAId_mascotBId: { mascotAId, mascotBId } },
      update: { type: "FRIEND" },
      create: { mascotAId, mascotBId, type: "FRIEND" },
    }),
    prisma.mascotRelation.upsert({
      where: { mascotAId_mascotBId: { mascotAId: mascotBId, mascotBId: mascotAId } },
      update: { type: "FRIEND" },
      create: { mascotAId: mascotBId, mascotBId: mascotAId, type: "FRIEND" },
    }),
  ]);

  await Promise.all([
    logEvent(mascotAId, "💚", `Fez amizade com ${b.nickname ?? getPokemonName(b.pokemonId)}!`),
    logEvent(mascotBId, "💚", `Fez amizade com ${a.nickname ?? getPokemonName(a.pokemonId)}!`),
  ]);
}

// ── Eventos sociais automáticos (batalhas/amizades entre mascotes) ────────────

export interface SocialEventSummary {
  battles: number;
  friendships: number;
  events: string[];
}

export async function triggerSocialEvents(): Promise<SocialEventSummary> {
  // Busca todos os mascotes (equipados + banco) de jogadores PLAYER (não admins)
  const allMascots = await prisma.mascot.findMany({
    where: { player: { user: { role: "PLAYER" } } },
    select: {
      id: true, pokemonId: true, nickname: true, playerId: true,
      statForce: true, statAgility: true, statVitality: true,
      statCharisma: true, statInstinct: true,
      happiness: true, mood: true, level: true,
    }
  });

  if (allMascots.length < 2) return { battles: 0, friendships: 0, events: [] };

  const summary: SocialEventSummary = { battles: 0, friendships: 0, events: [] };

  // Sorteia pares de mascotes de jogadores diferentes
  const shuffled = [...allMascots].sort(() => Math.random() - 0.5);
  const maxPairs = Math.min(5, Math.floor(allMascots.length / 2));

  const usedIds = new Set<string>();

  for (let i = 0; i < shuffled.length && summary.battles + summary.friendships < maxPairs; i++) {
    const a = shuffled[i];
    if (usedIds.has(a.id)) continue;

    // Encontra parceiro de jogador diferente
    const partner = shuffled.find(b =>
      b.id !== a.id &&
      b.playerId !== a.playerId &&
      !usedIds.has(b.id)
    );
    if (!partner) continue;

    usedIds.add(a.id);
    usedIds.add(partner.id);

    const aName = a.nickname ?? getPokemonName(a.pokemonId);
    const bName = partner.nickname ?? getPokemonName(partner.pokemonId);

    // 60% chance de batalha, 40% de amizade
    const isBattle = Math.random() < 0.6;

    if (isBattle) {
      try {
        const result = await battleMascots(a.id, partner.id);
        summary.battles++;
        summary.events.push(`⚔️ ${result.summary}`);
      } catch {
        // ignora erros individuais (ex: mascote do mesmo jogador)
      }
    } else {
      // Amizade entre mascotes de jogadores diferentes
      try {
        await prisma.$transaction([
          prisma.mascotRelation.upsert({
            where: { mascotAId_mascotBId: { mascotAId: a.id, mascotBId: partner.id } },
            update: { type: "FRIEND" },
            create: { mascotAId: a.id, mascotBId: partner.id, type: "FRIEND" },
          }),
          prisma.mascotRelation.upsert({
            where: { mascotAId_mascotBId: { mascotAId: partner.id, mascotBId: a.id } },
            update: { type: "FRIEND" },
            create: { mascotAId: partner.id, mascotBId: a.id, type: "FRIEND" },
          }),
        ]);
        await Promise.all([
          logEvent(a.id,       "💚", `Fez amizade com ${bName} durante evento social!`),
          logEvent(partner.id, "💚", `Fez amizade com ${aName} durante evento social!`),
        ]);
        summary.friendships++;
        summary.events.push(`💚 ${aName} fez amizade com ${bName}!`);
      } catch {
        // ignora
      }
    }
  }

  // Eventos entre rivais: +provocação
  const rivalPairs = await prisma.mascotRelation.findMany({
    where: { type: "RIVAL", wins: { gt: 0 } },
    include: { mascotA: { select: { id: true, pokemonId: true, nickname: true } }, mascotB: { select: { id: true, pokemonId: true, nickname: true } } },
    take: 3,
  });
  for (const rel of rivalPairs) {
    const aName = rel.mascotA.nickname ?? getPokemonName(rel.mascotA.pokemonId);
    const bName = rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId);
    await logEvent(rel.mascotA.id, "😤", `A rivalidade com ${bName} está ficando intensa...`).catch(() => {});
    await logEvent(rel.mascotB.id, "😤", `${aName} não esqueceu a última derrota...`).catch(() => {});
  }

  // Eventos entre aliados: +apoio
  const friendPairs = await prisma.mascotRelation.findMany({
    where: { type: "FRIEND" },
    include: { mascotA: { select: { id: true, pokemonId: true, nickname: true } }, mascotB: { select: { id: true, pokemonId: true, nickname: true } } },
    take: 3,
  });
  for (const rel of friendPairs) {
    const aName = rel.mascotA.nickname ?? getPokemonName(rel.mascotA.pokemonId);
    const bName = rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId);
    if (Math.random() < 0.5) {
      await logEvent(rel.mascotA.id, "💛", `Recebeu apoio de ${bName} hoje!`).catch(() => {});
    }
  }
  void friendPairs; void rivalPairs;

  return summary;
}

// ── Utilidades para UI ────────────────────────────────────────────────────────

export { getSpriteUrl, getPokemonName, expToNextLevel };
export type { ExpeditionDuration };
