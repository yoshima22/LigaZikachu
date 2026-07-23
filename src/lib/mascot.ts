/**
 * Serviço de mascotes — lógica de negócio do sistema.
 */

import { prisma } from "@/lib/prisma";
import { creditCoins } from "@/lib/zikacoins";
import { maybeDropSyncTicket } from "@/lib/sync-challenge";
import { maybeRevealOrderClueFromExpedition } from "@/lib/raid-event";
import { getShopItemMeta } from "@/lib/shop-cache";
import { registerPokemonDiscovery } from "@/lib/pokemon-dex";
import {
  ALL_EVOLVED_IDS, EGG_POOLS, LEGENDARY_HATCH_BASE_OVERRIDES, LEGENDARY_POOL,
  EVOLUTION_MAP, EVOLUTION_REVERSE_MAP, PERSONALITIES, INCUBATION_DURATION_MS,
  EXPEDITION_DURATIONS, TRAINING_EXP_MULT, expToNextLevel, EXP_REWARDS,
  EGG_STAT_RANGES, EGG_SHINY_CHANCE,
  getSpriteUrl, getPokemonName, getPokemonElement, getTypeAdvantageMultiplier,
  getMascotStatusGrowthMultiplier, getMascotProgressMilestones, getExpeditionOdds,
  getMegaStoneExpeditionChance, rollExpeditionAgilityReduction,
} from "@/lib/mascot-data";
import type { ExpeditionDuration, ExpeditionMode } from "@/lib/mascot-data";
import type { EggType, Mascot, MascotMood, MascotPersonality, Prisma } from "@prisma/client";
import { ZikaCoinTxType } from "@prisma/client";
import { LEAGUE_SHOP_ITEM_TYPES } from "@/lib/shop-config";
import { rollPokemonIdFromEgg } from "@/lib/mascot-egg-pools";
import { isStandbyActive } from "@/lib/account-standby";
import { MEGA_STONES, getMegaStoneByType, getMegaStoneForMegaPokemon } from "@/lib/mega-evolution";
import { ensureMegaStoneShopItems } from "@/lib/mega-shop";
import { publishLeagueTicker } from "@/lib/league-ticker";

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

function getEggStatTypeKey(type: string, origin?: string | null) {
  if (origin?.startsWith("GEN_CHOICE:")) {
    const originalType = origin.split(":")[1];
    return originalType || type;
  }
  return type === "LAB" || origin?.startsWith("LAB_REGION:") ? "LAB" : type;
}

function getEggRollType(type: string, origin?: string | null) {
  if (origin?.startsWith("GEN_CHOICE:")) {
    const genType = origin.split(":")[2];
    return genType || type;
  }
  return type;
}

/** Sorteio de pokemonId a partir do tipo de ovo */
/**
 * Rola uma opção para o ovo de laboratório.
 * Pool = SPECIAL (pokémon cobiçados) com 10% de chance lendária —
 * acima do ovo SPECIAL normal (6%), recompensando o custo em pó de criação.
 */
export function rollLabEggChoice(): number {
  if (Math.random() < 0.07) {
    const hatchableLegendaryPool = Array.from(
      new Set(LEGENDARY_POOL.map((id) => LEGENDARY_HATCH_BASE_OVERRIDES[id] ?? id)),
    ).filter((id) => !ALL_EVOLVED_IDS.has(id));
    return randomFrom(hatchableLegendaryPool);
  }
  const pool = EGG_POOLS.SPECIAL?.length ? EGG_POOLS.SPECIAL : EGG_POOLS.RARE;
  return randomFrom(pool);
}

