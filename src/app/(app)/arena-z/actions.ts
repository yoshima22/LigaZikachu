"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin, requireAdmin } from "@/lib/auth/permissions";
import {
  adminSetMascotArenaState,
  createArenaTeam,
  healMascotSus,
  retireArenaTeam,
  runBotBattle,
  runPvpBattle,
} from "@/lib/arena-z";

async function getCurrentPlayerId() {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado.");
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) throw new Error("Perfil de jogador nao encontrado.");
  return player.id;
}

export async function createArenaTeamAction(formData: FormData): Promise<{ error?: string }> {
  try {
    const playerId = await getCurrentPlayerId();
    const name = String(formData.get("name") ?? "Equipe Arena Z");
    const mascotIds = formData.getAll("mascotIds").map(String);
    await createArenaTeam(playerId, name, mascotIds);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar equipe." };
  }
}

export async function runBotBattleAction(teamId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof runBotBattle>> }> {
  try {
    const playerId = await getCurrentPlayerId();
    const result = await runBotBattle(playerId, teamId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao combater bot." };
  }
}

export async function runPvpBattleAction(attackTeamId: string, defenseTeamId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const playerId = await getCurrentPlayerId();
    await runPvpBattle(playerId, attackTeamId, defenseTeamId);
    revalidatePath("/arena-z");
    revalidatePath("/mascotes");
    return {};
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
