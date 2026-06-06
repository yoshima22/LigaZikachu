/**
 * Serviço de mascotes — lógica de negócio do sistema.
 */

import { prisma } from "@/lib/prisma";
import {
  EGG_POOLS, LEGENDARY_POOL, EVOLUTION_MAP, PERSONALITIES, INCUBATION_DURATION_MS,
  EXPEDITION_DURATIONS, TRAINING_EXP_MULT, expForLevel, expToNextLevel, EXP_REWARDS,
  EGG_STAT_RANGES, EGG_SHINY_CHANCE,
  getSpriteUrl, getPokemonName, getPokemonElement, getTypeAdvantageMultiplier,
} from "@/lib/mascot-data";
import type { ExpeditionDuration, ExpeditionMode } from "@/lib/mascot-data";
import type { EggType, MascotMood, MascotPersonality } from "@prisma/client";

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

  // Chance lendaria por raridade. SPECIAL e RARE custam mais e devem parecer especiais.
  // SPECIAL: 6% | RARE: 3% | GEN eggs: 1% | COMMON: 1% | EVENT: 0.3%
  const legendaryChance =
    eggType === "SPECIAL" ? 0.06 :
    eggType === "RARE" ? 0.03 :
    eggType.startsWith("EGG_GEN") ? 0.01 :
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

export async function hatchEgg(playerId: string): Promise<{ mascotId: string; pokemonId: number; name: string; isNew: boolean; isShiny: boolean; isStatBuffed: boolean }> {
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
    // Stat range baseado no tipo do ovo (ovos mais raros = stats melhores)
    const eggTypeKey = incubator.egg.type as string;
    const [statMin, statMax] = EGG_STAT_RANGES[eggTypeKey] ?? [8, 14];
    const isStatBuffed = statMin > 8; // ovos acima de COMMON/EVENT

    // Chance de shiny (brilhante)
    const shinyChance = EGG_SHINY_CHANCE[eggTypeKey] ?? (1 / 500);
    const isShiny = Math.random() < shinyChance;

    // Cria o mascote com stats escalados por raridade do ovo
    const m = await tx.mascot.create({
      data: {
        playerId,
        pokemonId,
        personality,
        isShiny,
        statForce:    randomInt(statMin, statMax),
        statAgility:  randomInt(statMin, statMax),
        statCharisma: randomInt(statMin, statMax),
        statInstinct: randomInt(statMin, statMax),
        statVitality: randomInt(statMin, statMax),
      }
    });
    // Marca incubadora como chocada
    await tx.mascotIncubator.update({ where: { playerId }, data: { hatched: true } });
    // Remove ovo do inventário e incubadora
    await tx.mascotIncubator.delete({ where: { playerId } });
    await tx.mascotEgg.delete({ where: { id: incubator.eggId } });

    // Log de nascimento com marcadores especiais
    const hatchNotes: string[] = [];
    if (isShiny) hatchNotes.push("✨ É SHINY!");
    if (isStatBuffed) hatchNotes.push(`⬆️ Stats elevados (${statMin}–${statMax}) pelo ovo de alta raridade!`);
    if (hatchNotes.length > 0) {
      await tx.mascotEvent.create({
        data: {
          mascotId: m.id,
          emoji: isShiny ? "✨" : "⬆️",
          description: hatchNotes.join(" "),
        }
      }).catch(() => null);
    }

    return { m, isShiny, isStatBuffed };
  });

  const isShiny = (mascot as { isShiny?: boolean }).isShiny ?? false;
  const isStatBuffed = (mascot as { isStatBuffed?: boolean }).isStatBuffed ?? false;
  return {
    mascotId: (mascot as { m: { id: string } }).m.id,
    pokemonId,
    name: getPokemonName(pokemonId),
    isNew: true,
    isShiny,
    isStatBuffed,
  };
}

// ── Equipar mascote ───────────────────────────────────────────────────────────

export async function equipMascot(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.arenaState === "INJURED") throw new Error("Mascote ferido precisa de Atendimento SUS antes de ser equipado.");
  if (mascot.arenaState === "RESTING" && mascot.restingUntil && mascot.restingUntil > new Date()) throw new Error("Mascote está em repouso e não pode ser equipado ainda.");
  if (mascot.arenaState === "ARENA") throw new Error("Mascote registrado na Arena Z não pode ser equipado.");

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

type MascotStatKey = "statForce" | "statAgility" | "statCharisma" | "statInstinct" | "statVitality";

const LEVEL_STAT_GAIN_MULTIPLIER = 0.55;

function distributeStatPoints(total: number, weights: Record<MascotStatKey, number>): Record<MascotStatKey, number> {
  const keys = Object.keys(weights) as MascotStatKey[];
  const weightTotal = keys.reduce((sum, key) => sum + Math.max(1, weights[key]), 0);
  const exact = keys.map((key) => {
    const value = (Math.max(1, weights[key]) / weightTotal) * total;
    return { key, floor: Math.floor(value), remainder: value - Math.floor(value) };
  });
  const distributed = Object.fromEntries(keys.map((key) => [key, 0])) as Record<MascotStatKey, number>;

  exact.forEach(({ key, floor }) => {
    distributed[key] += floor;
  });

  let leftover = total - keys.reduce((sum, key) => sum + distributed[key], 0);
  exact
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ key }) => {
      if (leftover <= 0) return;
      distributed[key]++;
      leftover--;
    });

  return distributed;
}

function levelStatBonuses(
  mascot: {
    pokemonId: number;
    level: number;
    personality: MascotPersonality;
    statForce: number;
    statAgility: number;
    statCharisma: number;
    statInstinct: number;
    statVitality: number;
  },
  levelsGained: number,
): Record<MascotStatKey, number> {
  const rawPoints =
    levelsGained * (mascot.personality === "COMPETITIVE" ? 2 : 1) +
    levelsGained +
    levelsGained * (mascot.personality === "LOYAL" ? 2 : 1) +
    levelsGained +
    levelsGained * (mascot.personality === "DRAMATIC" ? 0 : 1);
  const pointsToAdd = rawPoints > 0 ? Math.max(1, Math.round(rawPoints * LEVEL_STAT_GAIN_MULTIPLIER)) : 0;

  const weights: Record<MascotStatKey, number> = {
    statForce: mascot.statForce * 3,
    statAgility: mascot.statAgility * 3,
    statCharisma: mascot.statCharisma * 3,
    statInstinct: mascot.statInstinct * 3,
    statVitality: mascot.statVitality * 3,
  };

  if (mascot.personality === "COMPETITIVE") weights.statForce *= 1.15;
  if (mascot.personality === "LOYAL") weights.statCharisma *= 1.15;
  if (mascot.personality === "DRAMATIC") weights.statVitality *= 0.85;

  (Object.keys(weights) as MascotStatKey[]).forEach((key, index) => {
    const wobble = 0.92 + (((mascot.pokemonId * (index + 3) + mascot.level * 11) % 17) / 100);
    weights[key] *= wobble;
  });

  return distributeStatPoints(pointsToAdd, weights);
}

