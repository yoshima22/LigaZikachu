import { prisma } from "@/lib/prisma";
import { creditCoins } from "@/lib/zikacoins";
import { addExp } from "@/lib/mascot";
import { getPokemonElement, getPokemonName, getTypeAdvantageMultiplier } from "@/lib/mascot-data";
import type { ArenaBattleResult, Prisma } from "@prisma/client";

export const ARENA_Z_CONFIG = {
  susCost: 10,
  restAfterSusHours: 3,
  restAfterWinMinutes: 30,
  defeatedLootPreservedPct: 0.6,
  defeatedLootStolenPct: 0.3,
  defeatedLootBurnPct: 0.1,
};

const BOT_NAMES = [
  "Nando Faisca", "Beto Raio", "Cida Tempestade", "Tuca do Beco", "Mestre Pingo",
  "Nina das Folhas", "Raul Pedreira", "Leo Brasa", "Jana Sombria", "Gui do Choque",
  "Mira Mare", "Dani Esporo", "Ruan Cascalho", "Toni Vento", "Carla Prisma",
  "Zeca do Trovao", "Bruna Fagulha", "Caio Raiz", "Vini Nevoeiro", "Lari Cristal",
  "Dudu Ferrugem", "Fe Labareda", "Igor Relampago", "Manu Aurora", "Biel Espinho",
  "Rita Eclipse", "Pedro Turbina", "Kika Granito", "Samuca Poeira", "Taina Estrela",
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

function botReward(levelMin: number, levelMax: number): ArenaLoot {
  const tier = Math.ceil(levelMax / 5);
  return {
    coins: rand(5 * tier, 15 * tier),
    exp: rand(5 * tier, 18 * tier),
    food: Math.random() < Math.min(0.45, tier * 0.05) ? 1 : 0,
    sweet: Math.random() < Math.min(0.2, tier * 0.025) ? 1 : 0,
  };
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

export async function runBotBattle(playerId: string, teamId: string) {
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

  const attackers = team.members.map(m => toArenaMascot(m.mascot));
  const avgLevel = Math.max(1, Math.round(attackers.reduce((sum, m) => sum + m.level, 0) / attackers.length));
  const band = levelBand(avgLevel);
  const botSize = rand(2, Math.min(6, Math.max(2, attackers.length + rand(-1, 1))));
  const botName = pick(BOT_NAMES);
  const defenders = Array.from({ length: botSize }, (_, index) => makeBotMascot(index + 1, band.min, band.max));
  const combat = runCombat(attackers, defenders);
  const won = combat.result === "ATTACKER_WIN";
  const reward = won ? botReward(band.min, band.max) : { coins: 0, exp: 0, food: 0, sweet: 0 };
  const injuredMascotIds = won ? [] : combat.defeatedMascotIds.length > 0 ? combat.defeatedMascotIds : [pick(attackers).id];
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
      },
    });
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

  return { won, botName, reward, rounds: combat.rounds };
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
