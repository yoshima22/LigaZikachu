"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { toBrtDateString } from "@/lib/date-utils";

export type SyncCleanupResult = {
  error?: string;
  scheduledDate?: string;
  rooms?: number;
  teams?: number;
  lineups?: number;
  selections?: number;
  matches?: number;
  scores?: number;
};

function startOfBrtDay(date: string) {
  return new Date(`${date}T00:00:00-03:00`);
}

export async function adminClearPreviousSyncEventsAction(): Promise<SyncCleanupResult> {
  try {
    await requireAdmin();
    const config = await prisma.syncChallengeConfig.findUnique({
      where: { id: "singleton" },
      select: { registrationOpensAt: true, round1At: true },
    });
    if (!config?.round1At || config.round1At <= new Date()) {
      return { error: "Agende a primeira rodada do próximo evento em uma data futura antes de executar a limpeza." };
    }

    const scheduledDate = toBrtDateString(config.round1At);
    const preserveTeamsFrom = config.registrationOpensAt && config.registrationOpensAt <= config.round1At
      ? config.registrationOpensAt
      : startOfBrtDay(scheduledDate);

    const oldRooms = await prisma.syncEventRoom.findMany({
      where: { date: { lt: scheduledDate } },
      select: { id: true, teams: { select: { id: true } } },
    });
    const roomIds = oldRooms.map((room) => room.id);
    const roomTeamIds = oldRooms.flatMap((room) => room.teams.map((team) => team.id));
    const oldDetachedTeams = await prisma.syncEventTeam.findMany({
      where: { roomId: null, createdAt: { lt: preserveTeamsFrom } },
      select: { id: true },
    });
    const teamIds = [...new Set([...roomTeamIds, ...oldDetachedTeams.map((team) => team.id)])];

    const [lineups, selections, matches, scores] = await Promise.all([
      teamIds.length ? prisma.syncEventLineup.count({ where: { teamId: { in: teamIds } } }) : 0,
      roomIds.length ? prisma.syncRoundSelection.count({ where: { round: { roomId: { in: roomIds } } } }) : 0,
      roomIds.length ? prisma.syncRoundMatch.count({ where: { round: { roomId: { in: roomIds } } } }) : 0,
      roomIds.length ? prisma.syncEventScore.count({ where: { roomId: { in: roomIds } } }) : 0,
    ]);

    await prisma.$transaction(async (tx) => {
      if (roomIds.length) {
        await tx.syncRoundMatch.deleteMany({ where: { round: { roomId: { in: roomIds } } } });
        await tx.syncRoundSelection.deleteMany({ where: { round: { roomId: { in: roomIds } } } });
        await tx.syncEventScore.deleteMany({ where: { roomId: { in: roomIds } } });
        await tx.syncEventRound.deleteMany({ where: { roomId: { in: roomIds } } });
      }
      if (teamIds.length) {
        await tx.syncEventLineup.deleteMany({ where: { teamId: { in: teamIds } } });
        await tx.syncEventTeam.deleteMany({ where: { id: { in: teamIds } } });
      }
      if (roomIds.length) await tx.syncEventRoom.deleteMany({ where: { id: { in: roomIds } } });
    });

    revalidatePath("/desafio-sincronizado");
    return {
      scheduledDate,
      rooms: oldRooms.length,
      teams: teamIds.length,
      lineups,
      selections,
      matches,
      scores,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível limpar os eventos anteriores." };
  }
}
