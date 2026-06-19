"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { grantValidSyncTicketForPlayer } from "@/lib/sync-challenge";
import { runSyncBattle, loadModEffect } from "@/lib/sync-battle";
import { toBrtDateString } from "@/lib/date-utils";

export async function adminUndoSimulationAction(): Promise<{ error?: string; log?: string[] }> {
  try {
    await requireAdmin();
    const log: string[] = [];
    const date = toBrtDateString(new Date());

    const existingRooms = await prisma.syncEventRoom.findMany({
      where: { date },
      select: { id: true, teams: { select: { id: true } } },
    });

    if (existingRooms.length === 0) {
      return { error: "Nenhuma sala encontrada para hoje." };
    }

    const roomIds = existingRooms.map((r) => r.id);
    const teamIds = existingRooms.flatMap((r) => r.teams.map((t) => t.id));

    await prisma.syncRoundMatch.deleteMany({ where: { round: { roomId: { in: roomIds } } } });
    await prisma.syncRoundSelection.deleteMany({ where: { round: { roomId: { in: roomIds } } } });
    await prisma.syncEventRound.deleteMany({ where: { roomId: { in: roomIds } } });
    await prisma.syncEventScore.deleteMany({ where: { roomId: { in: roomIds } } });

    if (teamIds.length > 0) {
      const teamTickets = await prisma.syncEventTeam.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, ticketAId: true, ticketBId: true },
      });
      const ticketIds = teamTickets.flatMap((t) => [t.ticketAId, t.ticketBId]).filter(Boolean) as string[];
      if (ticketIds.length > 0) {
        await prisma.syncTicket.updateMany({ where: { id: { in: ticketIds } }, data: { status: "AVAILABLE" } });
      }
      await prisma.syncEventLineup.deleteMany({ where: { teamId: { in: teamIds } } });
      await prisma.syncEventTeam.deleteMany({ where: { id: { in: teamIds } } });
    }

    await prisma.syncEventRoom.deleteMany({ where: { id: { in: roomIds } } });

    log.push(`🧹 ${existingRooms.length} sala(s) e ${teamIds.length} dupla(s) removidas.`);
    log.push("✅ Simulação desfeita. A página está limpa para uma nova rodada.");

    revalidatePath("/desafio-sincronizado");
    return { log };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao desfazer simulação." };
  }
}

