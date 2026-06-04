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
  botCooldownMinutes: 3,  // cooldown entre batalhas de bot por equipe
};

// Dificuldades: modificam a faixa de nível do bot
export const DIFFICULTY_CONFIG = {
  easy:   { levelOffset: -5, rewardMult: 0.6, injuryChanceMult: 0.4, label: "Fácil",  color: "green", desc: "Bot 5 níveis abaixo. Menos loot, quase sem risco de ferimento." },
  normal: { levelOffset:  0, rewardMult: 1.0, injuryChanceMult: 1.0, label: "Normal", color: "yellow", desc: "Bot equivalente ao nível médio da equipe." },
  hard:   { levelOffset: +5, rewardMult: 1.8, injuryChanceMult: 2.5, label: "Difícil", color: "red",   desc: "Bot 5 níveis acima. Loot muito maior, risco alto de ferimento." },
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

function makeBotMascot(index: number, levelMin: number, levelMax: number): ArenaMascot {
  const pokemonIds = [1, 4, 7, 25, 37, 54, 58, 63, 66, 92, 133, 147, 152, 155, 158, 179, 197, 215, 246];
  const pokemonId = pick(pokemonIds);
  const level = rand(levelMin, levelMax);
  return {
    id: `bot-${index}-${pokemonId}-${level}`,
    ownerId: null,
    pokemonId,
    name: `${getPokemonName(pokemonId)} Bot`,
    level,
    force: rand(8, 14) + Math.floor(level / 2),
    agility: rand(8, 14) + Math.floor(level / 2),
    instinct: rand(8, 14) + Math.floor(level / 3),
    vitality: rand(8, 14) + Math.floor(level / 2),
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

export type ArenaLootFull = ArenaLoot & { egg?: "COMMON" | "RARE" | "SPECIAL" };

function botReward(levelMin: number, levelMax: number): ArenaLootFull {
  const tier = Math.ceil(levelMax / 5);
  const eggRoll = Math.random();
  // Tier 4+ (level 20+): chance de ovo comum / raro
  const eggChance = tier >= 8 ? 0.12 : tier >= 6 ? 0.08 : tier >= 4 ? 0.05 : 0;
  const rareEggChance = tier >= 10 ? 0.04 : tier >= 8 ? 0.02 : 0;
  let egg: "COMMON" | "RARE" | "SPECIAL" | undefined;
  if (eggRoll < rareEggChance) egg = "RARE";
  else if (eggRoll < eggChance) egg = "COMMON";
  return {
    coins: rand(5 * tier, 15 * tier),
    exp:   rand(5 * tier, 18 * tier),
    food:  Math.random() < Math.min(0.45, tier * 0.05) ? 1 : 0,
    sweet: Math.random() < Math.min(0.2, tier * 0.025) ? 1 : 0,
    egg,
  };
}

function getBotRewardRange(levelMax: number) {
  const tier = Math.ceil(levelMax / 5);
  return {
    coinsMin: 5 * tier,
    coinsMax: 15 * tier,
    expMin: 5 * tier,
    expMax: 18 * tier,
    foodChance: Math.min(45, tier * 5),
    sweetChance: Math.min(20, tier * 2.5),
  };
}

function buildBotOpponent(attackers: ArenaMascot[], difficulty: ArenaDifficulty = "normal", seed?: number) {
  const avgLevel = Math.max(1, Math.round(attackers.reduce((sum, m) => sum + m.level, 0) / attackers.length));
  const diff = DIFFICULTY_CONFIG[difficulty];
  const adjustedLevel = Math.max(1, avgLevel + diff.levelOffset);
  const band = levelBand(adjustedLevel);
  const botSize = rand(2, Math.min(6, Math.max(2, attackers.length + rand(-1, 1))));
  // Seed determinístico: usa seed se fornecido, caso contrário gera aleatório
  const nameSeed = seed !== undefined ? seed % BOT_NAMES.length : Math.floor(Math.random() * BOT_NAMES.length);
  const botName = BOT_NAMES[nameSeed];
  const defenders = Array.from({ length: botSize }, (_, index) => makeBotMascot(index + 1, band.min, band.max));
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
    where: { attackTeamId: teamId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const cooldownMs = lastBattle
    ? Math.max(0, ARENA_Z_CONFIG.botCooldownMinutes * 60_000 - (Date.now() - lastBattle.createdAt.getTime()))
    : 0;
  return {
    trainerName: bot.botName,
    levelBandMin: bot.band.min,
    levelBandMax: bot.band.max,
    rewardRange: bot.rewardRange,
    difficulty,
    difficultyLabel: diff.label,
    difficultyColor: diff.color,
    injuryRisk: difficulty === "easy" ? "Baixo" : difficulty === "normal" ? "Médio" : "Alto",
    cooldownMs,
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
    if (member.mascot.restingUntil && member.mascot.restingUntil > now) throw new Error(`${name} esta em repouso ate ${member.mascot.restingUntil.toLocaleString("pt-BR")}.`);
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

export async function createArenaTeam(playerId: string, name: string, mascotIds: string[]) {
  const mascots = await validateArenaMascots(playerId, mascotIds);
  const teamName = name.trim() || "Equipe Arena Z";

  return prisma.$transaction(async (tx) => {
    const team = await tx.arenaTeam.create({
      data: {
        playerId,
        name: teamName,
        members: {
          create: mascots.map((m, index) => ({ mascotId: m.id, slot: index + 1 })),
        },
      },
    });
    await tx.mascot.updateMany({
      where: { id: { in: mascots.map(m => m.id) } },
      data: { arenaState: "ARENA", isEquipped: false },
    });
    return team;
  });
}

export async function retireArenaTeam(playerId: string, teamId: string) {
  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team || team.playerId !== playerId) throw new Error("Equipe nao encontrada.");
  if (team.status !== "ACTIVE") throw new Error("Equipe ja retirada.");
  const expPerMascot = team.vaultExp > 0 ? Math.max(1, Math.floor(team.vaultExp / team.members.length)) : 0;

  await prisma.$transaction(async (tx) => {
    if (team.vaultCoins > 0) {
      await creditCoins(tx, {
        playerId,
        type: "BET_WON",
        amount: team.vaultCoins,
        description: `Retirada do cofre da Arena Z: ${team.vaultCoins} ZC`,
      });
    }
    if (team.vaultFood > 0) {
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId, type: "FOOD" } },
        update: { quantity: { increment: team.vaultFood } },
        create: { playerId, type: "FOOD", quantity: team.vaultFood },
      });
    }
    if (team.vaultSweet > 0) {
      await tx.mascotFoodItem.upsert({
        where: { playerId_type: { playerId, type: "SWEET" } },
        update: { quantity: { increment: team.vaultSweet } },
        create: { playerId, type: "SWEET", quantity: team.vaultSweet },
      });
    }
    for (const member of team.members) {
      await tx.mascot.update({ where: { id: member.mascotId }, data: { arenaState: "FREE" } });
    }
    await tx.arenaTeam.update({
      where: { id: team.id },
      data: { status: "RETIRED", vaultCoins: 0, vaultExp: 0, vaultFood: 0, vaultSweet: 0 },
    });
  });

  if (expPerMascot > 0) {
    await Promise.all(team.members.map(member => addExp(member.mascotId, expPerMascot).catch(() => null)));
  }
}

export async function runBotBattle(playerId: string, teamId: string, difficulty: ArenaDifficulty = "normal") {
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
  assertTeamReady(team);

  // Cooldown: impede spam de bot battles
  const lastBattle = await prisma.arenaBattle.findFirst({
    where: { attackTeamId: teamId },
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
  const baseReward = won ? botReward(band.min, band.max) : { coins: 0, exp: 0, food: 0, sweet: 0, egg: undefined };
  const reward: ArenaLootFull = won ? {
    coins: Math.round(baseReward.coins * diff.rewardMult),
    exp:   Math.round(baseReward.exp   * diff.rewardMult),
    food:  baseReward.food,
    sweet: baseReward.sweet,
    egg:   baseReward.egg,
  } : baseReward;
  // Risco de ferimento aumenta com dificuldade
  const rawInjured = !won ? combat.defeatedMascotIds : [];
  const injuryChance = won ? 0 : 0.25 * diff.injuryChanceMult;
  const injuredMascotIds = rawInjured.length > 0
    ? rawInjured
    : (!won && Math.random() < injuryChance ? [pick(attackers).id] : []);
  const restUntil = new Date(Date.now() + ARENA_Z_CONFIG.restAfterWinMinutes * 60_000);

  await prisma.$transaction(async (tx) => {
    await tx.arenaBattle.create({
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
        lootResult: reward as unknown as Prisma.InputJsonValue,
        injuredMascotIds: injuredMascotIds as unknown as Prisma.InputJsonValue,
      },
    });
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
    // Entrega ovo diretamente ao inventário (não vai pro cofre)
    if (reward.egg && won) {
      await tx.mascotEgg.create({
        data: { playerId, type: reward.egg, origin: `Arena Z bot ${botName}` }
      });
    }
    for (const member of team.members) {
      const injured = injuredMascotIds.includes(member.mascotId);
      await tx.mascot.update({
        where: { id: member.mascotId },
        data: injured
          ? { arenaState: "INJURED", injuredAt: new Date(), isEquipped: false, battleLosses: { increment: 1 } }
          : { restingUntil: restUntil, battleWins: won ? { increment: 1 } : undefined },
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

  return {
    won,
    result: combat.result,
    botName,
    reward,
    rounds: combat.rounds,
    difficulty,
    difficultyLabel: diff.label,
    injuredMascotIds,
    injuredMascots: team.members
      .filter(member => injuredMascotIds.includes(member.mascotId))
      .map(member => member.mascot.nickname ?? getPokemonName(member.mascot.pokemonId)),
    botMascots: defenders.map(m => ({
      pokemonId: m.pokemonId,
      name: m.name,
      level: m.level,
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
  const battles = await prisma.arenaBattle.findMany({
    where: { status: "RESOLVED", type: { in: ["BOT", "PVP"] } },
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
  if (attackTeam.status !== "ACTIVE" || defenseTeam.status !== "ACTIVE") throw new Error("As duas equipes precisam estar ativas.");
  if (attackTeam.members.length === 0 || defenseTeam.members.length === 0) throw new Error("As equipes precisam ter mascotes.");

  assertTeamReady(attackTeam);
  assertTeamReady(defenseTeam);

  const attackers = attackTeam.members.map(m => toArenaMascot(m.mascot));
  const defenders = defenseTeam.members.map(m => toArenaMascot(m.mascot));
  const combat = runCombat(attackers, defenders);
  const attackerWon = combat.result === "ATTACKER_WIN";
  const defenderWon = combat.result === "DEFENDER_WIN";
  const draw = combat.result === "DRAW";
  const winnerTeam = attackerWon ? attackTeam : defenderWon ? defenseTeam : null;
  const loserTeam = attackerWon ? defenseTeam : defenderWon ? attackTeam : null;
  const restUntil = new Date(Date.now() + ARENA_Z_CONFIG.restAfterWinMinutes * 60_000);
  const losingLoot: ArenaLoot = loserTeam
    ? { coins: loserTeam.vaultCoins, exp: loserTeam.vaultExp, food: loserTeam.vaultFood, sweet: loserTeam.vaultSweet }
    : { coins: 0, exp: 0, food: 0, sweet: 0 };
  const lootSplit = loserTeam ? splitDefeatedLoot(losingLoot) : null;
  const preserved = lootSplit ? remainingLoot(losingLoot, lootSplit.stolen, lootSplit.burned) : null;
  const injuredMascotIds = loserTeam
    ? combat.defeatedMascotIds.filter(id => loserTeam.members.some(member => member.mascotId === id))
    : [];
  if (loserTeam && injuredMascotIds.length === 0) {
    injuredMascotIds.push(pick(loserTeam.members).mascotId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.arenaBattle.create({
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
    }

    if (loserTeam && preserved) {
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

    if (draw) {
      await tx.arenaTeam.updateMany({
        where: { id: { in: [attackTeam.id, defenseTeam.id] } },
        data: { lastBattleAt: new Date() },
      });
    }

    const allMembers = [...attackTeam.members, ...defenseTeam.members];
    for (const member of allMembers) {
      const injured = injuredMascotIds.includes(member.mascotId);
      const won = winnerTeam?.id === member.teamId;
      await tx.mascot.update({
        where: { id: member.mascotId },
        data: injured
          ? { arenaState: "INJURED", injuredAt: new Date(), restingUntil: null, isEquipped: false, battleLosses: { increment: 1 } }
          : { restingUntil: restUntil, battleWins: won ? { increment: 1 } : undefined },
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

  return {
    result: combat.result,
    winnerName: winnerTeam?.player.displayName ?? null,
    loserName: loserTeam?.player.displayName ?? null,
    stolen: lootSplit?.stolen ?? { coins: 0, exp: 0, food: 0, sweet: 0 },
  };
}

export async function healMascotSus(playerId: string, mascotId: string) {
  const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
  if (!mascot || mascot.playerId !== playerId) throw new Error("Mascote nao encontrado.");
  if (mascot.arenaState !== "INJURED") throw new Error("Mascote nao esta ferido.");
  const restingUntil = new Date(Date.now() + ARENA_Z_CONFIG.restAfterSusHours * 3_600_000);

  await prisma.$transaction(async (tx) => {
    await creditCoins(tx, {
      playerId,
      type: "ADMIN_ADJUSTMENT",
      amount: -ARENA_Z_CONFIG.susCost,
      description: `Atendimento SUS Arena Z para ${mascot.nickname ?? getPokemonName(mascot.pokemonId)}`,
    });
    await tx.mascot.update({
      where: { id: mascot.id },
      data: { arenaState: "RESTING", injuredAt: null, restingUntil },
    });
    await tx.mascotEvent.create({
      data: {
        mascotId: mascot.id,
        emoji: "SUS",
        description: `Recebeu Atendimento SUS e entrou em repouso ate ${restingUntil.toLocaleString("pt-BR")}.`,
      },
    });
  });
}

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