export async function addExp(
  mascotId: string,
  amount: number,
  options: { ignoreBenchPenalty?: boolean } = {}
): Promise<LevelUpResult> {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot) throw new Error("Mascote não encontrado.");
  // EXP agora é dado a qualquer mascote (equipado ou no banco)
  // Mascotes no banco recebem 50% do EXP (interações presenciais são menos intensas)
  if (!options.ignoreBenchPenalty && !mascot.isEquipped) amount = Math.max(1, Math.floor(amount * 0.5));

  // Check for active EXP_BOOST buff
  const expBoostBuff = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: "EXP_BOOST", expiresAt: { gt: new Date() } }
  });
  if (expBoostBuff) amount = Math.floor(amount * 2);

  let { level, exp, pokemonId } = mascot;
  exp += amount;
  let levelsGained = 0;
  let evolved = false;
  let newPokemonId: number | undefined;

  // Verifica level ups em cadeia
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level++;
    levelsGained++;

    // Verifica evolução (respeitando evolutionLocked)
    const evo = EVOLUTION_MAP.get(pokemonId);
    if (evo && level >= evo.level && !mascot.evolutionLocked) {
      pokemonId = evo.to;
      evolved = true;
      newPokemonId = pokemonId;
    }
  }

  // Auto-rename: se o nickname era o nome padrão do Pokémon antes da evolução,
  // atualiza para o nome da nova forma automaticamente
  const leveled = levelsGained > 0;
  let nicknameUpdate: { nickname: null } | Record<string, never> = {};
  if (evolved && newPokemonId) {
    const oldDefaultName = getPokemonName(mascot.pokemonId);
    const wasDefault = !mascot.nickname || mascot.nickname === oldDefaultName;
    if (wasDefault) nicknameUpdate = { nickname: null }; // null = mostra nome novo do pokemonId
  }

  // Bônus de stat por level up
  const statUpdates = leveled
    ? Object.fromEntries(
        Object.entries(levelStatBonuses(mascot, levelsGained)).map(([key, value]) => [
          key,
          mascot[key as MascotStatKey] + value,
        ]),
      )
    : {};

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
  if (mascot.arenaState === "INJURED") throw new Error("Mascote ferido não pode receber interações.");
  if (mascot.arenaState === "RESTING" && mascot.restingUntil && mascot.restingUntil > new Date()) throw new Error("Mascote em repouso não pode receber interações ainda.");
  if (mascot.arenaState === "ARENA") throw new Error("Mascote registrado na Arena Z não pode receber interações.");

  const now = new Date();
  const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutos
  if (!skipCooldown && mascot.lastInteractedAt && now.getTime() - mascot.lastInteractedAt.getTime() < COOLDOWN_MS) {
    return { success: false, message: "Espere um pouco antes de interagir novamente.", happinessChange: 0, expGained: 0 };
  }
  // Verifica se um rival travou as interações
  if (mascot.socialCooldownUntil && mascot.socialCooldownUntil > now && !skipCooldown) {
    const remaining = Math.ceil((mascot.socialCooldownUntil.getTime() - now.getTime()) / 60_000);
    return { success: false, message: `Um rival atordoou este mascote! Interações travadas por mais ${remaining} min.`, happinessChange: 0, expGained: 0, refused: true };
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

  // Cesta de Piquenique Chocante: +50% EXP e +5 felicidade bônus nas interações
  const picnicBuff = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: "PICNIC_BASKET", expiresAt: { gt: new Date() } }
  }).catch(() => null);
  const picnicExpBonus = picnicBuff ? 0.50 : 0;
  const picnicHappyBonus = picnicBuff ? 5 : 0;

  if (picnicHappyBonus > 0 && !refused) {
    const updatedHappiness = Math.min(100, newHappiness + picnicHappyBonus);
    await prisma.mascot.update({ where: { id: mascotId }, data: { happiness: updatedHappiness } }).catch(() => {});
  }

  if (expGained > 0) {
    // Bônus social: aliados e rivais aumentam EXP por interação
    const relations = await prisma.mascotRelation.findMany({
      where: { mascotAId: mascotId },
      select: { type: true },
    }).catch(() => [] as { type: string }[]);
    const hasFriends = relations.some(r => r.type === "FRIEND");
    const hasRivals  = relations.some(r => r.type === "RIVAL");
    const socialMult = 1.0 + (hasFriends ? 0.25 : 0) + (hasRivals ? 0.15 : 0) + picnicExpBonus;
    const finalExp = Math.round(expGained * socialMult);
    await addExp(mascotId, finalExp).catch(() => {});
  }

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
  | { type: "TRAINING";  exp: number; durationLabel: string }  // retorna só EXP, nunca itens
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
  const foodQtyMin =
    durationKey === "6h" ? 3 :
    durationKey === "3h" ? 2 :
    1;
  const foodQtyMax = foodQtyMin + 1 + Math.floor(rewardBonus / 10);
  const sweetQty =
    durationKey === "6h" ? randomInt(2, 3) :
    durationKey === "3h" ? randomInt(1, 2) :
    1;

  // Valor de moedas escala com duração e nível
  const coinMin = Math.max(50, 50 + rewardBonus * 6 + mascot.level * 2);
  const coinMax = coinMin + 100 + rewardBonus * 12 + mascot.level * 3;

  const cumEgg   = eggWeight;
  const cumSweet = cumEgg + sweetWeight;
  const cumFood  = cumSweet + foodWeight;

  if (roll < cumEgg)   return { type: "EGG",   eggType };
  if (roll < cumSweet) return { type: "FOOD",  foodType: "SWEET", quantity: sweetQty };
  if (roll < cumFood)  return { type: "FOOD",  foodType: "FOOD",  quantity: randomInt(foodQtyMin, foodQtyMax) };
  return { type: "COINS", amount: randomInt(coinMin, coinMax) };
}

