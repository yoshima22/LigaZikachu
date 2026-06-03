/**
 * Serviço de mascotes — lógica de negócio do sistema.
 */

import { prisma } from "@/lib/prisma";
import {
  EGG_POOLS, EVOLUTION_MAP, PERSONALITIES, INCUBATION_DURATION_MS,
  EXPEDITION_DURATION_MS, expForLevel, expToNextLevel, EXP_REWARDS,
  getSpriteUrl, getPokemonName,
} from "@/lib/mascot-data";
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
  const pool = EGG_POOLS[eggType] ?? EGG_POOLS.COMMON;
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

  await prisma.$transaction([
    prisma.mascot.updateMany({ where: { playerId }, data: { isEquipped: false } }),
    prisma.mascot.update({ where: { id: mascotId }, data: { isEquipped: true } }),
  ]);
}

export async function unequipMascot(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
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
  if (!mascot.isEquipped) {
    return { leveled: false, newLevel: mascot.level, evolved: false };
  }

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
    data: { level, exp, pokemonId, ...statUpdates }
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
  type: InteractionType
): Promise<InteractionResult> {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");

  const now = new Date();
  const COOLDOWN_MS = 5 * 60 * 1000; // 5min entre interações repetidas
  if (mascot.lastInteractedAt && now.getTime() - mascot.lastInteractedAt.getTime() < COOLDOWN_MS) {
    return { success: false, message: "Espere um pouco antes de interagir novamente.", happinessChange: 0, expGained: 0 };
  }

  let happinessChange = 0;
  let expGained = 0;
  let refused = false;
  let newMood: MascotMood | undefined;
  let message = "";

  switch (type) {
    case "PLAY":
      happinessChange = 8;
      expGained = EXP_REWARDS.PLAY_WITH;
      newMood = mascot.personality === "LAZY" ? "TIRED" : "HAPPY";
      message = mascot.personality === "LAZY"
        ? `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} brincou, mas parece que cansou rápido.`
        : `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} adorou brincar!`;
      break;

    case "PET":
      // Mascote tímido ou bravo pode recusar carinho
      if (mascot.personality === "TIMID" && mascot.happiness < 40) {
        refused = true;
        message = `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} recuou. Não quer carinho agora.`;
        break;
      }
      if (mascot.mood === "ANGRY") {
        refused = true;
        message = `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} está bravo. Melhor esperar passar.`;
        break;
      }
      happinessChange = 3;
      expGained = EXP_REWARDS.PET;
      newMood = mascot.mood === "NEUTRAL" ? "HAPPY" : undefined;
      message = `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} gostou do carinho!`;
      break;

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
      happinessChange = 12;
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
      happinessChange = 10;
      expGained = EXP_REWARDS.FEED_SWEET;
      newMood = "EXCITED";
      message = `${mascot.nickname ?? getPokemonName(mascot.pokemonId)} amou o doce! Olha aquela energia!`;
      break;
    }
  }

  if (refused) {
    return { success: false, message, happinessChange: 0, expGained: 0, refused: true };
  }

  if (!mascot.isEquipped) expGained = 0;

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
    const newHappiness = Math.max(0, mascot.happiness - happinessDecay);
    // NÃO reseta lastInteractedAt/lastFedAt — isso causaria cooldown falso e bloquearia interações
    await prisma.mascot.update({
      where: { id: mascotId },
      data: { happiness: newHappiness, mood: newMood }
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

function rollExpeditionReward(mascot: { level: number; statInstinct: number; statCharisma: number }): ExpeditionReward {
  const luck = mascot.statInstinct + Math.floor(mascot.level / 10);
  const roll = Math.random() * 100;

  if (roll < 5 + luck * 0.3) return { type: "EGG", eggType: luck > 20 ? "RARE" : "COMMON" };
  if (roll < 20) return { type: "FOOD", foodType: "SWEET", quantity: 1 };
  if (roll < 40) return { type: "FOOD", foodType: "FOOD",  quantity: randomInt(1, 3) };
  if (roll < 60) return { type: "COINS", amount: randomInt(50, 200) };
  return { type: "NOTHING" };
}

function describeExpeditionReward(reward: ExpeditionReward) {
  switch (reward.type) {
    case "EGG":
      return {
        title: reward.eggType === "RARE" ? "Ovo Raro encontrado" : "Ovo Comum encontrado",
        description: "Seu mascote voltou da expedição carregando um ovo.",
        payload: {
          rewardKind: "MASCOT_EGG",
          eggType: reward.eggType,
          origin: "Expedição de mascote",
          rewardLabel: reward.eggType === "RARE" ? "Ovo Raro" : "Ovo Comum",
        }
      };
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

export async function startExpedition(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (!mascot.isEquipped) throw new Error("Apenas o mascote equipado pode sair em expedição.");

  const active = await prisma.mascotExpedition.findFirst({
    where: { mascotId, status: "ACTIVE" }
  });
  if (active) throw new Error("Mascote já está em expedição.");

  const finishAt = new Date(Date.now() + EXPEDITION_DURATION_MS);
  return prisma.mascotExpedition.create({
    data: { mascotId, finishAt }
  });
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

  const reward = rollExpeditionReward(expedition.mascot);

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

  const reward = rollExpeditionReward(expedition.mascot);
  const gift = describeExpeditionReward(reward);

  await prisma.$transaction(async (tx) => {
    await tx.mascotExpedition.update({
      where: { id: expeditionId },
      data: { status: "CLAIMED", rewardJson: reward }
    });

    if (gift) {
      await tx.playerGift.create({
        data: {
          playerId,
          type: "CUSTOM",
          title: `Expedição: ${gift.title}`,
          description: gift.description,
          payload: {
            ...gift.payload,
            mascotId: expedition.mascotId,
            pokemonId: expedition.mascot.pokemonId,
          }
        }
      });
    }
  });

  await addExp(expedition.mascotId, EXP_REWARDS.EXPEDITION).catch(() => {});

  return { reward, mascotId: expedition.mascotId };
}

// ── Utilidades para UI ────────────────────────────────────────────────────────

export { getSpriteUrl, getPokemonName, expToNextLevel };
