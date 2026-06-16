"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { normalizeCombatRole, recommendCombatRole } from "@/lib/combat-roles";

const LINEUP_SLOTS = 9;

async function requirePlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  return { user, player };
}

async function getActiveTeamForPlayer(playerId: string) {
  return prisma.syncEventTeam.findFirst({
    where: {
      status: { in: ["LINEUP_PENDING", "LINEUP_READY"] },
      OR: [{ playerAId: playerId }, { playerBId: playerId }],
    },
    include: { lineups: true },
  });
}

export async function addLineupMascotAction(
  mascotId: string,
): Promise<{ error?: string }> {
  try {
    const { player } = await requirePlayer();

    const team = await getActiveTeamForPlayer(player.id);
    if (!team) return { error: "Você não está em uma dupla ativa." };

    const myStatus = team.playerAId === player.id ? team.lineupStatusA : team.lineupStatusB;
    if (myStatus === "LOCKED") return { error: "Sua escalação já está travada." };

    const myLineup = team.lineups.filter((l) => l.playerId === player.id);
    if (myLineup.length >= LINEUP_SLOTS) return { error: `Você já tem ${LINEUP_SLOTS} mascotes na escalação.` };

    // Valida dono e disponibilidade do mascote
    const mascot = await prisma.mascot.findUnique({
      where: { id: mascotId },
      select: {
        id: true, playerId: true, nickname: true, pokemonId: true,
        statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
      },
    });
    if (!mascot) return { error: "Mascote não encontrado." };
    if (mascot.playerId !== player.id) return { error: "Este mascote não pertence a você." };

    // Verifica se já está em outra escalação ativa
    const alreadyInLineup = await prisma.syncEventLineup.findFirst({
      where: { mascotId, team: { status: { in: ["COMPLETE", "LINEUP_PENDING", "LINEUP_READY"] } } },
    });
    if (alreadyInLineup) return { error: "Este mascote já está em outra escalação ativa." };

    const nextSlot = myLineup.length + 1;
    await prisma.syncEventLineup.create({
      data: { teamId: team.id, playerId: player.id, mascotId, slot: nextSlot, combatRole: recommendCombatRole(mascot) },
    });

    // Atualiza status da dupla para LINEUP_PENDING se ainda estava COMPLETE
    if (team.status === "COMPLETE") {
      await prisma.syncEventTeam.update({
        where: { id: team.id },
        data: { status: "LINEUP_PENDING" },
      });
    }

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function setLineupCombatRoleAction(
  mascotId: string,
  combatRole: string,
): Promise<{ error?: string }> {
  try {
    const { player } = await requirePlayer();
    const team = await getActiveTeamForPlayer(player.id);
    if (!team) return { error: "VocÃª nÃ£o estÃ¡ em uma dupla ativa." };

    const entry = team.lineups.find((l) => l.playerId === player.id && l.mascotId === mascotId);
    if (!entry) return { error: "Mascote nÃ£o estÃ¡ na sua escalaÃ§Ã£o." };

    await prisma.syncEventLineup.update({
      where: { id: entry.id },
      data: { combatRole: normalizeCombatRole(combatRole) },
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function removeLineupMascotAction(
  mascotId: string,
): Promise<{ error?: string }> {
  try {
    const { player } = await requirePlayer();

    const team = await getActiveTeamForPlayer(player.id);
    if (!team) return { error: "Você não está em uma dupla ativa." };

    const myStatus = team.playerAId === player.id ? team.lineupStatusA : team.lineupStatusB;
    if (myStatus === "LOCKED") return { error: "Sua escalação está travada e não pode ser alterada." };

    const entry = team.lineups.find((l) => l.playerId === player.id && l.mascotId === mascotId);
    if (!entry) return { error: "Mascote não está na sua escalação." };

    // Remove e recompacta slots
    await prisma.syncEventLineup.delete({ where: { id: entry.id } });
    const remaining = team.lineups
      .filter((l) => l.playerId === player.id && l.mascotId !== mascotId)
      .sort((a, b) => a.slot - b.slot);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].slot !== i + 1) {
        await prisma.syncEventLineup.update({
          where: { id: remaining[i].id },
          data: { slot: i + 1 },
        });
      }
    }

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function lockLineupAction(): Promise<{ error?: string }> {
  try {
    const { player } = await requirePlayer();

    const team = await getActiveTeamForPlayer(player.id);
    if (!team) return { error: "Você não está em uma dupla ativa." };

    const isA = team.playerAId === player.id;
    const myStatus = isA ? team.lineupStatusA : team.lineupStatusB;
    if (myStatus === "LOCKED") return { error: "Sua escalação já está travada." };

    const myLineup = team.lineups.filter((l) => l.playerId === player.id);
    if (myLineup.length !== LINEUP_SLOTS) {
      return { error: `Você precisa de exatamente ${LINEUP_SLOTS} mascotes para travar (${myLineup.length}/${LINEUP_SLOTS}).` };
    }

    const newLineupA = isA ? "LOCKED" : team.lineupStatusA;
    const newLineupB = isA ? team.lineupStatusB : "LOCKED";
    const bothLocked = newLineupA === "LOCKED" && newLineupB === "LOCKED" && team.playerBId !== null;

    await prisma.syncEventTeam.update({
      where: { id: team.id },
      data: {
        lineupStatusA: newLineupA,
        lineupStatusB: newLineupB,
        ...(bothLocked ? { status: "LINEUP_READY", lineupReadyAt: new Date() } : {}),
      },
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function unlockLineupAction(): Promise<{ error?: string }> {
  try {
    const { user, player } = await requirePlayer();

    const team = await getActiveTeamForPlayer(player.id);
    if (!team) return { error: "Você não está em uma dupla ativa." };

    // Apenas admin pode destravar
    if (!isAdmin(user.role)) return { error: "Apenas admins podem destravar a escalação." };

    await prisma.syncEventTeam.update({
      where: { id: team.id },
      data: {
        lineupStatusA: "OPEN",
        lineupStatusB: "OPEN",
        status: "LINEUP_PENDING",
      },
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function adminClearLineupAction(
  teamId: string,
  playerId: string,
): Promise<{ error?: string }> {
  try {
    const { user } = await requirePlayer();
    if (!isAdmin(user.role)) return { error: "Acesso negado." };

    const team = await prisma.syncEventTeam.findUnique({ where: { id: teamId } });
    if (!team) return { error: "Dupla não encontrada." };

    await prisma.syncEventLineup.deleteMany({ where: { teamId, playerId } });
    const isA = team.playerAId === playerId;
    await prisma.syncEventTeam.update({
      where: { id: teamId },
      data: {
        lineupStatusA: isA ? "OPEN" : team.lineupStatusA,
        lineupStatusB: isA ? team.lineupStatusB : "OPEN",
        status: "LINEUP_PENDING",
      },
    });

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}