async function rollItemExpeditionReward(
  mascot: { id: string; level: number; statInstinct: number; statCharisma: number },
  durationKey: ExpeditionDuration = "1h",
  allyCount = 0
): Promise<ExpeditionReward> {
  const luckBuff = await prisma.mascotBuff.findFirst({
    where: { mascotId: mascot.id, type: "LUCK_BOOST", expiresAt: { gt: new Date() } }
  });
  const dur = EXPEDITION_DURATIONS[durationKey];
  const rewardBonus = dur.rewardBonus;
  const luck = (mascot.statInstinct + Math.floor(mascot.level / 5)) * (luckBuff ? 2 : 1);
  const allyBonus = Math.min(20, allyCount * 4);

  const eggWeight = 6 + Math.min(26, luck * 0.7) + rewardBonus * 0.8 + allyBonus;
  const sweetWeight = 34 + rewardBonus * 0.8 + (luckBuff ? 12 : 0);
  const foodWeight = 60 + rewardBonus * 0.9 + Math.min(20, mascot.level);
  const roll = Math.random() * (eggWeight + sweetWeight + foodWeight);

  let eggType = "COMMON";
  if (durationKey === "6h") eggType = luck > 9 ? "SPECIAL" : "RARE";
  else if (durationKey === "3h") eggType = luck > 10 ? "RARE" : "COMMON";
  else if (luck > 22) eggType = "RARE";

  const quantityBase =
    durationKey === "6h" ? 4 :
    durationKey === "3h" ? 3 :
    durationKey === "1h" ? 2 :
    1;
  const bonusQuantity = Math.floor((rewardBonus + allyBonus) / 18);
  const quantity = randomInt(quantityBase, quantityBase + 1 + bonusQuantity);

  if (roll < eggWeight) return { type: "EGG", eggType };
  if (roll < eggWeight + sweetWeight) return { type: "FOOD", foodType: "SWEET", quantity: Math.max(1, Math.floor(quantity / 2)) };
  return { type: "FOOD", foodType: "FOOD", quantity };
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

export async function startExpedition(
  playerId: string,
  mascotId: string,
  durationKey: ExpeditionDuration = "1h",
  mode: ExpeditionMode = "STANDARD"
) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote nao encontrado.");
  if (mascot.arenaState === "ARENA") throw new Error("Mascote registrado na Arena Z nao pode sair em expedicao.");
  if (mascot.arenaState === "INJURED") throw new Error("Mascote ferido nao pode sair em expedicao.");
  if (mascot.arenaState === "RESTING" && mascot.restingUntil && mascot.restingUntil > new Date()) throw new Error("Mascote em repouso nao pode sair em expedicao.");

  const active = await prisma.mascotExpedition.findFirst({
    where: { mascotId, status: "ACTIVE" }
  });
  if (active) throw new Error("Mascote ja esta em expedicao.");

  const activePlayerExpeditions = await prisma.mascotExpedition.findMany({
    where: { status: "ACTIVE", mascot: { playerId } },
    select: { rewardJson: true },
  });
  const sameModeActive = activePlayerExpeditions.some(expedition => {
    const stored = (expedition.rewardJson as Record<string, unknown> | null) ?? {};
    return ((stored.mode as ExpeditionMode | undefined) ?? "STANDARD") === mode;
  });
  if (sameModeActive) {
    const label = mode === "TRAINING" ? "treinamento" : mode === "ITEMS" ? "itens" : "padrao";
    throw new Error(`Voce ja tem uma expedicao de ${label} em andamento.`);
  }

  const dur = EXPEDITION_DURATIONS[durationKey];
  const finishAt = new Date(Date.now() + dur.ms);
  return prisma.mascotExpedition.create({
    data: { mascotId, finishAt, rewardJson: { durationKey, mode } }
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
      await tx.mascotEgg.create({ data: { playerId, type: reward.eggType as EggType, origin: "Expedição" } });
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

  // Recupera duração e modo armazenados no rewardJson
  const stored = (expedition.rewardJson as Record<string, unknown> | null) ?? {};
  const durationKey: ExpeditionDuration = (stored.durationKey as ExpeditionDuration) ?? "1h";
  const mode: ExpeditionMode = (stored.mode as ExpeditionMode) ?? "STANDARD";
  const dur = EXPEDITION_DURATIONS[durationKey];

  // Busca aliados ANTES de rolar recompensa (influenciam as chances)
  const friends = await prisma.mascotRelation.findMany({
    where: { mascotAId: expedition.mascotId, type: "FRIEND" },
    include: { mascotB: { select: { id: true, statCharisma: true, nickname: true, pokemonId: true, playerId: true } } }
  });
  const allyCount = friends.length;
  const expeditorName = expedition.mascot.nickname ?? getPokemonName(expedition.mascot.pokemonId);

  // Recompensa: TRAINING retorna só EXP (calculado depois), ITEMS foca itens, STANDARD tudo
  const baseReward = mode === "TRAINING"
    ? null  // preenchido após calcular EXP
    : mode === "ITEMS"
      ? await rollItemExpeditionReward(expedition.mascot, durationKey, allyCount)
      : await rollExpeditionReward(expedition.mascot, durationKey, allyCount);

  // EXP: base × duração × nível × bônus social
  const expBase = EXP_REWARDS.EXPEDITION;
  const levelMult = 1 + Math.floor(expedition.mascot.level / 20) * 0.25;
  const allyExpBonus = 1 + allyCount * 0.1;
  const rivalCount = await prisma.mascotRelation.count({
    where: { mascotAId: expedition.mascotId, type: "RIVAL" }
  });
  const rivalBonus = rivalCount > 0 ? 1.15 : 1.0;
  const expMult = mode === "TRAINING"
    ? TRAINING_EXP_MULT[durationKey]
    : mode === "ITEMS" ? 0 : dur.expMultiplier;

  // Ovo da Sorte: +20% EXP se mascote tem buff LUCKY_EGG ativo
  const luckyEggBuff = mode === "TRAINING" ? await prisma.mascotBuff.findFirst({
    where: { mascotId: expedition.mascotId, type: "LUCKY_EGG", expiresAt: { gt: new Date() } }
  }) : null;
  const luckyEggMult = luckyEggBuff ? 1.20 : 1.0;

  const expeditionExp = Math.round(expBase * expMult * levelMult * allyExpBonus * rivalBonus * luckyEggMult);

  // Reward final — TRAINING usa tipo especial com EXP para exibir no modal
  const reward: ExpeditionReward = mode === "TRAINING"
    ? { type: "TRAINING", exp: expeditionExp, durationLabel: dur.label }
    : (baseReward ?? { type: "NOTHING" as const });
  const gift = mode === "TRAINING" ? null : describeExpeditionReward(reward);

  await prisma.$transaction(async (tx) => {
    await tx.mascotExpedition.update({
      where: { id: expeditionId },
      data: { status: "CLAIMED", rewardJson: reward }
    });

    if (mode === "TRAINING") {
      const bonuses: string[] = [];
      if (allyCount > 0) bonuses.push(`${allyCount} aliado${allyCount > 1 ? "s" : ""} apoiou`);
      if (rivalBonus > 1) bonuses.push("motivação de rivalidade");
      const note = bonuses.length > 0 ? ` (${bonuses.join(", ")})` : "";
      await tx.mascotEvent.create({
        data: {
          mascotId: expedition.mascotId,
          emoji: "🏋️",
          description: `Treinamento de ${dur.label} concluído! +${expeditionExp} EXP${note}`,
        }
      });
    } else if (gift) {
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
      if (mode !== "ITEMS") {
        await addExp(rel.mascotB.id, Math.round(EXP_REWARDS.EXPEDITION * 0.3)).catch(() => {});
      }

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

  if (expeditionExp > 0) {
    await addExp(expedition.mascotId, expeditionExp).catch(() => {});
  }

  // Ovo da Sorte: consome o buff após uso (1x por dia)
  if (luckyEggBuff) {
    await prisma.mascotBuff.delete({ where: { id: luckyEggBuff.id } }).catch(() => {});
  }

  // Compartilhador de XP: distribui metade do EXP de TRAINING para Pokémon com XP_SHARE
  if (mode === "TRAINING" && expeditionExp > 0) {
    const sharedExp = Math.floor(expeditionExp / 2);
    if (sharedExp > 0) {
      const xpShareBuffs = await prisma.mascotBuff.findMany({
        where: {
          type: "XP_SHARE",
          mascot: { playerId },
          mascotId: { not: expedition.mascotId }, // não conta o próprio mascote
          expiresAt: { gt: new Date("2090-01-01") },
        },
        select: { mascotId: true },
      }).catch(() => []);
      for (const xb of xpShareBuffs) {
        await addExp(xb.mascotId, sharedExp).catch(() => {});
        await prisma.mascotEvent.create({
          data: { mascotId: xb.mascotId, emoji: "📡", description: `Compartilhou ${sharedExp} EXP via Compartilhador de XP!` }
        }).catch(() => {});
      }
    }
  }

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

// ── Pools de texto para eventos sociais ──────────────────────────────────────

function pickText(pool: string[], a: string, b: string): string {
  const t = pool[Math.floor(Math.random() * pool.length)];
  return t.replace(/\{a\}/g, a).replace(/\{b\}/g, b);
}

const SOCIAL_TEXTS = {
  // ── RIVAIS ────────────────────────────────────────────────────────────────
  rival_trap_small: [
    "{a} deixou uma armadilha boba no caminho de {b}. Não machucou, mas atrasou.",
    "{a} removeu algumas marcações da rota de {b}.",
    "{a} trocou placas de lugar e fez {b} perder tempo.",
    "{a} espalhou pistas falsas pelo trajeto de {b}.",
    "{a} não sabotou tudo, mas atrapalhou o suficiente para irritar {b}.",
    "{a} fez uma pequena bagunça na rota de {b}. Simples, mas eficaz.",
  ],
  rival_loot_eye: [
    "{a} descobriu que {b} está acumulando loot na Arena e começou a rondar.",
    "{a} ouviu rumores sobre o cofre de {b}. A rivalidade ganhou um novo motivo.",
    "{a} percebeu que {b} está guardando recompensas demais. Péssimo sinal.",
    "{a} está de olho no que {b} trouxe da Arena.",
    "{a} não atacou ainda, mas deixou claro que quer o loot de {b}.",
    "{a} fez questão de deixar {b} saber que sabe sobre o cofre.",
  ],
  rival_wound_pride: [
    "{a} zombou da derrota de {b}. A recuperação vai ser ainda mais amarga.",
    "{a} apareceu só para lembrar {b} da queda na Arena. Golpe baixo.",
    "{a} comemorou a derrota de {b} alto demais. {b} ficou furioso.",
    "{a} transformou a derrota de {b} em piada pública.",
    "{a} não perdeu a chance de provocar {b} enquanto ele se recuperava.",
    "{a} mandou uma mensagem de 'condolências' para {b}. Falsidade pura.",
  ],
  rival_territory: [
    "{a} e {b} disputaram território durante horas. Ninguém saiu convencido.",
    "{a} marcou presença no espaço de {b}. A tensão subiu.",
    "{a} desafiou {b} sem atacar. Só para deixar o aviso.",
    "{a} e {b} ficaram frente a frente até alguém ceder caminho. Ninguém cedeu.",
    "{a} deixou claro que não aceita dividir espaço com {b}.",
    "{a} ocupou o lugar favorito de {b} de propósito. A mensagem foi recebida.",
  ],
  rival_hostile_silence: [
    "{a} e {b} ficaram no mesmo ambiente sem trocar uma palavra. Foi pior do que brigar.",
    "{a} passou por {b} como se ele nem existisse. A provocação foi entendida.",
    "{a} ignorou {b} de propósito. Funcionou.",
    "{a} e {b} dividiram o mesmo espaço em completo silêncio hostil.",
    "{a} não fez nada contra {b}. E isso irritou ainda mais.",
    "{a} e {b} se olharam brevemente. Mais do que suficiente.",
    "{a} passou por {b} sem fazer nada. Mas {b} sentiu.",
  ],
  rival_irritate: [
    "{a} cruzou o caminho de {b} e os dois se encararam por um longo tempo. {b} está furioso!",
    "{a} mandou um recado de desafio para {b}. {b} não ficou nem um pouco feliz.",
    "{a} apareceu no território de {b} só pra cutucar. O humor de {b} foi para o buraco.",
    "Tensão máxima! {a} e {b} se encontraram hoje. {b} está com raiva.",
    "{a} provocou {b} com um olhar de superioridade. {b} está de mau humor.",
    "{a} passou perto de {b} só para mostrar que estava por perto. {b} ficou irritado.",
    "{a} enviou sinais de desafio que {b} entendeu perfeitamente. A raiva subiu.",
    "{a} ignorou {b} completamente em público, o que foi, de alguma forma, ainda mais provocativo.",
  ],
  rival_stun: [
    "{a} fez uma investida surpresa em {b}! {b} ficou sem ação por um tempo.",
    "{a} deu um susto em {b} — ele ficou paralisado por alguns instantes.",
    "{a} rugiu tão alto perto de {b} que ele perdeu o foco. {b} está travado.",
    "{a} distraiu {b} com uma provocação elaborada e inesperada. Vai levar um tempo para reagir.",
    "Ataque psicológico! {a} sobrecarregou {b} com provocações. {b} não consegue se concentrar agora.",
    "{a} interceptou {b} num momento crucial e o deixou sem reação.",
    "{a} e {b} tiveram um confronto de olhares tão intenso que {b} ficou em choque.",
    "{a} apareceu de repente na frente de {b} e gritou tão alto que {b} não consegue fazer nada agora.",
  ],
  rival_expedition_delay: [
    "{a} conseguiu chegar até a rota de expedição de {b} e complicou o caminho!",
    "{a} colocou obstáculos no caminho de {b}. A expedição vai demorar mais.",
    "{a} sabotou um atalho que {b} usaria. O retorno vai atrasar.",
    "Emboscada! {a} surpreendeu {b} na expedição e atrasou o retorno.",
    "{a} deu um desvio forçado na rota de {b}. Mais tempo de caminho pela frente.",
    "{a} deixou pistas falsas no trajeto de {b}. A expedição foi comprometida.",
    "{a} apareceu na metade da expedição de {b} e forçou uma rota alternativa.",
  ],
  rival_steal_exp: [
    "{a} interceptou {b} durante um treino e roubou parte do aprendizado!",
    "{a} interrompeu {b} no momento decisivo. {b} perdeu experiência acumulada.",
    "Golpe baixo! {a} sabotou o treino de {b} e saiu com um pouco de EXP.",
    "{a} capturou a atenção de {b} no pior momento e atrapalhou o progresso dele.",
    "{a} perturbou a concentração de {b} durante uma sessão de treino importante.",
    "{a} apareceu no treino de {b} e criou tanto caos que a sessão foi desperdiçada.",
  ],
  rival_arch: [
    "RIVAL DIRETO! {a} declarou {b} como seu maior adversário. A tensão entre eles é absoluta.",
    "{a} não consegue pensar em outra coisa além de superar {b}. Rivalidade no nível máximo!",
    "A batalha entre {a} e {b} já é lenda no grupo. Todo mundo comenta.",
    "{a} e {b} atingiram o nível máximo de rivalidade. Cada encontro é um confronto épico.",
    "Rivais eternos! {a} e {b} se olham e o ar ao redor esquenta. É uma rivalidade que vai durar para sempre.",
    "{a} e {b} já não precisam de motivo para competir.",
    "{a} considera qualquer vitória de {b} uma ofensa pessoal.",
    "{a} treinou o dia inteiro só pensando em superar {b}.",
    "{a} ouviu o nome de {b} e mudou de humor na hora.",
    "{a} e {b} estão criando uma rivalidade que todo mundo já acompanha.",
  ],
  rival_general: [
    "{a} fez questão de passar na frente de {b} sem olhar para trás.",
    "{a} deixou marcas no território de {b}.",
    "{a} comemorou alto demais perto de {b}.",
    "{a} ficou treinando justamente onde {b} costuma descansar.",
    "{a} mandou um olhar que dizia tudo.",
    "{a} e {b} se olharam e souberam que a próxima batalha está chegando.",
  ],
  ally_cheer: [
    "{a} apareceu com uma surpresa para animar {b}! {b} ficou muito feliz.",
    "{a} visitou {b} e trouxe energia positiva. {b} está de ótimo humor!",
    "{a} cantarolou perto de {b} até fazê-lo sorrir. A felicidade de {b} aumentou!",
    "{a} fez uma apresentação especial para {b}. O humor de {b} melhorou muito!",
    "Amizade de verdade! {a} apareceu exatamente quando {b} mais precisava.",
    "{a} percebeu que {b} estava triste e foi lá ajudar. {b} está sorrindo de novo!",
    "{a} enviou mensagens de encorajamento para {b} até ele sorrir.",
    "{a} trouxe presentes simbólicos para {b}. Pequenos gestos que fazem diferença!",
  ],
  ally_rest: [
    "{a} foi visitar {b} durante o repouso e ajudou na recuperação!",
    "{a} trouxe ingredientes especiais para acelerar o descanso de {b}.",
    "Super amizade! {a} cuidou de {b} e ele vai se recuperar mais rápido.",
    "{a} ficou de guarda enquanto {b} descansava, protegendo o sono.",
    "{a} compartilhou técnicas de recuperação com {b}. O repouso vai durar menos!",
    "Aliados de verdade! {a} ajudou {b} a se recuperar antes do previsto.",
    "{a} preparou um ambiente especial de descanso para {b}. Recuperação acelerada!",
    "{a} massageou as tensões de {b} durante o repouso. Muito mais descansado!",
  ],
  ally_exp: [
    "{a} e {b} treinaram juntos! Ambos aprenderam com a experiência.",
    "{a} compartilhou segredos de batalha com {b}. {b} cresceu com isso!",
    "{a} orientou {b} durante uma sessão especial de treinamento.",
    "Treinamento em dupla! {a} e {b} evoluíram juntos hoje.",
    "{a} passou o dia ensinando {b}. O aprendizado foi mútuo!",
    "Parceria de treinamento! {a} e {b} superaram um desafio juntos.",
    "{a} e {b} descobriram um novo método de treino juntos. EXP bônus para ambos!",
  ],
  ally_encourage: [
    "{a} percebeu que {b} estava para baixo e foi lá dar um empurrãozinho!",
    "{a} acreditou em {b} quando ele mesmo duvidava. {b} ficou mais confiante!",
    "Palavras de incentivo de {a} fizeram {b} recuperar a motivação.",
    "{a} lembrou {b} de todas as suas conquistas. {b} está determinado de novo!",
    "{a} fez um discurso épico de motivação para {b}. Nada vai parar {b} agora!",
    "{a} compartilhou sua própria história de superação com {b}. {b} se inspirou.",
  ],
  ally_gift: [
    "{a} apareceu com um presentinho para {b}. Pequenos gestos fortalecem grandes amizades.",
    "{a} encontrou algo no caminho e decidiu entregar para {b}.",
    "{a} trouxe um petisco para {b}. A amizade também se alimenta.",
    "{a} dividiu parte do que encontrou com {b}. Companheirismo de verdade.",
    "{a} deixou uma surpresa no cantinho de {b}. Quando {b} viu, ficou animado.",
    "{a} não trouxe muito — mas o gesto valeu mais que o presente.",
    "{a} achou algo especial e pensou logo em {b}.",
    "{a} entregou um envelope para {b}. Dentro havia uma surpresa.",
  ],
  ally_snack: [
    "{a} dividiu um lanche com {b}. O clima melhorou na hora.",
    "{a} percebeu que {b} estava mal e chamou para comer alguma coisa.",
    "{a} trouxe um petisco simples, mas {b} precisava exatamente disso.",
    "{a} sentou perto de {b} e os dois dividiram um momento tranquilo.",
    "{a} fez companhia para {b} durante uma pausa. O humor melhorou.",
    "{a} apareceu na hora certa com a coisa certa.",
  ],
  ally_expedition_guard: [
    "{a} acompanhou {b} por parte da expedição e ajudou a evitar problemas.",
    "{a} ficou de olho na rota de {b}. Nenhum rival vai atrapalhar tão fácil.",
    "{a} marcou o caminho para {b}, evitando que ele caísse em pistas falsas.",
    "{a} protegeu a retaguarda de {b} durante a expedição.",
    "{a} percebeu movimentação estranha na rota e avisou {b} a tempo.",
    "{a} garantiu que {b} chegou no caminho certo.",
  ],
  ally_sus_visit: [
    "{a} visitou {b} no Atendimento SUS e ajudou a levantar o astral.",
    "{a} ficou esperando {b} sair do atendimento. Ninguém se recupera sozinho.",
    "{a} levou palavras de apoio para {b} durante a recuperação.",
    "{a} acompanhou {b} no pós-atendimento. O repouso vai ser um pouco mais leve.",
    "{a} ficou de guarda enquanto {b} se recuperava.",
    "{a} apareceu antes mesmo que {b} pedisse. Super Amigos sabem quando é necessário.",
  ],
  ally_arena_inspiration: [
    "{a} e {b} revisaram juntos o último combate. Ambos aprenderam algo novo.",
    "{a} mostrou para {b} onde poderia melhorar. O treino rendeu bons frutos.",
    "{a} e {b} transformaram a última batalha em aprendizado.",
    "{a} e {b} discutiram estratégias até chegarem em uma ideia melhor.",
    "{a} ajudou {b} a entender o que deu errado na Arena.",
    "{a} e {b} combinaram o que cada um faria diferente. Progresso conjunto.",
  ],
  ally_safe_route: [
    "{a} indicou uma rota melhor para {b}. A expedição pode render um pouco mais.",
    "{a} contou sobre um atalho secreto para {b}.",
    "{a} marcou um ponto de coleta que {b} ainda não conhecia.",
    "{a} deixou sinais pelo caminho para ajudar {b} a encontrar mais recursos.",
    "{a} compartilhou uma dica valiosa de exploração com {b}.",
    "{a} passou o mapa da região para {b} antes de partir.",
  ],
  ally_general: [
    "{a} e {b} passaram um tempo treinando poses de vitória.",
    "{a} ficou ouvindo {b} reclamar até ele se acalmar.",
    "{a} dividiu histórias antigas com {b}.",
    "{a} e {b} criaram uma saudação própria.",
    "{a} apareceu só para garantir que {b} estava bem.",
  ],
  best_friend_general: [
    "{a} e {b} já sabem o que o outro vai fazer antes mesmo de agir.",
    "{a} trouxe exatamente o que {b} precisava sem que ele pedisse.",
    "{a} e {b} têm uma rotina própria de treino e descanso.",
    "{a} percebeu que {b} estava mal antes de qualquer outro mascote.",
    "{a} e {b} viraram referência de parceria dentro da Liga.",
  ],
  ally_joint_buff: [
    "{a} e {b} desenvolveram um ataque coordenado! A próxima batalha deles será mais poderosa.",
    "Sincronia perfeita! {a} e {b} praticaram manobras em dupla. Força combinada!",
    "{a} e {b} descobriram que juntos são mais fortes. Efeito de equipe ativado!",
    "Treino especial! {a} e {b} ensaiaram um ataque conjunto devastador.",
  ],
  best_friend_bond: [
    "Super amizade! {a} e {b} são inseparáveis agora. A ligação deles é especial.",
    "{a} e {b} desenvolveram uma comunicação própria. Entendem-se sem palavras.",
    "A amizade entre {a} e {b} transcende o comum. Eles são melhores amigos!",
    "{a} salvaria {b} de qualquer situação — e vice-versa. Super Amigos!",
    "O vínculo entre {a} e {b} cresceu tanto que ninguém consegue separá-los.",
    "{a} e {b} têm uma conexão que foi além da amizade comum. Supra-amizade ativada!",
  ],
};

// Tier baseado em interactionCount
function getSocialTier(type: "FRIEND" | "RIVAL", count: number): string {
  if (type === "FRIEND") return count >= 5 ? "Super Amigo" : "Amigo";
  return count >= 3 ? "Rival Direto" : "Rival";
}

export async function triggerSocialEvents(): Promise<SocialEventSummary> {
  const allMascots = await prisma.mascot.findMany({
    where: { player: { user: { role: "PLAYER" } } },
    select: {
      id: true, pokemonId: true, nickname: true, playerId: true,
      statForce: true, statAgility: true, statVitality: true,
      statCharisma: true, statInstinct: true,
      happiness: true, mood: true, level: true,
      restingUntil: true, arenaState: true,
    }
  });

  if (allMascots.length < 2) return { battles: 0, friendships: 0, events: [] };

  const summary: SocialEventSummary = { battles: 0, friendships: 0, events: [] };
  const shuffled = [...allMascots].sort(() => Math.random() - 0.5);
  const maxPairs = Math.min(5, Math.floor(allMascots.length / 2));
  const usedIds = new Set<string>();

  for (let i = 0; i < shuffled.length && summary.battles + summary.friendships < maxPairs; i++) {
    const a = shuffled[i];
    if (usedIds.has(a.id)) continue;
    const partner = shuffled.find(b => b.id !== a.id && b.playerId !== a.playerId && !usedIds.has(b.id));
    if (!partner) continue;
    usedIds.add(a.id);
    usedIds.add(partner.id);

    const aName = a.nickname ?? getPokemonName(a.pokemonId);
    const bName = partner.nickname ?? getPokemonName(partner.pokemonId);
    const isBattle = Math.random() < 0.6;

    if (isBattle) {
      try {
        const result = await battleMascots(a.id, partner.id);
        summary.battles++;
        summary.events.push(`⚔️ ${result.summary}`);
      } catch { /* ignora */ }
    } else {
      try {
        await prisma.$transaction([
          prisma.mascotRelation.upsert({
            where: { mascotAId_mascotBId: { mascotAId: a.id, mascotBId: partner.id } },
            update: { type: "FRIEND", interactionCount: { increment: 1 } },
            create: { mascotAId: a.id, mascotBId: partner.id, type: "FRIEND" },
          }),
          prisma.mascotRelation.upsert({
            where: { mascotAId_mascotBId: { mascotAId: partner.id, mascotBId: a.id } },
            update: { type: "FRIEND", interactionCount: { increment: 1 } },
            create: { mascotAId: partner.id, mascotBId: a.id, type: "FRIEND" },
          }),
        ]);
        const msg = pickText(SOCIAL_TEXTS.ally_cheer, aName, bName);
        await Promise.all([
          logEvent(a.id, "💚", msg),
          logEvent(partner.id, "💚", pickText(SOCIAL_TEXTS.ally_cheer, bName, aName)),
        ]);
        summary.friendships++;
        summary.events.push(`💚 ${aName} e ${bName} interagiram!`);
      } catch { /* ignora */ }
    }
  }

  // ── Eventos de RIVAIS com efeitos reais ──────────────────────────────────
  const rivalPairs = await prisma.mascotRelation.findMany({
    where: { type: "RIVAL" },
    include: {
      mascotA: { select: { id: true, pokemonId: true, nickname: true, playerId: true, arenaState: true, level: true } },
      mascotB: {
        select: { id: true, pokemonId: true, nickname: true, playerId: true,
                  arenaState: true, mood: true, happiness: true, restingUntil: true,
                  expeditions: { where: { status: "ACTIVE" }, take: 1 } }
      },
    },
    orderBy: { interactionCount: "desc" },
    take: 5,
  });

  for (const rel of rivalPairs) {
    if (!rel.mascotA || !rel.mascotB) continue;
    const aName = rel.mascotA.nickname ?? getPokemonName(rel.mascotA.pokemonId);
    const bName = rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId);
    const isArchRival = rel.interactionCount >= 3;

    // Sorteia o tipo de evento rival (pesos diferentes)
    const eventRoll = Math.random();
    let rivalEvent: string;

    if (isArchRival && eventRoll < 0.15) {
      // Rival Direto: trava interações do alvo por 15-30 min
      const stunMin = randomInt(15, 30);
      const stunUntil = new Date(Date.now() + stunMin * 60_000);
      await prisma.mascot.update({
        where: { id: rel.mascotB.id },
        data: { socialCooldownUntil: stunUntil, mood: "ANGRY" as MascotMood }
      }).catch(() => {});
      rivalEvent = pickText(SOCIAL_TEXTS.rival_stun, aName, bName);
      summary.events.push(`😠 ${aName} travou ${bName} por ${stunMin}min!`);

    } else if (eventRoll < 0.25 && rel.mascotB.expeditions.length > 0) {
      // Atrasa expedição ativa em 15-25 min
      const expedition = rel.mascotB.expeditions[0];
      const delayMin = randomInt(15, 25);
      await prisma.mascotExpedition.update({
        where: { id: expedition.id },
        data: { finishAt: new Date(new Date(expedition.finishAt).getTime() + delayMin * 60_000) }
      }).catch(() => {});
      rivalEvent = pickText(SOCIAL_TEXTS.rival_expedition_delay, aName, bName);
      summary.events.push(`🌪️ ${aName} atrasou a expedição de ${bName} em ${delayMin}min!`);

    } else if (eventRoll < 0.40) {
      // Irrita (muda humor para ANGRY)
      await prisma.mascot.update({
        where: { id: rel.mascotB.id },
        data: { mood: "ANGRY" as MascotMood, happiness: { decrement: 5 } }
      }).catch(() => {});
      rivalEvent = pickText(SOCIAL_TEXTS.rival_irritate, aName, bName);
      summary.events.push(`😠 ${aName} irritou ${bName}!`);

    } else if (isArchRival && eventRoll < 0.55) {
      // Rival Direto: roubo de EXP pequeno
      const stolenExp = randomInt(3, 10);
      await addExp(rel.mascotA.id, stolenExp).catch(() => {});
      rivalEvent = pickText(SOCIAL_TEXTS.rival_steal_exp, aName, bName);
      summary.events.push(`💀 ${aName} roubou ${stolenExp} EXP de ${bName}!`);

    } else if (eventRoll < 0.50 && rel.mascotB.expeditions.length > 0) {
      // 🪤 Armadilha leve na rota (rival comum, atraso menor)
      const expedition = rel.mascotB.expeditions[0];
      const delayMin = randomInt(5, 15);
      await prisma.mascotExpedition.update({
        where: { id: expedition.id },
        data: { finishAt: new Date(new Date(expedition.finishAt).getTime() + delayMin * 60_000) }
      }).catch(() => {});
      rivalEvent = pickText(SOCIAL_TEXTS.rival_trap_small, aName, bName);
      summary.events.push(`🪤 ${aName} armou uma armadilha leve para ${bName} (+${delayMin}min)`);

    } else if (eventRoll < 0.65 && rel.mascotB.arenaState === "ARENA") {
      // 🧲 Isca de Loot — alvo na Arena, rival espreitando o cofre
      await prisma.mascot.update({
        where: { id: rel.mascotB.id },
        data: { happiness: { decrement: 5 } }
      }).catch(() => {});
      rivalEvent = pickText(SOCIAL_TEXTS.rival_loot_eye, aName, bName);
      summary.events.push(`🧲 ${aName} está de olho no loot de ${bName}`);

    } else if (isArchRival && eventRoll < 0.75 &&
               (rel.mascotB.arenaState === "INJURED" || rel.mascotB.arenaState === "RESTING")) {
      // 💢 Ferida no Orgulho — Rival Direto agrava recuperação
      const extraMin = randomInt(10, 20);
      if (rel.mascotB.restingUntil) {
        const newRest = new Date(new Date(rel.mascotB.restingUntil).getTime() + extraMin * 60_000);
        await prisma.mascot.update({
          where: { id: rel.mascotB.id },
          data: { mood: "ANGRY" as MascotMood, restingUntil: newRest }
        }).catch(() => {});
      } else {
        await prisma.mascot.update({ where: { id: rel.mascotB.id }, data: { mood: "ANGRY" as MascotMood } }).catch(() => {});
      }
      rivalEvent = pickText(SOCIAL_TEXTS.rival_wound_pride, aName, bName);
      summary.events.push(`💢 ${aName} agravou a recuperação de ${bName} (+${extraMin}min)`);

    } else if (isArchRival && eventRoll < 0.88) {
      // 🔥 Duelo de Território — Rival Direto, só log + contador
      rivalEvent = pickText(SOCIAL_TEXTS.rival_territory, aName, bName);
      summary.events.push(`🔥 ${aName} e ${bName} disputaram território`);

    } else if (isArchRival) {
      rivalEvent = pickText(SOCIAL_TEXTS.rival_arch, aName, bName);
    } else if (eventRoll < 0.92) {
      // 🧊 Silêncio Hostil — sem efeito
      rivalEvent = pickText(SOCIAL_TEXTS.rival_hostile_silence, aName, bName);
    } else {
      rivalEvent = pickText(SOCIAL_TEXTS.rival_general, aName, bName);
    }

    await Promise.all([
      logEvent(rel.mascotA.id, "😤", rivalEvent).catch(() => {}),
      logEvent(rel.mascotB.id, "😤", rivalEvent).catch(() => {}),
    ]);
    await prisma.mascotRelation.update({
      where: { id: rel.id },
      data: { interactionCount: { increment: 1 } }
    }).catch(() => {});
  }

  // ── Eventos de ALIADOS com efeitos reais ─────────────────────────────────
  const friendPairs = await prisma.mascotRelation.findMany({
    where: { type: "FRIEND" },
    include: {
      mascotA: { select: { id: true, pokemonId: true, nickname: true, playerId: true, happiness: true, isEquipped: true, arenaState: true } },
      mascotB: {
        select: { id: true, pokemonId: true, nickname: true, playerId: true,
                  happiness: true, isEquipped: true, arenaState: true,
                  restingUntil: true, susRestBonusMinutes: true,
                  expeditions: { where: { status: "ACTIVE" }, take: 1 } }
      },
    },
    orderBy: { interactionCount: "desc" },
    take: 5,
  });

  for (const rel of friendPairs) {
    if (!rel.mascotA || !rel.mascotB) continue;
    const aName = rel.mascotA.nickname ?? getPokemonName(rel.mascotA.pokemonId);
    const bName = rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId);
    const isBestFriend = rel.interactionCount >= 5;

    const eventRoll = Math.random();
    let allyEvent: string;

    if (isBestFriend && eventRoll < 0.20 && rel.mascotB.restingUntil && new Date(rel.mascotB.restingUntil) > new Date()) {
      // Super Amigo: reduz repouso em 30-60 min
      const reductionMin = randomInt(30, 60);
      const newRest = new Date(new Date(rel.mascotB.restingUntil).getTime() - reductionMin * 60_000);
      if (newRest > new Date()) {
        await prisma.mascot.update({ where: { id: rel.mascotB.id }, data: { restingUntil: newRest } }).catch(() => {});
        allyEvent = pickText(SOCIAL_TEXTS.ally_rest, aName, bName);
        summary.events.push(`💤 ${aName} reduziu o repouso de ${bName} em ${reductionMin}min!`);
      } else {
        await prisma.mascot.update({ where: { id: rel.mascotB.id }, data: { restingUntil: null, arenaState: "FREE" } }).catch(() => {});
        allyEvent = `${aName} ajudou ${bName} a se recuperar completamente! ${bName} está livre novamente.`;
        summary.events.push(`✅ ${aName} curou completamente o repouso de ${bName}!`);
      }

    } else if (isBestFriend && eventRoll < 0.35) {
      // Super Amigo: buff de ataque conjunto temporário + EXP para ambos
      const bonusExp = randomInt(10, 25);
      await Promise.all([
        addExp(rel.mascotA.id, bonusExp).catch(() => {}),
        addExp(rel.mascotB.id, bonusExp).catch(() => {}),
      ]);
      allyEvent = pickText(SOCIAL_TEXTS.ally_joint_buff, aName, bName);
      summary.events.push(`⚡ ${aName} e ${bName} realizaram ataque conjunto! +${bonusExp} EXP cada.`);

    } else if (eventRoll < 0.30 && rel.mascotB.happiness < 60) {
      // Anima aliado com baixa felicidade
      await prisma.mascot.update({
        where: { id: rel.mascotB.id },
        data: { happiness: { increment: 15 }, mood: "HAPPY" as MascotMood }
      }).catch(() => {});
      allyEvent = pickText(SOCIAL_TEXTS.ally_encourage, aName, bName);
      summary.events.push(`💛 ${aName} animou ${bName}!`);

    } else if (eventRoll < 0.55) {
      // EXP bônus de treinamento conjunto
      const bonusExp = randomInt(5, 15);
      await Promise.all([
        addExp(rel.mascotA.id, bonusExp).catch(() => {}),
        addExp(rel.mascotB.id, bonusExp).catch(() => {}),
      ]);
      allyEvent = pickText(SOCIAL_TEXTS.ally_exp, aName, bName);
      summary.events.push(`📚 ${aName} e ${bName} treinaram juntos! +${bonusExp} EXP.`);

    } else if (isBestFriend && eventRoll < 0.60 && rel.mascotB.arenaState === "INJURED") {
      // 🚑 Visita SUS — Super Amigo reduz repouso pós-cura acumulando bônus
      const bonusMin = randomInt(15, 30);
      await prisma.mascot.update({
        where: { id: rel.mascotB.id },
        data: { susRestBonusMinutes: { increment: bonusMin } }
      }).catch(() => {});
      allyEvent = pickText(SOCIAL_TEXTS.ally_sus_visit, aName, bName);
      summary.events.push(`🚑 ${aName} visitou ${bName} no SUS! Repouso futuro -${bonusMin}min.`);

    } else if (isBestFriend && eventRoll < 0.70 && rel.mascotB.expeditions && rel.mascotB.expeditions.length > 0) {
      // 🛡️ Guarda de Expedição — Super Amigo protege rota
      // Se havia atraso recente (finishAt > original), reduz um pouco
      const expedition = rel.mascotB.expeditions[0];
      const guardReductionMin = randomInt(10, 20);
      const newFinish = new Date(new Date(expedition.finishAt).getTime() - guardReductionMin * 60_000);
      if (newFinish > new Date()) {
        await prisma.mascotExpedition.update({ where: { id: expedition.id }, data: { finishAt: newFinish } }).catch(() => {});
      }
      allyEvent = pickText(SOCIAL_TEXTS.ally_expedition_guard, aName, bName);
      summary.events.push(`🛡️ ${aName} protegeu a expedição de ${bName} (-${guardReductionMin}min)`);

    } else if (isBestFriend && eventRoll < 0.80 &&
               (rel.mascotA.arenaState === "ARENA" || rel.mascotB.arenaState === "ARENA")) {
      // ✨ Inspiração de Equipe — ambos em/perto da Arena
      const arenaExp = randomInt(5, 15);
      await Promise.all([
        addExp(rel.mascotA.id, arenaExp).catch(() => {}),
        addExp(rel.mascotB.id, arenaExp).catch(() => {}),
      ]);
      allyEvent = pickText(SOCIAL_TEXTS.ally_arena_inspiration, aName, bName);
      summary.events.push(`✨ ${aName} e ${bName} — inspiração de arena! +${arenaExp} EXP.`);

    } else if (eventRoll < 0.70 && rel.mascotB.expeditions && rel.mascotB.expeditions.length > 0) {
      // 🧭 Rota Segura — aliado em expedição, ganha item extra (food)
      await prisma.mascotFoodItem.upsert({
        where: { playerId_type: { playerId: rel.mascotB.playerId, type: "FOOD" } },
        update: { quantity: { increment: 1 } },
        create: { playerId: rel.mascotB.playerId, type: "FOOD", quantity: 1 }
      }).catch(() => {});
      allyEvent = pickText(SOCIAL_TEXTS.ally_safe_route, aName, bName);
      summary.events.push(`🧭 ${aName} garantiu item extra na expedição de ${bName}!`);

    } else if (eventRoll < 0.80 && rel.mascotB.happiness < 50) {
      // 🧃 Lanche Compartilhado — aliado com baixa felicidade (versão leve do encouragement)
      const happBoost = randomInt(5, 10);
      const newMoodSnack = Math.random() < 0.4 ? "HAPPY" : undefined;
      await prisma.mascot.update({
        where: { id: rel.mascotB.id },
        data: { happiness: { increment: happBoost }, ...(newMoodSnack ? { mood: newMoodSnack as MascotMood } : {}) }
      }).catch(() => {});
      allyEvent = pickText(SOCIAL_TEXTS.ally_snack, aName, bName);
      summary.events.push(`🧃 ${aName} dividiu um lanche com ${bName}! +${happBoost} felicidade.`);

    } else if (eventRoll < 0.88) {
      // 🎁 Presente de Amigo — pequena recompensa para B
      const giftRoll = Math.random();
      // Ticket ZikaLoot: Super Amigos têm 8% de chance, amigos comuns têm 3%
      const ticketChance = isBestFriend ? 0.08 : 0.03;
      if (giftRoll < ticketChance) {
        // 🎟️ Ticket ZikaLoot — presente especial de amizade
        const ticketItem = await prisma.shopItem.findFirst({
          where: { type: "ZIKALOOT_TICKET", active: true },
          select: { id: true },
        }).catch(() => null);
        if (ticketItem) {
          await prisma.playerInventory.upsert({
            where: { playerId_itemId: { playerId: rel.mascotB.playerId, itemId: ticketItem.id } },
            update: { quantity: { increment: 1 } },
            create: { playerId: rel.mascotB.playerId, itemId: ticketItem.id, quantity: 1 },
          }).catch(() => {});
          allyEvent = pickText(SOCIAL_TEXTS.ally_gift, aName, bName) + " (🎟️ Ticket ZikaLoot!)";
          summary.events.push(`🎟️ ${aName} deu um Ticket ZikaLoot para ${bName}!`);
        } else {
          // Fallback: doce se o ticket não existir no shop
          await prisma.mascotFoodItem.upsert({
            where: { playerId_type: { playerId: rel.mascotB.playerId, type: "SWEET" } },
            update: { quantity: { increment: 1 } },
            create: { playerId: rel.mascotB.playerId, type: "SWEET", quantity: 1 }
          }).catch(() => {});
          allyEvent = pickText(SOCIAL_TEXTS.ally_gift, aName, bName) + " (doce!)";
          summary.events.push(`🎁 ${aName} deu um presente para ${bName}`);
        }
      } else if (giftRoll < ticketChance + 0.57) {
        // ZikaCoins (3-10)
        const coins = randomInt(3, 10);
        await prisma.zikaCoinWallet.updateMany({
          where: { playerId: rel.mascotB.playerId },
          data: { balance: { increment: coins } }
        }).catch(() => {});
        allyEvent = pickText(SOCIAL_TEXTS.ally_gift, aName, bName) + ` (+${coins} ZC)`;
        summary.events.push(`🎁 ${aName} deu um presente para ${bName}`);
      } else if (giftRoll < ticketChance + 0.87) {
        // 1 petisco (FOOD)
        await prisma.mascotFoodItem.upsert({
          where: { playerId_type: { playerId: rel.mascotB.playerId, type: "FOOD" } },
          update: { quantity: { increment: 1 } },
          create: { playerId: rel.mascotB.playerId, type: "FOOD", quantity: 1 }
        }).catch(() => {});
        allyEvent = pickText(SOCIAL_TEXTS.ally_gift, aName, bName);
        summary.events.push(`🎁 ${aName} deu um presente para ${bName}`);
      } else {
        // Doce
        await prisma.mascotFoodItem.upsert({
          where: { playerId_type: { playerId: rel.mascotB.playerId, type: "SWEET" } },
          update: { quantity: { increment: 1 } },
          create: { playerId: rel.mascotB.playerId, type: "SWEET", quantity: 1 }
        }).catch(() => {});
        allyEvent = pickText(SOCIAL_TEXTS.ally_gift, aName, bName) + " (doce!)";
        summary.events.push(`🎁 ${aName} deu um presente para ${bName}`);
      }

    } else if (isBestFriend) {
      allyEvent = pickText(SOCIAL_TEXTS.best_friend_general, aName, bName);
    } else {
      allyEvent = pickText(SOCIAL_TEXTS.ally_general, aName, bName);
    }

    await Promise.all([
      logEvent(rel.mascotA.id, isBestFriend ? "💛" : "💚", allyEvent).catch(() => {}),
      logEvent(rel.mascotB.id, isBestFriend ? "💛" : "💚", allyEvent).catch(() => {}),
    ]);
    await prisma.mascotRelation.update({
      where: { id: rel.id },
      data: { interactionCount: { increment: 1 } }
    }).catch(() => {});
  }

  return summary;
}

// ── Novos Itens Especiais ─────────────────────────────────────────────────────

/** Ovo da Sorte: +20% EXP na próxima expedição TRAINING (1x por dia) */
export async function applyLuckyEgg(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.arenaState !== "FREE") throw new Error("Mascote deve estar livre para receber o Ovo da Sorte.");
  const existing = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: "LUCKY_EGG", expiresAt: { gt: new Date() } }
  });
  if (existing) throw new Error("Este mascote já tem um Ovo da Sorte ativo (recarrega em 24h).");
  await prisma.mascotBuff.create({
    data: { mascotId, type: "LUCKY_EGG", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
  });
  await logEvent(mascotId, "🥚✨", "Ovo da Sorte ativado! Próxima expedição de treinamento terá +20% EXP.");
}

/** Política de Fraqueza: protege o Pokémon de ataques oportunistas (1 bloqueio) */
export async function applyWeaknessPolicy(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  const existing = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: "WEAKNESS_POLICY", expiresAt: { gt: new Date("2090-01-01") } }
  });
  if (existing) throw new Error("Este mascote já tem Política de Fraqueza ativa.");
  await prisma.mascotBuff.create({
    data: { mascotId, type: "WEAKNESS_POLICY", expiresAt: new Date("2099-12-31T23:59:59Z") }
  });
  await logEvent(mascotId, "🛡️", "Política de Fraqueza equipada! Estará protegido contra ataques oportunistas.");
}

