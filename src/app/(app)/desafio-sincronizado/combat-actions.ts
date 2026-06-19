"use server";

import { revalidatePath } from "next/cache";
import { EggType, ZikaCoinTxType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { runSyncBattle, loadModEffect, type ModEffect, type SyntheticSyncMascot } from "@/lib/sync-battle";
import { getPokemonName } from "@/lib/mascot-data";
import { toBrtDateString } from "@/lib/date-utils";
import { materializeRoundModifier } from "@/lib/sync-round-modifiers";
import { finalizeSyncEventRoomRewards } from "@/lib/sync-event-rewards";

// ── Pokémon generation helper ─────────────────────────────────────────────────

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

// ── Reward modifier delivery ──────────────────────────────────────────────────

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
  confrontoSelections: { teamId: string; playerId: string; mascotIds: string[] }[],
  roomId: string,
): Promise<void> {
  if (!modEffect) return;
  const e = modEffect as Record<string, unknown>;
  const type = typeof e.type === "string" ? e.type : "";
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
        description: "Desafio Sincronizado — bônus de modificador",
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
          title: "Bônus do Modificador",
          description: `Você ganhou: ${itemName}`,
          payload: { item: itemName, source: "sync-modifier" },
          status: "UNCLAIMED",
        },
      });
    }
  };

  switch (type) {
    case "REWARD_WINNER": {
      const item = typeof e.item === "string" ? e.item : null;
      if (item) for (const pid of winnerPlayers) await grantItem(pid, item);
      break;
    }
    case "REWARD_ALL": {
      const item = typeof e.item === "string" ? e.item : null;
      if (item) for (const pid of allPlayers) await grantItem(pid, item);
      break;
    }
    case "REWARD_LOWEST_SCORE": {
      const item = typeof e.item === "string" ? e.item : null;
      if (item) for (const pid of loserPlayers) await grantItem(pid, item);
      break;
    }
    case "REWARD_CHANCE_WINNER": {
      const reward = typeof e.reward === "string" ? e.reward : null;
      const chance = typeof e.chance === "number" ? e.chance : 0.05;
      const eggType = reward ? EGG_REWARD_MAP[reward] : null;
      if (eggType && Math.random() < chance) {
        for (const pid of winnerPlayers) await grantEgg(pid, eggType);
      }
      break;
    }
    case "REWARD_UNDERDOG_WIN": {
      if (winnerPlayers.length === 0) break;
      const value = typeof e.value === "number" ? e.value : 0;
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
      const value = typeof e.value === "number" ? e.value : 0;
      const randomPid = allPlayers[Math.floor(Math.random() * allPlayers.length)];
      if (randomPid && value > 0) await grantCoins(randomPid, value);
      break;
    }
    case "REWARD_TOP_INSTINCT":
    case "REWARD_TOP_INSTINCT_CHANCE": {
      const reward = typeof e.reward === "string" ? e.reward : null;
      const chance = type === "REWARD_TOP_INSTINCT" ? 1 : (typeof e.chance === "number" ? e.chance : 0.2);
      if (!reward || Math.random() > chance) break;
      const eggType = EGG_REWARD_MAP[reward];
      if (!eggType) break;
      const allMascotIds = confrontoSelections.flatMap((s) => s.mascotIds);
      const mascots = await tx.mascot.findMany({
        where: { id: { in: allMascotIds } },
        select: { id: true, statInstinct: true },
      });
      if (mascots.length === 0) break;
      const topMascot = mascots.reduce((best, m) => (m.statInstinct > best.statInstinct ? m : best));
      const topSel = confrontoSelections.find((s) => s.mascotIds.includes(topMascot.id));
      if (topSel) await grantEgg(topSel.playerId, eggType);
      break;
    }
    case "REWARD_GEN_DIVERSITY": {
      const chance = typeof e.value === "number" ? e.value : 0.1;
      for (const sel of confrontoSelections) {
        const mascots = await tx.mascot.findMany({
          where: { id: { in: sel.mascotIds } },
          select: { pokemonId: true },
        });
        const gens = new Set(mascots.map((m) => pokemonGen(m.pokemonId)));
        if (gens.size >= 2 && Math.random() < chance) await grantEgg(sel.playerId, EggType.COMMON);
      }
      break;
    }
  }
}

async function requirePlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  return { user, player };
}

// ── Admin: fechar inscrições e montar salas ────────────────────────────────────

