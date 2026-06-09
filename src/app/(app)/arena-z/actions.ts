"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin, requireAdmin } from "@/lib/auth/permissions";
import {
  addMascotToArenaTeam,
  adminSetMascotArenaState,
  adminRepairArenaStates,
  applyPassiveIncomeForPlayer,
  claimArenaTutorialBonus,
  createArenaTeam,
  deleteArenaTeam,
  getTeamTimeMultiplier,
  applyMultiplierToVault,
  healMascotSus,
  lockBotForTeam,
  purgeAdminArenaData,
  retireArenaTeam,
  runBotBattle,
  runOpportunisticAttack,
  runPvpBattle,
  markPvpDefenseSeenForTeam,
} from "@/lib/arena-z";
import type { ArenaDifficulty } from "@/lib/arena-z";

type ArenaStaleNotice = {
  attackerName?: string | null;
  happenedAt?: string | null;
  battleId?: string | null;
  message: string;
};

async function getCurrentPlayerId() {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado.");
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) throw new Error("Perfil de jogador nao encontrado.");
  return player.id;
}

async function checkTeamStaleFromIncomingAttack(
  playerId: string,
  teamId: string,
  knownUpdatedAt?: string | null,
): Promise<ArenaStaleNotice | null> {
  if (!knownUpdatedAt) return null;
  const knownDate = new Date(knownUpdatedAt);
  if (Number.isNaN(knownDate.getTime())) return null;

  const team = await prisma.arenaTeam.findUnique({
    where: { id: teamId },
    select: { playerId: true, updatedAt: true, status: true },
  });
  if (!team || team.playerId !== playerId) return null;
  if (team.updatedAt <= knownDate) return null;

  const battle = await prisma.arenaBattle.findFirst({
    where: {
      type: "PVP",
      defenseTeamId: teamId,
      defenderPlayerId: playerId,
      createdAt: { gt: knownDate },
    },
    include: { attackerPlayer: { select: { displayName: true, ptcglNick: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (!battle) {
    return {
      message: "Sua equipe mudou depois que esta tela foi carregada. Atualize a Arena antes de iniciar outro combate.",
    };
  }

  const attackerName = battle.attackerPlayer?.displayName ?? battle.attackerPlayer?.ptcglNick ?? "outro jogador";
  return {
    attackerName,
    happenedAt: battle.createdAt.toISOString(),
    battleId: battle.id,
    message: `${attackerName} atacou sua equipe antes desta acao. Atualize para ver o combate resolvido e o estado atual do cofre/mascotes.`,
  };
}

export async function createArenaTeamAction(mascotIds: string[], name: string, teamType: "PVE" | "PVP" | "BOTH"): Promise<{ error?: string }> {
  try {
    const playerId = await getCurrentPlayerId();
    await createArenaTeam(playerId, name, mascotIds, teamType);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar equipe." };
  }
}

export async function addMascotToArenaTeamAction(teamId: string, mascotId: string): Promise<{ error?: string }> {
  try {
    const playerId = await getCurrentPlayerId();
    await addMascotToArenaTeam(playerId, teamId, mascotId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao adicionar mascote." };
  }
}

export async function claimArenaTutorialBonusAction(): Promise<{ error?: string; claimed?: boolean }> {
  try {
    const playerId = await getCurrentPlayerId();
    return await claimArenaTutorialBonus(playerId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function runBotBattleAction(teamId: string, difficulty: ArenaDifficulty = "normal", teamKnownUpdatedAt?: string): Promise<{ error?: string; stale?: ArenaStaleNotice; result?: Awaited<ReturnType<typeof runBotBattle>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    // Verifica se a equipe foi atacada desde o último carregamento do cliente
    const stale = await checkTeamStaleFromIncomingAttack(playerId, teamId, teamKnownUpdatedAt);
    if (stale) return { stale };
    const result = await runBotBattle(playerId, teamId, difficulty);
    // Não revalidamos aqui para que o modal de resultado/animação permaneça aberto.
    // O router.refresh() é chamado pelo cliente ao fechar o modal.
    return { result };
  } catch (err) {
    // blockedByUnseenPvp: converte em stale notice para mostrar modal de PvP não visto
    if (err instanceof Error && (err as Error & { blockedByUnseenPvp?: boolean; unseenPvp?: { attackerName: string; happenedAt: Date; battleId: string } }).blockedByUnseenPvp) {
      const pvp = (err as Error & { unseenPvp: { attackerName: string; happenedAt: Date; battleId: string } }).unseenPvp;
      return { stale: { attackerName: pvp.attackerName, happenedAt: pvp.happenedAt.toISOString(), battleId: pvp.battleId, message: err.message } };
    }
    return { error: err instanceof Error ? err.message : "Erro ao combater bot." };
  }
}

export async function runPvpBattleAction(attackTeamId: string, defenseTeamId: string, attackTeamKnownUpdatedAt?: string): Promise<{ error?: string; stale?: ArenaStaleNotice; result?: Awaited<ReturnType<typeof runPvpBattle>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    const stale = await checkTeamStaleFromIncomingAttack(playerId, attackTeamId, attackTeamKnownUpdatedAt);
    if (stale) return { stale };
    const result = await runPvpBattle(playerId, attackTeamId, defenseTeamId);
    // Revalidação feita pelo cliente ao fechar o modal
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao resolver PvP." };
  }
}

export async function retireArenaTeamAction(teamId: string, teamKnownUpdatedAt?: string): Promise<{ error?: string; stale?: ArenaStaleNotice }> {
  try {
    const playerId = await getCurrentPlayerId();
    // Verifica ataque PvP pendente antes de permitir saída
    const stale = await checkTeamStaleFromIncomingAttack(playerId, teamId, teamKnownUpdatedAt);
    if (stale) return { stale };
    await retireArenaTeam(playerId, teamId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    // Se a função lançou com unseenPvp, converte em stale notice
    if (err instanceof Error && (err as Error & { unseenPvp?: unknown }).unseenPvp) {
      const pvp = (err as Error & { unseenPvp: { attackerName: string; happenedAt: Date; battleId: string } }).unseenPvp;
      return { stale: { attackerName: pvp.attackerName, happenedAt: pvp.happenedAt.toISOString(), battleId: pvp.battleId, message: err.message } };
    }
    return { error: err instanceof Error ? err.message : "Erro ao retirar equipe." };
  }
}

/** Marca todos os ataques PvP desta equipe como vistos (chamado após o jogador visualizar o modal stale) */
export async function markPvpDefenseSeenAction(teamId: string): Promise<void> {
  try {
    await markPvpDefenseSeenForTeam(teamId);
    revalidatePath("/arena-z");
  } catch { /* silencioso */ }
}

export async function healMascotSusAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const playerId = await getCurrentPlayerId();
    await healMascotSus(playerId, mascotId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro no Atendimento SUS." };
  }
}

export async function applyPassiveIncomeAction(): Promise<void> {
  try {
    const user = await getSessionUser();
    if (!user) return;
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return;
    await applyPassiveIncomeForPlayer(player.id);
    revalidatePath("/arena-z");
  } catch { /* silencioso */ }
}

export async function deleteArenaTeamAction(teamId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) return { error: "Perfil nao encontrado." };
    const isAdminUser = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    await deleteArenaTeam(player.id, teamId, isAdminUser);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao remover equipe." };
  }
}

export async function purgeAdminArenaDataAction(): Promise<{ error?: string; teams?: number; battles?: number }> {
  try {
    await requireAdmin();
    const result = await purgeAdminArenaData();
    revalidatePath("/arena-z");
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro na limpeza." };
  }
}

export async function lockBotAction(teamId: string, difficulty: ArenaDifficulty = "normal", teamKnownUpdatedAt?: string): Promise<{ error?: string; stale?: ArenaStaleNotice; result?: Awaited<ReturnType<typeof lockBotForTeam>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    const stale = await checkTeamStaleFromIncomingAttack(playerId, teamId, teamKnownUpdatedAt);
    if (stale) return { stale };
    const result = await lockBotForTeam(playerId, teamId, difficulty);
    revalidatePath("/arena-z");
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao gerar adversario." };
  }
}

export async function runOpportunisticAttackAction(targetMascotId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof runOpportunisticAttack>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    const result = await runOpportunisticAttack(playerId, targetMascotId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao atacar." };
  }
}

export async function adminSetMascotStateAction(mascotId: string, state: "FREE" | "INJURED" | "RESTING"): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await adminSetMascotArenaState(mascotId, state);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao alterar estado." };
  }
}

export async function adminRepairArenaAction(targetPlayerId?: string): Promise<{
  error?: string;
  fixedOrphanArena?: number;
  fixedExpiredResting?: number;
  deletedEmptyTeams?: number;
  fixedMismatchedTeamMembers?: number;
  details?: string[];
}> {
  try {
    await requireAdmin();
    const result = await adminRepairArenaStates(targetPlayerId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao reparar arena." };
  }
}