/** Cesta de Piquenique Chocante: bônus EXP+felicidade em interações por 2h para equipe equipada */
export async function applyPicnicBasket(playerId: string) {
  const equippedMascots = await prisma.mascot.findMany({
    where: { playerId, isEquipped: true, arenaState: "FREE" }
  });
  if (equippedMascots.length === 0) throw new Error("Nenhum mascote equipado e livre encontrado.");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await prisma.mascotBuff.createMany({
    data: equippedMascots.map(m => ({ mascotId: m.id, type: "PICNIC_BASKET" as const, expiresAt }))
  });
  for (const m of equippedMascots) {
    await logEvent(m.id, "🧺⚡", "Piquenique Chocante! Bônus de EXP e felicidade por 2h durante interações.");
  }
  return equippedMascots.length;
}

/** Ticket de Férias: envia Pokémon com o Professor Carvalho por 7 dias */
export async function applyVacationTicket(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId },
    include: { expeditions: { where: { status: "ACTIVE" }, take: 1 } }
  });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.arenaState !== "FREE") throw new Error("Mascote deve estar livre para ir de férias.");
  if (mascot.expeditions.length > 0) throw new Error("Mascote está em expedição. Conclua antes das férias.");
  const finishAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.mascotExpedition.create({
    data: { mascotId, finishAt, status: "ACTIVE", rewardJson: { durationKey: "7d", mode: "VACATION" } }
  });
  await logEvent(mascotId, "🏖️", `Partiu de férias com o Professor Carvalho por 7 dias! Volta em ${finishAt.toLocaleDateString("pt-BR")}.`);
}

