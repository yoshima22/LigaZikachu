"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { runSyncBattle } from "@/lib/sync-battle";
import { toBrtDateString } from "@/lib/date-utils";

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

    // Verifica se já há salas para hoje
    const existingRooms = await prisma.syncEventRoom.count({ where: { date } });
    if (existingRooms > 0) return { error: `Salas para ${date} já foram formadas.` };

    // Busca duplas com lineup completo
    const readyTeams = await prisma.syncEventTeam.findMany({
      where: { status: "LINEUP_READY", roomId: null },
      orderBy: { lineupReadyAt: "asc" },
      select: { id: true, playerAId: true, playerBId: true },
    });

    if (readyTeams.length < 4) {
      return { error: `Apenas ${readyTeams.length} dupla(s) prontas. Mínimo de 4 necessário para formar uma sala.` };
    }

    // Agrupa em salas de 4 (máximo 3 salas por dia)
    const maxRooms = 3;
    const rooms: typeof readyTeams[] = [];
    for (let i = 0; i < Math.min(Math.floor(readyTeams.length / 4), maxRooms); i++) {
      rooms.push(readyTeams.slice(i * 4, i * 4 + 4));
    }

    await prisma.$transaction(async (tx) => {
      for (let roomIdx = 0; roomIdx < rooms.length; roomIdx++) {
        const config = await tx.syncChallengeConfig.findUnique({ where: { id: "singleton" } });
        const room = await tx.syncEventRoom.create({
          data: { roomIndex: roomIdx + 1, date, status: "READY" },
        });

        // Atribui as 4 duplas ao slot da sala
        for (let slot = 0; slot < 4; slot++) {
          await tx.syncEventTeam.update({
            where: { id: rooms[roomIdx][slot].id },
            data: { roomId: room.id, roomSlot: slot + 1 },
          });
        }

        // Cria as 3 rodadas com os horários da config
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

        // Inicializa pontuação de todos os jogadores da sala
        for (const team of rooms[roomIdx]) {
          for (const pid of [team.playerAId, team.playerBId].filter(Boolean) as string[]) {
            await tx.syncEventScore.create({
              data: { roomId: room.id, teamId: team.id, playerId: pid },
            });
          }
        }
      }
    });

    revalidatePath("/desafio-sincronizado");
    return { formed: rooms.length };
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
      await tx.syncEventRound.update({ where: { id: roundId }, data: { status: "SELECTING" } });
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
      // Chaveamento: R1: 1×2/3×4, R2: 1×3/2×4, R3: 1×4/2×3
      const pairings: [number, number][] = round.roundNumber === 1
        ? [[0, 1], [2, 3]]
        : round.roundNumber === 2
        ? [[0, 2], [1, 3]]
        : [[0, 3], [1, 2]];

      // Auto-seleciona mascotes para jogadores que não escolheram
      for (const team of teams) {
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

      // Sorteia modificador
      const modifiers = await tx.syncEventModifier.findMany({ where: { active: true }, select: { id: true } });
      const modifierId = modifiers.length > 0
        ? modifiers[Math.floor(Math.random() * modifiers.length)].id
        : null;

      await tx.syncEventRound.update({
        where: { id: roundId },
        data: { status: "EXECUTING", modifierId, selectionsClosedAt: new Date() },
      });

      // Executa cada confronto
      for (const [slotA, slotB] of pairings) {
        const teamA = teams[slotA];
        const teamB = teams[slotB];
        if (!teamA || !teamB) continue;

        const allSelections = await tx.syncRoundSelection.findMany({
          where: { roundId, teamId: { in: [teamA.id, teamB.id] } },
        });

        const result = await runSyncBattle({
          teamA,
          teamB,
          selections: allSelections,
          modifierId,
        });

        const match = await tx.syncRoundMatch.create({
          data: {
            roundId,
            teamAId: teamA.id,
            teamBId: teamB.id,
            result: result.result,
            teamADamage: result.teamADamage,
            teamBDamage: result.teamBDamage,
            survivingA: result.survivingA,
            survivingB: result.survivingB,
            replayJson: result.replayJson,
            executedAt: new Date(),
          },
        });

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
        for (const pid of [teamB.playerAId, teamB.playerBId].filter(Boolean) as string[]) {
          await updateScore(pid, teamB.id, bWon, aWon, result.teamBDamage, result.survivingB, result.teamADamage);
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
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao executar rodada." };
  }
}

// ── Admin: iniciar rodada de desempate ────────────────────────────────────────

export async function adminStartTiebreakAction(roomId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();

    const room = await prisma.syncEventRoom.findUnique({
      where: { id: roomId },
      select: { id: true, status: true, rounds: { select: { id: true, roundNumber: true, status: true } } },
    });
    if (!room) return { error: "Sala não encontrada." };

    const existingTiebreak = room.rounds.find((r) => r.roundNumber === 0);
    if (existingTiebreak) return { error: "Desempate já foi criado." };

    const config = await prisma.syncChallengeConfig.findUnique({ where: { id: "singleton" } });

    await prisma.$transaction(async (tx) => {
      await tx.syncEventRound.create({
        data: {
          roomId,
          roundNumber: 0,
          status: "PENDING",
          scheduledAt: config?.tiebreakAt ?? new Date(),
        },
      });
      await tx.syncEventRoom.update({
        where: { id: roomId },
        data: { status: "TIEBREAK" },
      });
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao iniciar desempate." };
  }
}

// ── Admin: calcular ranking final e entregar recompensas ──────────────────────

export async function adminFinalizeRoomAction(roomId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();

    const room = await prisma.syncEventRoom.findUnique({
      where: { id: roomId },
      include: { scores: { include: { player: { select: { id: true, displayName: true } } } } },
    });
    if (!room) return { error: "Sala não encontrada." };

    // Ranking: vitórias DESC, damageDone DESC, damageTaken ASC
    const sorted = [...room.scores].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.damageDone !== a.damageDone) return b.damageDone - a.damageDone;
      return a.damageTaken - b.damageTaken;
    });

    type RewardDef = {
      coins: number;
      label: string;
      eggType: "EVENT" | "SPECIAL" | "RARE" | "COMMON" | null;
      foodGift: string | null; // descrição do item extra
    };

    // Recompensas por posição por dupla (entregues individualmente a cada jogador)
    const rewardsByPosition: Record<number, RewardDef> = {
      1: { coins: 1200, label: "1º lugar no Desafio Sincronizado", eggType: "EVENT", foodGift: "Amuleto da Sorte" },
      2: { coins: 800,  label: "2º lugar no Desafio Sincronizado", eggType: "SPECIAL", foodGift: "Vitamina Chocante" },
      3: { coins: 500,  label: "3º lugar no Desafio Sincronizado", eggType: "RARE", foodGift: "Bala de Mel" },
      4: { coins: 300,  label: "4º lugar no Desafio Sincronizado", eggType: "COMMON", foodGift: "Água Fresca" },
    };

    // Deduplica scores por dupla (pega o score com wins mais alto por dupla)
    const scoresByTeam = new Map<string, typeof sorted[0]>();
    for (const score of sorted) {
      const existing = scoresByTeam.get(score.teamId);
      if (!existing || score.wins > existing.wins) scoresByTeam.set(score.teamId, score);
    }
    const teamRanking = [...scoresByTeam.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.damageDone !== a.damageDone) return b.damageDone - a.damageDone;
      return a.damageTaken - b.damageTaken;
    });

    await prisma.$transaction(async (tx) => {
      for (let pos = 0; pos < teamRanking.length; pos++) {
        const position = pos + 1;
        const teamTopScore = teamRanking[pos];
        const reward = rewardsByPosition[position];

        // Todos os jogadores desta dupla recebem a recompensa
        const allTeamScores = sorted.filter((s) => s.teamId === teamTopScore.teamId);
        for (const score of allTeamScores) {
          if (score.rewardGranted) continue;

          await tx.syncEventScore.update({
            where: { id: score.id },
            data: { finalPosition: position, rewardGranted: true },
          });

          if (!reward) continue;

          // ZC
          const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: score.playerId } });
          if (wallet) {
            await tx.zikaCoinWallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: reward.coins }, totalEarned: { increment: reward.coins } },
            });
            await tx.zikaCoinTransaction.create({
              data: {
                walletId: wallet.id,
                type: "ADMIN_ADJUSTMENT",
                amount: reward.coins,
                balanceBefore: wallet.balance,
                balanceAfter: wallet.balance + reward.coins,
                description: `Desafio Sincronizado — ${reward.label}`,
              },
            });
          }

          // Ovo
          if (reward.eggType) {
            await tx.mascotEgg.create({
              data: { playerId: score.playerId, type: reward.eggType, origin: `Desafio Sincronizado — ${reward.label}` },
            });
          }

          // Item extra via PlayerGift
          if (reward.foodGift) {
            await tx.playerGift.create({
              data: {
                playerId: score.playerId,
                type: "CUSTOM",
                title: `Recompensa Desafio Sincronizado`,
                description: `${reward.label} — ${reward.foodGift}`,
                payload: { item: reward.foodGift, source: "sync-challenge" },
                status: "UNCLAIMED",
              },
            });
          }
        }
      }

      await tx.syncEventRoom.update({
        where: { id: roomId },
        data: { status: "FINISHED", finishedAt: new Date() },
      });
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao finalizar sala." };
  }
}