export async function adminRunFullSimulationAction(): Promise<{
  error?: string;
  roomId?: string;
  log?: string[];
}> {
  try {
    await requireAdmin();
    const log: string[] = [];

    // ── 1. Encontra 8 jogadores ativos com mascotes ──────────────────────────
    const players = await prisma.player.findMany({
      where: { active: true, user: { status: "ACTIVE" } },
      select: { id: true, displayName: true, mascots: { select: { id: true }, take: 9 } },
      orderBy: { displayName: "asc" },
      take: 30,
    });

    const eligible = players.filter((p) => p.mascots.length >= 3);
    if (eligible.length < 8) {
      return { error: `São necessários pelo menos 8 jogadores com ≥ 3 mascotes cada. Encontrados: ${eligible.length}.` };
    }

    const chosen = eligible.slice(0, 8);
    log.push(`✅ 8 jogadores selecionados: ${chosen.map((p) => p.displayName).join(", ")}`);

    // ── 2. Limpa salas existentes do dia (cascade manual) ───────────────────
    const date = toBrtDateString(new Date());
    const existingRooms = await prisma.syncEventRoom.findMany({
      where: { date },
      select: { id: true, teams: { select: { id: true } } },
    });

    if (existingRooms.length > 0) {
      const roomIds = existingRooms.map((r) => r.id);
      const teamIds = existingRooms.flatMap((r) => r.teams.map((t) => t.id));

      await prisma.syncRoundMatch.deleteMany({ where: { round: { roomId: { in: roomIds } } } });
      await prisma.syncRoundSelection.deleteMany({ where: { round: { roomId: { in: roomIds } } } });
      await prisma.syncEventRound.deleteMany({ where: { roomId: { in: roomIds } } });
      await prisma.syncEventScore.deleteMany({ where: { roomId: { in: roomIds } } });

      if (teamIds.length > 0) {
        const teamTickets = await prisma.syncEventTeam.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, ticketAId: true, ticketBId: true },
        });
        const ticketIds = teamTickets.flatMap((t) => [t.ticketAId, t.ticketBId]).filter(Boolean) as string[];
        if (ticketIds.length > 0) {
          await prisma.syncTicket.updateMany({ where: { id: { in: ticketIds } }, data: { status: "AVAILABLE" } });
        }
        await prisma.syncEventLineup.deleteMany({ where: { teamId: { in: teamIds } } });
        await prisma.syncEventTeam.deleteMany({ where: { id: { in: teamIds } } });
      }

      await prisma.syncEventRoom.deleteMany({ where: { id: { in: roomIds } } });
      log.push(`🧹 ${existingRooms.length} sala(s) do dia limpas`);
    }

    // ── 3. Limpa times pendentes dos jogadores escolhidos ───────────────────
    const pendingTeams = await prisma.syncEventTeam.findMany({
      where: {
        status: { in: ["OPEN", "COMPLETE", "LINEUP_PENDING", "LINEUP_READY"] },
        roomId: null,
        OR: [
          { playerAId: { in: chosen.map((p) => p.id) } },
          { playerBId: { in: chosen.map((p) => p.id) } },
        ],
      },
      select: { id: true, ticketAId: true, ticketBId: true },
    });
    if (pendingTeams.length > 0) {
      const pendingIds = pendingTeams.map((t) => t.id);
      const pendingTickets = pendingTeams.flatMap((t) => [t.ticketAId, t.ticketBId]).filter(Boolean) as string[];
      await prisma.syncEventLineup.deleteMany({ where: { teamId: { in: pendingIds } } });
      await prisma.syncEventTeam.updateMany({ where: { id: { in: pendingIds } }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      if (pendingTickets.length > 0) {
        await prisma.syncTicket.updateMany({ where: { id: { in: pendingTickets } }, data: { status: "AVAILABLE" } });
      }
      log.push(`🧹 ${pendingTeams.length} time(s) pendente(s) cancelados`);
    }

    // ── 4. Cria 4 duplas ─────────────────────────────────────────────────────
    const teamIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const pA = chosen[i * 2];
      const pB = chosen[i * 2 + 1];

      await prisma.$transaction(async (tx) => {
        const [ticketA, ticketB] = await Promise.all([
          grantValidSyncTicketForPlayer(tx, pA.id),
          grantValidSyncTicketForPlayer(tx, pB.id),
        ]);
        await tx.syncTicket.updateMany({
          where: { id: { in: [ticketA.id, ticketB.id] } },
          data: { status: "RESERVED" },
        });
        const team = await tx.syncEventTeam.create({
          data: {
            playerAId: pA.id,
            playerBId: pB.id,
            ticketAId: ticketA.id,
            ticketBId: ticketB.id,
            status: "LINEUP_PENDING",
            confirmedA: true,
            confirmedB: true,
            confirmedAt: new Date(),
            completedAt: new Date(),
          },
        });
        teamIds.push(team.id);

        const lineupData = [pA, pB].flatMap((p) =>
          p.mascots.slice(0, 9).map((m, slot) => ({
            teamId: team.id,
            playerId: p.id,
            mascotId: m.id,
            slot: slot + 1,
          }))
        );
        await tx.syncEventLineup.createMany({ data: lineupData });

        await tx.syncEventTeam.update({
          where: { id: team.id },
          data: { lineupStatusA: "LOCKED", lineupStatusB: "LOCKED", status: "LINEUP_READY", lineupReadyAt: new Date() },
        });
      });

      log.push(`🤝 Dupla ${i + 1}: ${pA.displayName} + ${pB.displayName}`);
    }

    // ── 5. Forma a sala ──────────────────────────────────────────────────────
    const room = await prisma.$transaction(async (tx) => {
      const r = await tx.syncEventRoom.create({ data: { roomIndex: 1, date, status: "READY" } });

      await Promise.all(
        teamIds.map((tid, slot) =>
          tx.syncEventTeam.update({ where: { id: tid }, data: { roomId: r.id, roomSlot: slot + 1 } })
        )
      );

      const now = new Date();
      await tx.syncEventRound.createMany({
        data: [1, 2, 3].map((rn) => ({ roomId: r.id, roundNumber: rn, status: "PENDING", scheduledAt: now })),
      });

      const scoreData = chosen.map((p, idx) => ({ roomId: r.id, teamId: teamIds[Math.floor(idx / 2)], playerId: p.id }));
      await tx.syncEventScore.createMany({ data: scoreData });

      return r;
    });

    log.push(`🏟️ Arena única formada com todas as duplas simuladas`);

    // ── 6. Executa as 3 rodadas ──────────────────────────────────────────────
    const rounds = await prisma.syncEventRound.findMany({ where: { roomId: room.id }, orderBy: { roundNumber: "asc" } });
    const teams = await prisma.syncEventTeam.findMany({
      where: { roomId: room.id },
      include: { lineups: true },
      orderBy: { roomSlot: "asc" },
    });

    const pairingsPerRound: [number, number][][] = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];

    // Pré-carrega todos os lineups indexados por playerId
    const lineupsByPlayer = new Map<string, string[]>();
    for (const team of teams) {
      const playerIds = [team.playerAId, team.playerBId].filter(Boolean) as string[];
      for (const pid of playerIds) {
        lineupsByPlayer.set(pid, team.lineups.filter((l) => l.playerId === pid).map((l) => l.mascotId));
      }
    }

    for (const round of rounds) {
      const modifiers = await prisma.syncEventModifier.findMany({ where: { active: true }, select: { id: true } });
      const modifierId = modifiers.length > 0 ? modifiers[Math.floor(Math.random() * modifiers.length)].id : null;
      const modEffect = await loadModEffect(modifierId);

      await prisma.syncEventRound.update({
        where: { id: round.id },
        data: { status: "EXECUTING", modifierId, selectionsClosedAt: new Date() },
      });

      // Busca todas as seleções feitas até agora para esta sala (1 query por rodada)
      const allPrevSels = await prisma.syncRoundSelection.findMany({
        where: { round: { roomId: room.id, roundNumber: { lt: round.roundNumber } } },
        select: { playerId: true, mascotIds: true },
      });
      const usedByPlayer = new Map<string, Set<string>>();
      for (const sel of allPrevSels) {
        const set = usedByPlayer.get(sel.playerId) ?? new Set();
        for (const mid of sel.mascotIds) set.add(mid);
        usedByPlayer.set(sel.playerId, set);
      }

      const pairings = pairingsPerRound[round.roundNumber - 1] ?? [[0, 1], [2, 3]];

      for (const [slotA, slotB] of pairings) {
        const teamA = teams[slotA];
        const teamB = teams[slotB];
        if (!teamA || !teamB) continue;

        const allSelections: { teamId: string; playerId: string; mascotIds: string[] }[] = [];
        const createdSelections: { roundId: string; teamId: string; playerId: string; mascotIds: string[]; isAuto: boolean }[] = [];

        for (const team of [teamA, teamB]) {
          const playerIds = [team.playerAId, team.playerBId].filter(Boolean) as string[];
          for (const pid of playerIds) {
            const used = usedByPlayer.get(pid) ?? new Set();
            const lineup = lineupsByPlayer.get(pid) ?? [];
            const available = lineup.filter((mid) => !used.has(mid));
            let picks = available.slice(0, 3);
            if (picks.length < 3) {
              // fallback: reutiliza mascotes já usados
              picks = lineup.slice(0, 3);
            }
            const finalPicks = picks.slice(0, 3);
            if (finalPicks.length > 0) {
              allSelections.push({ teamId: team.id, playerId: pid, mascotIds: finalPicks });
              createdSelections.push({ roundId: round.id, teamId: team.id, playerId: pid, mascotIds: finalPicks, isAuto: true });
            }
          }
        }

        await prisma.syncRoundSelection.createMany({ data: createdSelections });

        const result = await runSyncBattle({ teamA, teamB, selections: allSelections, modifierId, modEffect });

        await prisma.syncRoundMatch.create({
          data: {
            roundId: round.id,
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

        const aWon = result.result === "TEAM_A_WIN";
        const bWon = result.result === "TEAM_B_WIN";

        await Promise.all([
          ...[teamA.playerAId, teamA.playerBId].filter(Boolean).map((pid) =>
            prisma.syncEventScore.updateMany({
              where: { roomId: room.id, playerId: pid as string },
              data: {
                wins: aWon ? { increment: 1 } : undefined,
                losses: bWon ? { increment: 1 } : undefined,
                draws: (!aWon && !bWon) ? { increment: 1 } : undefined,
                damageDone: { increment: result.teamADamage },
                damageTaken: { increment: result.teamBDamage },
                survivingTotal: { increment: result.survivingA },
              },
            })
          ),
          ...[teamB.playerAId, teamB.playerBId].filter(Boolean).map((pid) =>
            prisma.syncEventScore.updateMany({
              where: { roomId: room.id, playerId: pid as string },
              data: {
                wins: bWon ? { increment: 1 } : undefined,
                losses: aWon ? { increment: 1 } : undefined,
                draws: (!aWon && !bWon) ? { increment: 1 } : undefined,
                damageDone: { increment: result.teamBDamage },
                damageTaken: { increment: result.teamADamage },
                survivingTotal: { increment: result.survivingB },
              },
            })
          ),
        ]);

        // Atualiza o mapa de used para a próxima iteração da mesma rodada
        for (const sel of createdSelections) {
          const set = usedByPlayer.get(sel.playerId) ?? new Set();
          for (const mid of sel.mascotIds) set.add(mid);
          usedByPlayer.set(sel.playerId, set);
        }
      }

      await prisma.syncEventRound.update({
        where: { id: round.id },
        data: { status: "DONE", executedAt: new Date() },
      });

      log.push(`⚔️ Rodada ${round.roundNumber} concluída${modifierId ? " (com modificador)" : ""}`);
    }

    await prisma.syncEventRoom.update({ where: { id: room.id }, data: { status: "FINISHED", finishedAt: new Date() } });
    log.push("🏁 Evento encerrado. Acesse a sala para ver o ranking e conferir as recompensas.");

    revalidatePath("/desafio-sincronizado");
    return { roomId: room.id, log };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro na simulação." };
  }
}

// ── Step-by-step simulation interfaces ──────────────────────────────────────

export interface SimSetupResult {
  error?: string;
  roomId?: string;
  log?: string[];
  teams?: { name: string; playerAName: string; playerBName: string }[];
}

export interface SimRoundResult {
  error?: string;
  log?: string[];
  matches?: {
    teamAName: string;
    teamBName: string;
    result: string;
    teamADamage: number;
    teamBDamage: number;
    survivingA: number;
    survivingB: number;
    replayJson: unknown;
  }[];
  ranking?: { teamName: string; wins: number; damageDone: number }[];
}

export interface SimFinalizeResult {
  error?: string;
  log?: string[];
  ranking?: { position: number; teamName: string; wins: number }[];
}

// ── adminSimSetupAction ──────────────────────────────────────────────────────

export async function adminSimSetupAction(): Promise<SimSetupResult> {
  try {
    await requireAdmin();
    const log: string[] = [];

    // 1. Find 8 eligible players
    const players = await prisma.player.findMany({
      where: { active: true, user: { status: "ACTIVE" } },
      select: { id: true, displayName: true, mascots: { select: { id: true }, take: 9 } },
      orderBy: { displayName: "asc" },
      take: 30,
    });

    const eligible = players.filter((p) => p.mascots.length >= 3);
    if (eligible.length < 8) {
      return { error: `São necessários pelo menos 8 jogadores com ≥ 3 mascotes cada. Encontrados: ${eligible.length}.` };
    }

    const chosen = eligible.slice(0, 8);
    log.push(`✅ 8 jogadores selecionados: ${chosen.map((p) => p.displayName).join(", ")}`);

    // 2. Cleanup existing rooms for the day
    const date = toBrtDateString(new Date());
    const existingRooms = await prisma.syncEventRoom.findMany({
      where: { date },
      select: { id: true, teams: { select: { id: true } } },
    });

    if (existingRooms.length > 0) {
      const roomIds = existingRooms.map((r) => r.id);
      const teamIds = existingRooms.flatMap((r) => r.teams.map((t) => t.id));

      await prisma.syncRoundMatch.deleteMany({ where: { round: { roomId: { in: roomIds } } } });
      await prisma.syncRoundSelection.deleteMany({ where: { round: { roomId: { in: roomIds } } } });
      await prisma.syncEventRound.deleteMany({ where: { roomId: { in: roomIds } } });
      await prisma.syncEventScore.deleteMany({ where: { roomId: { in: roomIds } } });

      if (teamIds.length > 0) {
        const teamTickets = await prisma.syncEventTeam.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, ticketAId: true, ticketBId: true },
        });
        const ticketIds = teamTickets.flatMap((t) => [t.ticketAId, t.ticketBId]).filter(Boolean) as string[];
        if (ticketIds.length > 0) {
          await prisma.syncTicket.updateMany({ where: { id: { in: ticketIds } }, data: { status: "AVAILABLE" } });
        }
        await prisma.syncEventLineup.deleteMany({ where: { teamId: { in: teamIds } } });
        await prisma.syncEventTeam.deleteMany({ where: { id: { in: teamIds } } });
      }
      await prisma.syncEventRoom.deleteMany({ where: { id: { in: roomIds } } });
      log.push(`🧹 ${existingRooms.length} sala(s) do dia limpas`);
    }

    // 3. Cleanup pending teams
    const pendingTeams = await prisma.syncEventTeam.findMany({
      where: {
        status: { in: ["OPEN", "COMPLETE", "LINEUP_PENDING", "LINEUP_READY"] },
        roomId: null,
        OR: [
          { playerAId: { in: chosen.map((p) => p.id) } },
          { playerBId: { in: chosen.map((p) => p.id) } },
        ],
      },
      select: { id: true, ticketAId: true, ticketBId: true },
    });
    if (pendingTeams.length > 0) {
      const pendingIds = pendingTeams.map((t) => t.id);
      const pendingTickets = pendingTeams.flatMap((t) => [t.ticketAId, t.ticketBId]).filter(Boolean) as string[];
      await prisma.syncEventLineup.deleteMany({ where: { teamId: { in: pendingIds } } });
      await prisma.syncEventTeam.updateMany({ where: { id: { in: pendingIds } }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      if (pendingTickets.length > 0) {
        await prisma.syncTicket.updateMany({ where: { id: { in: pendingTickets } }, data: { status: "AVAILABLE" } });
      }
      log.push(`🧹 ${pendingTeams.length} time(s) pendente(s) cancelados`);
    }

    // 4. Create 4 duplas
    const teamIds: string[] = [];
    const teamsResult: SimSetupResult["teams"] = [];

    for (let i = 0; i < 4; i++) {
      const pA = chosen[i * 2];
      const pB = chosen[i * 2 + 1];

      await prisma.$transaction(async (tx) => {
        const [ticketA, ticketB] = await Promise.all([
          grantValidSyncTicketForPlayer(tx, pA.id),
          grantValidSyncTicketForPlayer(tx, pB.id),
        ]);
        await tx.syncTicket.updateMany({
          where: { id: { in: [ticketA.id, ticketB.id] } },
          data: { status: "RESERVED" },
        });
        const team = await tx.syncEventTeam.create({
          data: {
            playerAId: pA.id,
            playerBId: pB.id,
            ticketAId: ticketA.id,
            ticketBId: ticketB.id,
            status: "LINEUP_PENDING",
            confirmedA: true,
            confirmedB: true,
            confirmedAt: new Date(),
            completedAt: new Date(),
          },
        });
        teamIds.push(team.id);

        const lineupData = [pA, pB].flatMap((p) =>
          p.mascots.slice(0, 9).map((m, slot) => ({
            teamId: team.id,
            playerId: p.id,
            mascotId: m.id,
            slot: slot + 1,
          }))
        );
        await tx.syncEventLineup.createMany({ data: lineupData });

        await tx.syncEventTeam.update({
          where: { id: team.id },
          data: { lineupStatusA: "LOCKED", lineupStatusB: "LOCKED", status: "LINEUP_READY", lineupReadyAt: new Date() },
        });
      });

      teamsResult!.push({ name: `Dupla ${i + 1}`, playerAName: pA.displayName, playerBName: pB.displayName });
      log.push(`🤝 Dupla ${i + 1}: ${pA.displayName} + ${pB.displayName}`);
    }

    // 5. Form room
    const room = await prisma.$transaction(async (tx) => {
      const r = await tx.syncEventRoom.create({ data: { roomIndex: 1, date, status: "READY" } });

      await Promise.all(
        teamIds.map((tid, slot) =>
          tx.syncEventTeam.update({ where: { id: tid }, data: { roomId: r.id, roomSlot: slot + 1 } })
        )
      );

      const now = new Date();
      await tx.syncEventRound.createMany({
        data: [1, 2, 3].map((rn) => ({ roomId: r.id, roundNumber: rn, status: "PENDING", scheduledAt: now })),
      });

      const scoreData = chosen.map((p, idx) => ({ roomId: r.id, teamId: teamIds[Math.floor(idx / 2)], playerId: p.id }));
      await tx.syncEventScore.createMany({ data: scoreData });

      return r;
    });

    log.push(`🏟️ Arena única formada com todas as duplas simuladas`);

    revalidatePath("/desafio-sincronizado");
    return { roomId: room.id, log, teams: teamsResult };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro no setup da simulação." };
  }
}