/** Coleta as Férias: retorna o Pokémon revigorado */
export async function claimVacation(playerId: string, expeditionId: string) {
  const expedition = await prisma.mascotExpedition.findUnique({
    where: { id: expeditionId },
    include: { mascot: true }
  });
  if (!expedition || expedition.mascot.playerId !== playerId) throw new Error("Expedição não encontrada.");
  if (expedition.status !== "ACTIVE") throw new Error("Férias já coletadas.");
  if (new Date() < expedition.finishAt) throw new Error("As férias ainda não terminaram.");

  const happinessBonus = 30;
  const expBonus = 500;

  await prisma.$transaction(async (tx) => {
    await tx.mascotExpedition.update({
      where: { id: expeditionId },
      data: { status: "CLAIMED", rewardJson: { happinessBonus, expBonus } }
    });
    await tx.mascot.update({
      where: { id: expedition.mascotId },
      data: {
        happiness: Math.min(100, expedition.mascot.happiness + happinessBonus),
        mood: "HAPPY",
      }
    });
    await tx.mascotEvent.create({
      data: {
        mascotId: expedition.mascotId,
        emoji: "🌴",
        description: `Voltou das férias com o Professor Carvalho revigorado! +${happinessBonus} felicidade e +${expBonus} EXP.`
      }
    });
  });

  await addExp(expedition.mascotId, expBonus).catch(() => {});
  return { happinessBonus, expBonus };
}