export function rollPokemonFromEgg(eggType: string): number {
  return rollPokemonIdFromEgg(eggType);
  // Pool aleatório (COMMON sem gen específica) = todas as 9 gerações
  const pool = eggType === "COMMON" || eggType === "EVENT"
    ? (EGG_POOLS.RANDOM.length > 0 ? EGG_POOLS.RANDOM : EGG_POOLS.COMMON)
    : (EGG_POOLS[eggType] ?? EGG_POOLS.RANDOM);

  // Chance lendaria por raridade. SPECIAL e RARE custam mais e devem parecer especiais.
  // SPECIAL: 4% | RARE: 2% | GEN eggs: 0.7% | COMMON: 0.7% | EVENT: 0.2%
  const legendaryChance =
    eggType === "SPECIAL" ? 0.02 :
    eggType === "RARE" ? 0.02 :
    eggType.startsWith("EGG_GEN") ? 0.007 :
    eggType === "COMMON" ? 0.007 :
    0.002;

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

export async function hatchEgg(playerId: string, forcedPokemonId?: number): Promise<{
  mascotId: string; pokemonId: number; name: string; isNew: boolean; isShiny: boolean; isStatBuffed: boolean;
  stats: { force: number; agility: number; charisma: number; instinct: number; vitality: number };
  statRange: [number, number];
}> {
  const incubator = await prisma.mascotIncubator.findUnique({
    where: { playerId },
    include: { egg: true }
  });
  if (!incubator) throw new Error("Sem ovo na incubadora.");
  if (incubator.hatched) throw new Error("Ovo já chocado.");
  if (new Date() < incubator.finishAt) throw new Error("O ovo ainda não está pronto.");

  const pokemonId = forcedPokemonId ?? rollPokemonIdFromEgg(
    getEggRollType(incubator.egg.type, incubator.egg.origin),
    incubator.egg.hatchRarityBonusPct,
  );
  const personality = randomPersonality();

  const mascot = await prisma.$transaction(async (tx) => {
    // Stat range baseado no tipo do ovo (ovos mais raros = stats melhores)
    const eggTypeKey = getEggStatTypeKey(incubator.egg.type as string, incubator.egg.origin);
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
        hatchedFromEggType: incubator.egg.type,
        hatchedFromEggOrigin: incubator.egg.origin,
        statForce:    randomInt(statMin, statMax),
        statAgility:  randomInt(statMin, statMax),
        statCharisma: randomInt(statMin, statMax),
        statInstinct: randomInt(statMin, statMax),
        statVitality: randomInt(statMin, statMax),
      }
    });
    await registerPokemonDiscovery({ playerId, pokemonId, source: `egg:${incubator.egg.type}` }, tx);
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

    return { m, isShiny, isStatBuffed, eggTypeKey };
  }, { timeout: 15000, maxWait: 10000 });

  const { m, isShiny, isStatBuffed, eggTypeKey } = mascot as {
    m: { id: string; statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number };
    isShiny: boolean; isStatBuffed: boolean; eggTypeKey: string;
  };
  const [rangeMin, rangeMax] = EGG_STAT_RANGES[eggTypeKey] ?? [8, 14];

  return {
    mascotId: m.id,
    pokemonId,
    name: getPokemonName(pokemonId),
    isNew: true,
    isShiny,
    isStatBuffed,
    /** Stats reais ao nascer */
    stats: {
      force:    m.statForce,
      agility:  m.statAgility,
      charisma: m.statCharisma,
      instinct: m.statInstinct,
      vitality: m.statVitality,
    },
    /** Range normal do ovo — para comparação visual */
    statRange: [rangeMin, rangeMax] as [number, number],
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

// Suaviza o peso do crescimento: expoente < 1 comprime a distância entre os
// atributos altos e baixos, mantendo o foco (o mais alto ainda cresce mais)
// mas evitando que os baixos fiquem com peso desprezível.
const GROWTH_WEIGHT_EXPONENT = 0.85;
function softWeight(stat: number): number {
  return Math.pow(Math.max(0, stat), GROWTH_WEIGHT_EXPONENT);
}

/**
 * Distribui pontos por peso e impede que um atributo fique PERMANENTEMENTE preso:
 * se o atributo mais fraco receberia 0 neste ganho, está bem abaixo da média
 * (< 55%) e caímos na cadência (a cada ~3 níveis), redireciona 1 ponto do que
 * mais cresceu para ele. Mantém o foco (só 1 ponto, e só quando muito atrás),
 * mas garante que nenhum atributo trave em "nunca mais sobe".
 */
function distributeStatPointsAntiFreeze(
  points: number,
  weights: Record<MascotStatKey, number>,
  currentStats: Record<MascotStatKey, number>,
  cadenceLevel: number,
): Record<MascotStatKey, number> {
  const dist = distributeStatPoints(points, weights);
  if (points < 2) return dist;
  const keys = Object.keys(currentStats) as MascotStatKey[];
  const avg = keys.reduce((s, k) => s + currentStats[k], 0) / keys.length;
  const weakest = keys.reduce((a, b) => (currentStats[b] < currentStats[a] ? b : a), keys[0]);
  const laggingBadly = currentStats[weakest] < avg * 0.55;
  const onCadence = cadenceLevel % 3 === 0;
  if (laggingBadly && onCadence && dist[weakest] === 0) {
    const topGainer = keys.reduce((a, b) => (dist[b] > dist[a] ? b : a), keys[0]);
    if (dist[topGainer] > 0) { dist[topGainer] -= 1; dist[weakest] += 1; }
  }
  return dist;
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
  const growthMultiplier = getMascotStatusGrowthMultiplier(mascot.pokemonId);
  const pointsToAdd = rawPoints > 0 ? Math.max(1, Math.round(rawPoints * LEVEL_STAT_GAIN_MULTIPLIER * growthMultiplier)) : 0;

  const weights: Record<MascotStatKey, number> = {
    statForce: softWeight(mascot.statForce),
    statAgility: softWeight(mascot.statAgility),
    statCharisma: softWeight(mascot.statCharisma),
    statInstinct: softWeight(mascot.statInstinct),
    statVitality: softWeight(mascot.statVitality),
  };

  if (mascot.personality === "COMPETITIVE") weights.statForce *= 1.15;
  if (mascot.personality === "LOYAL") weights.statCharisma *= 1.15;
  if (mascot.personality === "DRAMATIC") weights.statVitality *= 0.85;

  (Object.keys(weights) as MascotStatKey[]).forEach((key, index) => {
    const wobble = 0.92 + (((mascot.pokemonId * (index + 3) + mascot.level * 11) % 17) / 100);
    weights[key] *= wobble;
  });

  const currentStats: Record<MascotStatKey, number> = {
    statForce: mascot.statForce, statAgility: mascot.statAgility, statCharisma: mascot.statCharisma,
    statInstinct: mascot.statInstinct, statVitality: mascot.statVitality,
  };
  return distributeStatPointsAntiFreeze(pointsToAdd, weights, currentStats, mascot.level);
}

function addStatRecords(
  base: Record<MascotStatKey, number>,
  add: Record<MascotStatKey, number>,
): Record<MascotStatKey, number> {
  return {
    statForce: base.statForce + add.statForce,
    statAgility: base.statAgility + add.statAgility,
    statCharisma: base.statCharisma + add.statCharisma,
    statInstinct: base.statInstinct + add.statInstinct,
    statVitality: base.statVitality + add.statVitality,
  };
}

function emptyStatRecord(): Record<MascotStatKey, number> {
  return { statForce: 0, statAgility: 0, statCharisma: 0, statInstinct: 0, statVitality: 0 };
}

/**
 * Simula o crescimento procedural de stats de nível 1 até `targetLevel`.
 * Usa a mesma lógica de level-up real, começando de stats base aleatórios
 * no range de ovo COMMON (8–14). Chame múltiplas vezes para reroll.
 */
export function computeProceduralStats(
  pokemonId: number,
  targetLevel: number,
  personality: MascotPersonality,
): Record<MascotStatKey, number> {
  // Stats base = ovo COMMON range (8–14)
  const cur: Record<MascotStatKey, number> & { pokemonId: number; level: number; personality: MascotPersonality } = {
    pokemonId,
    level: 1,
    personality,
    statForce:    randomInt(8, 14),
    statAgility:  randomInt(8, 14),
    statCharisma: randomInt(8, 14),
    statInstinct: randomInt(8, 14),
    statVitality: randomInt(8, 14),
  };

  for (let lvl = 1; lvl < Math.max(1, Math.min(100, targetLevel)); lvl++) {
    const bonuses = levelStatBonuses({ ...cur, level: lvl }, 1);
    cur.level = lvl + 1;
    (Object.keys(bonuses) as MascotStatKey[]).forEach(k => { cur[k] += bonuses[k]; });
  }

  return {
    statForce:    cur.statForce,
    statAgility:  cur.statAgility,
    statCharisma: cur.statCharisma,
    statInstinct: cur.statInstinct,
    statVitality: cur.statVitality,
  };
}

export async function addExp(
  mascotId: string,
  amount: number,
  options: { ignoreBenchPenalty?: boolean; ignoreExpBoost?: boolean; mascotSnapshot?: Mascot } = {}
): Promise<LevelUpResult> {
  const mascot = options.mascotSnapshot ?? await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot) throw new Error("Mascote não encontrado.");
  if (mascot.expLocked) return { leveled: false, newLevel: mascot.level, evolved: false };
  // EXP agora é dado a qualquer mascote (equipado ou no banco)
  // Mascotes no banco recebem 50% do EXP (interações presenciais são menos intensas)
  if (!options.ignoreBenchPenalty && !mascot.isEquipped) amount = Math.max(1, Math.floor(amount * 0.5));

  // Check for active EXP_BOOST buff (ignorado se já foi aplicado pelo caller)
  if (!options.ignoreExpBoost) {
    const [expBoostBuff, expBoostItem] = await Promise.all([
      prisma.mascotBuff.findFirst({ where: { mascotId, type: "EXP_BOOST", expiresAt: { gt: new Date() } } }),
      getShopItemMeta("MASCOT_BUFF_EXP"),
    ]);
    if (expBoostBuff) {
      const pct = (expBoostItem as { expMultiplierPct?: number } | null)?.expMultiplierPct ?? 25;
      amount = Math.floor(amount * (1 + pct / 100));
    }
  }

  let { level, exp, pokemonId } = mascot;
  exp += amount;
  // Nível máximo — não acumula EXP além do cap
  if (level >= 100) { exp = 0; }
  let levelsGained = 0;
  let evolved = false;
  let newPokemonId: number | undefined;
  const evolvedPokemonIds: number[] = [];

  // Verifica level ups em cadeia (cap: nível 100)
  while (level < 100 && exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level++;
    levelsGained++;
    if (level >= 100) { exp = 0; break; }

    // Verifica evolução (respeitando evolutionLocked)
    const evo = EVOLUTION_MAP.get(pokemonId);
    if (evo && level >= evo.level && !mascot.evolutionLocked) {
      const opts = evo.toOptions;
      pokemonId = opts ? opts[Math.floor(Math.random() * opts.length)] : evo.to;
      evolved = true;
      newPokemonId = pokemonId;
      evolvedPokemonIds.push(pokemonId);
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

  const baseAfterLevelBonuses: Record<MascotStatKey, number> = {
    statForce: typeof statUpdates.statForce === "number" ? statUpdates.statForce : mascot.statForce,
    statAgility: typeof statUpdates.statAgility === "number" ? statUpdates.statAgility : mascot.statAgility,
    statCharisma: typeof statUpdates.statCharisma === "number" ? statUpdates.statCharisma : mascot.statCharisma,
    statInstinct: typeof statUpdates.statInstinct === "number" ? statUpdates.statInstinct : mascot.statInstinct,
    statVitality: typeof statUpdates.statVitality === "number" ? statUpdates.statVitality : mascot.statVitality,
  };

  const candidateMilestones = leveled ? getMascotProgressMilestones(pokemonId, level, evolved) : [];
  const existingMilestoneKeys = candidateMilestones.length > 0
    ? new Set((await prisma.mascotProgressMilestone.findMany({
        where: { mascotId, key: { in: candidateMilestones.map((m) => m.key) } },
        select: { key: true },
      })).map((m) => m.key))
    : new Set<string>();
  const newMilestones = candidateMilestones.filter((m) => !existingMilestoneKeys.has(m.key));
  let milestoneBonuses = emptyStatRecord();
  const milestoneRows: {
    mascotId: string;
    key: string;
    label: string;
    level: number;
    statsJson: Record<MascotStatKey, number>;
  }[] = [];
  for (const milestone of newMilestones) {
    const currentStats = addStatRecords(baseAfterLevelBonuses, milestoneBonuses);
    const weights: Record<MascotStatKey, number> = {
      statForce: softWeight(currentStats.statForce),
      statAgility: softWeight(currentStats.statAgility),
      statCharisma: softWeight(currentStats.statCharisma),
      statInstinct: softWeight(currentStats.statInstinct),
      statVitality: softWeight(currentStats.statVitality),
    };
    const points = distributeStatPointsAntiFreeze(milestone.points, weights, currentStats, milestone.level);
    milestoneBonuses = addStatRecords(milestoneBonuses, points);
    milestoneRows.push({
      mascotId,
      key: milestone.key,
      label: milestone.label,
      level: milestone.level,
      statsJson: points,
    });
  }

  const finalStatUpdates = newMilestones.length > 0
    ? {
        statForce: baseAfterLevelBonuses.statForce + milestoneBonuses.statForce,
        statAgility: baseAfterLevelBonuses.statAgility + milestoneBonuses.statAgility,
        statCharisma: baseAfterLevelBonuses.statCharisma + milestoneBonuses.statCharisma,
        statInstinct: baseAfterLevelBonuses.statInstinct + milestoneBonuses.statInstinct,
        statVitality: baseAfterLevelBonuses.statVitality + milestoneBonuses.statVitality,
      }
    : statUpdates;

  await prisma.mascot.update({
    where: { id: mascotId },
    data: { level, exp, pokemonId, ...finalStatUpdates, ...nicknameUpdate }
  });

  for (const evolvedPokemonId of new Set(evolvedPokemonIds)) {
    await registerPokemonDiscovery({
      playerId: mascot.playerId,
      pokemonId: evolvedPokemonId,
      source: `evolution:${mascot.pokemonId}`,
    });
  }

  if (newMilestones.length > 0) {
    await prisma.mascotProgressMilestone.createMany({
      data: milestoneRows,
      skipDuplicates: true,
    });
    await prisma.mascotEvent.create({
      data: {
        mascotId,
        emoji: "🌟",
        description: `Marco de crescimento: ${newMilestones.map((m) => m.label).join(", ")}. Atributos bonus aplicados.`,
      },
    }).catch(() => null);
  }

  // Auto-kick da arena se o nível ultrapassou o limite da sala
  if (leveled) {
    const membership = await prisma.arenaTeamMember.findFirst({
      where: { mascotId, team: { status: "ACTIVE", isTraining: false } },
      include: {
        team: {
          select: {
            id: true, roomLevel: true, playerId: true, status: true,
            vaultCoins: true, vaultExp: true, vaultFood: true, vaultSweet: true,
            members: { select: { id: true, mascotId: true, mascot: { select: { level: true, arenaState: true } } } },
          },
        },
      },
    });
    if (membership && membership.team.roomLevel !== null && membership.team.roomLevel > 0 && level > membership.team.roomLevel) {
      const team = membership.team;
      // Membros restantes com nível válido (excluindo este mascote)
      const remainingValid = team.members.filter(
        m => m.mascotId !== mascotId && m.mascot.arenaState !== "INJURED" && m.mascot.level <= team.roomLevel!
      );

      if (remainingValid.length === 0) {
        // Último membro válido — retira a equipe distribuindo as recompensas do cofre
        const allMascotIds = team.members.map(m => m.mascotId);
        await prisma.$transaction(async (tx) => {
          if (team.vaultCoins > 0) {
            await creditCoins(tx, {
              playerId: team.playerId,
              type: ZikaCoinTxType.BET_WON,
              amount: team.vaultCoins,
              description: `Cofre Arena Z (retirada automática por nível): ${team.vaultCoins} ZC`,
            });
          }
          if (team.vaultFood > 0) {
            await tx.mascotFoodItem.upsert({
              where: { playerId_type: { playerId: team.playerId, type: "FOOD" } },
              update: { quantity: { increment: team.vaultFood } },
              create: { playerId: team.playerId, type: "FOOD", quantity: team.vaultFood },
            });
          }
          if (team.vaultSweet > 0) {
            await tx.mascotFoodItem.upsert({
              where: { playerId_type: { playerId: team.playerId, type: "SWEET" } },
              update: { quantity: { increment: team.vaultSweet } },
              create: { playerId: team.playerId, type: "SWEET", quantity: team.vaultSweet },
            });
          }
          // Libera todos os mascotes da equipe
          await tx.mascot.updateMany({
            where: { id: { in: allMascotIds }, arenaState: { not: "INJURED" } },
            data: { arenaState: "FREE" },
          });
          // Retira a equipe
          await tx.arenaTeam.update({
            where: { id: team.id },
            data: { status: "RETIRED", vaultCoins: 0, vaultExp: 0, vaultFood: 0, vaultSweet: 0 },
          });
          await tx.mascotEvent.create({
            data: {
              mascotId,
              emoji: "📤",
              description: `Equipe da Sala ${team.roomLevel} encerrada automaticamente: atingiu nível ${level} e não havia mais membros válidos. Cofre distribuído.`,
            },
          });
        });
        // Distribui EXP do cofre para todos os mascotes da equipe (fora da transaction para evitar recursão)
        if (team.vaultExp > 0 && allMascotIds.length > 0) {
          const expPerMascot = Math.max(1, Math.floor(team.vaultExp / allMascotIds.length));
          await Promise.allSettled(
            allMascotIds.map(id => addExp(id, expPerMascot, { ignoreBenchPenalty: true }))
          );
        }
      } else {
        // Ainda há membros válidos — apenas remove este mascote da equipe
        await prisma.$transaction([
          prisma.arenaTeamMember.delete({ where: { id: membership.id } }),
          prisma.mascot.update({ where: { id: mascotId }, data: { arenaState: "FREE" } }),
          prisma.mascotEvent.create({
            data: {
              mascotId,
              emoji: "📤",
              description: `Saiu da equipe da Arena automaticamente: atingiu nível ${level}, acima do limite da Sala ${team.roomLevel}. Equipe continua ativa com os demais.`,
            },
          }),
        ]);
      }
    }
  }

  if (mascot.level < 100 && level === 100) {
    const owner = await prisma.player.findUnique({
      where: { id: mascot.playerId },
      select: { displayName: true },
    }).catch(() => null);
    await publishLeagueTicker({
      type: "MASCOT_LEVEL_100",
      message: `${mascot.nickname ?? getPokemonName(pokemonId)} de ${owner?.displayName ?? "um jogador"} chegou ao nível 100!`,
      href: `/jogadores/${mascot.playerId}`,
      eventKey: `mascot-level-100:${mascotId}`,
      priority: 8,
      ttlHours: 24,
    });
  }

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
  inventoryRemaining?: number;
  evolved?: boolean;
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

  // Bloqueia brincar/carinho se mascote está em expedição ativa
  if (type === "PLAY" || type === "PET") {
    const activeExp = await prisma.mascotExpedition.findFirst({
      where: { mascotId, status: "ACTIVE" },
      select: { id: true },
    });
    if (activeExp) {
      return { success: false, message: `${getPokemonName(mascot.pokemonId)} está em expedição — só aceita comida por enquanto.`, happinessChange: 0, expGained: 0 };
    }
  }

  const now = new Date();
  const PLAY_COOLDOWN_MS = 45 * 60 * 1000;
  const PET_COOLDOWN_MS  = 25 * 60 * 1000;

  if (!skipCooldown && type === "PLAY") {
    const playedAt = mascot.lastPlayedAt;
    if (playedAt && now.getTime() - playedAt.getTime() < PLAY_COOLDOWN_MS) {
      const remaining = Math.ceil((PLAY_COOLDOWN_MS - (now.getTime() - playedAt.getTime())) / 60_000);
      return { success: false, message: `Espere mais ${remaining} min antes de brincar novamente.`, happinessChange: 0, expGained: 0 };
    }
  }
  if (!skipCooldown && type === "PET") {
    if (mascot.lastPettedAt && now.getTime() - mascot.lastPettedAt.getTime() < PET_COOLDOWN_MS) {
      const remaining = Math.ceil((PET_COOLDOWN_MS - (now.getTime() - mascot.lastPettedAt.getTime())) / 60_000);
      return { success: false, message: `Espere mais ${remaining} min antes de fazer carinho novamente.`, happinessChange: 0, expGained: 0 };
    }
  }
  // Verifica se um rival travou as interações
  if (type !== "FEED_FOOD" && type !== "FEED_SWEET" && mascot.socialCooldownUntil && mascot.socialCooldownUntil > now && !skipCooldown) {
    const remaining = Math.ceil((mascot.socialCooldownUntil.getTime() - now.getTime()) / 60_000);
    return { success: false, message: `Um rival atordoou este mascote! Interações travadas por mais ${remaining} min.`, happinessChange: 0, expGained: 0, refused: true };
  }

  // Bônus por nível — cada 10 níveis aumenta eficácia das interações
  const lvlBonus = Math.floor(mascot.level / 10);
  const mascotName = mascot.nickname ?? getPokemonName(mascot.pokemonId);

  // Pré-busca multipliers de EXP para calcular o valor real antes de montar a mensagem
  const [relations, expBoostBuff] = await Promise.all([
    prisma.mascotRelation.findMany({ where: { mascotAId: mascotId }, select: { type: true, interactionCount: true } }).catch(() => [] as { type: string; interactionCount: number }[]),
    prisma.mascotBuff.findFirst({ where: { mascotId, type: "EXP_BOOST", expiresAt: { gt: now } } }).catch(() => null),
  ]);
  const expBoostItemMeta = expBoostBuff ? await getShopItemMeta("MASCOT_BUFF_EXP") : null;
  const picnicExpBonus = 0;
  const picnicHappyBonus = 0;

  // Bônus social escalado por tier (§12 do doc social)
  const friendRels     = relations.filter(r => r.type === "FRIEND");
  const rivalRels      = relations.filter(r => r.type === "RIVAL");
  const friendCount    = friendRels.length;
  const hasSuperFriend = friendRels.some(r => r.interactionCount >= 5);
  const rivalCount     = rivalRels.length;
  const hasDirectRival = rivalRels.some(r => r.interactionCount >= 3);
  let socialBonus = 0;
  if (friendCount === 1) socialBonus += 0.05;          // 1 amigo: +5%
  else if (friendCount >= 2) socialBonus += 0.10;       // 2+ amigos: +10%
  if (hasSuperFriend) socialBonus += 0.10;              // Super Amigo: +10% extra
  if (hasDirectRival) socialBonus += 0.10;              // Rival Direto: +10%
  else if (rivalCount > 0) socialBonus += 0.05;         // Rival comum: +5%
  socialBonus = Math.min(socialBonus, 0.25);            // cap total +25%
  const socialMult = 1.0 + socialBonus + picnicExpBonus;
  const benchMult  = mascot.isEquipped ? 1.5 : (mascot.isFavorite ? 1.25 : 1.0);
  const expBoostMult = expBoostBuff ? 1 + ((expBoostItemMeta?.metadata as { expMultiplierPct?: number } | null)?.expMultiplierPct ?? 25) / 100 : 1.0;

  // Calcula EXP real que será aplicado (mesmo cálculo do addExp, mas exposto aqui para a mensagem)
  // Zero quando EXP travada ou mascote já no nível máximo — para mensagem refletir o real
  const expIsBlocked = mascot.expLocked || mascot.level >= 100;
  const calcFinalExp = (base: number) =>
    expIsBlocked ? 0 : Math.max(1, Math.round(base * socialMult * benchMult * expBoostMult));

  let happinessChange = 0;
  let expGained = 0;       // EXP real aplicado (após todos os multiplicadores)
  let refused = false;
  let newMood: MascotMood | undefined;
  let message = "";
  let inventoryRemaining: number | undefined;

  switch (type) {
    case "PLAY": {
      const playHappy = 8 + lvlBonus * 2 + (mascot.personality === "PLAYFUL" ? 3 : 0);
      const playExpBase = EXP_REWARDS.PLAY_WITH + lvlBonus * 3;
      expGained = calcFinalExp(playExpBase);
      happinessChange = playHappy;
      newMood = mascot.personality === "LAZY" ? "TIRED" : "HAPPY";
      message = mascot.personality === "LAZY"
        ? `${mascotName} é preguiçoso — brincou um pouco mas logo cansou. (+${playHappy} felicidade, +${expGained} EXP)`
        : `${mascotName} adorou brincar! (+${playHappy} felicidade, +${expGained} EXP)`;
      break;
    }
    case "PET": {
      if (mascot.personality === "TIMID" && mascot.happiness < 40) {
        refused = true;
        message = `${mascotName} é muito tímido e está com a felicidade baixa (${mascot.happiness}/100) — recusou o carinho.`;
        break;
      }
      if (mascot.mood === "ANGRY") {
        refused = true;
        message = `${mascotName} está com raiva agora. Espere a raiva passar antes de tentar o carinho!`;
        break;
      }
      const petHappy = 5 + lvlBonus + (mascot.personality === "LOYAL" ? 2 : 0);
      const petExpBase = EXP_REWARDS.PET + lvlBonus;
      expGained = calcFinalExp(petExpBase);
      happinessChange = petHappy;
      newMood = mascot.happiness + petHappy >= 80 ? "HAPPY" :
                mascot.mood === "TIRED" ? "NEUTRAL" :
                mascot.mood === "NEEDY" ? "NEUTRAL" : undefined;
      message = mascot.personality === "PROUD"
        ? `${mascotName} aceitou o carinho com dignidade! 👑 (+${petHappy} felicidade, +${expGained} EXP)`
        : `${mascotName} gostou do carinho! 💛 (+${petHappy} felicidade, +${expGained} EXP)`;
      break;
    }

    case "FEED_FOOD": {
      const consumed = await prisma.mascotFoodItem.updateMany({
        where: { playerId, type: "FOOD", quantity: { gt: 0 } },
        data: { quantity: { decrement: 1 } },
      });
      if (consumed.count === 0) {
        return { success: false, message: "Você não tem comida no inventário.", happinessChange: 0, expGained: 0 };
      }
      const food = await prisma.mascotFoodItem.findUnique({ where: { playerId_type: { playerId, type: "FOOD" } }, select: { quantity: true } });
      inventoryRemaining = food?.quantity ?? 0;
      happinessChange = 25;
      expGained = calcFinalExp(EXP_REWARDS.FEED_FOOD);
      newMood = "HAPPY";
      message = `${mascotName} comeu e está satisfeito! (+${expGained} EXP)`;
      break;
    }

    case "FEED_SWEET": {
      const consumed = await prisma.mascotFoodItem.updateMany({
        where: { playerId, type: "SWEET", quantity: { gt: 0 } },
        data: { quantity: { decrement: 1 } },
      });
      if (consumed.count === 0) {
        return { success: false, message: "Você não tem doces no inventário.", happinessChange: 0, expGained: 0 };
      }
      const sweet = await prisma.mascotFoodItem.findUnique({ where: { playerId_type: { playerId, type: "SWEET" } }, select: { quantity: true } });
      inventoryRemaining = sweet?.quantity ?? 0;
      happinessChange = 35;
      expGained = calcFinalExp(EXP_REWARDS.FEED_SWEET);
      newMood = "EXCITED";
      message = `${mascotName} amou o doce! Olha aquela energia! (+${expGained} EXP)`;
      break;
    }
  }

  if (refused) {
    return { success: false, message, happinessChange: 0, expGained: 0, refused: true };
  }

  const newHappiness = Math.min(100, Math.max(0, mascot.happiness + happinessChange + picnicHappyBonus));
  const finalMood: MascotMood = newHappiness >= 90 ? "CONFIDENT" : newMood ?? mascot.mood;

  await prisma.mascot.update({
    where: { id: mascotId },
    data: {
      happiness: newHappiness,
      mood: finalMood,
      lastInteractedAt: type === "PLAY" || type === "PET" ? now : mascot.lastInteractedAt,
      lastPlayedAt: type === "PLAY" ? now : mascot.lastPlayedAt,
      lastPettedAt: type === "PET" ? now : mascot.lastPettedAt,
      lastFedAt: type.startsWith("FEED") ? now : mascot.lastFedAt,
    }
  });

  // Aplica EXP — passa ignoreBenchPenalty:true porque já calculamos o bench mult acima
  const levelResult = expGained > 0
    ? await addExp(mascotId, expGained, { ignoreBenchPenalty: true, ignoreExpBoost: true, mascotSnapshot: mascot })
    : null;

  return { success: true, message, happinessChange, expGained, newMood: finalMood, inventoryRemaining, evolved: levelResult?.evolved };
}

// ── Mood decay (recalcula humor baseado em última interação) ──────────────────

const _standbyCache = new Map<string, { until: number; active: boolean }>();

export async function recalculateMood(mascotId: string): Promise<void> {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot) return;

  // Cache standby check per player (avoids N+1 on batch mood recalc)
  let standby = _standbyCache.get(mascot.playerId);
  if (!standby || Date.now() > standby.until) {
    const player = await prisma.player.findUnique({ where: { id: mascot.playerId }, select: { notes: true } });
    const active = isStandbyActive(player?.notes);
    _standbyCache.set(mascot.playerId, { until: Date.now() + 60_000, active });
    standby = { until: Date.now() + 60_000, active };
  }
  if (standby.active) return;

  const now = Date.now();
  const decayMultiplier = mascot.isEquipped ? 0.5 : 0.0625;
  const thresholdMultiplier = mascot.isEquipped ? 2 : 16;
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

  if (hoursSinceFed > 48 * thresholdMultiplier) {
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
  | { type: "BUFF_ITEM"; shopItemType: string }
  | { type: "MEGA_STONE"; shopItemType: string }
  | { type: "TRAINING";  exp: number; durationLabel: string }  // retorna só EXP, nunca itens
  | { type: "VACATION";  expBonus: number; gotEgg: boolean }
  | { type: "NOTHING" };

function rollRandomMegaStoneType(): string {
  return randomFrom([...MEGA_STONES]).type;
}

// Pool de itens especiais que podem ser encontrados em expedições
function rollBuffItemType(durationKey: ExpeditionDuration): string {
  const leagueChance = durationKey === "6h" ? 0.18 : durationKey === "3h" ? 0.10 : 0.05;
  if (Math.random() < leagueChance) return randomFrom([...LEAGUE_SHOP_ITEM_TYPES]);
  const roll = Math.random() * 100;
  if (durationKey === "6h") {
    if (roll < 34) return "MASCOT_BUFF_EXP";   // 34% — Vitamina Elétrica
    if (roll < 62) return "MASCOT_BUFF_LUCK";  // 28% — Amuleto da Sorte
    if (roll < 78) return "PICNIC_BASKET";     // 16% — Cesta de Piquenique
    if (roll < 92) return "WEAKNESS_POLICY";  // 14% — Política de Fraqueza
    return "LUCKY_EGG";                        //  8% — Ovo da Sorte
  }
  if (durationKey === "3h") {
    if (roll < 42) return "MASCOT_BUFF_EXP";
    if (roll < 72) return "MASCOT_BUFF_LUCK";
    if (roll < 88) return "PICNIC_BASKET";
    return "WEAKNESS_POLICY";
  }
  // 1h / 30min: apenas buffs comuns
  return roll < 55 ? "MASCOT_BUFF_EXP" : "MASCOT_BUFF_LUCK";
}

async function rollExpeditionReward(
  mascot: { id: string; level: number; statInstinct: number; statCharisma: number },
  durationKey: ExpeditionDuration = "1h",
  allyCount = 0,
  picnicBonusPct = 0,
): Promise<ExpeditionReward> {
  const luckBuff = await prisma.mascotBuff.findFirst({
    where: { mascotId: mascot.id, type: "LUCK_BOOST", expiresAt: { gt: new Date() } }
  });
  const hasLuckBuff = !!luckBuff;
  const dur = EXPEDITION_DURATIONS[durationKey];
  const rewardBonus = dur.rewardBonus; // 0, 5, 15, 30
  const allyBonus = Math.min(20, allyCount * 4);
  const odds = getExpeditionOdds({ duration: durationKey, mode: "STANDARD", level: mascot.level, instinct: mascot.statInstinct, allyCount, luckBuff: hasLuckBuff });
  const luck = odds.luck;
  const roll = Math.random() * 100;

  // Ovo: qualidade requer instinto significativo com stat max=250
  // 6h SPECIAL: luck>90, 3h RARE: luck>60, 1h/30min RARE: luck>85
  let eggType = "COMMON";
  if (durationKey === "6h")                            eggType = luck > 90 ? "SPECIAL" : "RARE";
  else if (durationKey === "3h" && luck > 60)          eggType = "RARE";
  else if ((durationKey === "1h" || durationKey === "30min") && luck > 85) eggType = "RARE";

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
  const cumNothing = Math.max(0, odds.nothing - picnicBonusPct * 2);
  const cumEgg = cumNothing + odds.egg;
  const picnicEggLimit = cumEgg + picnicBonusPct;
  const cumSweet = picnicEggLimit + odds.sweet;
  const cumFood = cumSweet + odds.food;
  const cumCoin = cumFood + odds.coins;
  if (roll < cumNothing) return { type: "NOTHING" };
  if (roll < picnicEggLimit) return { type: "EGG", eggType };
  if (roll < cumSweet) return { type: "FOOD", foodType: "SWEET", quantity: sweetQty * 2 };
  if (roll < cumFood)  return { type: "FOOD", foodType: "FOOD", quantity: randomInt(foodQtyMin, foodQtyMax) * 2 };
  if (roll < cumCoin)  return { type: "COINS", amount: randomInt(odds.coinMin, odds.coinMax) };
  return { type: "BUFF_ITEM", shopItemType: rollBuffItemType(durationKey) };
}

async function rollItemExpeditionReward(
  mascot: { id: string; level: number; statInstinct: number; statCharisma: number },
  durationKey: ExpeditionDuration = "1h",
  allyCount = 0,
  picnicBonusPct = 0,
): Promise<ExpeditionReward> {
  const luckBuff = await prisma.mascotBuff.findFirst({
    where: { mascotId: mascot.id, type: "LUCK_BOOST", expiresAt: { gt: new Date() } }
  });
  const dur = EXPEDITION_DURATIONS[durationKey];
  const rewardBonus = dur.rewardBonus;
  const odds = getExpeditionOdds({ duration: durationKey, mode: "ITEMS", level: mascot.level, instinct: mascot.statInstinct, allyCount, luckBuff: !!luckBuff });
  const luck = odds.luck;
  const allyBonus = Math.min(20, allyCount * 4);

  const roll = Math.random() * 100;

  let eggType = "COMMON";
  if (durationKey === "6h")       eggType = luck > 90 ? "SPECIAL" : "RARE";
  else if (durationKey === "3h")  eggType = luck > 60 ? "RARE" : "COMMON";
  else if (luck > 85)             eggType = "RARE";

  const quantityBase =
    durationKey === "6h" ? 4 :
    durationKey === "3h" ? 3 :
    durationKey === "1h" ? 2 :
    1;
  const bonusQuantity = Math.floor((rewardBonus + allyBonus) / 18);
  const quantity = randomInt(quantityBase, quantityBase + 1 + bonusQuantity);

  if (roll < odds.megaStone) return { type: "MEGA_STONE", shopItemType: rollRandomMegaStoneType() };
  const eggLimit = odds.megaStone + odds.egg + picnicBonusPct;
  const sweetLimit = eggLimit + odds.sweet;
  const foodLimit = sweetLimit + Math.max(0, odds.food - picnicBonusPct * 2);
  if (roll < eggLimit) return { type: "EGG", eggType };
  if (roll < sweetLimit) return { type: "FOOD", foodType: "SWEET", quantity: Math.max(1, Math.floor(quantity / 2)) * 2 };
  if (roll < foodLimit) return { type: "FOOD", foodType: "FOOD", quantity: quantity * 2 };
  return { type: "BUFF_ITEM", shopItemType: rollBuffItemType(durationKey) };
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
    case "BUFF_ITEM": {
      const BUFF_LABELS: Record<string, string> = {
        MASCOT_BUFF_EXP:  "Vitamina Elétrica",
        MASCOT_BUFF_LUCK: "Amuleto da Sorte",
        PICNIC_BASKET:    "Cesta de Piquenique Chocante",
        WEAKNESS_POLICY:  "Política de Fraqueza",
        LUCKY_EGG:        "Ovo da Sorte",
      };
      const label = BUFF_LABELS[reward.shopItemType] ?? "Item Especial";
      return {
        title: `${label} encontrado!`,
        description: "Seu mascote voltou da expedição com um item especial.",
        payload: {
          rewardKind: "MASCOT_BUFF",
          buffType: reward.shopItemType,
          rewardLabel: label,
        }
      };
    }
    case "MEGA_STONE": {
      const stone = getMegaStoneByType(reward.shopItemType);
      const label = stone?.stoneName ?? "Pedra de Mega Evolucao";
      return {
        title: `${label} encontrada!`,
        description: "Seu mascote voltou da expedição de itens com uma pedra de mega evolução raríssima.",
        payload: {
          rewardKind: "MASCOT_BUFF",
          buffType: reward.shopItemType,
          quantity: 1,
          rewardLabel: label,
        }
      };
    }
    case "VACATION":
      return null;
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
  if (mascot.arenaState === "TRACE_HIDING" || mascot.arenaState === "TRACE_HUNTING") throw new Error("Mascote em Caçada de Rastros nao pode sair em expedicao.");
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

  if (durationKey === "7d") throw new Error("Para enviar o mascote de férias, use o Ticket de Férias do Prof. Carvalho no seu inventário.");

  const dur = EXPEDITION_DURATIONS[durationKey];
  const [picnicSpeedBuff, picnicRewardBuff] = await Promise.all([
    prisma.mascotBuff.findFirst({
      where: { type: "PICNIC_SPEED", mascot: { playerId }, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
    prisma.mascotBuff.findFirst({
      where: { type: "PICNIC_BASKET", mascot: { playerId }, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  ]);
  // O resultado fica estável por mascote/modo/duração durante 24h. Cancelar e
  // reiniciar a expedição, portanto, não permite rerrolar até obter um valor maior.
  const rollBucket = Math.floor(Date.now() / 86_400_000);
  const rollSeed = `${mascot.id}:${mode}:${durationKey}:${rollBucket}`;
  let hash = 2166136261;
  for (let index = 0; index < rollSeed.length; index++) {
    hash ^= rollSeed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const stableRandom = () => (hash >>> 0) / 4_294_967_296;
  const agilityTimeReductionPct = rollExpeditionAgilityReduction(mascot.statAgility, stableRandom);
  // A primeira metade sempre transcorre integralmente. Agilidade acelera apenas
  // a segunda metade, então 13% nela equivale a até 6,5% da duração total.
  const firstHalfMs = dur.ms / 2;
  const secondHalfMs = dur.ms / 2;
  const agilityAdjustedDurationMs = firstHalfMs + secondHalfMs * (1 - agilityTimeReductionPct / 100);
  const picnicTimeReductionPct = picnicSpeedBuff ? 30 : 0;
  const effectiveDurationMs = Math.round(agilityAdjustedDurationMs * (1 - picnicTimeReductionPct / 100));
  const finishAt = new Date(Date.now() + effectiveDurationMs);
  return prisma.$transaction(async (tx) => {
    const expedition = await tx.mascotExpedition.create({
      data: {
        mascotId,
        finishAt,
        rewardJson: {
          durationKey,
          mode,
          agilityTimeReductionPct,
          picnicTimeReductionPct,
          totalTimeReductionPct: 100 * (1 - effectiveDurationMs / dur.ms),
          baseDurationMs: dur.ms,
          effectiveDurationMs,
          agilityRollBucket: rollBucket,
          picnicActive: !!picnicRewardBuff,
        },
      },
    });
    if (picnicSpeedBuff) {
      await tx.mascotBuff.deleteMany({ where: { type: "PICNIC_SPEED", mascot: { playerId } } });
    }
    return expedition;
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

    // EXP pela expedição — sem bench penalty (expedição é trabalho do mascote, não interação)
    await addExp(expedition.mascotId, EXP_REWARDS.EXPEDITION, { ignoreBenchPenalty: true });
  });

  return { reward, mascotId: expedition.mascotId };
}

export async function claimExpedition(
  playerId: string,
  expeditionId: string
): Promise<{ reward: ExpeditionReward; mascotId: string; expGained: number; mode: ExpeditionMode; orderClue?: { clueText: string; relatedStepKey: string | null } | null }> {
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
  const picnicActive = stored.picnicActive === true;
  const picnicLootBonusPct = picnicActive ? (mode === "ITEMS" ? 3 : mode === "STANDARD" ? 1.5 : 0) : 0;
  const dur = EXPEDITION_DURATIONS[durationKey];

  if (mode === "VACATION") {
    const vacationReward = await claimVacation(playerId, expeditionId);
    return {
      mascotId: expedition.mascotId,
      expGained: vacationReward.expBonus,
      mode,
      reward: {
        type: "VACATION",
        expBonus: vacationReward.expBonus,
        gotEgg: vacationReward.gotEgg,
      },
    };
  }

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
      ? await rollItemExpeditionReward(expedition.mascot, durationKey, allyCount, picnicLootBonusPct)
      : await rollExpeditionReward(expedition.mascot, durationKey, allyCount, picnicLootBonusPct);

  // EXP: base × duração × nível × bônus social
  const expBase = EXP_REWARDS.EXPEDITION;
  const levelMult = 1 + Math.floor(expedition.mascot.level / 20) * 0.25;
  const allyExpBonus = 1 + allyCount * 0.1;
  // Bônus de rival em expedição escalado por tier (§12.1 do doc social)
  const rivalRelsExp = await prisma.mascotRelation.findMany({
    where: { mascotAId: expedition.mascotId, type: "RIVAL" },
    select: { interactionCount: true },
  });
  const rivalCount = rivalRelsExp.length;
  const hasDirectRivalExp = rivalRelsExp.some(r => r.interactionCount >= 3);
  const perRivalBonus = hasDirectRivalExp ? 0.10 : (rivalCount > 0 ? 0.05 : 0);
  const rivalBonus = 1.0 + Math.min(perRivalBonus * rivalCount, 0.15); // cap +15%
  const expMult = mode === "TRAINING"
    ? TRAINING_EXP_MULT[durationKey]
    : mode === "ITEMS" ? 0 : dur.expMultiplier;
  // Ovo da Sorte: +EXP% na próxima expedição de TRAINING (apenas modo TRAINING)
  const luckyEggBuff = mode === "TRAINING" ? await prisma.mascotBuff.findFirst({
    where: { mascotId: expedition.mascotId, type: "LUCKY_EGG", expiresAt: { gt: new Date() } }
  }) : null;

  // Vitamina Elétrica e Cesta de Piquenique: incluídas no cálculo para que o log/modal reflita o valor real
  const expBoostBuff = await prisma.mascotBuff.findFirst({
    where: { mascotId: expedition.mascotId, type: "EXP_BOOST", expiresAt: { gt: new Date() } },
  });
  const [luckyEggMeta, expBoostMeta] = await Promise.all([
    luckyEggBuff  ? getShopItemMeta("LUCKY_EGG")       : null,
    expBoostBuff  ? getShopItemMeta("MASCOT_BUFF_EXP") : null,
  ]);

  const luckyEggMult  = luckyEggBuff  ? 1 + ((luckyEggMeta  as { expMultiplierPct?: number } | null)?.expMultiplierPct ?? 20) / 100 : 1.0;
  const expBoostMult  = expBoostBuff  ? 1 + ((expBoostMeta  as { expMultiplierPct?: number } | null)?.expMultiplierPct ?? 25) / 100 : 1.0;
  const picnicExpMult = picnicActive
    ? mode === "TRAINING" ? 1.25 : mode === "STANDARD" ? 1.12 : 1
    : 1;

  const expeditionExp = Math.round(expBase * expMult * levelMult * allyExpBonus * rivalBonus * luckyEggMult * expBoostMult * picnicExpMult);

  // Reward final — TRAINING usa tipo especial com EXP para exibir no modal
  const reward: ExpeditionReward = mode === "TRAINING"
    ? { type: "TRAINING", exp: expeditionExp, durationLabel: dur.label }
    : (baseReward ?? { type: "NOTHING" as const });
  if (reward.type === "MEGA_STONE") {
    await ensureMegaStoneShopItems(false);
  }
  const gift = mode === "TRAINING" ? null : describeExpeditionReward(reward);
  const storedRewardJson: Record<string, Prisma.InputJsonValue> = {
    ...reward,
    mode,
    durationKey,
  };
  if (reward.type === "MEGA_STONE") {
    storedRewardJson.megaStoneDropChance = getMegaStoneExpeditionChance(expedition.mascot.statInstinct) / 100;
  }

  await prisma.$transaction(async (tx) => {
    await tx.mascotExpedition.update({
      where: { id: expeditionId },
      data: { status: "CLAIMED", rewardJson: storedRewardJson as Prisma.InputJsonObject }
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
              quantity: 2,
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

    }
    if (durationKey === "3h" || durationKey === "6h") {
      const syncDrop = await maybeDropSyncTicket(tx, playerId, durationKey === "3h" ? "expedition-3h" : "expedition-6h");
      if (syncDrop) {
        await tx.mascotEvent.create({
          data: {
            mascotId: expedition.mascotId,
            emoji: "DS",
            description: `Encontrou uma metade de ticket do Desafio Sincronizado na expedição de ${dur.label}.`,
          },
        }).catch(() => null);
      }
    }
  }, { timeout: 20000, maxWait: 10000 });

  for (const rel of friends) {
    const friendName = rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId);
    if (mode !== "ITEMS") {
      await addExp(rel.mascotB.id, Math.round(EXP_REWARDS.EXPEDITION * 0.3), { ignoreBenchPenalty: true }).catch(() => {});
    }
    await logEvent(rel.mascotB.id, "ALLY", `Apoiou ${expeditorName} em expedicao de ${dur.label} e ganhou recompensa!`).catch(() => {});
    await logEvent(expedition.mascotId, "ALLY", `${friendName} apoiou e turbinou a expedicao! (+${Math.round(allyExpBonus * 100 - 100)}% EXP)`).catch(() => {});
  }

  if (expeditionExp > 0) {
    // ignoreBenchPenalty: expedição é esforço do mascote, não interação presencial
    // ignoreExpBoost: buffs já incluídos no cálculo de expeditionExp acima (para log correto)
    await addExp(expedition.mascotId, expeditionExp, { ignoreBenchPenalty: true, ignoreExpBoost: true }).catch(() => {});
    if (mode === "STANDARD") {
      await logEvent(
        expedition.mascotId,
        "✨",
        `Expedição padrão de ${dur.label} concluída! +${expeditionExp} EXP.`,
      );
    }
  }

  const orderClue = await maybeRevealOrderClueFromExpedition({
    playerId,
    mascotId: expedition.mascotId,
    durationKey,
    mode,
  }).catch(() => null);

  // Ovo da Sorte: consome o buff após uso (1x por dia)
  if (luckyEggBuff) {
    await prisma.mascotBuff.delete({ where: { id: luckyEggBuff.id } }).catch(() => {});
  }

  // Compartilhadores: individual (50%) ou geral (10% aos outros favoritos).
  if (mode === "TRAINING" && expeditionExp > 0) {
    const equippedShare = await prisma.mascotBuff.findFirst({
      where: {
        type: { in: ["XP_SHARE", "XP_SHARE_TEAM"] },
        mascot: { playerId },
        expiresAt: { gt: new Date("2090-01-01") },
      },
      select: { type: true, mascotId: true },
    }).catch(() => null);
    if (equippedShare?.type === "XP_SHARE" && equippedShare.mascotId !== expedition.mascotId) {
      const sharedExp = Math.floor(expeditionExp / 2);
      await addExp(equippedShare.mascotId, sharedExp, { ignoreBenchPenalty: true }).catch(() => {});
      await logEvent(equippedShare.mascotId, "📡", `Recebeu ${sharedExp} EXP via Compartilhador de XP!`).catch(() => {});
    } else if (equippedShare?.type === "XP_SHARE_TEAM") {
      const sharedExp = Math.floor(expeditionExp * 0.1);
      const favorites = await prisma.mascot.findMany({
        where: { playerId, isFavorite: true, id: { not: expedition.mascotId } },
        select: { id: true },
        take: 10,
      });
      for (const favorite of favorites) {
        await addExp(favorite.id, sharedExp, { ignoreBenchPenalty: true }).catch(() => {});
        await logEvent(favorite.id, "📡", `Recebeu ${sharedExp} EXP via Compartilhador Geral!`).catch(() => {});
      }
    }
  }

  return {
    reward,
    mascotId: expedition.mascotId,
    expGained: expeditionExp,
    mode,
    orderClue: orderClue
      ? { clueText: orderClue.clueText, relatedStepKey: orderClue.relatedStepKey }
      : null,
  };
}

// ── Evento de log ─────────────────────────────────────────────────────────────

async function logEvent(mascotId: string, emoji: string, description: string) {
  await prisma.mascotEvent.create({ data: { mascotId, emoji, description } }).catch(() => {});
}

/**
 * Versão probabilística para eventos puramente cosméticos/narrativos
 * (sem efeito real no jogo). Reduz writes sem perder eventos importantes.
 * Grava apenas 1 em cada 3 chamadas.
 */
async function logEventMaybe(mascotId: string, emoji: string, description: string) {
  if (Math.random() > 0.33) return; // pula ~67% das vezes
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

// ── Limites diários de eventos negativos por mascote (§11 doc social) ─────────
// Mantidos em memória; resetam a cada dia
const _dailyNegEvents = new Map<string, { day: string; count: number }>();
const _dailyExpDelay  = new Map<string, { day: string; min: number }>();
const _dailySocialCd  = new Map<string, { day: string; min: number }>();

function _today() { return new Date().toISOString().slice(0, 10); }

function _canNegEvent(id: string): boolean {
  const e = _dailyNegEvents.get(id);
  return !e || e.day !== _today() || e.count < 2; // max 2 eventos negativos/dia
}
function _incNegEvent(id: string) {
  const today = _today();
  const e = _dailyNegEvents.get(id);
  if (!e || e.day !== today) _dailyNegEvents.set(id, { day: today, count: 1 });
  else e.count++;
}
/** Retorna quantos minutos de delay ainda cabem no dia (cap 45 min). */
function _allowedExpDelay(id: string, requested: number): number {
  const today = _today();
  const e = _dailyExpDelay.get(id);
  const used = (!e || e.day !== today) ? 0 : e.min;
  return Math.min(requested, Math.max(0, 45 - used));
}
function _trackExpDelay(id: string, min: number) {
  const today = _today();
  const e = _dailyExpDelay.get(id);
  if (!e || e.day !== today) _dailyExpDelay.set(id, { day: today, min });
  else e.min += min;
}
/** Retorna quantos minutos de trava social ainda cabem no dia (cap 30 min). */
function _allowedSocialCd(id: string, requested: number): number {
  const today = _today();
  const e = _dailySocialCd.get(id);
  const used = (!e || e.day !== today) ? 0 : e.min;
  return Math.min(requested, Math.max(0, 30 - used));
}
function _trackSocialCd(id: string, min: number) {
  const today = _today();
  const e = _dailySocialCd.get(id);
  if (!e || e.day !== today) _dailySocialCd.set(id, { day: today, min });
  else e.min += min;
}

// Throttle: eventos sociais automáticos rodam no máximo 1x por hora
let _lastSocialEventRun = 0;
const SOCIAL_EVENT_THROTTLE_MS = 30 * 60 * 1000; // 30 minutos

export async function triggerSocialEvents(): Promise<SocialEventSummary> {
  // Throttle in-process (evita múltiplos fire-and-forget simultâneos)
  const now = Date.now();
  if (now - _lastSocialEventRun < SOCIAL_EVENT_THROTTLE_MS) {
    return { battles: 0, friendships: 0, events: [] };
  }
  _lastSocialEventRun = now;

  // Pega apenas os 40 mascotes mais recentemente interagidos (limita a query)
  const allMascots = await prisma.mascot.findMany({
    where: { player: { user: { role: "PLAYER" } } },
    select: {
      id: true, pokemonId: true, nickname: true, playerId: true,
      statForce: true, statAgility: true, statVitality: true,
      statCharisma: true, statInstinct: true,
      happiness: true, mood: true, level: true,
      restingUntil: true, arenaState: true,
      player: { select: { displayName: true } },
    },
    orderBy: { lastInteractedAt: "desc" },
    take: 40,
  });

  if (allMascots.length < 2) return { battles: 0, friendships: 0, events: [] };

  const summary: SocialEventSummary = { battles: 0, friendships: 0, events: [] };
  const shuffled = [...allMascots].sort(() => Math.random() - 0.5);
  const maxPairs = Math.min(10, Math.floor(allMascots.length / 2));
  const usedIds = new Set<string>();

  for (let i = 0; i < shuffled.length && summary.battles + summary.friendships < maxPairs; i++) {
    const a = shuffled[i];
    if (usedIds.has(a.id)) continue;
    const partner = shuffled.find(b => b.id !== a.id && b.playerId !== a.playerId && !usedIds.has(b.id));
    if (!partner) continue;
    usedIds.add(a.id);
    usedIds.add(partner.id);

    const aName = `${a.nickname ?? getPokemonName(a.pokemonId)} (${a.player.displayName})`;
    const bName = `${partner.nickname ?? getPokemonName(partner.pokemonId)} (${partner.player.displayName})`;
    // Distribuição §8: 45% batalha, 35% amizade, 20% neutro
    // Carisma médio aumenta chance de amizade em até +5%
    const avgCarisma = ((a.statCharisma ?? 10) + (partner.statCharisma ?? 10)) / 2;
    const carismaBias = Math.min(0.05, avgCarisma / 500);
    const eventRoll2 = Math.random();
    const isBattle  = eventRoll2 < (0.45 - carismaBias);
    const isNeutral = eventRoll2 >= (0.80 + carismaBias);

    if (isBattle) {
      try {
        const result = await battleMascots(a.id, partner.id);
        summary.battles++;
        summary.events.push(`⚔️ ${result.summary}`);
      } catch { /* ignora */ }
    } else if (isNeutral) {
      // Evento neutro — apenas narrativo
      const neutralTexts = [
        `${aName} e ${bName} se cruzaram num torneio e cada um seguiu o seu caminho.`,
        `${aName} notou ${bName} de longe. Por agora, nada aconteceu.`,
        `${aName} e ${bName} estavam no mesmo lugar ao mesmo tempo — apenas coincidência.`,
        `${aName} espiou ${bName} discretamente, mas não agiu.`,
        `${aName} e ${bName} trocaram um olhar rápido antes de seguir em frente.`,
      ];
      const neutralMsg = neutralTexts[Math.floor(Math.random() * neutralTexts.length)];
      await Promise.all([
        logEventMaybe(a.id, "👀", neutralMsg),
        logEventMaybe(partner.id, "👀", neutralMsg),
      ]).catch(() => {});
      summary.events.push(`👀 ${aName} e ${bName} — evento neutro`);
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
          logEventMaybe(a.id, "💚", msg),
          logEventMaybe(partner.id, "💚", pickText(SOCIAL_TEXTS.ally_cheer, bName, aName)),
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
      mascotA: { select: { id: true, pokemonId: true, nickname: true, playerId: true, arenaState: true, level: true, player: { select: { displayName: true } } } },
      mascotB: {
        select: { id: true, pokemonId: true, nickname: true, playerId: true,
                  player: { select: { displayName: true } },
                  arenaState: true, mood: true, happiness: true, restingUntil: true,
                  statAgility: true, statVitality: true,
                  expeditions: { where: { status: "ACTIVE" }, take: 1 } }
      },
    },
    orderBy: { interactionCount: "desc" },
    take: 10,
  });

  for (const rel of rivalPairs) {
    if (!rel.mascotA || !rel.mascotB) continue;
    const aName = `${rel.mascotA.nickname ?? getPokemonName(rel.mascotA.pokemonId)} (${rel.mascotA.player.displayName})`;
    const bName = `${rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId)} (${rel.mascotB.player.displayName})`;
    const isArchRival = rel.interactionCount >= 3;

    // Sorteia o tipo de evento rival (pesos diferentes)
    const eventRoll = Math.random();
    let rivalEvent: string;

    // Pula se mascote alvo já atingiu limite de eventos negativos do dia
    const bVitality  = rel.mascotB.statVitality  ?? 10;
    const bAgility   = rel.mascotB.statAgility   ?? 10;

    if (isArchRival && eventRoll < 0.15) {
      // Rival Direto: trava interações do alvo por 15-30 min
      // Vitalidade do alvo reduz duração (§13: resiste a atordoamento)
      const rawStun = randomInt(15, 30);
      const vitalityDiscount = Math.floor(bVitality / 20); // -1 min por 20 de vitalidade
      const stunMin = _allowedSocialCd(rel.mascotB.id, Math.max(5, rawStun - vitalityDiscount));
      if (stunMin > 0 && _canNegEvent(rel.mascotB.id)) {
        const stunUntil = new Date(Date.now() + stunMin * 60_000);
        await prisma.mascot.update({
          where: { id: rel.mascotB.id },
          data: { socialCooldownUntil: stunUntil, mood: "ANGRY" as MascotMood }
        }).catch(() => {});
        _trackSocialCd(rel.mascotB.id, stunMin);
        _incNegEvent(rel.mascotB.id);
        rivalEvent = pickText(SOCIAL_TEXTS.rival_stun, aName, bName);
        summary.events.push(`😠 ${aName} travou ${bName} por ${stunMin}min!`);
      } else {
        rivalEvent = `${aName} tentou atrapalhar ${bName}, mas ${bName} resistiu! (limite diário atingido)`;
        summary.events.push(`🛡️ ${bName} resistiu ao ataque de ${aName}`);
      }

    } else if (eventRoll < 0.25 && rel.mascotB.expeditions.length > 0) {
      // Atrasa expedição ativa em 15-25 min
      // Agilidade do alvo reduz atraso (§13: evita armadilhas)
      const expedition = rel.mascotB.expeditions[0];
      const rawDelay = randomInt(15, 25);
      const agilityDiscount = Math.floor(bAgility / 15);
      const delayMin = _allowedExpDelay(rel.mascotB.id, Math.max(5, rawDelay - agilityDiscount));
      if (delayMin > 0 && _canNegEvent(rel.mascotB.id)) {
        await prisma.mascotExpedition.update({
          where: { id: expedition.id },
          data: { finishAt: new Date(new Date(expedition.finishAt).getTime() + delayMin * 60_000) }
        }).catch(() => {});
        _trackExpDelay(rel.mascotB.id, delayMin);
        _incNegEvent(rel.mascotB.id);
        rivalEvent = pickText(SOCIAL_TEXTS.rival_expedition_delay, aName, bName);
        summary.events.push(`🌪️ ${aName} atrasou a expedição de ${bName} em ${delayMin}min!`);
      } else {
        rivalEvent = `${bName} estava preparado e evitou o sabotador ${aName}!`;
        summary.events.push(`🛡️ ${bName} esquivou da sabotagem de ${aName}`);
      }

    } else if (eventRoll < 0.40) {
      // Irrita (muda humor para ANGRY)
      if (_canNegEvent(rel.mascotB.id)) {
        await prisma.mascot.update({
          where: { id: rel.mascotB.id },
          data: { mood: "ANGRY" as MascotMood, happiness: { decrement: 5 } }
        }).catch(() => {});
        _incNegEvent(rel.mascotB.id);
        rivalEvent = pickText(SOCIAL_TEXTS.rival_irritate, aName, bName);
        summary.events.push(`😠 ${aName} provocou ${bName}!`);
      } else {
        rivalEvent = `${aName} tentou provocar ${bName}, mas ${bName} ignorou.`;
        summary.events.push(`😑 ${bName} ignorou ${aName}`);
      }

    } else if (isArchRival && eventRoll < 0.55) {
      // Rival Direto: motivação competitiva (EXP para A — não é roubo real de B)
      const bonusExp = randomInt(3, 10);
      await addExp(rel.mascotA.id, bonusExp).catch(() => {});
      rivalEvent = pickText(SOCIAL_TEXTS.rival_steal_exp, aName, bName)
        .replace(/roubou.*EXP.*de/i, "se motivou ao rivalizar com")
        || `${aName} se motivou intensamente rivalizando com ${bName} e ganhou +${bonusExp} EXP!`;
      summary.events.push(`🔥 ${aName} ganhou motivação competitiva de rivalizar com ${bName} (+${bonusExp} EXP)`);

    } else if (eventRoll < 0.50 && rel.mascotB.expeditions.length > 0) {
      // 🪤 Armadilha leve na rota (rival comum, atraso menor)
      const expedition = rel.mascotB.expeditions[0];
      const rawDelay = randomInt(5, 15);
      const agilityDiscount = Math.floor(bAgility / 20);
      const delayMin = _allowedExpDelay(rel.mascotB.id, Math.max(2, rawDelay - agilityDiscount));
      if (delayMin > 0 && _canNegEvent(rel.mascotB.id)) {
        await prisma.mascotExpedition.update({
          where: { id: expedition.id },
          data: { finishAt: new Date(new Date(expedition.finishAt).getTime() + delayMin * 60_000) }
        }).catch(() => {});
        _trackExpDelay(rel.mascotB.id, delayMin);
        _incNegEvent(rel.mascotB.id);
        rivalEvent = pickText(SOCIAL_TEXTS.rival_trap_small, aName, bName);
        summary.events.push(`🪤 ${aName} armou uma armadilha leve para ${bName} (+${delayMin}min)`);
      } else {
        rivalEvent = `${bName} detectou a armadilha de ${aName} a tempo e desviou!`;
        summary.events.push(`🛡️ ${bName} detectou armadilha de ${aName}`);
      }

    } else if (eventRoll < 0.65 && rel.mascotB.arenaState === "ARENA") {
      // 🧲 Isca de Loot — alvo na Arena, rival espreitando o cofre
      if (_canNegEvent(rel.mascotB.id)) {
        await prisma.mascot.update({
          where: { id: rel.mascotB.id },
          data: { happiness: { decrement: 5 } }
        }).catch(() => {});
        _incNegEvent(rel.mascotB.id);
        rivalEvent = pickText(SOCIAL_TEXTS.rival_loot_eye, aName, bName);
        summary.events.push(`🧲 ${aName} está de olho no loot de ${bName}`);
      } else {
        rivalEvent = `${aName} espreitou ${bName} na Arena, mas não conseguiu mais incomodar por hoje.`;
        summary.events.push(`👁️ ${aName} espreitou ${bName} (sem efeito)`);
      }

    } else if (isArchRival && eventRoll < 0.75 &&
               (rel.mascotB.arenaState === "INJURED" || rel.mascotB.arenaState === "RESTING")) {
      // 💢 Ferida no Orgulho — Rival Direto agrava recuperação (Vitalidade resiste)
      const rawExtra = randomInt(10, 20);
      const vitalityDiscount = Math.floor(bVitality / 15);
      const extraMin = Math.max(5, rawExtra - vitalityDiscount);
      if (_canNegEvent(rel.mascotB.id) && rel.mascotB.restingUntil) {
        const newRest = new Date(new Date(rel.mascotB.restingUntil).getTime() + extraMin * 60_000);
        await prisma.mascot.update({
          where: { id: rel.mascotB.id },
          data: { mood: "ANGRY" as MascotMood, restingUntil: newRest }
        }).catch(() => {});
        _incNegEvent(rel.mascotB.id);
      } else if (_canNegEvent(rel.mascotB.id)) {
        await prisma.mascot.update({ where: { id: rel.mascotB.id }, data: { mood: "ANGRY" as MascotMood } }).catch(() => {});
        _incNegEvent(rel.mascotB.id);
      }
      rivalEvent = pickText(SOCIAL_TEXTS.rival_wound_pride, aName, bName);
      summary.events.push(`💢 ${aName} perturbou a recuperação de ${bName} (+${extraMin}min)`);

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

    // Eventos com efeito real já foram logados acima; aqui chegam apenas cosméticos
    const hasRealEffect = eventRoll < 0.65 || (isArchRival && eventRoll < 0.75);
    const logFn = hasRealEffect ? logEvent : logEventMaybe;
    await Promise.all([
      logFn(rel.mascotA.id, "😤", rivalEvent).catch(() => {}),
      logFn(rel.mascotB.id, "😤", rivalEvent).catch(() => {}),
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
      mascotA: { select: { id: true, pokemonId: true, nickname: true, playerId: true, happiness: true, isEquipped: true, arenaState: true, player: { select: { displayName: true } } } },
      mascotB: {
        select: { id: true, pokemonId: true, nickname: true, playerId: true,
                  player: { select: { displayName: true } },
                  happiness: true, isEquipped: true, arenaState: true,
                  restingUntil: true, susRestBonusMinutes: true,
                  expeditions: { where: { status: "ACTIVE" }, take: 1 } }
      },
    },
    orderBy: { interactionCount: "desc" },
    take: 10,
  });

  for (const rel of friendPairs) {
    if (!rel.mascotA || !rel.mascotB) continue;
    const aName = `${rel.mascotA.nickname ?? getPokemonName(rel.mascotA.pokemonId)} (${rel.mascotA.player.displayName})`;
    const bName = `${rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId)} (${rel.mascotB.player.displayName})`;
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

    // Eventos com efeito real (presentes, redução de repouso, boost de EXP) sempre logam
    // Eventos cosméticos (best_friend_general, ally_general) usam logEventMaybe
    const allyHasEffect = eventRoll < 0.50;
    const allyLogFn = allyHasEffect ? logEvent : logEventMaybe;
    await Promise.all([
      allyLogFn(rel.mascotA.id, isBestFriend ? "💛" : "💚", allyEvent).catch(() => {}),
      allyLogFn(rel.mascotB.id, isBestFriend ? "💛" : "💚", allyEvent).catch(() => {}),
    ]);
    await prisma.mascotRelation.update({
      where: { id: rel.id },
      data: { interactionCount: { increment: 1 } }
    }).catch(() => {});
  }

  // ── Limpeza: manter apenas as 5 relações mais ativas por mascote ────────────
  // Roda de forma silenciosa para não bloquear o retorno
  pruneExcessRelations().catch(() => {});

  return summary;
}

/**
 * Remove relações excedentes: mantém no máximo 10 por mascote (as com mais interações).
 * Roda uma vez por ciclo de eventos sociais para manter a tabela enxuta.
 */
async function pruneExcessRelations(): Promise<void> {
  const MAX_RELATIONS = 10;
  // Pega IDs de mascotes que têm mais de MAX_RELATIONS relações
  const counts = await prisma.mascotRelation.groupBy({
    by: ["mascotAId"],
    _count: { id: true },
    having: { id: { _count: { gt: MAX_RELATIONS } } },
  });

  for (const row of counts) {
    // Busca as relações ordenadas pelas menos interativas (as que serão deletadas)
    const all = await prisma.mascotRelation.findMany({
      where: { mascotAId: row.mascotAId },
      orderBy: { interactionCount: "desc" },
      select: { id: true },
    });
    const toDelete = all.slice(MAX_RELATIONS).map(r => r.id);
    if (toDelete.length > 0) {
      await prisma.mascotRelation.deleteMany({ where: { id: { in: toDelete } } }).catch(() => {});
    }
  }
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

/** Cesta de Piquenique: acelera a próxima expedição e melhora as iniciadas nas próximas 3h. */
export async function applyPicnicBasket(playerId: string) {
  const mascots = await prisma.mascot.findMany({ where: { playerId }, select: { id: true } });
  if (mascots.length === 0) throw new Error("Nenhum mascote encontrado.");
  const mascotIds = mascots.map((mascot) => mascot.id);
  const rewardExpiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const speedExpiresAt = new Date("2099-12-31T23:59:59Z");
  await prisma.$transaction(async (tx) => {
    await tx.mascotBuff.deleteMany({
      where: { mascotId: { in: mascotIds }, type: { in: ["PICNIC_BASKET", "PICNIC_SPEED"] } },
    });
    await tx.mascotBuff.createMany({
      data: mascotIds.flatMap((id) => [
        { mascotId: id, type: "PICNIC_BASKET" as const, expiresAt: rewardExpiresAt },
        { mascotId: id, type: "PICNIC_SPEED" as const, expiresAt: speedExpiresAt },
      ]),
    });
  });
  return mascots.length;
}

/** Ticket de Férias: envia Pokémon com o Professor Carvalho pelos dias configurados no shop */
export async function applyVacationTicket(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId },
    include: { expeditions: { where: { status: "ACTIVE" }, take: 1 } }
  });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.arenaState !== "FREE") throw new Error("Mascote deve estar livre para ir de férias.");
  if (mascot.expeditions.length > 0) throw new Error("Mascote está em expedição. Conclua antes das férias.");
  const shopItem = await prisma.shopItem.findFirst({ where: { type: "VACATION_TICKET", active: true } });
  const meta = (shopItem?.metadata ?? {}) as Record<string, number>;
  const vacationDays = meta.vacationDays ?? 7;
  const finishAt = new Date(Date.now() + vacationDays * 24 * 60 * 60 * 1000);
  await prisma.mascotExpedition.create({
    data: { mascotId, finishAt, status: "ACTIVE", rewardJson: { durationKey: `${vacationDays}d`, mode: "VACATION" } }
  });
  await logEvent(mascotId, "🏖️", `Partiu de férias com o Professor Carvalho por ${vacationDays} dias! Volta em ${finishAt.toLocaleDateString("pt-BR")}.`);
}

/** Coleta as Férias: retorna o Pokémon revigorado com felicidade máxima, empanturrado e EXP configurado no shop */
export async function claimVacation(playerId: string, expeditionId: string) {
  const expedition = await prisma.mascotExpedition.findUnique({
    where: { id: expeditionId },
    include: { mascot: true }
  });
  if (!expedition || expedition.mascot.playerId !== playerId) throw new Error("Expedição não encontrada.");
  if (expedition.status !== "ACTIVE") throw new Error("Férias já coletadas.");
  if (new Date() < expedition.finishAt) throw new Error("As férias ainda não terminaram.");

  const shopItem = await prisma.shopItem.findFirst({ where: { type: "VACATION_TICKET", active: true } });
  const meta = (shopItem?.metadata ?? {}) as Record<string, number>;
  const expBonus = 4000 + Math.max(0, expedition.mascot.level - 1) * 10;
  const eggChancePct = meta.eggChancePct ?? 30;
  const gotEgg = Math.random() * 100 < eggChancePct;

  await prisma.$transaction(async (tx) => {
    await tx.mascotExpedition.update({
      where: { id: expeditionId },
      data: { status: "CLAIMED", rewardJson: { type: "VACATION", expBonus, gotEgg } }
    });
    await tx.mascot.update({
      where: { id: expedition.mascotId },
      data: {
        happiness: 100,
        mood: "HAPPY",
        lastFedAt: new Date(), // EMPANTURRADO: volta bem alimentado
      }
    });
    if (gotEgg) {
      await tx.mascotEgg.create({
        data: { playerId, type: "COMMON", origin: "VACATION" }
      });
    }
    await tx.mascotEvent.create({
      data: {
        mascotId: expedition.mascotId,
        emoji: "🌴",
        description: `Voltou das férias com o Professor Carvalho! Felicidade máxima, empanturrado e +${expBonus} EXP.${gotEgg ? " Trouxe um Ovo Comum de presente! 🥚" : ""}`
      }
    });
  });

  await addExp(expedition.mascotId, expBonus, { ignoreBenchPenalty: true });
  return { expBonus, gotEgg };
}

/** Compartilhador de XP: equipa em Pokémon fora de expedição (1 por jogador) */
export async function applyXpShare(playerId: string, mascotId: string, type: "XP_SHARE" | "XP_SHARE_TEAM") {
  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId },
    include: { expeditions: { where: { status: "ACTIVE" }, take: 1 } }
  });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.expeditions.length > 0) throw new Error("Não pode equipar em mascote em expedição.");
  await prisma.$transaction(async (tx) => {
    await tx.mascotBuff.deleteMany({
      where: {
        type: { in: ["XP_SHARE", "XP_SHARE_TEAM"] },
        mascot: { playerId },
        expiresAt: { gt: new Date("2090-01-01") },
      },
    });
    await tx.mascotBuff.create({
      data: { mascotId, type, expiresAt: new Date("2099-12-31T23:59:59Z") },
    });
  });
  await logEvent(mascotId, "📡", type === "XP_SHARE"
    ? "Compartilhador de XP equipado: receberá 50% da EXP de Treinamento."
    : "Compartilhador Geral equipado: outros favoritos receberão 10% da EXP de Treinamento.");
}

/** Remove Compartilhador de XP do Pokémon */
export async function removeXpShare(playerId: string, mascotId: string) {
  const buff = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: { in: ["XP_SHARE", "XP_SHARE_TEAM"] }, mascot: { playerId }, expiresAt: { gt: new Date("2090-01-01") } }
  });
  if (!buff) throw new Error("Compartilhador de XP não encontrado neste mascote.");
  await prisma.mascotBuff.delete({ where: { id: buff.id } });
  await logEvent(mascotId, "📡", "Compartilhador de XP removido.");
  return buff.type;
}

const RAINBOW_FEATHER_BASE_FORM_OVERRIDES: Readonly<Record<number, number>> = {
  // Ramificações que não fazem parte do mapa simplificado de evolução.
  135: 133, 136: 133, 196: 133, 197: 133, 470: 133, 471: 133, 700: 133,
  186: 60,
  199: 79,
  902: 550,
  980: 194,
  // Evoluções regionais cuja base pertence a outra forma.
  10100: 172,
  10114: 102,
  10115: 104,
  10169: 10161,
  10233: 155,
  10236: 501,
  10237: 548,
  10240: 627,
  10241: 704,
  10242: 704,
  10243: 712,
  10244: 722,
};

function getRainbowFeatherBaseForm(pokemonId: number): number {
  const megaStone = getMegaStoneForMegaPokemon(pokemonId);
  let current = megaStone?.compatiblePokemonId ?? pokemonId;
  const overriddenBase = RAINBOW_FEATHER_BASE_FORM_OVERRIDES[current];
  if (overriddenBase) current = overriddenBase;

  const seen = new Set<number>();
  while (!seen.has(current)) {
    seen.add(current);
    const previous = EVOLUTION_REVERSE_MAP.get(current)?.[0];
    if (!previous) break;
    current = previous.from;
  }
  return current;
}

/**
 * Corrige usos feitos por uma Server Action antiga ainda aberta no navegador
 * durante uma troca de deploy. A ação nova já desevolui no mesmo transaction.
 */
export async function repairRecentRainbowFeatherDevolutions(playerId: string): Promise<number> {
  const since = new Date(Date.now() - 6 * 60 * 60_000);
  const recentUses = await prisma.mascotEvent.findMany({
    where: {
      emoji: "🌈",
      createdAt: { gte: since },
      mascot: { playerId, level: 1 },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      mascot: {
        select: {
          id: true,
          pokemonId: true,
          level: true,
          evolutionLocked: true,
        },
      },
    },
  });

  const repairs = new Map<string, {
    eventId: string;
    pokemonId: number;
    basePokemonId: number;
    evolutionLocked: boolean;
  }>();
  for (const use of recentUses) {
    if (repairs.has(use.mascot.id)) continue;
    const basePokemonId = getRainbowFeatherBaseForm(use.mascot.pokemonId);
    if (basePokemonId === use.mascot.pokemonId) continue;
    repairs.set(use.mascot.id, {
      eventId: use.id,
      pokemonId: use.mascot.pokemonId,
      basePokemonId,
      evolutionLocked: use.mascot.evolutionLocked,
    });
  }
  if (repairs.size === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const [mascotId, repair] of repairs) {
      await tx.mascot.update({
        where: { id: mascotId },
        data: { pokemonId: repair.basePokemonId, evolutionLocked: false },
      });
      await tx.mascotProgressMilestone.deleteMany({ where: { mascotId } });
      await tx.auditLog.create({
        data: {
          entityType: "mascot",
          entityId: mascotId,
          action: "rainbow_feather.devolution_auto_repair",
          before: {
            pokemonId: repair.pokemonId,
            level: 1,
            evolutionLocked: repair.evolutionLocked,
          },
          after: {
            pokemonId: repair.basePokemonId,
            level: 1,
            evolutionLocked: false,
            progressMilestones: [],
          },
          metadata: {
            reason: "Uso recente processado por Server Action anterior ao deploy da desevolução",
            sourceEventId: repair.eventId,
          },
        },
      });
    }
  });
  return repairs.size;
}

