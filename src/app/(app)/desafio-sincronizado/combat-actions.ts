"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { runSyncBattle, loadModEffect } from "@/lib/sync-battle";
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

      // Chaveamento regular: R1: 1×2/3×4, R2: 1×3/2×4, R3: 1×4/2×3
      // Desempate (roundNumber=0): apenas as duplas empatadas no 1º lugar
      let pairings: [number, number][];
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
        // Pareia de 2 em 2 (pode haver mais de 2 empatadas)
        pairings = [];
        for (let i = 0; i < Math.floor(teamsForRound.length / 2); i++) {
          pairings.push([i * 2, i * 2 + 1]);
        }
      } else {
        pairings = round.roundNumber === 1
          ? [[0, 1], [2, 3]]
          : round.roundNumber === 2
          ? [[0, 2], [1, 3]]
          : [[0, 3], [1, 2]];
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

      // Sorteia modificador e pré-carrega o effect (1 query, reutilizada em todos os confrontos)
      const modifiers = await tx.syncEventModifier.findMany({ where: { active: true }, select: { id: true } });
      const modifierId = modifiers.length > 0
        ? modifiers[Math.floor(Math.random() * modifiers.length)].id
        : null;
      const modEffect = await loadModEffect(modifierId);

      await tx.syncEventRound.update({
        where: { id: roundId },
        data: { status: "EXECUTING", modifierId, selectionsClosedAt: new Date() },
      });

      // Busca todas as seleções da rodada de uma vez
      const roundSelections = await tx.syncRoundSelection.findMany({ where: { roundId } });

      // Executa cada confronto
      for (const [slotA, slotB] of pairings) {
        const teamA = teamsForRound[slotA];
        const teamB = teamsForRound[slotB];
        if (!teamA || !teamB) continue;

        const allSelections = roundSelections.filter((s) => s.teamId === teamA.id || s.teamId === teamB.id);

        const result = await runSyncBattle({
          teamA,
          teamB,
          selections: allSelections,
          modifierId,
          modEffect,
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

      // Se foi desempate (roundNumber=0), atribui posições finais e fecha sala
      if (round.roundNumber === 0 && pairings.length > 0) {
        for (const [slotA, slotB] of pairings) {
          const teamA = teamsForRound[slotA];
          const teamB = teamsForRound[slotB];
          if (!teamA || !teamB) continue;

          const match = await tx.syncRoundMatch.findFirst({
            where: { roundId, teamAId: teamA.id, teamBId: teamB.id },
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

          const winnerId = match.result === "TEAM_A_WIN" ? teamA.id : match.result === "TEAM_B_WIN" ? teamB.id : null;
          const loserId = match.result === "TEAM_A_WIN" ? teamB.id : match.result === "TEAM_B_WIN" ? teamA.id : null;

          if (winnerId) {
            await tx.syncEventScore.updateMany({ where: { roomId: round.roomId, teamId: winnerId }, data: { finalPosition: pos1 } });
          }
          if (loserId) {
            await tx.syncEventScore.updateMany({ where: { roomId: round.roomId, teamId: loserId }, data: { finalPosition: pos2 } });
          }
          // Em caso de empate, ambas ficam na melhor posição disponível
          if (!winnerId && !loserId) {
            await tx.syncEventScore.updateMany({ where: { roomId: round.roomId, teamId: teamA.id }, data: { finalPosition: pos1 } });
            await tx.syncEventScore.updateMany({ where: { roomId: round.roomId, teamId: teamB.id }, data: { finalPosition: pos1 } });
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