/** Compartilhador de XP: equipa em Pokémon fora de expedição (1 por jogador) */
export async function applyXpShare(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId },
    include: { expeditions: { where: { status: "ACTIVE" }, take: 1 } }
  });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.expeditions.length > 0) throw new Error("Não pode equipar em mascote em expedição.");
  const existing = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: "XP_SHARE", expiresAt: { gt: new Date("2090-01-01") } }
  });
  if (existing) throw new Error("Este mascote já tem Compartilhador de XP.");
  const count = await prisma.mascotBuff.count({
    where: { type: "XP_SHARE", mascot: { playerId }, expiresAt: { gt: new Date("2090-01-01") } }
  });
  if (count >= 1) throw new Error("Você já tem um Compartilhador de XP ativo. Remova-o antes.");
  await prisma.mascotBuff.create({
    data: { mascotId, type: "XP_SHARE", expiresAt: new Date("2099-12-31T23:59:59Z") }
  });
  await logEvent(mascotId, "📡", "Compartilhador de XP equipado! Receberá metade do EXP de expedições de treinamento.");
}

/** Remove Compartilhador de XP do Pokémon */
export async function removeXpShare(playerId: string, mascotId: string) {
  const buff = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: "XP_SHARE", mascot: { playerId }, expiresAt: { gt: new Date("2090-01-01") } }
  });
  if (!buff) throw new Error("Compartilhador de XP não encontrado neste mascote.");
  await prisma.mascotBuff.delete({ where: { id: buff.id } });
  await logEvent(mascotId, "📡", "Compartilhador de XP removido.");
}

/** Pena Arco-Íris: reseta Pokémon para nível 1 com atributos base */
export async function applyRainbowFeather(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.arenaState !== "FREE") throw new Error("Mascote deve estar livre para usar a Pena Arco-Íris.");
  await prisma.mascot.update({
    where: { id: mascotId },
    data: {
      level: 1, exp: 0,
      statForce: 10, statAgility: 10, statCharisma: 10, statInstinct: 10, statVitality: 10,
      happiness: 50, mood: "NEUTRAL",
    }
  });
  // Remove marca de proteína (stats foram resetados)
  await prisma.mascotBuff.deleteMany({
    where: { mascotId, type: "STAT_BOOST", expiresAt: { gt: new Date("2090-01-01") } }
  }).catch(() => {});
  await logEvent(mascotId, "🌈", "Pena Arco-Íris usada! Atributos e nível resetados. Uma nova jornada começa!");
}

// ── Utilidades para UI ────────────────────────────────────────────────────────

export { getSpriteUrl, getPokemonName, expToNextLevel, getSocialTier };
export type { ExpeditionDuration };