/**
 * Recupera uma Pena Primordial consumida por uma versão antiga da Server Action.
 * A combinação item administrativo zerado + marcador ausente + evento logo após
 * a concessão identifica o caso sem alterar resets normais.
 */
export async function repairRecentPrimordialFeatherReset(playerId: string): Promise<number> {
  const inventory = await prisma.playerInventory.findUnique({
    where: {
      playerId_itemId: {
        playerId,
        itemId: "admin-lab-rainbow-feather",
      },
    },
    select: { quantity: true, purchasedAt: true, source: true },
  });
  if (!inventory || inventory.quantity > 0 || inventory.source !== "ADMIN_GRANT") return 0;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { adminLabFeatherUsedAt: true },
  });
  if (!player || player.adminLabFeatherUsedAt) return 0;

  const deadline = new Date(inventory.purchasedAt.getTime() + 30 * 60_000);
  const use = await prisma.mascotEvent.findFirst({
    where: {
      emoji: "🌈",
      createdAt: { gte: inventory.purchasedAt, lte: deadline },
      mascot: {
        playerId,
        level: 1,
        hatchedFromEggType: null,
        hatchedFromEggOrigin: null,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      mascot: {
        select: {
          id: true,
          pokemonId: true,
          statForce: true,
          statAgility: true,
          statCharisma: true,
          statInstinct: true,
          statVitality: true,
        },
      },
    },
  });
  if (!use) return 0;

  const [statMin, statMax] = EGG_STAT_RANGES.LAB;
  const newStats = {
    statForce: randomInt(statMin, statMax),
    statAgility: randomInt(statMin, statMax),
    statCharisma: randomInt(statMin, statMax),
    statInstinct: randomInt(statMin, statMax),
    statVitality: randomInt(statMin, statMax),
  };
  const repaired = await prisma.$transaction(async (tx) => {
    const marked = await tx.player.updateMany({
      where: { id: playerId, adminLabFeatherUsedAt: null },
      data: { adminLabFeatherUsedAt: use.createdAt },
    });
    if (marked.count !== 1) return false;

    const updated = await tx.mascot.updateMany({
      where: {
        id: use.mascot.id,
        playerId,
        level: 1,
        hatchedFromEggType: null,
        hatchedFromEggOrigin: null,
      },
      data: {
        ...newStats,
        hatchedFromEggType: "LAB",
        hatchedFromEggOrigin: "Origem de ovo de Laboratorio",
      },
    });
    if (updated.count !== 1) throw new Error("O mascote mudou durante a recuperação da Pena Primordial.");

    await tx.mascotEvent.create({
      data: {
        mascotId: use.mascot.id,
        emoji: "🌈",
        description: `Correção da Pena Arco-Íris Primordial: origem de Laboratório registrada e atributos ressorteados em ${statMin}–${statMax}.`,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "mascot",
        entityId: use.mascot.id,
        action: "rainbow_feather.primordial_auto_repair",
        before: {
          pokemonId: use.mascot.pokemonId,
          stats: {
            statForce: use.mascot.statForce,
            statAgility: use.mascot.statAgility,
            statCharisma: use.mascot.statCharisma,
            statInstinct: use.mascot.statInstinct,
            statVitality: use.mascot.statVitality,
          },
          hatchedFromEggType: null,
          hatchedFromEggOrigin: null,
        },
        after: {
          pokemonId: use.mascot.pokemonId,
          stats: newStats,
          hatchedFromEggType: "LAB",
          hatchedFromEggOrigin: "Origem de ovo de Laboratorio",
          adminLabFeatherUsedAt: use.createdAt.toISOString(),
        },
        metadata: {
          reason: "Pena Primordial processada por Server Action anterior",
          sourceEventId: use.id,
        },
      },
    });
    return true;
  });
  return repaired ? 1 : 0;
}

