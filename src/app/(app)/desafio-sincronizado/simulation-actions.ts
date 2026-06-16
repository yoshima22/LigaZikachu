"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { grantValidSyncTicketForPlayer } from "@/lib/sync-challenge";
import { runSyncBattle } from "@/lib/sync-battle";
import { toBrtDateString } from "@/lib/date-utils";

// Executa um ciclo completo do Desafio Sincronizado de forma automática:
// tickets → duplas → confirmação → escalação → sala → 3 rodadas → recompensas

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

    // Filtra jogadores com ao menos 3 mascotes (mínimo para disputar 1 rodada)
    const eligible = players.filter((p) => p.mascots.length >= 3);
    if (eligible.length < 8) {
      return {
        error: `São necessários pelo menos 8 jogadores com ≥ 3 mascotes cada. Encontrados: ${eligible.length}.`,
      };
    }

    const chosen = eligible.slice(0, 8);
    log.push(`✅ 8 jogadores selecionados: ${chosen.map((p) => p.displayName).join(", ")}`);

    // ── 2. Limpa dados de simulação anteriores (equipes sem sala, lineups) ──
    const oldTeams = await prisma.syncEventTeam.findMany({
      where: {
        status: { in: ["OPEN", "COMPLETE", "LINEUP_PENDING", "LINEUP_READY"] },
        roomId: null,
        playerAId: { in: chosen.map((p) => p.id) },
      },
      select: { id: true, ticketAId: true, ticketBId: true },
    });
    for (const t of oldTeams) {
      await prisma.syncEventLineup.deleteMany({ where: { teamId: t.id } });
      await prisma.syncEventTeam.update({ where: { id: t.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      const ids = [t.ticketAId, t.ticketBId].filter(Boolean) as string[];
      if (ids.length) await prisma.syncTicket.updateMany({ where: { id: { in: ids } }, data: { status: "AVAILABLE" } });
    }
    if (oldTeams.length) log.push(`🧹 ${oldTeams.length} equipe(s) pendente(s) da conta limpas`);

    // ── 3. Cria 4 duplas (chosen[0+1], [2+3], [4+5], [6+7]) ────────────────
    const teamIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const pA = chosen[i * 2];
      const pB = chosen[i * 2 + 1];

      await prisma.$transaction(async (tx) => {
        const ticketA = await grantValidSyncTicketForPlayer(tx, pA.id);
        const ticketB = await grantValidSyncTicketForPlayer(tx, pB.id);
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

        // Escala até 9 mascotes por jogador
        for (const p of [pA, pB]) {
          const mascots = p.mascots.slice(0, 9);
          for (let slot = 0; slot < mascots.length; slot++) {
            await tx.syncEventLineup.create({
              data: { teamId: team.id, playerId: p.id, mascotId: mascots[slot].id, slot: slot + 1 },
            });
          }
        }

        // Trava as escalações (bypassa validação de 9 mínimo para jogadores com menos)
        await tx.syncEventTeam.update({
          where: { id: team.id },
          data: {
            lineupStatusA: "LOCKED",
            lineupStatusB: "LOCKED",
            status: "LINEUP_READY",
            lineupReadyAt: new Date(),
          },
        });
      });

      log.push(`🤝 Dupla ${i + 1}: ${pA.displayName} + ${pB.displayName}`);
    }

    // ── 4. Forma a sala ──────────────────────────────────────────────────────
    const date = toBrtDateString(new Date());

    // Remove sala anterior de hoje se houver (para simulação repetível)
    await prisma.syncEventRoom.deleteMany({ where: { date, status: { in: ["READY", "CANCELLED"] } } });

    const room = await prisma.$transaction(async (tx) => {
      const r = await tx.syncEventRoom.create({
        data: { roomIndex: 1, date, status: "READY" },
      });

      for (let slot = 0; slot < 4; slot++) {
        await tx.syncEventTeam.update({
          where: { id: teamIds[slot] },
          data: { roomId: r.id, roomSlot: slot + 1 },
        });
      }

      const now = new Date();
      for (let rn = 1; rn <= 3; rn++) {
        await tx.syncEventRound.create({
          data: { roomId: r.id, roundNumber: rn, status: "PENDING", scheduledAt: now },
        });
      }

      for (let i = 0; i < 4; i++) {
        const pA = chosen[i * 2];
        const pB = chosen[i * 2 + 1];
        for (const pid of [pA.id, pB.id]) {
          await tx.syncEventScore.create({
            data: { roomId: r.id, teamId: teamIds[i], playerId: pid },
          });
        }
      }

      return r;
    });

    log.push(`🏟️ Sala formada: Arena 1 com 4 duplas`);

    // ── 5. Executa as 3 rodadas automaticamente ──────────────────────────────
    const rounds = await prisma.syncEventRound.findMany({
      where: { roomId: room.id },
      orderBy: { roundNumber: "asc" },
    });

    const pairingsPerRound: [number, number][][] = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];

    for (const round of rounds) {
      const teams = await prisma.syncEventTeam.findMany({
        where: { roomId: room.id },
        include: { lineups: true },
        orderBy: { roomSlot: "asc" },
      });

      // Sorteia modificador (se houver)
      const modifiers = await prisma.syncEventModifier.findMany({ where: { active: true }, select: { id: true } });
      const modifierId = modifiers.length > 0
        ? modifiers[Math.floor(Math.random() * modifiers.length)].id
        : null;

      await prisma.syncEventRound.update({
        where: { id: round.id },
        data: { status: "EXECUTING", modifierId, selectionsClosedAt: new Date() },
      });

      const pairings = pairingsPerRound[round.roundNumber - 1] ?? [[0, 1], [2, 3]];

      for (const [slotA, slotB] of pairings) {
        const teamA = teams[slotA];
        const teamB = teams[slotB];
        if (!teamA || !teamB) continue;

        // Auto-seleciona 3 mascotes disponíveis por jogador
        const allSelections: { teamId: string; playerId: string; mascotIds: string[] }[] = [];

        for (const team of [teamA, teamB]) {
          const playerIds = [team.playerAId, team.playerBId].filter(Boolean) as string[];
          for (const pid of playerIds) {
            const prevSels = await prisma.syncRoundSelection.findMany({
              where: { playerId: pid, round: { roomId: room.id, roundNumber: { lt: round.roundNumber } } },
              select: { mascotIds: true },
            });
            const used = new Set(prevSels.flatMap((s) => s.mascotIds));
            const available = team.lineups.filter((l) => l.playerId === pid && !used.has(l.mascotId));
            const picks = available.slice(0, 3).map((l) => l.mascotId);
            if (picks.length < 3) {
              // Reutiliza qualquer mascote do lineup se acabaram
              const fallback = team.lineups.filter((l) => l.playerId === pid).slice(0, 3).map((l) => l.mascotId);
              picks.push(...fallback.filter((id) => !picks.includes(id)));
            }
            const finalPicks = picks.slice(0, 3);
            if (finalPicks.length > 0) {
              await prisma.syncRoundSelection.create({
                data: { roundId: round.id, teamId: team.id, playerId: pid, mascotIds: finalPicks, isAuto: true },
              });
              allSelections.push({ teamId: team.id, playerId: pid, mascotIds: finalPicks });
            }
          }
        }

        const result = await runSyncBattle({ teamA, teamB, selections: allSelections, modifierId });

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

        for (const [team, won, lost, dmg, surv, dmgTaken] of [
          [teamA, aWon, bWon, result.teamADamage, result.survivingA, result.teamBDamage],
          [teamB, bWon, aWon, result.teamBDamage, result.survivingB, result.teamADamage],
        ] as [typeof teamA, boolean, boolean, number, number, number][]) {
          for (const pid of [team.playerAId, team.playerBId].filter(Boolean) as string[]) {
            await prisma.syncEventScore.updateMany({
              where: { roomId: room.id, playerId: pid },
              data: {
                wins: won ? { increment: 1 } : undefined,
                losses: lost ? { increment: 1 } : undefined,
                draws: (!won && !lost) ? { increment: 1 } : undefined,
                damageDone: { increment: dmg },
                damageTaken: { increment: dmgTaken },
                survivingTotal: { increment: surv },
              },
            });
          }
        }
      }

      await prisma.syncEventRound.update({
        where: { id: round.id },
        data: { status: "DONE", executedAt: new Date() },
      });

      log.push(`⚔️ Rodada ${round.roundNumber} concluída${modifierId ? " (com modificador)" : ""}`);
    }

    await prisma.syncEventRoom.update({
      where: { id: room.id },
      data: { status: "FINISHED", finishedAt: new Date() },
    });

    log.push("🏁 Evento encerrado. Acesse a sala para ver o ranking e entregar recompensas.");

    revalidatePath("/desafio-sincronizado");
    return { roomId: room.id, log };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro na simulação." };
  }
}