export async function adminFormRoomsAction(): Promise<{ error?: string; formed?: number }> {
  try {
    await requireAdmin();

    const date = toBrtDateString(new Date());

    // Nao altera evento/sala ja formada no dia atual.
    const existingRooms = await prisma.syncEventRoom.count({ where: { date } });
    if (existingRooms > 0) return { error: `Salas para ${date} ja foram formadas.` };

    // Busca duplas com lineup completo.
    const readyTeams = await prisma.syncEventTeam.findMany({
      where: { status: "LINEUP_READY", roomId: null },
      orderBy: { lineupReadyAt: "asc" },
      select: { id: true, playerAId: true, playerBId: true },
    });

    if (readyTeams.length < 2) {
      return { error: `Apenas ${readyTeams.length} dupla(s) pronta(s). Minimo de 2 necessario para formar a Arena Sincronizada.` };
    }

    await prisma.$transaction(async (tx) => {
      const config = await tx.syncChallengeConfig.findUnique({ where: { id: "singleton" } });
      const room = await tx.syncEventRoom.create({
        data: { roomIndex: 1, date, status: "READY" },
      });

      // Uma unica Arena Sincronizada recebe todas as duplas prontas.
      for (let slot = 0; slot < readyTeams.length; slot++) {
        await tx.syncEventTeam.update({
          where: { id: readyTeams[slot].id },
          data: { roomId: room.id, roomSlot: slot + 1 },
        });
      }

      // Cria as 3 rodadas com os horarios da config.
      const roundTimes = [config?.round1At, config?.round2At, config?.round3At];
      for (let rn = 1; rn <= 3; rn++) {
        await tx.syncEventRound.create({
          data: {
            roomId: room.id,
            roundNumber: rn,
            status: "PENDING",
            scheduledAt: roundTimes[rn - 1] ?? new Date(),
          },
        });
      }

      // Inicializa pontuacao de todos os jogadores da arena.
      for (const team of readyTeams) {
        for (const pid of [team.playerAId, team.playerBId].filter(Boolean) as string[]) {
          await tx.syncEventScore.create({
            data: { roomId: room.id, teamId: team.id, playerId: pid },
          });
        }
      }
    });

    revalidatePath("/desafio-sincronizado");
    return { formed: 1 };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao formar salas." };
  }
}

// ── Admin: iniciar seleção de uma rodada ──────────────────────────────────────

