import { prisma } from "@/lib/prisma";
import { creditCoins } from "@/lib/zikacoins";
import { addExp } from "@/lib/mascot";
import { getPokemonElement, getPokemonName, getTypeAdvantageMultiplier } from "@/lib/mascot-data";
import { Prisma } from "@prisma/client";
import type { ArenaBattleResult } from "@prisma/client";

export const ARENA_Z_CONFIG = {
  susCost: 10,
  restAfterSusHours: 3,
  restAfterWinMinutes: 30,
  defeatedLootPreservedPct: 0.6,
  defeatedLootStolenPct: 0.3,
  defeatedLootBurnPct: 0.1,
  botCooldownMinutes: 3,
  pvpCooldownMinutes: 10,
  // Multiplicador de tempo: +8.3% por hora, cap 4x após 36h
  multPerHour: 1 / 12,  // 1 unidade de mult a cada 12h
  multCap: 4.0,
  // Penalidade PvP: retirada rápida após última batalha (<2h) reduz mult em 50%
  pvpQuickExitPenaltyHours: 2,
};

// ── Renda Passiva ─────────────────────────────────────────────────────────────
// Por hora por mascote na equipe
export const PASSIVE_COINS_PER_MASCOT_PER_H = 5;
export const PASSIVE_EXP_PER_MASCOT_PER_H   = 10;
const PASSIVE_MAX_HOURS               = 24;  // máximo por sessão (evita acúmulo por abandono)
const PASSIVE_MIN_INTERVAL_HOURS      = 0.5; // processa a cada 30 min

export async function applyPassiveIncome(teamId: string): Promise<{ coins: number; exp: number } | null> {
  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    include: { members: { select: { id: true } } },
  });
  if (!team || team.status !== "ACTIVE" || team.members.length === 0) return null;
  // Renda passiva é exclusiva de equipes PvP ou BOTH — PvE só ganha pelo combate
  if (team.teamType === "PVE") return null;

  const lastAt = team.lastPassiveIncomeAt ?? team.enteredAt;
  const hoursElapsed = (Date.now() - new Date(lastAt).getTime()) / 3_600_000;
  if (hoursElapsed < PASSIVE_MIN_INTERVAL_HOURS) return null; // muito cedo

  const hours    = Math.min(hoursElapsed, PASSIVE_MAX_HOURS);
  const mascots  = team.members.length;
  const coins    = Math.floor(hours * mascots * PASSIVE_COINS_PER_MASCOT_PER_H);
  const exp      = Math.floor(hours * mascots * PASSIVE_EXP_PER_MASCOT_PER_H);
  if (coins === 0 && exp === 0) return null;

  await prisma.arenaTeam.update({
    where: { id: teamId },
    data: {
      vaultCoins: { increment: coins },
      vaultExp:   { increment: exp },
      lastPassiveIncomeAt: new Date(),
    },
  });
  return { coins, exp };
}

/** Aplica renda passiva para TODAS as equipes ativas de um jogador */
export async function applyPassiveIncomeForPlayer(playerId: string): Promise<void> {
  const activeTeams = await prisma.arenaTeam.findMany({
    where: { playerId, status: "ACTIVE" },
    select: { id: true },
  });
  await Promise.all(activeTeams.map(t => applyPassiveIncome(t.id).catch(() => null)));
}

/** Calcula o multiplicador atual baseado no tempo na Arena */
export function getTeamTimeMultiplier(enteredAt: Date): number {
  const hoursActive = (Date.now() - new Date(enteredAt).getTime()) / 3_600_000;
  return Math.min(ARENA_Z_CONFIG.multCap, 1 + hoursActive * ARENA_Z_CONFIG.multPerHour);
}

/** Aplica o multiplicador ao cofre e retorna os valores finais */
export function applyMultiplierToVault(
  vault: { coins: number; exp: number; food: number; sweet: number },
  mult: number,
  hadRecentBattle: boolean // penalidade PvP quick-exit
): { coins: number; exp: number; food: number; sweet: number; effectiveMult: number } {
  // Penalidade: se retirou logo após batalha PvP, perde 30% do mult bonus
  const bonus = mult - 1;
  const effectiveMult = hadRecentBattle ? 1 + bonus * 0.7 : mult;
  return {
    coins: Math.floor(vault.coins * effectiveMult),
    exp:   Math.floor(vault.exp * effectiveMult),
    food:  vault.food,   // comida/doce: não multiplicado (evita excesso)
    sweet: vault.sweet,
    effectiveMult,
  };
}

// Dificuldades: modificam a faixa de nível do bot
export const DIFFICULTY_CONFIG = {
  easy:   { levelOffset: -1, rewardMult: 0.8, injuryChanceMult: 0.6, label: "Facil",  color: "green", desc: "Bot perto da forca real do time. Menos loot e risco menor." },
  normal: { levelOffset: +3, rewardMult: 1.2, injuryChanceMult: 1.2, label: "Normal", color: "yellow", desc: "Bot acima da forca real do time, evitando abuso de media baixa." },
  hard:   { levelOffset: +8, rewardMult: 2.0, injuryChanceMult: 2.8, label: "Dificil", color: "red",   desc: "Bot bem acima da forca real. Loot maior, risco alto de ferimento." },
} as const;
export type ArenaDifficulty = keyof typeof DIFFICULTY_CONFIG;

const BOT_NAMES = [
  "Nando Faísca",   "Beto Raio",      "Cida Tempestade", "Tuca do Beco",   "Mestre Pingo",
  "Nina das Folhas","Raul Pedreira",  "Léo Brasa",       "Jana Sombria",   "Gui do Choque",
  "Mira Maré",      "Dani Esporo",    "Ruan Cascalho",   "Toni Vento",     "Carla Prisma",
  "Zeca do Trovão", "Bruna Fagulha",  "Caio Raiz",       "Vini Nevoeiro",  "Lari Cristal",
  "Dudu Ferrugem",  "Fê Labareda",    "Igor Relâmpago",  "Manu Aurora",    "Biel Espinho",
  "Rita Eclipse",   "Pedro Turbina",  "Kika Granito",    "Samuca Poeira",  "Tainá Estrela",
  // Expansão
  "Kael Vorto",     "Luma Sílica",    "Drex Cinzeiro",   "Naia Brûma",     "Ciro Safira",
  "Zel Paradoxo",   "Mika Trovisco",  "Reva Estrela",    "Cadu Nublado",   "Tess Éter",
  "Vox Sombral",    "Ixo do Pico",    "Nere Madrugada",  "Flick Relâmpago","Soru Granito",
  "Bira Lava",      "Dita Escuridão", "Yam Cascata",     "Pico Ribeirão",  "Selu Ventania",
  "Orki Farol",     "Cata Neblina",   "Finn Corrente",   "Zago Cinzeiro",  "Wara Espelho",
  "Niko Parafuso",  "Leva Brilhante", "Skua Temporal",   "Brun Rocha",     "Queia Chama",
];

type ArenaMascot = {
  id: string;
  ownerId: string | null;
  pokemonId: number;
  name: string;
  level: number;
  force: number;
  agility: number;
  instinct: number;
  vitality: number;
  happiness: number;
  hp: number;
};

export type ArenaLoot = {
  coins: number;
  exp: number;
  food: number;
  sweet: number;
};

