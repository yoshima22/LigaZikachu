import { EggType, ZikaCoinTxType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toBrtDateString } from "@/lib/date-utils";
import { getPokemonName } from "@/lib/mascot-data";
import { loadModEffect, runSyncBattle, type ModEffect, type SyntheticSyncMascot } from "@/lib/sync-battle";
import { materializeRoundModifier } from "@/lib/sync-round-modifiers";

const SELECTION_WINDOW_MS = 10 * 60 * 1000;

function pokemonGen(id: number): number {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  return 9;
}

function buildRoundPairings<T>(teams: T[], roundNumber: number): [T, T | null][] {
  if (teams.length <= 1) return teams.map((team) => [team, null]);

  const pool: (T | null)[] = [...teams];
  if (pool.length % 2 === 1) pool.push(null);

  const rotations = Math.max(0, roundNumber - 1);
  for (let i = 0; i < rotations; i++) {
    const fixed = pool[0];
    const rest = pool.slice(1);
    const last = rest.pop();
    pool.splice(0, pool.length, fixed ?? null, last ?? null, ...rest);
  }

  const pairings: [T, T | null][] = [];
  const half = pool.length / 2;
  for (let i = 0; i < half; i++) {
    const a = pool[i];
    const b = pool[pool.length - 1 - i];
    if (a) pairings.push([a, b ?? null]);
    else if (b) pairings.push([b, null]);
  }
  return pairings;
}

function makeSyncBotMascots(baseMascots: SyntheticSyncMascot[], seed: number): SyntheticSyncMascot[] {
  const fallbackLevel = 12;
  const count = Math.max(3, Math.min(6, baseMascots.length || 6));
  const avg = (field: keyof Pick<SyntheticSyncMascot, "level" | "statForce" | "statAgility" | "statVitality" | "statCharisma" | "statInstinct" | "happiness">, fallback: number) => {
    if (baseMascots.length === 0) return fallback;
    return baseMascots.reduce((sum, mascot) => sum + Number(mascot[field] ?? fallback), 0) / baseMascots.length;
  };

  const pokemonPool = [25, 59, 65, 68, 94, 130, 143, 149, 181, 197, 208, 212, 214, 229, 248];
  const level = Math.max(5, Math.round(avg("level", fallbackLevel) + 2));
  const force = Math.max(5, Math.round(avg("statForce", 12) * 1.08));
  const agility = Math.max(5, Math.round(avg("statAgility", 12) * 1.08));
  const vitality = Math.max(5, Math.round(avg("statVitality", 12) * 1.08));
  const charisma = Math.max(5, Math.round(avg("statCharisma", 12) * 1.04));
  const instinct = Math.max(5, Math.round(avg("statInstinct", 12) * 1.04));

  return Array.from({ length: count }, (_, index) => {
    const pokemonId = pokemonPool[(seed + index * 3) % pokemonPool.length];
    return {
      id: `sync-bot-${seed}-${index}-${pokemonId}`,
      pokemonId,
      nickname: `Sombra ${getPokemonName(pokemonId)}`,
      level,
      statForce: force + (index % 3),
      statAgility: agility + ((index + 1) % 3),
      statVitality: vitality + ((index + 2) % 3),
      statCharisma: charisma,
      statInstinct: instinct,
      happiness: Math.round(avg("happiness", 70)),
      mood: "FOCUSED",
      combatRole: index % 3 === 0 ? "DEFENDER" : index % 3 === 1 ? "ATTACKER" : "SUPPORT",
    };
  });
}

const EGG_REWARD_MAP: Record<string, EggType> = {
  EGG_COMMON: EggType.COMMON,
  EGG_RARE: EggType.RARE,
  EGG_SPECIAL: EggType.SPECIAL,
  EGG_EVENT: EggType.EVENT,
  EGG_LAB: EggType.LAB,
  EGG_COMMON_CHANCE: EggType.COMMON,
};

