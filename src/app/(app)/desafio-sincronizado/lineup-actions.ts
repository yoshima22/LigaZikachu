"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { normalizeCombatRole, defaultCombatRoleFor } from "@/lib/combat-roles";
import { currentEventTeamsWhere, getSyncWindowState } from "@/lib/sync-challenge";
import type { Role } from "@prisma/client";
import { validateBattleDivision } from "@/lib/battle-divisions";

const LINEUP_SLOTS = 9;

async function requirePlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  return { user, player };
}

const getLineupConfig = () =>
  prisma.syncChallengeConfig.findUnique({
    where: { id: "singleton" },
    select: { registrationOpensAt: true, registrationClosesAt: true },
  });
type LineupConfig = Awaited<ReturnType<typeof getLineupConfig>>;

/** Sessão + configuração em paralelo (evita idas e voltas ao banco em sequência). */
async function loadContext() {
  const [session, config] = await Promise.all([requirePlayer(), getLineupConfig()]);
  return { ...session, config };
}

/** Só duplas do evento atual: eventos passados nunca entram na escalação. */
function getActiveTeamForPlayer(playerId: string, config: LineupConfig) {
  return prisma.syncEventTeam.findFirst({
    where: {
      status: { in: ["LINEUP_PENDING", "LINEUP_READY"] },
      OR: [{ playerAId: playerId }, { playerBId: playerId }],
      ...currentEventTeamsWhere(config),
    },
    orderBy: { createdAt: "desc" },
    include: { lineups: true },
  });
}

function assertLineupWindowOpen(role: Role, config: LineupConfig): string | null {
  if (isAdmin(role)) return null;
  const state = getSyncWindowState(config ?? undefined);
  return state.isOpen ? null : `O prazo para montar e travar a equipe encerrou às 17:50 BRT. ${state.label}`;
}

export async function addLineupMascotAction(
  mascotId: string,
): Promise<{ error?: string }> {
  try {
    const { user, player, config } = await loadContext();
    const windowError = assertLineupWindowOpen(user.role, config);
    if (windowError) return { error: windowError };

    const team = await getActiveTeamForPlayer(player.id, config);
    if (!team) return { error: "Você não está em uma dupla ativa." };

    const myStatus = team.playerAId === player.id ? team.lineupStatusA : team.lineupStatusB;
    if (myStatus === "LOCKED") return { error: "Sua escalação já está travada." };

    const myLineup = team.lineups.filter((l) => l.playerId === player.id);
    if (myLineup.length >= LINEUP_SLOTS) return { error: `Você já tem ${LINEUP_SLOTS} mascotes na escalação.` };

    // Dono do mascote + "já escalado em outra dupla do evento atual" em paralelo.
    const [mascot, alreadyInLineup] = await Promise.all([
      prisma.mascot.findUnique({
        where: { id: mascotId },
        select: {
          id: true, playerId: true, nickname: true, pokemonId: true, preferredCombatRole: true,
          megaEvolvedAt: true, megaEvolvedFromPokemonId: true,
          statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
        },
      }),
      prisma.syncEventLineup.findFirst({
        where: {
          mascotId,
          team: { status: { in: ["COMPLETE", "LINEUP_PENDING", "LINEUP_READY"] }, ...currentEventTeamsWhere(config) },
        },
        select: { id: true },
      }),
    ]);
    if (!mascot) return { error: "Mascote não encontrado." };
    if (mascot.playerId !== player.id) return { error: "Este mascote não pertence a você." };
    if (alreadyInLineup) return { error: "Este mascote já está em outra escalação ativa." };

    // Primeiro slot livre (não depende de a lista estar compactada).
    const usedSlots = new Set(myLineup.map((l) => l.slot));
    let nextSlot = 1;
    while (usedSlots.has(nextSlot)) nextSlot++;
    await prisma.syncEventLineup.create({
      data: { teamId: team.id, playerId: player.id, mascotId, slot: nextSlot, combatRole: defaultCombatRoleFor(mascot) },
    });

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
    const { user, player, config } = await loadContext();
    const windowError = assertLineupWindowOpen(user.role, config);
    if (windowError) return { error: windowError };
    const team = await getActiveTeamForPlayer(player.id, config);
    if (!team) return { error: "Você não está em uma dupla ativa." };

    const entry = team.lineups.find((l) => l.playerId === player.id && l.mascotId === mascotId);
    if (!entry) return { error: "Mascote não está na sua escalação." };

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
    const { user, player, config } = await loadContext();
    const windowError = assertLineupWindowOpen(user.role, config);
    if (windowError) return { error: windowError };

    const team = await getActiveTeamForPlayer(player.id, config);
    if (!team) return { error: "Você não está em uma dupla ativa." };

    const myStatus = team.playerAId === player.id ? team.lineupStatusA : team.lineupStatusB;
    if (myStatus === "LOCKED") return { error: "Sua escalação está travada e não pode ser alterada." };

    const entry = team.lineups.find((l) => l.playerId === player.id && l.mascotId === mascotId);
    if (!entry) return { error: "Mascote não está na sua escalação." };

    // Remove e recompacta slots
    const remaining = team.lineups
      .filter((l) => l.playerId === player.id && l.mascotId !== mascotId)
      .sort((a, b) => a.slot - b.slot);
    await prisma.$transaction([
      prisma.syncEventLineup.delete({ where: { id: entry.id } }),
      ...remaining
        .map((l, i) => ({ l, slot: i + 1 }))
        .filter(({ l, slot }) => l.slot !== slot)
        .map(({ l, slot }) => prisma.syncEventLineup.update({ where: { id: l.id }, data: { slot } })),
    ]);

    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function lockLineupAction(): Promise<{ error?: string }> {
  try {
    const { user, player, config } = await loadContext();
    const windowError = assertLineupWindowOpen(user.role, config);
    if (windowError) return { error: windowError };

    const team = await getActiveTeamForPlayer(player.id, config);
    if (!team) return { error: "Você não está em uma dupla ativa." };

    const isA = team.playerAId === player.id;
    const myStatus = isA ? team.lineupStatusA : team.lineupStatusB;
    if (myStatus === "LOCKED") return { error: "Sua escalação já está travada." };

    const myLineup = team.lineups.filter((l) => l.playerId === player.id);
    if (myLineup.length !== LINEUP_SLOTS) {
      return { error: `Você precisa de exatamente ${LINEUP_SLOTS} mascotes para travar (${myLineup.length}/${LINEUP_SLOTS}).` };
    }

    const lineupMascots = await prisma.mascot.findMany({
      where: { id: { in: myLineup.map((entry) => entry.mascotId) }, playerId: player.id },
      select: { id: true, megaEvolvedAt: true, megaEvolvedFromPokemonId: true },
    });
    const { getBattleModeDivision } = await import("@/lib/battle-division-settings");
    const division = await getBattleModeDivision("SYNC_CHALLENGE");
    const divisionCheck = validateBattleDivision(lineupMascots, division, division === "LIMITED" ? 3 : null);
    if (!divisionCheck.valid) {
      return { error: `${divisionCheck.message} Remova uma mega antes de travar os 9 mascotes.` };
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
    const { user, player, config } = await loadContext();

    const team = await getActiveTeamForPlayer(player.id, config);
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