export async function adminStartRoundSelectionAction(roundId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const round = await prisma.syncEventRound.findUnique({ where: { id: roundId } });
    if (!round) return { error: "Rodada não encontrada." };
    if (round.status !== "PENDING") return { error: "Esta rodada não está pendente." };

    await prisma.$transaction(async (tx) => {
      // Sorteia o modificador já na abertura da seleção para que os jogadores
      // possam ver as regras especiais ao escolher os mascotes
      const modifiers = await tx.syncEventModifier.findMany({ where: { active: true }, select: { id: true } });
      const baseModifierId = modifiers.length > 0
        ? modifiers[Math.floor(Math.random() * modifiers.length)].id
        : null;
      const modifierId = await materializeRoundModifier(tx, baseModifierId, roundId);

      await tx.syncEventRound.update({
        where: { id: roundId },
        data: { status: "SELECTING", modifierId },
      });
      const roomStatusMap: Record<number, "ROUND_1" | "ROUND_2" | "ROUND_3"> = { 1: "ROUND_1", 2: "ROUND_2", 3: "ROUND_3" };
      await tx.syncEventRoom.update({
        where: { id: round.roomId },
        data: { status: roomStatusMap[round.roundNumber] ?? "ROUND_1" },
      });
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao iniciar rodada." };
  }
}

// ── Jogador: selecionar 3 mascotes para a rodada ──────────────────────────────

export async function selectRoundMascotsAction(
  roundId: string,
  mascotIds: string[],
): Promise<{ error?: string }> {
  try {
    const { player } = await requirePlayer();

    if (mascotIds.length !== 3) return { error: "Selecione exatamente 3 mascotes." };
    if (new Set(mascotIds).size !== 3) return { error: "Mascotes duplicados não permitidos." };

    const round = await prisma.syncEventRound.findUnique({
      where: { id: roundId },
      include: { room: { include: { teams: { include: { lineups: true } } } } },
    });
    if (!round) return { error: "Rodada não encontrada." };
    if (round.status !== "SELECTING") return { error: "Seleção não está aberta para esta rodada." };

    // Encontra a dupla do jogador na sala
    const team = round.room.teams.find((t) => t.playerAId === player.id || t.playerBId === player.id);
    if (!team) return { error: "Você não está nesta sala." };

    // Verifica se os mascotes pertencem ao lineup do jogador
    const myLineupIds = team.lineups.filter((l) => l.playerId === player.id).map((l) => l.mascotId);
    for (const mid of mascotIds) {
      if (!myLineupIds.includes(mid)) return { error: "Um ou mais mascotes não estão na sua escalação." };
    }

    // Verifica se mascotes já foram usados nas rodadas anteriores desta sala
    const prevSelections = await prisma.syncRoundSelection.findMany({
      where: { playerId: player.id, round: { roomId: round.roomId, roundNumber: { lt: round.roundNumber } } },
      select: { mascotIds: true },
    });
    const usedMascotIds = new Set(prevSelections.flatMap((s) => s.mascotIds));
    for (const mid of mascotIds) {
      if (usedMascotIds.has(mid)) return { error: "Cada mascote só pode ser usado uma vez por evento." };
    }

    await prisma.syncRoundSelection.upsert({
      where: { roundId_playerId: { roundId, playerId: player.id } },
      create: { roundId, teamId: team.id, playerId: player.id, mascotIds, isAuto: false },
      update: { mascotIds, isAuto: false, selectedAt: new Date() },
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao selecionar mascotes." };
  }
}

// ── Admin: fechar seleções, sortear modificador e executar combates ────────────

export async function adminExecuteRoundAction(roundId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();

    const round = await prisma.syncEventRound.findUnique({
      where: { id: roundId },
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
    });
    if (!round) return { error: "Rodada não encontrada." };
    if (round.status !== "SELECTING" && round.status !== "MODIFIER_DRAWN") {
      return { error: "Esta rodada não pode ser executada agora." };
    }

    await prisma.$transaction(async (tx) => {
      const teams = round.room.teams.sort((a, b) => (a.roomSlot ?? 0) - (b.roomSlot ?? 0));

      // Chaveamento regular: R1: 1×2/3×4, R2: 1×3/2×4, R3: 1×4/2×3
      // Desempate (roundNumber=0): apenas as duplas empatadas no 1º lugar
      let pairings: [typeof teams[number], typeof teams[number] | null][];
      let teamsForRound = teams;

      if (round.roundNumber === 0) {
        // Busca duplas com finalPosition null (ainda empatadas)
        const tiedScores = await tx.syncEventScore.findMany({
          where: { roomId: round.roomId, finalPosition: null },
          distinct: ["teamId"],
          select: { teamId: true },
        });
        const tiedIds = tiedScores.map((s) => s.teamId);
        teamsForRound = teams.filter((t) => tiedIds.includes(t.id));
        pairings = buildRoundPairings(teamsForRound, 1);
      } else {
        pairings = buildRoundPairings(teamsForRound, round.roundNumber);
      }

      // Auto-seleciona mascotes para jogadores que não escolheram
      for (const team of teamsForRound) {
        const playerIds = [team.playerAId, team.playerBId].filter(Boolean) as string[];
        for (const pid of playerIds) {
          const existing = round.selections.find((s) => s.playerId === pid);
          if (!existing) {
            const prevSelections = await tx.syncRoundSelection.findMany({
              where: { playerId: pid, round: { roomId: round.roomId, roundNumber: { lt: round.roundNumber } } },
              select: { mascotIds: true },
            });
            const used = new Set(prevSelections.flatMap((s) => s.mascotIds));
            const available = team.lineups.filter((l) => l.playerId === pid && !used.has(l.mascotId));
            const auto = available.slice(0, 3).map((l) => l.mascotId);
            if (auto.length > 0) {
              await tx.syncRoundSelection.create({
                data: { roundId, teamId: team.id, playerId: pid, mascotIds: auto, isAuto: true },
              });
            }
          }
        }
      }

      // Usa o modificador já sorteado na abertura da seleção
      const modifierId = round.modifierId ?? null;
      const modEffect = await loadModEffect(modifierId);

      await tx.syncEventRound.update({
        where: { id: roundId },
        data: { status: "EXECUTING", selectionsClosedAt: new Date() },
      });

      // Busca todas as seleções da rodada de uma vez
      const roundSelections = await tx.syncRoundSelection.findMany({ where: { roundId } });

      // Executa cada confronto
      for (let pairingIndex = 0; pairingIndex < pairings.length; pairingIndex++) {
        const [teamA, teamB] = pairings[pairingIndex];
        if (!teamA) continue;

        const isBotMatch = !teamB;
        const botName = isBotMatch ? "Bot Sincronizado" : null;
        const botTeam = { id: `sync-bot-${round.id}-${teamA.id}`, playerAId: "sync-bot", playerBId: null };
        const opponentTeam = teamB ?? botTeam;
        const allSelections = roundSelections.filter((s) => s.teamId === teamA.id || (teamB && s.teamId === teamB.id));

        const syntheticMascotsB = isBotMatch
          ? makeSyncBotMascots(
              await tx.mascot.findMany({
                where: { id: { in: allSelections.filter((s) => s.teamId === teamA.id).flatMap((s) => s.mascotIds) } },
              }) as SyntheticSyncMascot[],
              round.roundNumber * 100 + pairingIndex,
            )
          : undefined;

        const result = await runSyncBattle({
          teamA,
          teamB: opponentTeam,
          selections: allSelections,
          modifierId,
          modEffect,
          syntheticMascotsB,
        });

        await tx.syncRoundMatch.create({
          data: {
            roundId,
            teamAId: teamA.id,
            teamBId: teamB?.id ?? null,
            botName,
            result: result.result,
            teamADamage: result.teamADamage,
            teamBDamage: result.teamBDamage,
            survivingA: result.survivingA,
            survivingB: result.survivingB,
            replayJson: result.replayJson,
            executedAt: new Date(),
          },
        });

        // Entrega recompensas de modificadores do tipo REWARD_*
        if (teamB) {
          await applyRoundRewardModifier(tx, modEffect, teamA, teamB, result, allSelections, round.roomId);
        }

        // Atualiza pontuações dos jogadores
        const updateScore = async (pid: string, tid: string, won: boolean, lost: boolean, damage: number, surviving: number, damageTaken: number) => {
          await tx.syncEventScore.updateMany({
            where: { roomId: round.roomId, playerId: pid },
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
        for (const pid of [teamA.playerAId, teamA.playerBId].filter(Boolean) as string[]) {
          await updateScore(pid, teamA.id, aWon, bWon, result.teamADamage, result.survivingA, result.teamBDamage);
        }
        if (teamB) {
          for (const pid of [teamB.playerAId, teamB.playerBId].filter(Boolean) as string[]) {
            await updateScore(pid, teamB.id, bWon, aWon, result.teamBDamage, result.survivingB, result.teamADamage);
          }
        }
      }

      await tx.syncEventRound.update({
        where: { id: roundId },
        data: { status: "DONE", executedAt: new Date() },
      });

      // Se foi a última rodada (3), verifica se sala acabou
      if (round.roundNumber === 3) {
        await tx.syncEventRoom.update({
          where: { id: round.roomId },
          data: { status: "FINISHED", finishedAt: new Date() },
        });
      }

      // Se foi desempate (roundNumber=0), atribui posições finais e fecha sala
      if (round.roundNumber === 0 && pairings.length > 0) {
        for (const [teamA, teamB] of pairings) {
          if (!teamA) continue;

          const match = await tx.syncRoundMatch.findFirst({
            where: { roundId, teamAId: teamA.id, teamBId: teamB?.id ?? null },
            select: { result: true },
          });
          if (!match) continue;

          // Determina qual position já está ocupada pelos não-empatados
          const existingPositions = await tx.syncEventScore.findMany({
            where: { roomId: round.roomId, finalPosition: { not: null } },
            select: { finalPosition: true },
          });
          const takenPositions = new Set(existingPositions.map((s) => s.finalPosition));
          // 1º e 2º devem ser os dois primeiros disponíveis
          const available = [1, 2, 3, 4].filter((p) => !takenPositions.has(p));
          const pos1 = available[0] ?? 1;
          const pos2 = available[1] ?? 2;

          const winnerId = match.result === "TEAM_A_WIN" ? teamA.id : match.result === "TEAM_B_WIN" ? teamB?.id ?? null : null;
          const loserId = match.result === "TEAM_A_WIN" ? teamB?.id ?? null : match.result === "TEAM_B_WIN" ? teamA.id : null;

          if (winnerId) {
            await tx.syncEventScore.updateMany({ where: { roomId: round.roomId, teamId: winnerId }, data: { finalPosition: pos1 } });
          }
          if (loserId) {
            await tx.syncEventScore.updateMany({ where: { roomId: round.roomId, teamId: loserId }, data: { finalPosition: pos2 } });
          }
          // Em caso de empate, ambas ficam na melhor posição disponível
          if (!winnerId && !loserId) {
            await tx.syncEventScore.updateMany({ where: { roomId: round.roomId, teamId: teamA.id }, data: { finalPosition: pos1 } });
            if (teamB) {
              await tx.syncEventScore.updateMany({ where: { roomId: round.roomId, teamId: teamB.id }, data: { finalPosition: pos1 } });
            }
          }
        }

        await tx.syncEventRoom.update({
          where: { id: round.roomId },
          data: { status: "FINISHED", finishedAt: new Date() },
        });
      }
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao executar rodada." };
  }
}

// ── Admin: iniciar rodada de desempate (só para duplas empatadas em 1º) ───────

export async function adminStartTiebreakAction(roomId: string): Promise<{ error?: string; tiedTeams?: string[] }> {
  try {
    await requireAdmin();

    const room = await prisma.syncEventRoom.findUnique({
      where: { id: roomId },
      include: {
        rounds: { select: { id: true, roundNumber: true, status: true } },
        scores: { include: { player: { select: { displayName: true } } } },
        teams: { select: { id: true, roomSlot: true, playerA: { select: { displayName: true } }, playerB: { select: { displayName: true } } } },
      },
    });
    if (!room) return { error: "Sala não encontrada." };

    const existingTiebreak = room.rounds.find((r) => r.roundNumber === 0);
    if (existingTiebreak) return { error: "Desempate já foi criado." };

    const allDone = room.rounds.filter((r) => r.roundNumber > 0).every((r) => r.status === "DONE");
    if (!allDone) return { error: "Nem todas as rodadas foram concluídas ainda." };

    // Calcula vitórias por dupla (soma scores dos 2 jogadores / 2 = vitórias únicas da dupla)
    const teamWins = new Map<string, { wins: number; damageDone: number; damageTaken: number; name: string }>();
    for (const team of room.teams) {
      const name = `${team.playerA.displayName}${team.playerB ? ` + ${team.playerB.displayName}` : ""}`;
      const teamScores = room.scores.filter((s) => s.teamId === team.id);
      // Ambos jogadores têm o mesmo wins (foi incrementado identicamente) — pega o maior
      const wins = Math.max(...teamScores.map((s) => s.wins), 0);
      const damageDone = teamScores.reduce((sum, s) => sum + s.damageDone, 0);
      const damageTaken = teamScores.reduce((sum, s) => sum + s.damageTaken, 0);
      teamWins.set(team.id, { wins, damageDone, damageTaken, name });
    }

    // Encontra o máximo de vitórias
    const maxWins = Math.max(...[...teamWins.values()].map((t) => t.wins));

    // Duplas empatadas no topo
    const tiedTeamIds = [...teamWins.entries()]
      .filter(([, v]) => v.wins === maxWins)
      .map(([id]) => id);

    if (tiedTeamIds.length < 2) {
      return { error: "Não há empate no 1º lugar. Nenhum desempate necessário." };
    }

    const config = await prisma.syncChallengeConfig.findUnique({ where: { id: "singleton" } });
    const tiedNames = tiedTeamIds.map((id) => teamWins.get(id)!.name);

    await prisma.$transaction(async (tx) => {
      // Cria a rodada de desempate com metadado indicando quais duplas participam
      await tx.syncEventRound.create({
        data: {
          roomId,
          roundNumber: 0,
          status: "PENDING",
          scheduledAt: config?.tiebreakAt ?? new Date(),
          // Usamos o modifierId para guardar quais teams disputam (via effectJson workaround não é possível)
          // Simplesmente deixamos aberto — o executeRound usará roomSlot para parear
        },
      });

      // Marca as duplas não empatadas como finalistas (4º/3º) antes do desempate
      const nonTiedIds = [...teamWins.keys()].filter((id) => !tiedTeamIds.includes(id));
      const sortedNonTied = nonTiedIds.sort((a, b) => {
        const ta = teamWins.get(a)!;
        const tb = teamWins.get(b)!;
        if (tb.wins !== ta.wins) return tb.wins - ta.wins;
        return tb.damageDone - ta.damageDone;
      });

      // posições finais provisórias para os não-empatados
      let pos = tiedTeamIds.length + 1;
      for (const tid of sortedNonTied) {
        await tx.syncEventScore.updateMany({
          where: { roomId, teamId: tid },
          data: { finalPosition: pos },
        });
        pos++;
      }

      await tx.syncEventRoom.update({
        where: { id: roomId },
        data: { status: "TIEBREAK" },
      });
    });

    revalidatePath("/desafio-sincronizado");
    return { tiedTeams: tiedNames };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao iniciar desempate." };
  }
}

// ── Admin: calcular ranking final e entregar recompensas ──────────────────────

export async function adminFinalizeRoomAction(roomId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await finalizeSyncEventRoomRewards(roomId);
    await prisma.syncEventRoom.update({
      where: { id: roomId },
      data: { status: "FINISHED", finishedAt: new Date() },
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao finalizar sala." };
  }
}