// ── adminSimRoundAction ──────────────────────────────────────────────────────

export async function adminSimRoundAction(roomId: string, roundNumber: number): Promise<SimRoundResult> {
  try {
    await requireAdmin();
    const log: string[] = [];

    const round = await prisma.syncEventRound.findFirst({
      where: { roomId, roundNumber },
    });
    if (!round) return { error: `Rodada ${roundNumber} não encontrada.` };

    const modifiers = await prisma.syncEventModifier.findMany({ where: { active: true }, select: { id: true } });
    const modifierId = modifiers.length > 0 ? modifiers[Math.floor(Math.random() * modifiers.length)].id : null;
    const modEffect = await loadModEffect(modifierId);

    await prisma.syncEventRound.update({
      where: { id: round.id },
      data: { status: "EXECUTING", modifierId, selectionsClosedAt: new Date() },
    });

    const teams = await prisma.syncEventTeam.findMany({
      where: { roomId },
      include: { lineups: true },
      orderBy: { roomSlot: "asc" },
    });

    const lineupsByPlayer = new Map<string, string[]>();
    for (const team of teams) {
      const playerIds = [team.playerAId, team.playerBId].filter(Boolean) as string[];
      for (const pid of playerIds) {
        lineupsByPlayer.set(pid, team.lineups.filter((l) => l.playerId === pid).map((l) => l.mascotId));
      }
    }

    const allPrevSels = await prisma.syncRoundSelection.findMany({
      where: { round: { roomId, roundNumber: { lt: roundNumber } } },
      select: { playerId: true, mascotIds: true },
    });
    const usedByPlayer = new Map<string, Set<string>>();
    for (const sel of allPrevSels) {
      const set = usedByPlayer.get(sel.playerId) ?? new Set();
      for (const mid of sel.mascotIds) set.add(mid);
      usedByPlayer.set(sel.playerId, set);
    }

    const pairingsPerRound: [number, number][][] = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];
    const pairings = pairingsPerRound[roundNumber - 1] ?? [[0, 1], [2, 3]];

    const matchesResult: NonNullable<SimRoundResult["matches"]> = [];

    for (const [slotA, slotB] of pairings) {
      const teamA = teams[slotA];
      const teamB = teams[slotB];
      if (!teamA || !teamB) continue;

      const allSelections: { teamId: string; playerId: string; mascotIds: string[] }[] = [];
      const createdSelections: { roundId: string; teamId: string; playerId: string; mascotIds: string[]; isAuto: boolean }[] = [];

      for (const team of [teamA, teamB]) {
        const playerIds = [team.playerAId, team.playerBId].filter(Boolean) as string[];
        for (const pid of playerIds) {
          const used = usedByPlayer.get(pid) ?? new Set();
          const lineup = lineupsByPlayer.get(pid) ?? [];
          const available = lineup.filter((mid) => !used.has(mid));
          let picks = available.slice(0, 3);
          if (picks.length < 3) picks = lineup.slice(0, 3);
          const finalPicks = picks.slice(0, 3);
          if (finalPicks.length > 0) {
            allSelections.push({ teamId: team.id, playerId: pid, mascotIds: finalPicks });
            createdSelections.push({ roundId: round.id, teamId: team.id, playerId: pid, mascotIds: finalPicks, isAuto: true });
          }
        }
      }

      await prisma.syncRoundSelection.createMany({ data: createdSelections });

      const result = await runSyncBattle({ teamA, teamB, selections: allSelections, modifierId, modEffect });

      const matchRow = await prisma.syncRoundMatch.create({
        data: {
          roundId: round.id,
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

      // Fetch team names for the result
      const teamAFull = await prisma.syncEventTeam.findUnique({
        where: { id: teamA.id },
        select: { playerA: { select: { displayName: true } }, playerB: { select: { displayName: true } } },
      });
      const teamBFull = await prisma.syncEventTeam.findUnique({
        where: { id: teamB.id },
        select: { playerA: { select: { displayName: true } }, playerB: { select: { displayName: true } } },
      });

      const teamAName = teamAFull ? `${teamAFull.playerA.displayName}${teamAFull.playerB ? ` + ${teamAFull.playerB.displayName}` : ""}` : teamA.id;
      const teamBName = teamBFull ? `${teamBFull.playerA.displayName}${teamBFull.playerB ? ` + ${teamBFull.playerB.displayName}` : ""}` : teamB.id;

      matchesResult.push({
        teamAName,
        teamBName,
        result: result.result,
        teamADamage: result.teamADamage,
        teamBDamage: result.teamBDamage,
        survivingA: result.survivingA,
        survivingB: result.survivingB,
        replayJson: matchRow.replayJson,
      });

      const aWon = result.result === "TEAM_A_WIN";
      const bWon = result.result === "TEAM_B_WIN";

      await Promise.all([
        ...[teamA.playerAId, teamA.playerBId].filter(Boolean).map((pid) =>
          prisma.syncEventScore.updateMany({
            where: { roomId, playerId: pid as string },
            data: {
              wins: aWon ? { increment: 1 } : undefined,
              losses: bWon ? { increment: 1 } : undefined,
              draws: (!aWon && !bWon) ? { increment: 1 } : undefined,
              damageDone: { increment: result.teamADamage },
              damageTaken: { increment: result.teamBDamage },
              survivingTotal: { increment: result.survivingA },
            },
          })
        ),
        ...[teamB.playerAId, teamB.playerBId].filter(Boolean).map((pid) =>
          prisma.syncEventScore.updateMany({
            where: { roomId, playerId: pid as string },
            data: {
              wins: bWon ? { increment: 1 } : undefined,
              losses: aWon ? { increment: 1 } : undefined,
              draws: (!aWon && !bWon) ? { increment: 1 } : undefined,
              damageDone: { increment: result.teamBDamage },
              damageTaken: { increment: result.teamADamage },
              survivingTotal: { increment: result.survivingB },
            },
          })
        ),
      ]);

      for (const sel of createdSelections) {
        const set = usedByPlayer.get(sel.playerId) ?? new Set();
        for (const mid of sel.mascotIds) set.add(mid);
        usedByPlayer.set(sel.playerId, set);
      }
    }

    await prisma.syncEventRound.update({
      where: { id: round.id },
      data: { status: "DONE", executedAt: new Date() },
    });

    log.push(`⚔️ Rodada ${roundNumber} concluída${modifierId ? " (com modificador)" : ""}`);

    // Compute ranking
    const scores = await prisma.syncEventScore.findMany({
      where: { roomId },
      include: { team: { include: { playerA: { select: { displayName: true } }, playerB: { select: { displayName: true } } } } },
      orderBy: [{ wins: "desc" }, { damageDone: "desc" }],
    });

    const teamRankingMap = new Map<string, { teamName: string; wins: number; damageDone: number }>();
    for (const score of scores) {
      const existing = teamRankingMap.get(score.teamId);
      const name = `${score.team.playerA.displayName}${score.team.playerB ? ` + ${score.team.playerB.displayName}` : ""}`;
      if (!existing || score.wins > existing.wins) {
        teamRankingMap.set(score.teamId, { teamName: name, wins: score.wins, damageDone: score.damageDone });
      }
    }

    const ranking = [...teamRankingMap.values()].sort((a, b) => b.wins - a.wins || b.damageDone - a.damageDone);

    revalidatePath("/desafio-sincronizado");
    return { log, matches: matchesResult, ranking };
  } catch (err) {
    return { error: err instanceof Error ? err.message : `Erro na rodada ${roundNumber}.` };
  }
}

// ── adminSimFinalizeAction ───────────────────────────────────────────────────

export async function adminSimFinalizeAction(roomId: string): Promise<SimFinalizeResult> {
  try {
    await requireAdmin();
    const log: string[] = [];

    await prisma.syncEventRoom.update({ where: { id: roomId }, data: { status: "FINISHED", finishedAt: new Date() } });
    log.push("🏁 Evento encerrado.");

    const scores = await prisma.syncEventScore.findMany({
      where: { roomId },
      include: { team: { include: { playerA: { select: { displayName: true } }, playerB: { select: { displayName: true } } } } },
      orderBy: [{ wins: "desc" }, { damageDone: "desc" }],
    });

    const teamRankingMap = new Map<string, { teamName: string; wins: number; damageDone: number }>();
    for (const score of scores) {
      const existing = teamRankingMap.get(score.teamId);
      const name = `${score.team.playerA.displayName}${score.team.playerB ? ` + ${score.team.playerB.displayName}` : ""}`;
      if (!existing || score.wins > existing.wins) {
        teamRankingMap.set(score.teamId, { teamName: name, wins: score.wins, damageDone: score.damageDone });
      }
    }

    const sorted = [...teamRankingMap.values()].sort((a, b) => b.wins - a.wins || b.damageDone - a.damageDone);
    const ranking = sorted.map((r, idx) => ({ position: idx + 1, teamName: r.teamName, wins: r.wins }));

    revalidatePath("/desafio-sincronizado");
    return { log, ranking };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao finalizar simulação." };
  }
}