/** Pena Arco-Íris: faz o mascote renascer na forma base usando o intervalo do ovo original. */
export async function applyRainbowFeather(
  playerId: string,
  mascotId: string,
  expectedEggTier?: "COMMON" | "RARE" | "EVENT" | "SPECIAL" | "LAB",
  tx?: Prisma.TransactionClient,
  adminLabOriginOverride = false,
) {
  const db = tx ?? prisma;
  const mascot = await db.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote não encontrado.");
  if (mascot.arenaState !== "FREE") throw new Error("Mascote deve estar livre para usar a Pena Arco-Íris.");
  if (adminLabOriginOverride && (mascot.hatchedFromEggType || mascot.hatchedFromEggOrigin)) {
    throw new Error("Esta Pena especial só pode ser usada em mascotes sem ovo de origem registrado.");
  }
  const eggTypeKey = adminLabOriginOverride
    ? "LAB"
    : mascot.hatchedFromEggType
    ? getEggStatTypeKey(mascot.hatchedFromEggType, mascot.hatchedFromEggOrigin)
    : "RARE";
  const actualEggTier =
    eggTypeKey === "LAB" ? "LAB" :
    eggTypeKey === "SPECIAL" ? "SPECIAL" :
    eggTypeKey === "EVENT" ? "EVENT" :
    eggTypeKey === "RARE" || !mascot.hatchedFromEggType ? "RARE" :
    "COMMON";
  const tierRank = { COMMON: 0, RARE: 1, EVENT: 2, SPECIAL: 3, LAB: 4 } as const;
  if (expectedEggTier && tierRank[expectedEggTier] < tierRank[actualEggTier]) {
    const labels = { COMMON: "Comum", RARE: "Rara", EVENT: "de Evento", SPECIAL: "Especial", LAB: "de Laboratório" };
    throw new Error(`Esta pena não alcança a origem deste mascote. Use uma Pena Arco-Íris ${labels[actualEggTier]} ou superior.`);
  }
  const [statMin, statMax] = EGG_STAT_RANGES[eggTypeKey] ?? EGG_STAT_RANGES.RARE;
  const personality = randomPersonality();
  const basePokemonId = getRainbowFeatherBaseForm(mascot.pokemonId);
  const resetDefaultNickname = mascot.nickname === getPokemonName(mascot.pokemonId);
  await db.mascot.update({
    where: { id: mascotId },
    data: {
      level: 1, exp: 0,
      pokemonId: basePokemonId,
      evolutionLocked: false,
      ...(resetDefaultNickname ? { nickname: null } : {}),
      personality,
      statForce: randomInt(statMin, statMax),
      statAgility: randomInt(statMin, statMax),
      statCharisma: randomInt(statMin, statMax),
      statInstinct: randomInt(statMin, statMax),
      statVitality: randomInt(statMin, statMax),
      happiness: 50, mood: "NEUTRAL",
      ...(adminLabOriginOverride
        ? {
            hatchedFromEggType: "LAB" as const,
            hatchedFromEggOrigin: "Origem de ovo de Laboratorio",
          }
        : {}),
    }
  });
  // Remove marca de proteína (stats foram resetados)
  await db.mascotBuff.deleteMany({
    where: { mascotId, type: "STAT_BOOST", expiresAt: { gt: new Date("2090-01-01") } }
  }).catch(() => {});
  // O novo ciclo pode conquistar novamente os marcos de maturidade e evolução.
  await db.mascotProgressMilestone.deleteMany({ where: { mascotId } });
  if (!tx) {
    await logEvent(mascotId, "🌈", `Pena Arco-Íris usada! O mascote voltou para ${getPokemonName(basePokemonId)} no nível 1 e teve personalidade e atributos sorteados novamente.`);
  }
  return {
    statMin,
    statMax,
    actualEggTier: adminLabOriginOverride ? "LAB" : actualEggTier,
    usedFallback: !adminLabOriginOverride && !mascot.hatchedFromEggType,
    basePokemonId,
  };
}

// ── Utilidades para UI ────────────────────────────────────────────────────────

export { getSpriteUrl, getPokemonName, expToNextLevel, getSocialTier };
export type { ExpeditionDuration };