async function applyRoundRewardModifier(
  tx: Prisma.TransactionClient,
  modEffect: ModEffect | null,
  teamA: { id: string; playerAId: string; playerBId: string | null },
  teamB: { id: string; playerAId: string; playerBId: string | null },
  battleResult: { result: string; teamADamage: number; teamBDamage: number },
  selections: { teamId: string; playerId: string; mascotIds: string[] }[],
  roomId: string,
): Promise<void> {
  if (!modEffect) return;
  const effect = modEffect as Record<string, unknown>;
  const type = typeof effect.type === "string" ? effect.type : "";
  if (!type.startsWith("REWARD_")) return;

  const playersA = [teamA.playerAId, teamA.playerBId].filter(Boolean) as string[];
  const playersB = [teamB.playerAId, teamB.playerBId].filter(Boolean) as string[];
  const allPlayers = [...playersA, ...playersB];
  const aWon = battleResult.result === "TEAM_A_WIN";
  const bWon = battleResult.result === "TEAM_B_WIN";
  const winnerPlayers = aWon ? playersA : bWon ? playersB : [];
  const loserPlayers = aWon ? playersB : bWon ? playersA : [];

  const grantEgg = async (playerId: string, eggType: EggType) => {
    await tx.mascotEgg.create({ data: { playerId, type: eggType, origin: "Modificador de Rodada" } });
  };

  const grantCoins = async (playerId: string, amount: number) => {
    const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId } });
    if (!wallet) return;
    await tx.zikaCoinWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount }, totalEarned: { increment: amount } },
    });
    await tx.zikaCoinTransaction.create({
      data: {
        walletId: wallet.id,
        type: ZikaCoinTxType.ADMIN_ADJUSTMENT,
        amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance + amount,
        description: "Desafio Sincronizado - bonus de modificador",
      },
    });
  };

  const grantItem = async (playerId: string, itemName: string) => {
    const shopItem = await tx.shopItem.findFirst({
      where: { name: { contains: itemName, mode: "insensitive" }, active: true },
      select: { id: true },
    });
    if (shopItem) {
      await tx.playerInventory.upsert({
        where: { playerId_itemId: { playerId, itemId: shopItem.id } },
        update: { quantity: { increment: 1 } },
        create: { playerId, itemId: shopItem.id, quantity: 1, equipped: false },
      });
    } else {
      await tx.playerGift.create({
        data: {
          playerId,
          type: "CUSTOM",
          title: "Bonus do Modificador",
          description: `Voce ganhou: ${itemName}`,
          payload: { item: itemName, source: "sync-modifier" },
          status: "UNCLAIMED",
        },
      });
    }
  };

  switch (type) {
    case "REWARD_WINNER": {
      const item = typeof effect.item === "string" ? effect.item : null;
      if (item) for (const pid of winnerPlayers) await grantItem(pid, item);
      break;
    }
    case "REWARD_ALL": {
      const item = typeof effect.item === "string" ? effect.item : null;
      if (item) for (const pid of allPlayers) await grantItem(pid, item);
      break;
    }
    case "REWARD_LOWEST_SCORE": {
      const item = typeof effect.item === "string" ? effect.item : null;
      if (item) for (const pid of loserPlayers) await grantItem(pid, item);
      break;
    }
    case "REWARD_CHANCE_WINNER": {
      const reward = typeof effect.reward === "string" ? effect.reward : null;
      const chance = typeof effect.chance === "number" ? effect.chance : 0.05;
      const eggType = reward ? EGG_REWARD_MAP[reward] : null;
      if (eggType && Math.random() < chance) {
        for (const pid of winnerPlayers) await grantEgg(pid, eggType);
      }
      break;
    }
    case "REWARD_UNDERDOG_WIN": {
      if (winnerPlayers.length === 0) break;
      const value = typeof effect.value === "number" ? effect.value : 0;
      if (value <= 0) break;
      const [scoresA, scoresB] = await Promise.all([
        tx.syncEventScore.findMany({ where: { roomId, teamId: teamA.id }, select: { wins: true } }),
        tx.syncEventScore.findMany({ where: { roomId, teamId: teamB.id }, select: { wins: true } }),
      ]);
      const winsA = Math.max(...scoresA.map((s) => s.wins), 0);
      const winsB = Math.max(...scoresB.map((s) => s.wins), 0);
      const underdogWon = (aWon && winsA < winsB) || (bWon && winsB < winsA);
      if (underdogWon) for (const pid of winnerPlayers) await grantCoins(pid, value);
      break;
    }
    case "REWARD_RANDOM_PLAYER": {
      const value = typeof effect.value === "number" ? effect.value : 0;
      const randomPid = allPlayers[Math.floor(Math.random() * allPlayers.length)];
      if (randomPid && value > 0) await grantCoins(randomPid, value);
      break;
    }
    case "REWARD_TOP_INSTINCT":
    case "REWARD_TOP_INSTINCT_CHANCE": {
      const reward = typeof effect.reward === "string" ? effect.reward : null;
      const chance = type === "REWARD_TOP_INSTINCT" ? 1 : (typeof effect.chance === "number" ? effect.chance : 0.2);
      if (!reward || Math.random() > chance) break;
      const eggType = EGG_REWARD_MAP[reward];
      if (!eggType) break;
      const mascotIds = selections.flatMap((s) => s.mascotIds);
      const mascots = await tx.mascot.findMany({
        where: { id: { in: mascotIds } },
        select: { id: true, statInstinct: true },
      });
      if (mascots.length === 0) break;
      const topMascot = mascots.reduce((best, mascot) => mascot.statInstinct > best.statInstinct ? mascot : best);
      const topSelection = selections.find((s) => s.mascotIds.includes(topMascot.id));
      if (topSelection) await grantEgg(topSelection.playerId, eggType);
      break;
    }
    case "REWARD_GEN_DIVERSITY": {
      const chance = typeof effect.value === "number" ? effect.value : 0.1;
      for (const selection of selections) {
        const mascots = await tx.mascot.findMany({
          where: { id: { in: selection.mascotIds } },
          select: { pokemonId: true },
        });
        const gens = new Set(mascots.map((mascot) => pokemonGen(mascot.pokemonId)));
        if (gens.size >= 2 && Math.random() < chance) await grantEgg(selection.playerId, EggType.COMMON);
      }
      break;
    }
  }
}

