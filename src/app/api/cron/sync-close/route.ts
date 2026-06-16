/**
 * Cron job — fechamento de inscrições do Desafio Sincronizado
 *
 * Roda às 17:01 BRT (20:01 UTC) nos dias em que o evento está agendado.
 * Executa a validação de duplas, remove incompletas e forma as salas.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toBrtDateString } from "@/lib/date-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const date = toBrtDateString(new Date());

    // Verifica se já existem salas para hoje
    const existing = await prisma.syncEventRoom.count({ where: { date } });
    if (existing > 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Salas já formadas para hoje." });
    }

    // Valida configuração
    const config = await prisma.syncChallengeConfig.findUnique({ where: { id: "singleton" } });
    if (!config?.ticketsEnabled) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Sistema de tickets desativado." });
    }

    // Valida janela — só fecha se registrationClosesAt passou
    if (config.registrationClosesAt && new Date() < config.registrationClosesAt) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Janela de inscrição ainda não fechou." });
    }

    // Busca duplas com lineups travados (LINEUP_READY) e sem sala atribuída
    const readyTeams = await prisma.syncEventTeam.findMany({
      where: { status: "LINEUP_READY", roomId: null },
      select: { id: true, playerAId: true, playerBId: true, lineups: { select: { playerId: true } } },
      orderBy: { lineupReadyAt: "asc" },
    });

    // Remove duplas com lineup incompleto (algum jogador sem 9 mascotes)
    const validTeams = readyTeams.filter((t) => {
      if (!t.playerBId) return false;
      const countA = t.lineups.filter((l) => l.playerId === t.playerAId).length;
      const countB = t.lineups.filter((l) => l.playerId === t.playerBId).length;
      return countA >= 9 && countB >= 9;
    });

    const invalidCount = readyTeams.length - validTeams.length;
    if (invalidCount > 0) {
      // Cancela duplas inválidas e devolve tickets
      const invalidIds = readyTeams
        .filter((t) => !validTeams.find((v) => v.id === t.id))
        .map((t) => t.id);

      const teamsToCancel = await prisma.syncEventTeam.findMany({
        where: { id: { in: invalidIds } },
        select: { id: true, ticketAId: true, ticketBId: true },
      });

      for (const team of teamsToCancel) {
        await prisma.syncEventLineup.deleteMany({ where: { teamId: team.id } });
        await prisma.syncEventTeam.update({
          where: { id: team.id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        const ids = [team.ticketAId, team.ticketBId].filter(Boolean) as string[];
        if (ids.length) {
          await prisma.syncTicket.updateMany({ where: { id: { in: ids } }, data: { status: "AVAILABLE" } });
        }
      }
    }

    if (validTeams.length < 4) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: `Apenas ${validTeams.length} dupla(s) válida(s). Mínimo 4 por sala.`,
        invalidRemoved: invalidCount,
      });
    }

    // Forma salas de 4 (máx 3 por dia)
    const maxRooms = 3;
    const roomSlots: typeof validTeams[] = [];
    for (let i = 0; i < Math.min(Math.floor(validTeams.length / 4), maxRooms); i++) {
      roomSlots.push(validTeams.slice(i * 4, i * 4 + 4));
    }

    const roundTimes = [config.round1At, config.round2At, config.round3At];
    const formed: string[] = [];

    for (let ri = 0; ri < roomSlots.length; ri++) {
      const slot = roomSlots[ri];
      await prisma.$transaction(async (tx) => {
        const room = await tx.syncEventRoom.create({
          data: { roomIndex: ri + 1, date, status: "READY" },
        });
        formed.push(room.id);

        for (let s = 0; s < 4; s++) {
          await tx.syncEventTeam.update({
            where: { id: slot[s].id },
            data: { roomId: room.id, roomSlot: s + 1 },
          });
        }

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

        for (const team of slot) {
          for (const pid of [team.playerAId, team.playerBId].filter(Boolean) as string[]) {
            await tx.syncEventScore.create({
              data: { roomId: room.id, teamId: team.id, playerId: pid },
            });
          }
        }
      });
    }

    console.log(`[SyncClose] ${formed.length} sala(s) formada(s). ${invalidCount} dupla(s) inválida(s) canceladas.`);

    return NextResponse.json({
      ok: true,
      roomsFormed: formed.length,
      invalidRemoved: invalidCount,
      roomIds: formed,
    });
  } catch (err) {
    console.error("[SyncClose] Erro:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}