export type ArenaTurnLog = {
  turn: number;
  actorId: string;
  actorName: string;
  actorOwnerId: string | null;
  targetId: string;
  targetName: string;
  targetOwnerId: string | null;
  action: "ATTACK" | "DEFEND";
  damage: number;
  attackerType: string;
  defenderType: string;
  multiplier: number;
  advantageApplied: boolean;
};

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function seededRng(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function seededRand(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function seededPick<T>(rng: () => number, items: T[]) {
  return items[Math.floor(rng() * items.length)];
}

function levelBand(level: number) {
  const min = Math.max(1, Math.floor((level - 1) / 5) * 5 + 1);
  return { min, max: min + 4 };
}

function toArenaMascot(m: {
  id: string; playerId: string; pokemonId: number; nickname: string | null; level: number;
  statForce: number; statAgility: number; statInstinct: number; statVitality: number; happiness: number;
}): ArenaMascot {
  return {
    id: m.id,
    ownerId: m.playerId,
    pokemonId: m.pokemonId,
    name: m.nickname ?? getPokemonName(m.pokemonId),
    level: m.level,
    force: m.statForce,
    agility: m.statAgility,
    instinct: m.statInstinct,
    vitality: m.statVitality,
    happiness: m.happiness,
    hp: 55 + m.level * 6 + m.statVitality * 4,
  };
}

function makeBotMascot(index: number, levelMin: number, levelMax: number, rng: () => number = Math.random): ArenaMascot {
  const pokemonIds = [
    1,2,3,4,5,6,7,8,9,12,15,18,20,22,24,25,26,28,31,34,36,38,40,45,49,51,
    53,55,57,59,62,65,68,71,73,76,78,80,82,85,87,89,91,94,95,97,99,101,
    103,105,106,107,110,112,115,117,119,121,123,124,125,126,127,128,130,
    131,134,135,136,139,141,143,149,154,157,160,162,164,166,168,169,171,
    178,181,184,185,186,189,195,196,197,199,203,205,208,210,212,214,217,
    219,221,224,226,229,230,232,237,241,242,248,
  ];
  const pokemonId = seededPick(rng, pokemonIds);
  const level = seededRand(rng, levelMin, levelMax);
  return {
    id: `bot-${index}-${pokemonId}-${level}`,
    ownerId: null,
    pokemonId,
    name: `${getPokemonName(pokemonId)} Bot`,
    level,
    force: seededRand(rng, 8, 14) + Math.floor(level / 2),
    agility: seededRand(rng, 8, 14) + Math.floor(level / 2),
    instinct: seededRand(rng, 8, 14) + Math.floor(level / 3),
    vitality: seededRand(rng, 8, 14) + Math.floor(level / 2),
    happiness: 70,
    hp: 55 + level * 6 + (10 + Math.floor(level / 2)) * 4,
  };
}

function alive(team: ArenaMascot[], hp: Map<string, number>) {
  return team.filter(m => (hp.get(m.id) ?? 0) > 0);
}

function runCombat(attackers: ArenaMascot[], defenders: ArenaMascot[]) {
  const hp = new Map<string, number>();
  for (const m of [...attackers, ...defenders]) hp.set(m.id, m.hp);

  const log: ArenaTurnLog[] = [];
  let turn = 1;
  let guard: { team: "A" | "D"; reduction: number } | null = null;

  while (alive(attackers, hp).length > 0 && alive(defenders, hp).length > 0 && turn <= 80) {
    const aAlive = alive(attackers, hp);
    const dAlive = alive(defenders, hp);
    const all = [...aAlive.map(m => ({ mascot: m, side: "A" as const })), ...dAlive.map(m => ({ mascot: m, side: "D" as const }))];
    all.sort((x, y) => y.mascot.agility - x.mascot.agility + rand(-3, 3));

    for (const entry of all) {
      if ((hp.get(entry.mascot.id) ?? 0) <= 0) continue;
      const opponents = entry.side === "A" ? alive(defenders, hp) : alive(attackers, hp);
      if (opponents.length === 0) break;

      const actor = entry.mascot;
      const target = pick(opponents);
      const attackerType = getPokemonElement(actor.pokemonId);
      const defenderType = getPokemonElement(target.pokemonId);
      const multiplier = getTypeAdvantageMultiplier(attackerType, defenderType);
      const defend = Math.random() < 0.12;

      if (defend) {
        guard = { team: entry.side, reduction: 0.35 };
        log.push({
          turn, actorId: actor.id, actorName: actor.name, actorOwnerId: actor.ownerId,
          targetId: actor.id, targetName: actor.name, targetOwnerId: actor.ownerId,
          action: "DEFEND", damage: 0, attackerType, defenderType: attackerType, multiplier: 1, advantageApplied: false,
        });
        turn++;
        continue;
      }

      const raw = actor.force * 1.8 + actor.level * 2 + actor.instinct * 0.7 + rand(0, 12);
      const mitigation = target.vitality * 0.8 + target.level;
      const guarded = guard && guard.team !== entry.side ? guard.reduction : 0;
      const damage = Math.max(1, Math.round((raw * multiplier - mitigation) * (1 - guarded)));
      hp.set(target.id, Math.max(0, (hp.get(target.id) ?? 0) - damage));
      guard = null;

      log.push({
        turn, actorId: actor.id, actorName: actor.name, actorOwnerId: actor.ownerId,
        targetId: target.id, targetName: target.name, targetOwnerId: target.ownerId,
        action: "ATTACK", damage, attackerType, defenderType, multiplier, advantageApplied: multiplier > 1,
      });
      turn++;
    }
  }

  const aHp = alive(attackers, hp).reduce((sum, m) => sum + (hp.get(m.id) ?? 0), 0);
  const dHp = alive(defenders, hp).reduce((sum, m) => sum + (hp.get(m.id) ?? 0), 0);
  const result: ArenaBattleResult = aHp === dHp ? "DRAW" : aHp > dHp ? "ATTACKER_WIN" : "DEFENDER_WIN";
  const defeated = [...attackers, ...defenders].filter(m => (hp.get(m.id) ?? 0) <= 0);
  return { result, log, rounds: turn - 1, defeatedMascotIds: defeated.filter(m => m.ownerId).map(m => m.id) };
}

export type ArenaLootFull = ArenaLoot & {
  egg?: "COMMON" | "RARE" | "SPECIAL";
  buffItem?: string; // tipo do ShopItem (ex: "MASCOT_BUFF_STAT")
};

type ArenaItemSpoil = {
  kind: "MASCOT_BUFF";
  type: string;
  quantity: number;
  label: string;
};

const BUFF_ITEM_POOL = [
  "MASCOT_BUFF_EXP", "MASCOT_BUFF_STAT", "MASCOT_BUFF_HAPPY",
  "MASCOT_BUFF_LUCK", "MASCOT_BUFF_MOOD",
];

function botReward(levelMin: number, levelMax: number, difficulty: ArenaDifficulty = "normal"): ArenaLootFull {
  const tier = Math.ceil(levelMax / 5);
  const eggRoll = Math.random();
  const eggChance = tier >= 8 ? 0.12 : tier >= 6 ? 0.08 : tier >= 4 ? 0.05 : 0;
  const rareEggChance = tier >= 10 ? 0.04 : tier >= 8 ? 0.02 : 0;
  let egg: "COMMON" | "RARE" | "SPECIAL" | undefined;
  if (eggRoll < rareEggChance) egg = "RARE";
  else if (eggRoll < eggChance) egg = "COMMON";

  // Chance de item buff no dificil — entra no cofre e pode ser roubado em PvP
  let buffItem: string | undefined;
  if (difficulty === "hard" && Math.random() < 0.20) { // 20% de chance no Difícil
    buffItem = BUFF_ITEM_POOL[Math.floor(Math.random() * BUFF_ITEM_POOL.length)];
  }

  return {
    coins: rand(10 * tier, 28 * tier),
    exp:   rand(14 * tier, 36 * tier),
    food:  Math.random() < Math.min(0.45, tier * 0.05) ? 1 : 0,
    sweet: Math.random() < Math.min(0.2, tier * 0.025) ? 1 : 0,
    egg,
    buffItem,
  };
}

function getBotRewardRange(levelMax: number) {
  const tier = Math.ceil(levelMax / 5);
  return {
    coinsMin: 10 * tier,
    coinsMax: 28 * tier,
    expMin: 14 * tier,
    expMax: 36 * tier,
    foodChance: Math.min(45, tier * 5),
    sweetChance: Math.min(20, tier * 2.5),
  };
}

function getEffectiveTeamLevel(attackers: ArenaMascot[]) {
  const levels = attackers.map(m => m.level).sort((a, b) => b - a);
  const avgLevel = levels.reduce((sum, level) => sum + level, 0) / Math.max(1, levels.length);
  const topCount = Math.max(1, Math.ceil(levels.length / 2));
  const topAvg = levels.slice(0, topCount).reduce((sum, level) => sum + level, 0) / topCount;
  const maxLevel = levels[0] ?? 1;
  return Math.max(1, Math.round(Math.max(avgLevel, topAvg * 0.9, maxLevel * 0.72)));
}

function buildBotOpponent(attackers: ArenaMascot[], difficulty: ArenaDifficulty = "normal", seed?: number) {
  const rng = seed !== undefined ? seededRng(seed) : Math.random;
  const avgLevel = getEffectiveTeamLevel(attackers);
  const diff = DIFFICULTY_CONFIG[difficulty];
  const adjustedLevel = Math.max(1, avgLevel + diff.levelOffset);
  const band = levelBand(adjustedLevel);
  const botSize = Math.min(6, Math.max(2, attackers.length + seededRand(rng, 0, 2)));
  // Seed determinístico: usa seed se fornecido, caso contrário gera aleatório
  const nameSeed = seed !== undefined ? seed % BOT_NAMES.length : Math.floor(rng() * BOT_NAMES.length);
  const botName = BOT_NAMES[nameSeed];
  const defenders = Array.from({ length: botSize }, (_, index) => makeBotMascot(index + 1, band.min, band.max, rng));
  return { avgLevel, band, botSize, botName, defenders, rewardRange: getBotRewardRange(band.max), difficulty };
}

function splitDefeatedLoot(loot: ArenaLoot) {
  return {
    stolen: {
      coins: Math.floor(loot.coins * ARENA_Z_CONFIG.defeatedLootStolenPct),
      exp: Math.floor(loot.exp * ARENA_Z_CONFIG.defeatedLootStolenPct),
      food: Math.floor(loot.food * ARENA_Z_CONFIG.defeatedLootStolenPct),
      sweet: Math.floor(loot.sweet * ARENA_Z_CONFIG.defeatedLootStolenPct),
    },
    burned: {
      coins: Math.floor(loot.coins * ARENA_Z_CONFIG.defeatedLootBurnPct),
      exp: Math.floor(loot.exp * ARENA_Z_CONFIG.defeatedLootBurnPct),
      food: Math.floor(loot.food * ARENA_Z_CONFIG.defeatedLootBurnPct),
      sweet: Math.floor(loot.sweet * ARENA_Z_CONFIG.defeatedLootBurnPct),
    },
  };
}

export async function getArenaBotPreview(playerId: string, teamId: string, difficulty: ArenaDifficulty = "normal") {
  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    include: { members: { include: { mascot: true }, orderBy: { slot: "asc" } } },
  });
  if (!team || team.playerId !== playerId || team.status !== "ACTIVE" || team.members.length === 0) return null;
  const attackers = team.members.map(m => toArenaMascot(m.mascot));
  // Seed baseado no teamId + dificuldade + hora do dia (muda a cada 10min → bot muda mas é estável por período)
  const hourSlot = Math.floor(Date.now() / (10 * 60 * 1000));
  const seed = parseInt(teamId.replace(/[^0-9]/g, "").slice(-4) || "0") + hourSlot;
  const bot = buildBotOpponent(attackers, difficulty, seed);
  const diff = DIFFICULTY_CONFIG[difficulty];
  // Último combate da equipe (para mostrar cooldown)
  const lastBattle = await prisma.arenaBattle.findFirst({
    where: { attackTeamId: teamId, type: "BOT" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  // Retorna timestamp absoluto para o cliente calcular remaining = until - Date.now()
  // Isso evita dessincronização quando a página demora a chegar ao cliente
  const cooldownUntil = lastBattle
    ? new Date(lastBattle.createdAt.getTime() + ARENA_Z_CONFIG.botCooldownMinutes * 60_000)
    : null;
  return {
    trainerName: bot.botName,
    levelBandMin: bot.band.min,
    levelBandMax: bot.band.max,
    rewardRange: bot.rewardRange,
    difficulty,
    difficultyLabel: diff.label,
    difficultyColor: diff.color,
    injuryRisk: difficulty === "easy" ? "Baixo" : difficulty === "normal" ? "Médio" : "Alto",
    cooldownUntil,
    /** @deprecated use cooldownUntil */
    cooldownMs: cooldownUntil ? Math.max(0, cooldownUntil.getTime() - Date.now()) : 0,
    mascots: bot.defenders.map(m => ({
      id: m.id,
      pokemonId: m.pokemonId,
      name: m.name,
      level: m.level,
      type: getPokemonElement(m.pokemonId),
      force: m.force,
      agility: m.agility,
      vitality: m.vitality,
    })),
  };
}

function remainingLoot(loot: ArenaLoot, stolen: ArenaLoot, burned: ArenaLoot): ArenaLoot {
  return {
    coins: Math.max(0, loot.coins - stolen.coins - burned.coins),
    exp: Math.max(0, loot.exp - stolen.exp - burned.exp),
    food: Math.max(0, loot.food - stolen.food - burned.food),
    sweet: Math.max(0, loot.sweet - stolen.sweet - burned.sweet),
  };
}

function hasLoot(loot: ArenaLoot) {
  return loot.coins > 0 || loot.exp > 0 || loot.food > 0 || loot.sweet > 0;
}

async function dropArenaGroundSpoils(
  tx: Prisma.TransactionClient,
  loot: ArenaLoot | null | undefined,
  sourcePlayerId?: string | null,
  sourceBattleId?: string | null,
  itemPayload?: ArenaItemSpoil[] | null,
) {
  if ((!loot || !hasLoot(loot)) && (!itemPayload || itemPayload.length === 0)) return;
  await tx.arenaGroundSpoil.create({
    data: {
      sourceBattleId: sourceBattleId ?? null,
      sourcePlayerId: sourcePlayerId ?? null,
      coins: loot?.coins ?? 0,
      exp: loot?.exp ?? 0,
      food: loot?.food ?? 0,
      sweet: loot?.sweet ?? 0,
      itemPayload: itemPayload && itemPayload.length > 0 ? itemPayload as unknown as Prisma.InputJsonValue : undefined,
      status: "AVAILABLE",
    },
  });
}

async function maybeFindArenaGroundSpoils(
  tx: Prisma.TransactionClient,
  winnerPlayerId: string,
  winnerTeamId: string,
) {
  const available = await tx.arenaGroundSpoil.findMany({
    where: {
      status: "AVAILABLE",
      OR: [
        { sourcePlayerId: null },
        { sourcePlayerId: { not: winnerPlayerId } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 8,
  });
  if (available.length === 0) return null;

  const chance = Math.min(0.75, 0.25 + available.length * 0.06);
  if (Math.random() > chance) return null;

  const spoil = pick(available);
  await tx.arenaGroundSpoil.update({
    where: { id: spoil.id },
    data: { status: "CLAIMED", foundByPlayerId: winnerPlayerId, claimedAt: new Date() },
  });
  const items = Array.isArray(spoil.itemPayload)
    ? (spoil.itemPayload as unknown as ArenaItemSpoil[])
    : [];
  await tx.arenaTeam.update({
    where: { id: winnerTeamId },
    data: {
      vaultCoins: { increment: spoil.coins },
      vaultExp: { increment: spoil.exp },
      vaultFood: { increment: spoil.food },
      vaultSweet: { increment: spoil.sweet },
    },
  });
  for (const item of items) {
    if (item.kind === "MASCOT_BUFF" && item.type) {
      await tx.playerGift.create({
        data: {
          playerId: winnerPlayerId,
          type: "CUSTOM",
          title: `Espolio da Arena: ${item.label}`,
          description: "Item encontrado no chao da Arena Z apos uma vitoria PvP. Resgate para enviar ao inventario.",
          payload: {
            rewardKind: "MASCOT_BUFF",
            buffType: item.type,
            source: "ARENA_GROUND_SPOIL",
            quantity: item.quantity,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }
  return {
    coins: spoil.coins,
    exp: spoil.exp,
    food: spoil.food,
    sweet: spoil.sweet,
    items,
  };
}

async function creditArenaLoot(
  tx: Prisma.TransactionClient,
  playerId: string,
  loot: ArenaLoot,
  description: string
) {
  if (loot.coins > 0) {
    await creditCoins(tx, {
      playerId,
      type: "BET_WON",
      amount: loot.coins,
      description,
    });
  }
  if (loot.food > 0) {
    await tx.mascotFoodItem.upsert({
      where: { playerId_type: { playerId, type: "FOOD" } },
      update: { quantity: { increment: loot.food } },
      create: { playerId, type: "FOOD", quantity: loot.food },
    });
  }
  if (loot.sweet > 0) {
    await tx.mascotFoodItem.upsert({
      where: { playerId_type: { playerId, type: "SWEET" } },
      update: { quantity: { increment: loot.sweet } },
      create: { playerId, type: "SWEET", quantity: loot.sweet },
    });
  }
}

async function getArenaExpMascotIds(teamId: string, playerId: string, enteredAt: Date): Promise<string[]> {
  const ids = new Set<string>();

  const members = await prisma.arenaTeamMember.findMany({
    where: { teamId },
    select: { mascotId: true },
  });
  members.forEach(member => ids.add(member.mascotId));

  const battles = await prisma.arenaBattle.findMany({
    where: {
      createdAt: { gte: enteredAt },
      OR: [{ attackTeamId: teamId }, { defenseTeamId: teamId }],
    },
    select: { turnLog: true },
  });

  for (const battle of battles) {
    const turns = Array.isArray(battle.turnLog) ? battle.turnLog : [];
    for (const rawTurn of turns) {
      if (!rawTurn || typeof rawTurn !== "object") continue;
      const turn = rawTurn as { actorId?: unknown; actorOwnerId?: unknown; targetId?: unknown; targetOwnerId?: unknown };
      if (turn.actorOwnerId === playerId && typeof turn.actorId === "string") ids.add(turn.actorId);
      if (turn.targetOwnerId === playerId && typeof turn.targetId === "string") ids.add(turn.targetId);
    }
  }

  if (ids.size === 0) return [];

  const validMascots = await prisma.mascot.findMany({
    where: { id: { in: [...ids] }, playerId },
    select: { id: true },
  });

  return validMascots.map(mascot => mascot.id);
}

async function distributeArenaExp(mascotIds: string[], totalExp: number): Promise<void> {
  if (totalExp <= 0) return;
  if (mascotIds.length === 0) throw new Error("Nenhum mascote elegivel para receber EXP da Arena.");
  const expPerMascot = Math.max(1, Math.floor(totalExp / mascotIds.length));
  const results = await Promise.allSettled(
    mascotIds.map(mascotId => addExp(mascotId, expPerMascot, { ignoreBenchPenalty: true })),
  );
  const failed = results.filter(result => result.status === "rejected");
  if (failed.length > 0) {
    throw new Error(`Falha ao distribuir EXP da Arena para ${failed.length}/${mascotIds.length} mascote(s).`);
  }
}

function assertTeamReady(team: {
  members: Array<{
    mascot: {
      arenaState: string;
      restingUntil: Date | null;
      nickname: string | null;
      pokemonId: number;
    };
  }>;
}) {
  const now = new Date();
  for (const member of team.members) {
    const name = member.mascot.nickname ?? getPokemonName(member.mascot.pokemonId);
    if (member.mascot.arenaState === "INJURED") throw new Error(`${name} esta ferido e precisa de Atendimento SUS.`);
    if (member.mascot.restingUntil && member.mascot.restingUntil > now) throw new Error(`${name} esta em repouso ate ${member.mascot.restingUntil.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
  }
}

export async function validateArenaMascots(playerId: string, mascotIds: string[]) {
  const unique = [...new Set(mascotIds)].filter(Boolean);
  if (unique.length < 1 || unique.length > 6) throw new Error("Selecione de 1 a 6 mascotes.");

  const mascots = await prisma.mascot.findMany({
    where: { id: { in: unique }, playerId },
    include: { expeditions: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (mascots.length !== unique.length) throw new Error("Um ou mais mascotes nao pertencem ao jogador.");

  const now = new Date();
  for (const m of mascots) {
    if (m.expeditions.length > 0) throw new Error(`${m.nickname ?? getPokemonName(m.pokemonId)} esta em expedicao.`);
    if (m.bazarListed) throw new Error(`${m.nickname ?? getPokemonName(m.pokemonId)} esta anunciado no Bazar.`);
    if (m.arenaState === "INJURED") throw new Error(`${m.nickname ?? getPokemonName(m.pokemonId)} esta ferido.`);
    if (m.arenaState === "RESTING" && m.restingUntil && m.restingUntil > now) throw new Error(`${m.nickname ?? getPokemonName(m.pokemonId)} esta em repouso.`);
    if (m.arenaState === "ARENA") throw new Error(`${m.nickname ?? getPokemonName(m.pokemonId)} ja esta em uma equipe da Arena.`);
  }
  return mascots;
}

export const RETIRE_COOLDOWN_MS = 10 * 60_000; // 10 min após sair com recompensas

/** Verifica se algum dos mascotes está em cooldown pós-retirada (10 min) */
async function checkRetireCooldown(mascotIds: string[]): Promise<void> {
  const cooldownSince = new Date(Date.now() - RETIRE_COOLDOWN_MS);
  const blocked = await prisma.arenaTeamMember.findFirst({
    where: {
      mascotId: { in: mascotIds },
      team: { status: "RETIRED", retiredAt: { gte: cooldownSince } },
    },
    include: {
      mascot: { select: { nickname: true, pokemonId: true } },
      team: { select: { retiredAt: true } },
    },
  });
  if (!blocked) return;
  const name = blocked.mascot.nickname ?? getPokemonName(blocked.mascot.pokemonId);
  const retiredMs = blocked.team.retiredAt ? new Date(blocked.team.retiredAt).getTime() : Date.now();
  const remaining = Math.ceil((RETIRE_COOLDOWN_MS - (Date.now() - retiredMs)) / 60_000);
  throw new Error(`${name} precisa esperar ${remaining} min antes de entrar em nova equipe (saiu com recompensas recentemente).`);
}

export async function createArenaTeam(playerId: string, name: string, mascotIds: string[], teamType: "PVE" | "PVP" | "BOTH" = "BOTH") {
  if (mascotIds.length > 6) throw new Error("Máximo de 6 mascotes por equipe.");
  const mascots = await validateArenaMascots(playerId, mascotIds);
  const teamName = name.trim() || "Equipe Arena Z";

  // Bloqueia mascotes em cooldown pós-retirada (10 min)
  await checkRetireCooldown(mascots.map(m => m.id));

  // Bloqueia mascotes que já estão em outra equipe ativa
  const alreadyInTeam = await prisma.arenaTeamMember.findMany({
    where: { mascotId: { in: mascots.map(m => m.id) }, team: { status: "ACTIVE" } },
    include: { team: { select: { name: true } } },
  });
  if (alreadyInTeam.length > 0) {
    const names = alreadyInTeam.map(m => `Mascote (${m.mascotId.slice(-4)}) já está na equipe "${m.team.name}"`);
    throw new Error(names[0]);
  }

  return prisma.$transaction(async (tx) => {
    const activeLinks = await tx.arenaTeamMember.findMany({
      where: { mascotId: { in: mascots.map(m => m.id) }, team: { status: "ACTIVE" } },
      include: { team: { select: { name: true } } },
    });
    if (activeLinks.length > 0) {
      throw new Error(`Mascote ja esta na equipe "${activeLinks[0].team.name}". Atualize a pagina e tente novamente.`);
    }

    const lockedMascots = await tx.mascot.updateMany({
      where: {
        id: { in: mascots.map(m => m.id) },
        playerId,
        arenaState: { in: ["FREE", "RESTING"] },
        arenaTeamMembers: { none: { team: { status: "ACTIVE" } } },
      },
      data: { arenaState: "ARENA", restingUntil: null, injuredAt: null, isEquipped: false },
    });
    if (lockedMascots.count !== mascots.length) {
      throw new Error("Um mascote deixou de estar disponivel. Atualize a pagina e tente novamente.");
    }

    const team = await tx.arenaTeam.create({
      data: {
        playerId,
        name: teamName,
        teamType,
        members: {
          create: mascots.map((m, index) => ({ mascotId: m.id, slot: index + 1 })),
        },
      },
    });
    return team;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function addMascotToArenaTeam(playerId: string, teamId: string, mascotId: string) {
  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    include: { members: { orderBy: { slot: "asc" } } },
  });
  if (!team || team.playerId !== playerId) throw new Error("Equipe nao encontrada.");
  if (team.status !== "ACTIVE") throw new Error("Apenas equipes ativas podem receber mascotes.");
  if (team.members.length >= 6) throw new Error("A equipe ja tem 6 mascotes.");

  // Bloqueia mascote em cooldown pós-retirada
  await checkRetireCooldown([mascotId]);

  const [mascot] = await validateArenaMascots(playerId, [mascotId]);
  const usedSlots = new Set(team.members.map(member => member.slot));
  const slot = [1, 2, 3, 4, 5, 6].find(candidate => !usedSlots.has(candidate));
  if (!slot) throw new Error("Sem slot livre na equipe.");

  return prisma.$transaction(async (tx) => {
    const activeLink = await tx.arenaTeamMember.findFirst({
      where: { mascotId: mascot.id, team: { status: "ACTIVE" } },
      include: { team: { select: { name: true } } },
    });
    if (activeLink) throw new Error(`Mascote ja esta na equipe "${activeLink.team.name}". Atualize a pagina e tente novamente.`);

    const locked = await tx.mascot.updateMany({
      where: {
        id: mascot.id,
        playerId,
        arenaState: { in: ["FREE", "RESTING"] },
        arenaTeamMembers: { none: { team: { status: "ACTIVE" } } },
      },
      data: { arenaState: "ARENA", restingUntil: null, injuredAt: null, isEquipped: false },
    });
    if (locked.count !== 1) throw new Error("Mascote deixou de estar disponivel. Atualize a pagina e tente novamente.");

    const member = await tx.arenaTeamMember.create({
      data: { teamId, mascotId: mascot.id, slot },
    });
    return member;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Remove equipe completamente (admin ou dono). Libera mascotes e apaga o registro. */
export async function deleteArenaTeam(playerId: string, teamId: string, isAdmin = false) {
  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    include: { members: true, player: { include: { user: { select: { role: true } } } } },
  });
  if (!team) throw new Error("Equipe nao encontrada.");
  if (!isAdmin && team.playerId !== playerId) throw new Error("Sem permissao.");

  await prisma.$transaction(async (tx) => {
    // Libera todos os mascotes (feridos permanecem feridos, apenas sai do ARENA)
    await tx.mascot.updateMany({
      where: { id: { in: team.members.map(m => m.mascotId) }, arenaState: { not: "INJURED" } },
      data: { arenaState: "FREE", restingUntil: null }
    });
    // Remove a equipe (cascade apaga members via FK)
    // Nota: abandono NÃO credita o cofre e NÃO define retiredAt (sem penalidade de 10 min)
    await tx.arenaTeam.delete({ where: { id: teamId } });
  });
}

/** Admin: remove TODOS os registros de arena (batalhas, times) de contas admin. */
export async function purgeAdminArenaData(): Promise<{ teams: number; battles: number }> {
  const adminPlayers = await prisma.player.findMany({
    where: { user: { role: { in: ["ADMIN","SUPER_ADMIN"] } } },
    select: { id: true },
  });
  const adminIds = adminPlayers.map(p => p.id);
  if (adminIds.length === 0) return { teams: 0, battles: 0 };

  // Remove batalhas envolvendo admins
  const deletedBattles = await prisma.arenaBattle.deleteMany({
    where: {
      OR: [
        { attackerPlayerId: { in: adminIds } },
        { defenderPlayerId: { in: adminIds } },
      ],
    },
  });

  // Remove equipes de admins (libera mascotes antes via transação)
  const adminTeams = await prisma.arenaTeam.findMany({
    where: { playerId: { in: adminIds } },
    include: { members: true },
  });
  let teamsRemoved = 0;
  for (const team of adminTeams) {
    await prisma.mascot.updateMany({
      where: { id: { in: team.members.map(m => m.mascotId) } },
      data: { arenaState: "FREE", restingUntil: null }
    });
    await prisma.arenaTeam.delete({ where: { id: team.id } });
    teamsRemoved++;
  }

  return { teams: teamsRemoved, battles: deletedBattles.count };
}

export async function retireArenaTeam(playerId: string, teamId: string) {
  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team || team.playerId !== playerId) throw new Error("Equipe nao encontrada.");
  if (!["ACTIVE", "DEFEATED"].includes(team.status)) throw new Error("Equipe ja retirada.");

  // Bloqueia saída se há ataque PvP não visto — defensor precisa visualizar primeiro
  const unseenPvp = await getUnseenPvpAttack(teamId);
  if (unseenPvp) {
    throw Object.assign(
      new Error(`Voce foi atacado por ${unseenPvp.attackerName} antes de sair. Visualize o combate e tente novamente.`),
      { unseenPvp }
    );
  }

  // Aplica renda passiva antes de calcular o cofre final (re-lê após atualização)
  await applyPassiveIncome(teamId).catch(() => null);
  const refreshed = await prisma.arenaTeam.findUnique({ where: { id: teamId }, include: { members: true } });
  if (refreshed) { team.vaultCoins = refreshed.vaultCoins; team.vaultExp = refreshed.vaultExp; team.vaultFood = refreshed.vaultFood; team.vaultSweet = refreshed.vaultSweet; }

  // Multiplicador por tempo na Arena
  const mult = getTeamTimeMultiplier(team.enteredAt);
  // Penalidade PvP: se retirou dentro de 2h da última batalha
  const lastBattleAt = team.lastBattleAt ? new Date(team.lastBattleAt) : null;
  const hadRecentBattle = lastBattleAt
    ? (Date.now() - lastBattleAt.getTime()) < ARENA_Z_CONFIG.pvpQuickExitPenaltyHours * 3_600_000
    : false;

  let vaultFinal: ReturnType<typeof applyMultiplierToVault>;
  if (team.teamType === "BOTH") {
    // Para equipes BOTH: o multiplicador de tempo se aplica apenas à renda passiva PvP estimada.
    // A parcela de ZC/EXP ganhos em batalhas PvE é paga sem multiplicador extra.
    const hoursActive = (Date.now() - new Date(team.enteredAt).getTime()) / 3_600_000;
    const cappedHours = Math.min(hoursActive, PASSIVE_MAX_HOURS);
    const memberCount = team.members.length;
    const estimatedPvpCoins = Math.floor(cappedHours * memberCount * PASSIVE_COINS_PER_MASCOT_PER_H);
    const estimatedPvpExp   = Math.floor(cappedHours * memberCount * PASSIVE_EXP_PER_MASCOT_PER_H);
    // Porção PvP (renda passiva): limitada ao que existe no cofre
    const pvpCoins = Math.min(team.vaultCoins, estimatedPvpCoins);
    const pvpExp   = Math.min(team.vaultExp, estimatedPvpExp);
    const pveCoins = Math.max(0, team.vaultCoins - pvpCoins);
    const pveExp   = Math.max(0, team.vaultExp - pvpExp);
    // Aplica multiplicador apenas à porção PvP
    const pvpPart = applyMultiplierToVault({ coins: pvpCoins, exp: pvpExp, food: 0, sweet: 0 }, mult, hadRecentBattle);
    vaultFinal = {
      coins: pveCoins + pvpPart.coins,
      exp:   pveExp   + pvpPart.exp,
      food:  team.vaultFood,
      sweet: team.vaultSweet,
      effectiveMult: pvpPart.effectiveMult,
    };
  } else {
    vaultFinal = applyMultiplierToVault(
      { coins: team.vaultCoins, exp: team.vaultExp, food: team.vaultFood, sweet: team.vaultSweet },
      mult, hadRecentBattle
    );
  }
  const expMascotIds = await getArenaExpMascotIds(team.id, playerId, team.enteredAt);
  if (vaultFinal.exp > 0 && expMascotIds.length === 0) {
    throw new Error("Nao foi possivel identificar quais mascotes devem receber a EXP do cofre. A equipe nao foi retirada.");
  }

  await prisma.$transaction(async (tx) => {
    if (vaultFinal.coins > 0) {
      await creditCoins(tx, {
        playerId,
        type: "BET_WON",
        amount: vaultFinal.coins,
        description: `Cofre Arena Z (×${vaultFinal.effectiveMult.toFixed(1)}): ${vaultFinal.coins} ZC`,
      });
    }
    if (vaultFinal.food > 0) {
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId, type: "FOOD" } },
        update: { quantity: { increment: vaultFinal.food } },
        create: { playerId, type: "FOOD", quantity: vaultFinal.food },
      });
    }
    if (vaultFinal.sweet > 0) {
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId, type: "SWEET" } },
        update: { quantity: { increment: vaultFinal.sweet } },
        create: { playerId, type: "SWEET", quantity: vaultFinal.sweet },
      });
    }
    for (const member of team.members) {
      await tx.mascot.updateMany({
        where: { id: member.mascotId, arenaState: { not: "INJURED" } },
        data: { arenaState: "FREE", restingUntil: null },
      });
    }
    await tx.arenaTeam.update({
      where: { id: team.id },
      data: { status: "RETIRED", vaultCoins: 0, vaultExp: 0, vaultFood: 0, vaultSweet: 0, retiredAt: new Date() },
    });
  });

  await distributeArenaExp(expMascotIds, vaultFinal.exp);

  return { ...vaultFinal, hadPenalty: hadRecentBattle };
}

export async function syncDefeatedArenaTeams(playerId: string) {
  const teams = await prisma.arenaTeam.findMany({
    where: { playerId, status: "ACTIVE" },
    include: { members: { include: { mascot: true } } },
  });

  const activeMascotIds = new Set(teams.flatMap(team => team.members.map(member => member.mascotId)));
  const updated = { teams: 0, deletedEmptyTeams: 0, releasedOrphans: 0, removedInvalidMembers: 0 };

  await prisma.$transaction(async (tx) => {
    for (const team of teams) {
      const invalidMembers = team.members.filter(member =>
        member.mascot.arenaState === "INJURED" ||
        member.mascot.arenaState === "RESTING" ||
        !!member.mascot.restingUntil
      );
      const survivors = team.members.filter(member => !invalidMembers.some(invalid => invalid.id === member.id));

      if (invalidMembers.length > 0) {
        await tx.arenaTeamMember.deleteMany({
          where: { id: { in: invalidMembers.map(member => member.id) } },
        });
        updated.removedInvalidMembers += invalidMembers.length;
      }

      const legacyResting = survivors.filter(member => member.mascot.restingUntil || member.mascot.arenaState === "RESTING");
      if (legacyResting.length > 0) {
        await tx.mascot.updateMany({
          where: { id: { in: legacyResting.map(member => member.mascotId) }, arenaState: { not: "INJURED" } },
          data: { arenaState: "ARENA", restingUntil: null },
        });
      }

      if (survivors.length === 0) {
        await tx.arenaTeam.delete({ where: { id: team.id } });
        updated.deletedEmptyTeams++;
      }
    }

    const orphans = await tx.mascot.updateMany({
      where: {
        playerId,
        arenaState: "ARENA",
        id: activeMascotIds.size > 0 ? { notIn: [...activeMascotIds] } : undefined,
        arenaTeamMembers: { none: { team: { status: "ACTIVE" } } },
      },
      data: { arenaState: "FREE", restingUntil: null, injuredAt: null },
    });
    updated.releasedOrphans = orphans.count;
  });

  updated.teams = teams.length;
  return updated;
}

/**
 * Verifica se a equipe foi atacada por PvP e o defensor ainda não "viu" o combate.
 * Retorna o ID da batalha bloqueante ou null se está livre para agir.
 */
export async function getUnseenPvpAttack(teamId: string): Promise<{ battleId: string; attackerName: string; happenedAt: Date } | null> {
  try {
    const battle = await prisma.arenaBattle.findFirst({
      where: { defenseTeamId: teamId, type: "PVP", seenByDefender: false },
      orderBy: { createdAt: "desc" },
      include: { attackerPlayer: { select: { displayName: true, ptcglNick: true } } },
    });
    if (!battle) return null;
    return {
      battleId: battle.id,
      attackerName: battle.attackerPlayer?.displayName ?? battle.attackerPlayer?.ptcglNick ?? "outro jogador",
      happenedAt: battle.createdAt,
    };
  } catch {
    // Coluna seenByDefender pode não existir se a migration ainda não foi rodada; trata como nenhum ataque pendente
    return null;
  }
}

/** Marca todos os ataques PvP desta equipe como vistos pelo defensor */
export async function markPvpDefenseSeenForTeam(teamId: string): Promise<void> {
  try {
    await prisma.arenaBattle.updateMany({
      where: { defenseTeamId: teamId, type: "PVP", seenByDefender: false },
      data: { seenByDefender: true },
    });
  } catch {
    // Silencioso — migration pode ainda não ter sido aplicada
  }
}

export async function runBotBattle(playerId: string, teamId: string, difficulty: ArenaDifficulty = "normal") {
  await syncDefeatedArenaTeams(playerId).catch(() => null);

  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    include: {
      members: { include: { mascot: true }, orderBy: { slot: "asc" } },
      player: { select: { displayName: true } },
    },
  });
  if (!team || team.playerId !== playerId) throw new Error("Equipe nao encontrada.");
  if (team.status !== "ACTIVE") throw new Error("Equipe nao esta ativa.");
  if (team.members.length === 0) throw new Error("Equipe vazia.");
  if (team.teamType === "PVP") throw new Error("Equipe Somente PvP nao pode enfrentar bots.");

  // Admin: força debug mode automaticamente (sem cooldown, sem efeito no ranking/loot)
  const ownerUser = await prisma.player.findUnique({ where: { id: playerId }, include: { user: { select: { role: true } } } });
  const isAdminPlayer = ["ADMIN","SUPER_ADMIN"].includes(ownerUser?.user.role ?? "");
  if (isAdminPlayer) {
    // Debug mode automático para admin: roda combate sem persistir resultado real
    const attackers = team.members.map(m => toArenaMascot(m.mascot));
    const bot = buildBotOpponent(attackers, difficulty);
    const combat = runCombat(attackers, bot.defenders);
    const won = combat.result === "ATTACKER_WIN";
    const diff = DIFFICULTY_CONFIG[difficulty];
    const fakeReward: ArenaLootFull = won ? {
      coins: Math.round(rand(5, 30) * diff.rewardMult),
      exp: Math.round(rand(10, 50) * diff.rewardMult),
      food: 0, sweet: 0,
    } : { coins: 0, exp: 0, food: 0, sweet: 0 };
    const allMascotsAdmin = new Map([...attackers, ...bot.defenders].map(m => [m.id, m]));
    return {
      won, result: combat.result, botName: bot.botName,
      reward: fakeReward, rounds: combat.rounds,
      difficulty, difficultyLabel: diff.label,
      teamDefeated: false,
      preservedLoot: null,
      burnedLoot: null,
      stolenByBotLoot: null,
      injuredMascotIds: [], injuredMascots: [],
      playerMascots: attackers.map(m => ({ id: m.id, pokemonId: m.pokemonId, name: m.name, level: m.level, maxHp: m.hp })),
      botMascots: bot.defenders.map(m => ({ id: m.id, pokemonId: m.pokemonId, name: m.name, level: m.level, maxHp: m.hp, type: getPokemonElement(m.pokemonId) })),
      highlights: combat.log.filter(t => t.action === "ATTACK").sort((a,b) => b.damage - a.damage).slice(0,3).map(t => ({ turn: t.turn, actorName: t.actorName, targetName: t.targetName, damage: t.damage, advantageApplied: t.advantageApplied })),
      battleAnimation: combat.log
        .filter(t => t.action === "ATTACK")
        .slice(0, 28)
        .map(t => ({
          turn: t.turn,
          attackerId: t.actorId,
          attackerName: t.actorName,
          attackerPokemonId: allMascotsAdmin.get(t.actorId)?.pokemonId ?? 0,
          defenderId: t.targetId,
          defenderName: t.targetName,
          defenderPokemonId: allMascotsAdmin.get(t.targetId)?.pokemonId ?? 0,
          damage: t.damage,
          advantageApplied: t.advantageApplied,
          isPlayerAttacker: t.actorOwnerId !== null,
        })),
      debugMode: true,
    };
  }

  // Se esta equipe foi atacada por PvP e o defensor ainda não viu — bloqueia o PvE
  const unseenPvp = await getUnseenPvpAttack(teamId);
  if (unseenPvp) {
    throw Object.assign(
      new Error(`Voce foi atacado por ${unseenPvp.attackerName} antes de iniciar PvE. Veja o resultado do combate e tente novamente.`),
      { blockedByUnseenPvp: true, unseenPvp }
    );
  }

  assertTeamReady(team);

  // Aplica renda passiva acumulada antes da batalha
  await applyPassiveIncome(teamId).catch(() => null);

  // Cooldown: impede spam de bot battles
  const lastBattle = await prisma.arenaBattle.findFirst({
    where: { attackTeamId: teamId, type: "BOT" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastBattle) {
    const elapsed = Date.now() - lastBattle.createdAt.getTime();
    const cooldownMs = ARENA_Z_CONFIG.botCooldownMinutes * 60_000;
    if (elapsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
      throw new Error(`Aguarde ${remaining}s antes do proximo combate.`);
    }
  }

  const attackers = team.members.map(m => toArenaMascot(m.mascot));

  // Bot determinístico: usa pendingBotJson se disponível
  const useDifficulty = (team.pendingBotDifficulty as ArenaDifficulty | null) ?? difficulty;
  const diff = DIFFICULTY_CONFIG[useDifficulty];
  let band: { min: number; max: number };
  let botName: string;
  let defenders: ArenaMascot[];

  if (team.pendingBotJson) {
    // Usa o bot que o jogador viu no preview
    const locked = team.pendingBotJson as { botName: string; band: { min: number; max: number }; defenders: ArenaMascot[] };
    band = locked.band;
    botName = locked.botName;
    defenders = locked.defenders;
  } else {
    const bot = buildBotOpponent(attackers, useDifficulty);
    band = bot.band;
    botName = bot.botName;
    defenders = bot.defenders;
  }

  const combat = runCombat(attackers, defenders);
  const won = combat.result === "ATTACKER_WIN";
  // Recompensa escalada pela dificuldade
  const baseReward = won ? botReward(band.min, band.max, useDifficulty) : { coins: 0, exp: 0, food: 0, sweet: 0, egg: undefined, buffItem: undefined };
  const reward: ArenaLootFull = won ? {
    coins: Math.round(baseReward.coins * diff.rewardMult),
    exp:   Math.round(baseReward.exp   * diff.rewardMult),
    food:  baseReward.food,
    sweet: baseReward.sweet,
    egg:   baseReward.egg,
  } : baseReward;
  // Pokémon derrotados em combate ficam feridos independente do resultado
  // (mesmo na vitória, mascotes que caíram ficam indisponíveis para curar e recompor a equipe)
  const defeatedInCombat = combat.defeatedMascotIds;
  const injuryChance = 0.25 * diff.injuryChanceMult;
  const injuredMascotIds = defeatedInCombat.length > 0
    ? defeatedInCombat
    : (!won && Math.random() < injuryChance ? [pick(attackers).id] : []);
  const teamDefeated = !won && injuredMascotIds.length >= team.members.length;
  const currentVault: ArenaLoot = {
    coins: team.vaultCoins,
    exp: team.vaultExp,
    food: team.vaultFood,
    sweet: team.vaultSweet,
  };
  const defeatSplit = teamDefeated ? splitDefeatedLoot(currentVault) : null;
  const defeatPreserved = defeatSplit ? remainingLoot(currentVault, defeatSplit.stolen, defeatSplit.burned) : null;
  const defeatExpMascotIds = teamDefeated
    ? await getArenaExpMascotIds(team.id, playerId, team.enteredAt)
    : [];

  await prisma.$transaction(async (tx) => {
    const battle = await tx.arenaBattle.create({
      data: {
        type: "BOT",
        result: combat.result,
        attackerPlayerId: playerId,
        attackTeamId: team.id,
        botName,
        levelBandMin: band.min,
        levelBandMax: band.max,
        winnerPlayerId: won ? playerId : null,
        loserPlayerId: won ? null : playerId,
        rounds: combat.rounds,
        turnLog: combat.log as unknown as Prisma.InputJsonValue,
        lootResult: (teamDefeated
          ? { reward, preserved: defeatPreserved, burned: defeatSplit?.burned, stolenByBot: defeatSplit?.stolen, teamDefeated: true }
          : reward) as unknown as Prisma.InputJsonValue,
        injuredMascotIds: injuredMascotIds as unknown as Prisma.InputJsonValue,
      },
    });
    if (teamDefeated && defeatPreserved) {
      await creditArenaLoot(tx, playerId, defeatPreserved, `Cofre restante Arena Z apos K.O. total contra ${botName}`);
      await dropArenaGroundSpoils(tx, defeatSplit?.burned, playerId, battle.id);
      // Deleta o time: cascata remove os ArenaTeamMember automaticamente
      await tx.arenaTeam.delete({ where: { id: team.id } });
    } else {
      await tx.arenaTeam.update({
        where: { id: team.id },
        data: {
          vaultCoins: { increment: reward.coins },
          vaultExp: { increment: reward.exp },
          vaultFood: { increment: reward.food },
          vaultSweet: { increment: reward.sweet },
          lastBattleAt: new Date(),
          pendingBotJson: Prisma.JsonNull,
          pendingBotDifficulty: null,
        },
      });
    }
    // Entrega ovo diretamente ao inventário (não vai pro cofre)
    if (reward.egg && won) {
      await tx.mascotEgg.create({
        data: { playerId, type: reward.egg, origin: `Arena Z bot ${botName}` }
      });
    }
    // Item buff (Difícil) — vai pro cofre da equipe para poder ser roubado em PvP
    // Guardado como nota no vault via evento; entrega direta ao inventário na retirada
    if (reward.buffItem && won) {
      const shopItem = await tx.shopItem.findFirst({
        where: { type: reward.buffItem as never, active: true },
        select: { id: true },
      });
      if (shopItem) {
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId, itemId: shopItem.id } },
          update: { quantity: { increment: 1 } },
          create: { playerId, itemId: shopItem.id, quantity: 1 },
        });
        await tx.mascotEvent.create({
          data: {
            mascotId: team.members[0]?.mascotId ?? "",
            emoji: "🎁",
            description: `Arena Z Difícil: item especial (${reward.buffItem}) adicionado ao inventário!`,
          }
        }).catch(() => null);
      }
    }
    // Se o time não foi deletado (teamDefeated já cuida via cascade), remove membros feridos
    if (!teamDefeated && injuredMascotIds.length > 0) {
      await tx.arenaTeamMember.deleteMany({
        where: { teamId: team.id, mascotId: { in: injuredMascotIds } },
      });
    }
    for (const member of team.members) {
      const injured = injuredMascotIds.includes(member.mascotId);
      await tx.mascot.update({
        where: { id: member.mascotId },
        data: injured
          ? { arenaState: "INJURED", injuredAt: new Date(), isEquipped: false, battleLosses: { increment: 1 } }
          : { arenaState: "ARENA", restingUntil: null, battleWins: won ? { increment: 1 } : undefined },
      });
      await tx.mascotEvent.create({
        data: {
          mascotId: member.mascotId,
          emoji: injured ? "!" : "AZ",
          description: injured
            ? `Saiu ferido da Arena Z contra ${botName}.`
            : `Lutou na Arena Z contra ${botName}${won ? " e acumulou loot no cofre." : "."}`,
        },
      });
    }
  });

  if (teamDefeated && defeatPreserved) await distributeArenaExp(defeatExpMascotIds, defeatPreserved.exp);

  return {
    won,
    result: combat.result,
    botName,
    reward,
    rounds: combat.rounds,
    difficulty,
    difficultyLabel: diff.label,
    teamDefeated,
    preservedLoot: defeatPreserved,
    burnedLoot: defeatSplit?.burned ?? null,
    stolenByBotLoot: defeatSplit?.stolen ?? null,
    injuredMascotIds,
    injuredMascots: team.members
      .filter(member => injuredMascotIds.includes(member.mascotId))
      .map(member => member.mascot.nickname ?? getPokemonName(member.mascot.pokemonId)),
    playerMascots: attackers.map(m => ({
      id: m.id,
      pokemonId: m.pokemonId,
      name: m.name,
      level: m.level,
      maxHp: m.hp,
    })),
    botMascots: defenders.map(m => ({
      id: m.id,
      pokemonId: m.pokemonId,
      name: m.name,
      level: m.level,
      maxHp: m.hp,
      type: getPokemonElement(m.pokemonId),
    })),
    highlights: combat.log
      .filter(turn => turn.action === "ATTACK")
      .sort((a, b) => b.damage - a.damage)
      .slice(0, 3)
      .map(turn => ({
        turn: turn.turn,
        actorName: turn.actorName,
        targetName: turn.targetName,
        damage: turn.damage,
        advantageApplied: turn.advantageApplied,
      })),
    battleAnimation: (() => {
      const allMascots = new Map([...attackers, ...defenders].map(m => [m.id, m]));
      return combat.log
        .filter(t => t.action === "ATTACK")
        .slice(0, 28) // cap para animação não ficar longa demais
        .map(t => ({
          turn: t.turn,
          attackerId: t.actorId,
          attackerName: t.actorName,
          attackerPokemonId: allMascots.get(t.actorId)?.pokemonId ?? 0,
          defenderId: t.targetId,
          defenderName: t.targetName,
          defenderPokemonId: allMascots.get(t.targetId)?.pokemonId ?? 0,
          damage: t.damage,
          advantageApplied: t.advantageApplied,
          isPlayerAttacker: t.actorOwnerId !== null,
        }));
    })(),
  };
}

// ── Bot determinístico: salva o bot antes da batalha ─────────────────────────

export async function lockBotForTeam(playerId: string, teamId: string, difficulty: ArenaDifficulty = "normal") {
  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    include: { members: { include: { mascot: true }, orderBy: { slot: "asc" } } },
  });
  if (!team || team.playerId !== playerId) throw new Error("Equipe nao encontrada.");
  if (team.status !== "ACTIVE") throw new Error("Equipe nao esta ativa.");
  if (team.teamType === "PVP") throw new Error("Equipe Somente PvP nao pode gerar bot.");

  const attackers = team.members.map(m => toArenaMascot(m.mascot));
  const hourSlot = Math.floor(Date.now() / (10 * 60 * 1000));
  const seed = parseInt(teamId.replace(/[^0-9]/g, "").slice(-4) || "0") + hourSlot;
  const bot = buildBotOpponent(attackers, difficulty, seed);

  const botJson = {
    botName: bot.botName,
    band: bot.band,
    defenders: bot.defenders,
  };
  await prisma.arenaTeam.update({
    where: { id: teamId },
    data: {
      pendingBotJson: botJson as unknown as import("@prisma/client").Prisma.InputJsonValue,
      pendingBotDifficulty: difficulty,
    },
  });
  return {
    trainerName: bot.botName,
    levelBandMin: bot.band.min,
    levelBandMax: bot.band.max,
    difficulty,
    difficultyLabel: DIFFICULTY_CONFIG[difficulty].label,
    mascots: bot.defenders.map(m => ({
      id: m.id, pokemonId: m.pokemonId, name: m.name, level: m.level,
      type: getPokemonElement(m.pokemonId), force: m.force, agility: m.agility, vitality: m.vitality,
    })),
  };
}

// ── Ranking público ───────────────────────────────────────────────────────────

export async function getArenaRanking(limit = 20) {
  // Busca IDs de admins para excluir do ranking
  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { player: { select: { id: true } } },
  });
  const adminPlayerIds = new Set(
    adminUsers.map(u => u.player?.id).filter(Boolean) as string[]
  );

  const battles = await prisma.arenaBattle.findMany({
    where: {
      status: "RESOLVED",
      type: { in: ["BOT", "PVP"] },
      // Exclui batalhas onde atacante ou defensor é admin
      attackerPlayerId: { notIn: [...adminPlayerIds] },
      NOT: { defenderPlayerId: { in: [...adminPlayerIds] } },
    },
    include: {
      attackerPlayer: { select: { id: true, displayName: true, ptcglNick: true } },
      defenderPlayer: { select: { id: true, displayName: true, ptcglNick: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  type Row = { playerId: string; name: string; wins: number; losses: number; draws: number; stolenCoins: number; stolenExp: number };
  const map = new Map<string, Row>();
  const ensure = (id: string, name: string) => {
    if (!map.has(id)) map.set(id, { playerId: id, name, wins: 0, losses: 0, draws: 0, stolenCoins: 0, stolenExp: 0 });
    return map.get(id)!;
  };
  for (const b of battles) {
    const aName = b.attackerPlayer?.displayName ?? b.attackerPlayer?.ptcglNick ?? "?";
    const dName = b.defenderPlayer?.displayName ?? b.defenderPlayer?.ptcglNick ?? b.botName ?? "Bot";
    if (b.attackerPlayerId) ensure(b.attackerPlayerId, aName);
    if (b.defenderPlayerId) ensure(b.defenderPlayerId, dName);
    if (b.result === "DRAW") {
      if (b.attackerPlayerId) ensure(b.attackerPlayerId, aName).draws++;
      if (b.defenderPlayerId) ensure(b.defenderPlayerId, dName).draws++;
      continue;
    }
    if (b.winnerPlayerId) {
      const wName = b.winnerPlayerId === b.attackerPlayerId ? aName : dName;
      const row = ensure(b.winnerPlayerId, wName);
      row.wins++;
      const loot = b.lootResult as Record<string, unknown> | null;
      if (loot?.coins && typeof loot.coins === "number") row.stolenCoins += loot.coins;
      if (loot?.exp   && typeof loot.exp   === "number") row.stolenExp   += loot.exp;
    }
    if (b.loserPlayerId) {
      const lName = b.loserPlayerId === b.attackerPlayerId ? aName : dName;
      ensure(b.loserPlayerId, lName).losses++;
    }
  }
  return [...map.values()]
    .sort((a, b) => b.wins - a.wins || b.stolenCoins - a.stolenCoins || a.losses - b.losses)
    .slice(0, limit);
}

// ── Ataque oportunista de rival ───────────────────────────────────────────────

export async function runOpportunisticAttack(attackerPlayerId: string, targetMascotId: string) {
  // Verifica se mascote alvo está ferido e se atacante é rival
  const targetMascot = await prisma.mascot.findUnique({
    where: { id: targetMascotId },
    include: {
      player: { select: { id: true, displayName: true } },
      relationsAsA: { where: { mascotBId: { not: undefined } } },
      relationsAsB: { where: { type: "RIVAL" } },
    }
  });
  if (!targetMascot) throw new Error("Mascote nao encontrado.");
  if (targetMascot.arenaState !== "INJURED") throw new Error("Mascote nao esta ferido.");

  // Política de Fraqueza: bloqueia o ataque e consome o buff
  const weaknessPolicy = await prisma.mascotBuff.findFirst({
    where: { mascotId: targetMascotId, type: "WEAKNESS_POLICY", expiresAt: { gt: new Date("2090-01-01") } }
  });
  if (weaknessPolicy) {
    await prisma.mascotBuff.delete({ where: { id: weaknessPolicy.id } });
    await prisma.mascotEvent.create({
      data: { mascotId: targetMascotId, emoji: "🛡️", description: "Política de Fraqueza ativou! Ataque oportunista bloqueado. (buff consumido)" }
    });
    throw new Error("Este mascote está protegido pela Política de Fraqueza! O item foi consumido ao bloquear o ataque.");
  }

  const attackerPlayer = await prisma.player.findUnique({
    where: { id: attackerPlayerId },
    include: { mascots: { where: { arenaState: "FREE" }, take: 1 } }
  });
  if (!attackerPlayer) throw new Error("Atacante nao encontrado.");
  if (attackerPlayer.mascots.length === 0) throw new Error("Voce nao tem mascotes livres para atacar.");

  // Verifica se já atacou este mascote neste período de ferimento
  const recentOpportunistic = await prisma.arenaBattle.findFirst({
    where: {
      type: "OPPORTUNISTIC",
      attackerPlayerId,
      defenderPlayerId: targetMascot.playerId,
      createdAt: { gte: targetMascot.injuredAt ?? new Date(0) }
    }
  });
  if (recentOpportunistic) throw new Error("Voce ja atacou este mascote neste periodo de ferimento.");

  // Pequeno roubo: 5-15 EXP + chance de 1 petisco
  const stolenExp   = rand(5, 15);
  const stolenFood  = Math.random() < 0.3 ? 1 : 0;
  const extraRestMs = rand(15, 45) * 60 * 1000; // 15-45 min a mais de repouso

  const attackerMascotName = attackerPlayer.mascots[0]
    ? (attackerPlayer.mascots[0].nickname ?? getPokemonName(attackerPlayer.mascots[0].pokemonId))
    : "mascote";

  await prisma.$transaction(async (tx) => {
    // Registra a batalha oportunista
    await tx.arenaBattle.create({
      data: {
        type: "OPPORTUNISTIC",
        result: "ATTACKER_WIN",
        attackerPlayerId,
        defenderPlayerId: targetMascot.playerId,
        rounds: 1,
        turnLog: [{ turn: 1, actorName: `${attackerPlayer.displayName} (oportunista)`, damage: stolenExp, action: "ATTACK" }] as unknown as import("@prisma/client").Prisma.InputJsonValue,
        lootResult: { stolen: { exp: stolenExp, food: stolenFood } } as unknown as import("@prisma/client").Prisma.InputJsonValue,
        winnerPlayerId: attackerPlayerId,
        loserPlayerId: targetMascot.playerId,
      }
    });
    // Aplica EXP extra ao atacante
    if (stolenExp > 0 && attackerPlayer.mascots[0]) {
      await tx.mascot.update({
        where: { id: attackerPlayer.mascots[0].id },
        data: { exp: { increment: stolenExp } }
      });
    }
    // Aumenta tempo de repouso do alvo
    const currentRest = targetMascot.restingUntil ?? new Date();
    const newRest = new Date(Math.max(currentRest.getTime(), Date.now()) + extraRestMs);
    await tx.mascot.update({
      where: { id: targetMascotId },
      data: { restingUntil: newRest }
    });
    // Log de evento no mascote ferido
    await tx.mascotEvent.create({
      data: {
        mascotId: targetMascotId,
        emoji: "😈",
        description: `${attackerPlayer.displayName} aproveitou o ferimento e roubou ${stolenExp} EXP${stolenFood > 0 ? " e 1 petisco" : ""}. Repouso aumentado em ${Math.floor(extraRestMs / 60000)} min.`
      }
    });
  });

  return { stolenExp, stolenFood, extraRestMinutes: Math.floor(extraRestMs / 60000), attackerMascotName };
}

// ── Formata turno de combate para exibição legível ────────────────────────────

type PartialTurnLog = {
  turn: number;
  actorName: string;
  targetName?: string;
  damage?: number;
  advantageApplied?: boolean;
  action: string;
  actorOwnerId?: string | null;
  targetOwnerId?: string | null;
};

export function formatTurnLog(log: PartialTurnLog[]): string[] {
  return log.map(turn => {
    if (turn.action === "DEFEND") {
      return `Turno ${turn.turn}: ${turn.actorName} adotou postura defensiva.`;
    }
    const isBot = turn.actorOwnerId === null || turn.actorOwnerId === undefined;
    const targetIsBot = turn.targetOwnerId === null || turn.targetOwnerId === undefined;
    const actorTag = isBot ? " (bot)" : "";
    const targetTag = targetIsBot ? " (bot)" : "";
    const advantage = turn.advantageApplied ? " com vantagem de tipo!" : "";
    return `Turno ${turn.turn}: ${turn.actorName}${actorTag} atacou ${turn.targetName ?? "alvo"}${targetTag} causando ${turn.damage ?? 0} de dano${advantage}`;
  });
}

// ── Helpers PvP: recompensas de defesa, drops de ovo ─────────────────────────

/** Rolagem ponderada simples — retorna true com probabilidade `chance` (0–1) */
function roll(chance: number): boolean {
  return Math.random() < chance;
}

/** Retorna o tipo de ovo dropado (ou null) com base nas probabilidades da tabela */
function rollPvpEggDrop(scenario: "easy" | "balanced" | "hard" | "rival" | "defense" | "perfect_defense"): import("@prisma/client").EggType | null {
  const tables: Record<typeof scenario, { type: import("@prisma/client").EggType; chance: number }[]> = {
    easy:             [{ type: "COMMON", chance: 0.10 }, { type: "RARE", chance: 0.005 }],
    balanced:         [{ type: "COMMON", chance: 0.18 }, { type: "RARE", chance: 0.008 }, { type: "SPECIAL", chance: 0.005 }],
    hard:             [{ type: "COMMON", chance: 0.28 }, { type: "RARE", chance: 0.015 }, { type: "SPECIAL", chance: 0.008 }, { type: "EVENT", chance: 0.005 }],
    rival:            [{ type: "COMMON", chance: 0.32 }, { type: "RARE", chance: 0.018 }, { type: "SPECIAL", chance: 0.010 }, { type: "EVENT", chance: 0.005 }],
    defense:          [{ type: "COMMON", chance: 0.16 }, { type: "RARE", chance: 0.007 }, { type: "SPECIAL", chance: 0.005 }],
    perfect_defense:  [{ type: "COMMON", chance: 0.25 }, { type: "RARE", chance: 0.012 }, { type: "SPECIAL", chance: 0.007 }, { type: "EVENT", chance: 0.005 }],
  };
  // Percorre do mais raro ao mais comum (raridades não se acumulam)
  const table = [...tables[scenario]].reverse();
  for (const entry of table) {
    if (roll(entry.chance)) return entry.type;
  }
  return null;
}

/** Calcula o nível total de um time (soma dos níveis dos membros) */
function teamTotalLevel(members: { mascot: { level: number } }[]): number {
  return members.reduce((s, m) => s + m.mascot.level, 0);
}

export async function runPvpBattle(playerId: string, attackTeamId: string, defenseTeamId: string) {
  if (attackTeamId === defenseTeamId) throw new Error("Escolha duas equipes diferentes.");

  const [attackTeam, defenseTeam] = await Promise.all([
    prisma.arenaTeam.findUnique({
      where: { id: attackTeamId },
      include: {
        members: { include: { mascot: true }, orderBy: { slot: "asc" } },
        player: { select: { id: true, displayName: true } },
      },
    }),
    prisma.arenaTeam.findUnique({
      where: { id: defenseTeamId },
      include: {
        members: { include: { mascot: true }, orderBy: { slot: "asc" } },
        player: { select: { id: true, displayName: true } },
      },
    }),
  ]);

  if (!attackTeam || attackTeam.playerId !== playerId) throw new Error("Equipe atacante nao encontrada.");
  if (!defenseTeam) throw new Error("Equipe defensora nao encontrada.");
  if (defenseTeam.playerId === playerId) throw new Error("PvP precisa desafiar uma equipe de outro jogador.");

  // Bloqueia admins de participar de PvP real (para não contaminar rankings/loot)
  const [attackUser, defenseUser] = await Promise.all([
    prisma.player.findUnique({ where: { id: attackTeam.playerId }, include: { user: { select: { role: true } } } }),
    prisma.player.findUnique({ where: { id: defenseTeam.playerId }, include: { user: { select: { role: true } } } }),
  ]);
  const isAdminBattle = ["ADMIN","SUPER_ADMIN"].includes(attackUser?.user.role ?? "") || ["ADMIN","SUPER_ADMIN"].includes(defenseUser?.user.role ?? "");
  if (isAdminBattle) throw new Error("Contas admin nao participam de PvP real. Use o modo debug para testes.");
  if (attackTeam.status !== "ACTIVE" || defenseTeam.status !== "ACTIVE") throw new Error("As duas equipes precisam estar ativas.");
  if (attackTeam.members.length === 0 || defenseTeam.members.length === 0) throw new Error("As equipes precisam ter mascotes.");
  if (attackTeam.teamType === "PVE") throw new Error("Equipe Somente PvE nao pode atacar jogadores.");
  if (defenseTeam.teamType === "PVE") throw new Error("Equipe Somente PvE nao fica disponivel para PvP.");

  // Cooldown PvP: 10 min entre ataques PvP da mesma equipe atacante
  const lastPvp = await prisma.arenaBattle.findFirst({
    where: { type: "PVP", attackTeamId: attackTeamId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastPvp) {
    const elapsed = Date.now() - lastPvp.createdAt.getTime();
    const pvpCooldown = ARENA_Z_CONFIG.pvpCooldownMinutes * 60_000;
    if (elapsed < pvpCooldown) {
      const rem = Math.ceil((pvpCooldown - elapsed) / 1000);
      throw new Error(`Aguarde ${rem}s antes do proximo ataque PvP.`);
    }
  }
  // Anti-spam: impede atacar o mesmo time várias vezes seguidas
  const lastVsSameTeam = await prisma.arenaBattle.findFirst({
    where: { type: "PVP", attackTeamId, defenseTeamId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastVsSameTeam) {
    const elapsed = Date.now() - lastVsSameTeam.createdAt.getTime();
    if (elapsed < 30 * 60_000) { // 30 min entre ataques ao mesmo time
      throw new Error("Aguarde 30 min antes de atacar o mesmo time novamente.");
    }
  }

  assertTeamReady(attackTeam);
  assertTeamReady(defenseTeam);

  // Aplica renda passiva para ambos os times antes da batalha PvP
  await Promise.all([
    applyPassiveIncome(attackTeamId).catch(() => null),
    applyPassiveIncome(defenseTeamId).catch(() => null),
  ]);

  const attackers = attackTeam.members.map(m => toArenaMascot(m.mascot));
  const defenders = defenseTeam.members.map(m => toArenaMascot(m.mascot));
  const combat = runCombat(attackers, defenders);
  const attackerWon = combat.result === "ATTACKER_WIN";
  const defenderWon = combat.result === "DEFENDER_WIN";
  const draw = combat.result === "DRAW";
  const winnerTeam = attackerWon ? attackTeam : defenderWon ? defenseTeam : null;
  const loserTeam = attackerWon ? defenseTeam : defenderWon ? attackTeam : null;

  // ── Cenário PvP: determina tipo de batalha para drops e recompensas ────────
  const atkTotal = teamTotalLevel(attackTeam.members);
  const defTotal = teamTotalLevel(defenseTeam.members);
  const levelRatio = atkTotal > 0 && defTotal > 0 ? atkTotal / defTotal : 1;
  const isBalanced = levelRatio >= 0.8 && levelRatio <= 1.25;
  const attackerStronger = levelRatio > 1.25;
  const defenderStronger = levelRatio < 0.8;

  // Verifica relação de RIVAL entre mascotes dos dois jogadores
  const isRival = await prisma.mascotRelation.findFirst({
    where: {
      type: "RIVAL",
      OR: [
        { mascotA: { playerId: attackTeam.playerId }, mascotB: { playerId: defenseTeam.playerId } },
        { mascotA: { playerId: defenseTeam.playerId }, mascotB: { playerId: attackTeam.playerId } },
      ],
    },
    select: { id: true },
  }).then(r => !!r).catch(() => false);

  // Cenário de ataque (para drops do atacante que venceu)
  const attackScenario: "easy" | "balanced" | "hard" | "rival" = isRival
    ? "rival"
    : isBalanced
      ? "balanced"
      : attackerStronger
        ? "easy"
        : "hard";

  // Cenário de defesa (para drops do defensor que venceu)
  const perfectDefense = defenderWon && attackerStronger; // defensor venceu sendo mais fraco
  const defenseScenario: "defense" | "perfect_defense" = perfectDefense ? "perfect_defense" : "defense";

  // Drops de ovo: quem ganhou rola para ovo
  const attackerEgg = attackerWon ? rollPvpEggDrop(attackScenario) : null;
  const defenderEgg = defenderWon ? rollPvpEggDrop(defenseScenario) : null;

  // Recompensas ZC de defesa bem-sucedida (vão para o cofre do defensor)
  let defenseRewardCoins = 0;
  if (defenderWon) {
    const baseMin = isBalanced ? 150 : 80;
    const baseMax = isBalanced ? 250 : 180;
    defenseRewardCoins = Math.floor(baseMin + Math.random() * (baseMax - baseMin + 1));
    if (isRival) defenseRewardCoins += 50;
    if (perfectDefense) defenseRewardCoins += 80;
  }

  // IDs dos mascotes defensores que sobreviveram (para dar EXP de defesa)
  const survivingDefenderMascotIds = defenderWon
    ? defenseTeam.members
        .map(m => m.mascotId)
        .filter(id => !combat.defeatedMascotIds.includes(id))
    : [];
  const injuredMascotIds = loserTeam
    ? combat.defeatedMascotIds.filter(id => loserTeam.members.some(member => member.mascotId === id))
    : [];
  if (loserTeam && injuredMascotIds.length === 0) {
    injuredMascotIds.push(pick(loserTeam.members).mascotId);
  }
  const loserTeamDefeated = !!loserTeam && injuredMascotIds.length >= loserTeam.members.length;
  const losingLootWithMultiplier = loserTeam
    ? applyMultiplierToVault(
        { coins: loserTeam.vaultCoins, exp: loserTeam.vaultExp, food: loserTeam.vaultFood, sweet: loserTeam.vaultSweet },
        getTeamTimeMultiplier(loserTeam.enteredAt),
        false,
      )
    : { coins: 0, exp: 0, food: 0, sweet: 0, effectiveMult: 1 };
  const losingLoot: ArenaLoot = {
    coins: losingLootWithMultiplier.coins,
    exp: losingLootWithMultiplier.exp,
    food: losingLootWithMultiplier.food,
    sweet: losingLootWithMultiplier.sweet,
  };
  const lootSplit = loserTeamDefeated ? splitDefeatedLoot(losingLoot) : null;
  const preserved = lootSplit ? remainingLoot(losingLoot, lootSplit.stolen, lootSplit.burned) : null;
  const loserDefeatExpMascotIds = loserTeamDefeated && loserTeam
    ? await getArenaExpMascotIds(loserTeam.id, loserTeam.playerId, loserTeam.enteredAt)
    : [];
  let foundGroundSpoils: ArenaLoot | null = null;

  await prisma.$transaction(async (tx) => {
    const battle = await tx.arenaBattle.create({
      data: {
        type: "PVP",
        result: combat.result,
        attackerPlayerId: attackTeam.playerId,
        defenderPlayerId: defenseTeam.playerId,
        attackTeamId: attackTeam.id,
        defenseTeamId: defenseTeam.id,
        winnerPlayerId: winnerTeam?.playerId ?? null,
        loserPlayerId: loserTeam?.playerId ?? null,
        rounds: combat.rounds,
        turnLog: combat.log as unknown as Prisma.InputJsonValue,
        lootResult: {
          stolen: lootSplit?.stolen ?? { coins: 0, exp: 0, food: 0, sweet: 0 },
          burned: lootSplit?.burned ?? { coins: 0, exp: 0, food: 0, sweet: 0 },
          preserved: preserved ?? { coins: 0, exp: 0, food: 0, sweet: 0 },
          defenseRewardCoins,
          attackerEgg: attackerEgg ?? null,
          defenderEgg: defenderEgg ?? null,
        } as unknown as Prisma.InputJsonValue,
        injuredMascotIds: injuredMascotIds as unknown as Prisma.InputJsonValue,
      },
    });

    if (winnerTeam && lootSplit) {
      await tx.arenaTeam.update({
        where: { id: winnerTeam.id },
        data: {
          vaultCoins: { increment: lootSplit.stolen.coins },
          vaultExp: { increment: lootSplit.stolen.exp },
          vaultFood: { increment: lootSplit.stolen.food },
          vaultSweet: { increment: lootSplit.stolen.sweet },
          lastBattleAt: new Date(),
        },
      });
      await dropArenaGroundSpoils(tx, lootSplit.burned, loserTeam?.playerId ?? null, battle.id);
      foundGroundSpoils = await maybeFindArenaGroundSpoils(tx, winnerTeam.playerId, winnerTeam.id);
    }

    // Recompensa ZC de defesa bem-sucedida → adicionada ao cofre do defensor
    if (defenseRewardCoins > 0 && defenseTeam.status === "ACTIVE") {
      await tx.arenaTeam.update({
        where: { id: defenseTeam.id },
        data: { vaultCoins: { increment: defenseRewardCoins } },
      });
    }

    // Drops de ovo (fora da transação de loot principal, entrega direta ao inventário)
    if (attackerEgg) {
      await tx.mascotEgg.create({
        data: { playerId: attackTeam.playerId, type: attackerEgg, origin: `Vitória PvP contra ${defenseTeam.player.displayName}` },
      });
    }
    if (defenderEgg) {
      await tx.mascotEgg.create({
        data: { playerId: defenseTeam.playerId, type: defenderEgg, origin: `Defesa PvP contra ${attackTeam.player.displayName}` },
      });
    }

    if (loserTeam && preserved) {
      if (loserTeamDefeated) {
        await creditArenaLoot(tx, loserTeam.playerId, preserved, "Cofre restante Arena Z apos K.O. total em PvP");
        await tx.arenaTeam.delete({ where: { id: loserTeam.id } });
      } else {
        await tx.arenaTeam.update({
          where: { id: loserTeam.id },
          data: {
            vaultCoins: preserved.coins,
            vaultExp: preserved.exp,
            vaultFood: preserved.food,
            vaultSweet: preserved.sweet,
            lastBattleAt: new Date(),
          },
        });
      }
    }

    if (draw) {
      await tx.arenaTeam.updateMany({
        where: { id: { in: [attackTeam.id, defenseTeam.id] } },
        data: { lastBattleAt: new Date() },
      });
    }

    const allMembers = [...attackTeam.members, ...defenseTeam.members];
    if (loserTeam && injuredMascotIds.length > 0) {
      await tx.arenaTeamMember.deleteMany({
        where: { teamId: loserTeam.id, mascotId: { in: injuredMascotIds } },
      });
    }
    for (const member of allMembers) {
      const injured = injuredMascotIds.includes(member.mascotId);
      const won = winnerTeam?.id === member.teamId;
      await tx.mascot.update({
        where: { id: member.mascotId },
        data: injured
          ? { arenaState: "INJURED", injuredAt: new Date(), restingUntil: null, isEquipped: false, battleLosses: { increment: 1 } }
          : { arenaState: "ARENA", restingUntil: null, battleWins: won ? { increment: 1 } : undefined },
      });
      await tx.mascotEvent.create({
        data: {
          mascotId: member.mascotId,
          emoji: injured ? "PVP!" : "PVP",
          description: injured
            ? "Saiu ferido de um combate PvP da Arena Z."
            : `Participou de um combate PvP da Arena Z${won ? " e protegeu/roubou loot." : "."}`,
        },
      });
    }
  });

  if (loserTeamDefeated && preserved) await distributeArenaExp(loserDefeatExpMascotIds, preserved.exp);

  // EXP de defesa para mascotes defensores sobreviventes (30 EXP base + 20 extra se perfeita)
  if (survivingDefenderMascotIds.length > 0) {
    const defenseExp = perfectDefense ? 50 : 30;
    await Promise.all(
      survivingDefenderMascotIds.map(id =>
        addExp(id, defenseExp, { ignoreBenchPenalty: true }).catch(() => null)
      )
    );
  }

  const allMascots = new Map([...attackers, ...defenders].map(m => [m.id, m]));

  return {
    result: combat.result,
    winnerName: winnerTeam?.player.displayName ?? null,
    loserName: loserTeam?.player.displayName ?? null,
    stolen: lootSplit?.stolen ?? { coins: 0, exp: 0, food: 0, sweet: 0 },
    defenseRewardCoins,
    defenderEgg,
    attackerEgg,
    foundGroundSpoils,
    loserTeamDefeated,
    playerTeamName: attackTeam.player.displayName,
    botName: defenseTeam.player.displayName,
    playerMascots: attackers.map(m => ({
      id: m.id,
      pokemonId: m.pokemonId,
      name: m.name,
      level: m.level,
      maxHp: m.hp,
    })),
    botMascots: defenders.map(m => ({
      id: m.id,
      pokemonId: m.pokemonId,
      name: m.name,
      level: m.level,
      maxHp: m.hp,
    })),
    battleAnimation: combat.log
      .filter(t => t.action === "ATTACK")
      .slice(0, 28)
      .map(t => ({
        turn: t.turn,
        attackerId: t.actorId,
        attackerName: t.actorName,
        attackerPokemonId: allMascots.get(t.actorId)?.pokemonId ?? 0,
        defenderId: t.targetId,
        defenderName: t.targetName,
        defenderPokemonId: allMascots.get(t.targetId)?.pokemonId ?? 0,
        damage: t.damage,
        advantageApplied: t.advantageApplied,
        isPlayerAttacker: t.actorOwnerId === attackTeam.playerId,
      })),
  };
}

export async function healMascotSus(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote nao encontrado.");
  if (mascot.arenaState !== "INJURED") throw new Error("Mascote nao esta ferido.");
  // Aplica bônus acumulado por Super Amigos (visita SUS)
  const baseRestMs = ARENA_Z_CONFIG.restAfterSusHours * 3_600_000;
  const bonusReductionMs = (mascot.susRestBonusMinutes ?? 0) * 60_000;
  const effectiveRestMs = Math.max(30 * 60_000, baseRestMs - bonusReductionMs); // mínimo 30min
  const restingUntil = new Date(Date.now() + effectiveRestMs);

  await prisma.$transaction(async (tx) => {
    await creditCoins(tx, {
      playerId,
      type: "ADMIN_ADJUSTMENT",
      amount: -ARENA_Z_CONFIG.susCost,
      description: `Atendimento SUS Arena Z para ${mascot.nickname ?? getPokemonName(mascot.pokemonId)}`,
    });
    await tx.mascot.update({
      where: { id: mascot.id },
      data: { arenaState: "RESTING", injuredAt: null, restingUntil, susRestBonusMinutes: 0 },
    });
    const bonusNote = bonusReductionMs > 0
      ? ` (repouso reduzido ${mascot.susRestBonusMinutes}min por Super Amigos!)`
      : "";
    await tx.mascotEvent.create({
      data: {
        mascotId: mascot.id,
        emoji: "🏥",
        description: `Recebeu Atendimento SUS e entrou em repouso ate ${restingUntil.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.${bonusNote}`,
      },
    });
  });
}

// ── Tutorial bonus ────────────────────────────────────────────────────────────

export async function claimArenaTutorialBonus(playerId: string): Promise<{ error?: string; claimed?: boolean }> {
  try {
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { arenaTutorialClaimed: true } });
    if (!player) return { error: "Jogador nao encontrado." };
    if (player.arenaTutorialClaimed) return { claimed: false };
    const [proteinItem, waterItem] = await Promise.all([
      prisma.shopItem.findFirst({ where: { type: "MASCOT_BUFF_STAT", active: true }, select: { id: true } }),
      prisma.shopItem.findFirst({ where: { type: "MASCOT_BUFF_MOOD", active: true }, select: { id: true } }),
    ]);
    await prisma.$transaction(async (tx) => {
      await tx.player.update({ where: { id: playerId }, data: { arenaTutorialClaimed: true } });
      await tx.zikaCoinWallet.upsert({ where: { playerId }, update: { balance: { increment: 200 }, totalEarned: { increment: 200 } }, create: { playerId, balance: 200, totalEarned: 200 } });
      await tx.mascotFoodItem.upsert({ where: { playerId_type: { playerId, type: "FOOD" } }, update: { quantity: { increment: 3 } }, create: { playerId, type: "FOOD", quantity: 3 } });
      await tx.mascotEgg.createMany({ data: [
        { playerId, type: "COMMON",  origin: "Bônus Arena Z Tutorial" },
        { playerId, type: "RARE",    origin: "Bônus Arena Z Tutorial" },
        { playerId, type: "SPECIAL", origin: "Bônus Arena Z Tutorial" },
      ]});
      if (proteinItem) await tx.playerInventory.upsert({ where: { playerId_itemId: { playerId, itemId: proteinItem.id } }, update: { quantity: { increment: 1 } }, create: { playerId, itemId: proteinItem.id, quantity: 1 } });
      if (waterItem) await tx.playerInventory.upsert({ where: { playerId_itemId: { playerId, itemId: waterItem.id } }, update: { quantity: { increment: 1 } }, create: { playerId, itemId: waterItem.id, quantity: 1 } });
    });
    return { claimed: true };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function adminSetMascotArenaState(mascotId: string, state: "FREE" | "INJURED" | "RESTING") {
  const restingUntil = state === "RESTING" ? new Date(Date.now() + ARENA_Z_CONFIG.restAfterSusHours * 3_600_000) : null;
  await prisma.mascot.update({
    where: { id: mascotId },
    data: {
      arenaState: state,
      injuredAt: state === "INJURED" ? new Date() : null,
      restingUntil,
    },
  });
}

// ── Reparo de estado da Arena (admin) ─────────────────────────────────────────
/**
 * Corrige inconsistências de estado na Arena Z:
 * 1. Mascotes com arenaState=ARENA que não pertencem a nenhum time ativo → FREE
 * 2. Mascotes com arenaState=RESTING e restingUntil no passado → FREE
 * 3. Times ACTIVE sem nenhum membro → deletados
 * 4. Times com mascotes em ARENA/RESTING sem o mascote ter ArenaTeamMember correspondente → corrigido
 */
export async function adminRepairArenaStates(targetPlayerId?: string): Promise<{
  fixedOrphanArena: number;
  fixedExpiredResting: number;
  deletedEmptyTeams: number;
  fixedMismatchedTeamMembers: number;
  details: string[];
}> {
  const details: string[] = [];
  const wherePlayer = targetPlayerId ? { playerId: targetPlayerId } : {};

  // 1. Mascotes em ARENA sem ArenaTeamMember ativo
  const arenaButNoTeam = await prisma.mascot.findMany({
    where: {
      ...wherePlayer,
      arenaState: "ARENA",
      arenaTeamMembers: { none: {} },
    },
    select: { id: true, nickname: true, pokemonId: true, playerId: true },
  });
  if (arenaButNoTeam.length > 0) {
    await prisma.mascot.updateMany({
      where: { id: { in: arenaButNoTeam.map(m => m.id) } },
      data: { arenaState: "FREE", restingUntil: null },
    });
    for (const m of arenaButNoTeam) {
      details.push(`[ARENA→FREE] ${m.nickname ?? `#${m.pokemonId}`} (player ${m.playerId})`);
    }
  }

  // 2. Mascotes em RESTING com restingUntil no passado
  const expiredResting = await prisma.mascot.findMany({
    where: {
      ...wherePlayer,
      arenaState: "RESTING",
      restingUntil: { lt: new Date() },
    },
    select: { id: true, nickname: true, pokemonId: true, playerId: true },
  });
  if (expiredResting.length > 0) {
    await prisma.mascot.updateMany({
      where: { id: { in: expiredResting.map(m => m.id) } },
      data: { arenaState: "FREE", restingUntil: null },
    });
    for (const m of expiredResting) {
      details.push(`[RESTING_EXPIRED→FREE] ${m.nickname ?? `#${m.pokemonId}`} (player ${m.playerId})`);
    }
  }

  // 3. Times ACTIVE sem nenhum membro
  const emptyActiveTeams = await prisma.arenaTeam.findMany({
    where: { ...wherePlayer, status: "ACTIVE", members: { none: {} } },
    select: { id: true, name: true, playerId: true },
  });
  if (emptyActiveTeams.length > 0) {
    await prisma.arenaTeam.deleteMany({
      where: { id: { in: emptyActiveTeams.map(t => t.id) } },
    });
    for (const t of emptyActiveTeams) {
      details.push(`[EMPTY_TEAM_DELETED] ${t.name} (player ${t.playerId})`);
    }
  }

  // 4. ArenaTeamMembers cujo mascote NÃO está em arenaState=ARENA (mismatch)
  const mismatchedMembers = await prisma.arenaTeamMember.findMany({
    where: {
      team: { status: "ACTIVE", ...wherePlayer },
      mascot: { arenaState: { not: "ARENA" } },
    },
    include: { mascot: { select: { id: true, nickname: true, pokemonId: true, arenaState: true } }, team: { select: { id: true, name: true } } },
  });
  const fixedIds: string[] = [];
  for (const member of mismatchedMembers) {
    if (member.mascot.arenaState === "FREE") {
      // Mascote FREE mas ainda registrado como membro — corrige para ARENA
      await prisma.mascot.update({
        where: { id: member.mascot.id },
        data: { arenaState: "ARENA" },
      });
      details.push(`[FREE→ARENA mismatch fixed] ${member.mascot.nickname ?? `#${member.mascot.pokemonId}`} na equipe ${member.team.name}`);
      fixedIds.push(member.mascot.id);
    }
    // Se INJURED ou RESTING — remover do time (já é o comportamento de syncDefeated)
    if (member.mascot.arenaState === "INJURED" || member.mascot.arenaState === "RESTING") {
      await prisma.arenaTeamMember.delete({ where: { id: member.id } });
      details.push(`[MEMBER_REMOVED injured/resting] ${member.mascot.nickname ?? `#${member.mascot.pokemonId}`} da equipe ${member.team.name}`);
      fixedIds.push(member.mascot.id);
    }
  }

  // 5. Times que ficaram com 0 membros após remoção
  const nowEmptyAfterFix = await prisma.arenaTeam.findMany({
    where: { ...wherePlayer, status: "ACTIVE", members: { none: {} } },
    select: { id: true, name: true },
  });
  if (nowEmptyAfterFix.length > 0) {
    await prisma.arenaTeam.deleteMany({
      where: { id: { in: nowEmptyAfterFix.map(t => t.id) } },
    });
    for (const t of nowEmptyAfterFix) details.push(`[EMPTY_AFTER_FIX_DELETED] ${t.name}`);
  }

  return {
    fixedOrphanArena: arenaButNoTeam.length,
    fixedExpiredResting: expiredResting.length,
    deletedEmptyTeams: emptyActiveTeams.length + nowEmptyAfterFix.length,
    fixedMismatchedTeamMembers: fixedIds.length,
    details,
  };
}