export async function formSyncArenaForTodayIfDue(now = new Date()) {
  const date = toBrtDateString(now);
  const existing = await prisma.syncEventRoom.count({ where: { date } });
  if (existing > 0) return { formed: 0, skipped: "already-formed" };

  const config = await prisma.syncChallengeConfig.findUnique({ where: { id: "singleton" } });
  if (!config?.ticketsEnabled) return { formed: 0, skipped: "disabled" };
  if (config.registrationClosesAt && now < config.registrationClosesAt) return { formed: 0, skipped: "window-open" };

  const readyTeams = await prisma.syncEventTeam.findMany({
    where: { status: "LINEUP_READY", roomId: null },
    select: { id: true, playerAId: true, playerBId: true, lineups: { select: { playerId: true } } },
    orderBy: { lineupReadyAt: "asc" },
  });

  const validTeams = readyTeams.filter((team) => {
    if (!team.playerBId) return false;
    const countA = team.lineups.filter((lineup) => lineup.playerId === team.playerAId).length;
    const countB = team.lineups.filter((lineup) => lineup.playerId === team.playerBId).length;
    return countA >= 9 && countB >= 9;
  });

  const invalidTeams = readyTeams.filter((team) => !validTeams.some((valid) => valid.id === team.id));
  if (invalidTeams.length > 0) {
    for (const team of invalidTeams) {
      await prisma.syncEventLineup.deleteMany({ where: { teamId: team.id } });
      await prisma.syncEventTeam.update({
        where: { id: team.id },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      const fullTeam = await prisma.syncEventTeam.findUnique({
        where: { id: team.id },
        select: { ticketAId: true, ticketBId: true },
      });
      const ticketIds = [fullTeam?.ticketAId, fullTeam?.ticketBId].filter(Boolean) as string[];
      if (ticketIds.length > 0) {
        await prisma.syncTicket.updateMany({ where: { id: { in: ticketIds } }, data: { status: "AVAILABLE" } });
      }
    }
  }

  if (validTeams.length < 2) return { formed: 0, skipped: "not-enough-teams", invalidRemoved: invalidTeams.length };

  const roundTimes = [config.round1At, config.round2At, config.round3At];
  await prisma.$transaction(async (tx) => {
    const room = await tx.syncEventRoom.create({ data: { roomIndex: 1, date, status: "READY" } });
    for (let slot = 0; slot < validTeams.length; slot++) {
      await tx.syncEventTeam.update({
        where: { id: validTeams[slot].id },
        data: { roomId: room.id, roomSlot: slot + 1 },
      });
    }
    for (let roundNumber = 1; roundNumber <= 3; roundNumber++) {
      await tx.syncEventRound.create({
        data: {
          roomId: room.id,
          roundNumber,
          status: "PENDING",
          scheduledAt: roundTimes[roundNumber - 1] ?? now,
        },
      });
    }
    for (const team of validTeams) {
      for (const playerId of [team.playerAId, team.playerBId].filter(Boolean) as string[]) {
        await tx.syncEventScore.create({ data: { roomId: room.id, teamId: team.id, playerId } });
      }
    }
  });

  return { formed: 1, invalidRemoved: invalidTeams.length };
}

export async function openDueSyncRounds(now = new Date()) {
  const rounds = await prisma.syncEventRound.findMany({
    where: { status: "PENDING", scheduledAt: { lte: now }, room: { status: { notIn: ["FINISHED", "CANCELLED"] } } },
    select: { id: true, roomId: true, roundNumber: true },
    orderBy: [{ scheduledAt: "asc" }, { roundNumber: "asc" }],
  });

  let opened = 0;
  for (const round of rounds) {
    const previousRoundsDone = await prisma.syncEventRound.count({
      where: { roomId: round.roomId, roundNumber: { gt: 0, lt: round.roundNumber }, status: { not: "DONE" } },
    });
    if (previousRoundsDone > 0) continue;

    await prisma.$transaction(async (tx) => {
      const modifiers = await tx.syncEventModifier.findMany({ where: { active: true }, select: { id: true } });
      const baseModifierId = modifiers.length > 0 ? modifiers[Math.floor(Math.random() * modifiers.length)].id : null;
      const modifierId = await materializeRoundModifier(tx, baseModifierId, round.id);
      await tx.syncEventRound.update({
        where: { id: round.id },
        data: { status: "SELECTING", modifierId },
      });
      const roomStatusMap: Record<number, "ROUND_1" | "ROUND_2" | "ROUND_3"> = { 1: "ROUND_1", 2: "ROUND_2", 3: "ROUND_3" };
      await tx.syncEventRoom.update({
        where: { id: round.roomId },
        data: { status: roomStatusMap[round.roundNumber] ?? "ROUND_1" },
      });
    });
    opened++;
  }

  return { opened };
}

export async function executeDueSyncRounds(now = new Date()) {
  const executionThreshold = new Date(now.getTime() - SELECTION_WINDOW_MS);
  const rounds = await prisma.syncEventRound.findMany({
    where: {
      status: "SELECTING",
      scheduledAt: { lte: executionThreshold },
      matches: { none: {} },
    },
    include: {
      room: {
        include: {
          teams: {
            include: {
              lineups: true,
              playerA: { select: { id: true, displayName: true } },
              playerB: { select: { id: true, displayName: true } },
            },
          },
        },
      },
      selections: true,
    },
    orderBy: [{ scheduledAt: "asc" }, { roundNumber: "asc" }],
  });

  let executed = 0;
  for (const round of rounds) {
    await prisma.$transaction(async (tx) => {
      const teams = round.room.teams.sort((a, b) => (a.roomSlot ?? 0) - (b.roomSlot ?? 0));
      const teamsForRound = round.roundNumber === 0 ? teams : teams;
      const pairings = buildRoundPairings(teamsForRound, round.roundNumber);

      for (const team of teamsForRound) {
        const playerIds = [team.playerAId, team.playerBId].filter(Boolean) as string[];
        for (const playerId of playerIds) {
          const existing = round.selections.find((selection) => selection.playerId === playerId);
          if (existing) continue;
          const prevSelections = await tx.syncRoundSelection.findMany({
            where: { playerId, round: { roomId: round.roomId, roundNumber: { lt: round.roundNumber } } },
            select: { mascotIds: true },
          });
          const used = new Set(prevSelections.flatMap((selection) => selection.mascotIds));
          const available = team.lineups.filter((lineup) => lineup.playerId === playerId && !used.has(lineup.mascotId));
          const auto = available.slice(0, 3).map((lineup) => lineup.mascotId);
          if (auto.length > 0) {
            await tx.syncRoundSelection.create({
              data: { roundId: round.id, teamId: team.id, playerId, mascotIds: auto, isAuto: true },
            });
          }
        }
      }

      const modifierId = round.modifierId ?? null;
      const modEffect = await loadModEffect(modifierId);
      await tx.syncEventRound.update({
        where: { id: round.id },
        data: { status: "EXECUTING", selectionsClosedAt: now },
      });

      const roundSelections = await tx.syncRoundSelection.findMany({ where: { roundId: round.id } });
      for (let pairingIndex = 0; pairingIndex < pairings.length; pairingIndex++) {
        const [teamA, teamB] = pairings[pairingIndex];
        if (!teamA) continue;

        const isBotMatch = !teamB;
        const botName = isBotMatch ? "Bot Sincronizado" : null;
        const botTeam = { id: `sync-bot-${round.id}-${teamA.id}`, playerAId: "sync-bot", playerBId: null };
        const opponentTeam = teamB ?? botTeam;
        const selections = roundSelections.filter((selection) => selection.teamId === teamA.id || (teamB && selection.teamId === teamB.id));
        const syntheticMascotsB = isBotMatch
          ? makeSyncBotMascots(
              await tx.mascot.findMany({
                where: { id: { in: selections.filter((selection) => selection.teamId === teamA.id).flatMap((selection) => selection.mascotIds) } },
              }) as SyntheticSyncMascot[],
              round.roundNumber * 100 + pairingIndex,
            )
          : undefined;

        const result = await runSyncBattle({
          teamA,
          teamB: opponentTeam,
          selections,
          modifierId,
          modEffect,
          syntheticMascotsB,
        });

        await tx.syncRoundMatch.create({
          data: {
            roundId: round.id,
            teamAId: teamA.id,
            teamBId: teamB?.id ?? null,
            botName,
            result: result.result,
            teamADamage: result.teamADamage,
            teamBDamage: result.teamBDamage,
            survivingA: result.survivingA,
            survivingB: result.survivingB,
            replayJson: result.replayJson,
            executedAt: now,
          },
        });

        if (teamB) {
          await applyRoundRewardModifier(tx, modEffect, teamA, teamB, result, selections, round.roomId);
        }

        const updateScore = async (playerId: string, won: boolean, lost: boolean, damage: number, surviving: number, damageTaken: number) => {
          await tx.syncEventScore.updateMany({
            where: { roomId: round.roomId, playerId },
            data: {
              wins: won ? { increment: 1 } : undefined,
              losses: lost ? { increment: 1 } : undefined,
              draws: (!won && !lost) ? { increment: 1 } : undefined,
              damageDone: { increment: damage },
              damageTaken: { increment: damageTaken },
              survivingTotal: { increment: surviving },
            },
          });
        };

        const aWon = result.result === "TEAM_A_WIN";
        const bWon = result.result === "TEAM_B_WIN";
        for (const playerId of [teamA.playerAId, teamA.playerBId].filter(Boolean) as string[]) {
          await updateScore(playerId, aWon, bWon, result.teamADamage, result.survivingA, result.teamBDamage);
        }
        if (teamB) {
          for (const playerId of [teamB.playerAId, teamB.playerBId].filter(Boolean) as string[]) {
            await updateScore(playerId, bWon, aWon, result.teamBDamage, result.survivingB, result.teamADamage);
          }
        }
      }

      await tx.syncEventRound.update({
        where: { id: round.id },
        data: { status: "DONE", executedAt: now },
      });

      if (round.roundNumber === 3) {
        await tx.syncEventRoom.update({
          where: { id: round.roomId },
          data: { status: "FINISHED", finishedAt: now },
        });
      }
    });
    executed++;
  }

  return { executed, selectionWindowMinutes: SELECTION_WINDOW_MS / 60000 };
}

export async function runSyncEventAutomation(now = new Date()) {
  const formed = await formSyncArenaForTodayIfDue(now);
  const executed = await executeDueSyncRounds(now);
  const opened = await openDueSyncRounds(now);
  return { formed, opened, executed };
}
