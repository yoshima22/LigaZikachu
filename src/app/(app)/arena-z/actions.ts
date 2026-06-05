"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin, requireAdmin } from "@/lib/auth/permissions";
import {
  adminSetMascotArenaState,
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
} from "@/lib/arena-z";
import type { ArenaDifficulty } from "@/lib/arena-z";

async function getCurrentPlayerId() {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado.");
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) throw new Error("Perfil de jogador nao encontrado.");
  return player.id;
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

export async function claimArenaTutorialBonusAction(): Promise<{ error?: string; claimed?: boolean }> {
  try {
    const playerId = await getCurrentPlayerId();
    return await claimArenaTutorialBonus(playerId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function runBotBattleAction(teamId: string, difficulty: ArenaDifficulty = "normal"): Promise<{ error?: string; result?: Awaited<ReturnType<typeof runBotBattle>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    const result = await runBotBattle(playerId, teamId, difficulty);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao combater bot." };
  }
}

export async function runPvpBattleAction(attackTeamId: string, defenseTeamId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof runPvpBattle>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    const result = await runPvpBattle(playerId, attackTeamId, defenseTeamId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao resolver PvP." };
  }
}

export async function retireArenaTeamAction(teamId: string): Promise<{ error?: string }> {
  try {
    const playerId = await getCurrentPlayerId();
    await retireArenaTeam(playerId, teamId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao retirar equipe." };
  }
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

export async function lockBotAction(teamId: string, difficulty: ArenaDifficulty = "normal"): Promise<{ error?: string; result?: Awaited<ReturnType<typeof lockBotForTeam>> }> {
  try {
    const playerId = await getCurrentPlayerId();
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
