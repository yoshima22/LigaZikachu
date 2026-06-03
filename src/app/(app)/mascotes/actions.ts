"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  startIncubation, hatchEgg, equipMascot, unequipMascot,
  interactWithMascot, startExpedition, claimExpedition, recalculateMood,
  skipExpedition, addExp,
} from "@/lib/mascot";
import type { InteractionType } from "@/lib/mascot";

function revalidate() { revalidatePath("/mascotes"); }

export async function putEggInIncubator(eggId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    await startIncubation(player.id, eggId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function hatchEggAction(): Promise<{ error?: string; result?: Awaited<ReturnType<typeof hatchEgg>> }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    const result = await hatchEgg(player.id);
    revalidate();
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function skipIncubationAction(): Promise<{ error?: string }> {
  try {
    const user = await requireAdmin();
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil nÃ£o encontrado." };

    const incubator = await prisma.mascotIncubator.findUnique({
      where: { playerId: player.id },
      select: { id: true }
    });
    if (!incubator) return { error: "Nenhum ovo na incubadora." };

    await prisma.mascotIncubator.update({
      where: { playerId: player.id },
      data: { finishAt: new Date() }
    });

    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function equipMascotAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    await equipMascot(player.id, mascotId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function renameMascotAction(mascotId: string, nickname: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    await prisma.mascot.update({ where: { id: mascotId }, data: { nickname: nickname.trim().slice(0, 20) || null } });
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function interactAction(mascotId: string, type: InteractionType): Promise<{ error?: string; result?: Awaited<ReturnType<typeof interactWithMascot>> }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    await recalculateMood(mascotId);
    const result = await interactWithMascot(player.id, mascotId, type);
    revalidate();
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function startExpeditionAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    await startExpedition(player.id, mascotId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function claimExpeditionAction(expeditionId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof claimExpedition>> }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    const result = await claimExpedition(player.id, expeditionId);
    revalidate();
    revalidatePath("/caixa-de-presentes");
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function unequipMascotAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    await unequipMascot(player.id, mascotId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function skipExpeditionAction(expeditionId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await skipExpedition(expeditionId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function addExpAdminAction(mascotId: string, amount: number): Promise<{ error?: string; result?: Awaited<ReturnType<typeof addExp>> }> {
  try {
    await requireAdmin();
    // Bypass do check isEquipped — admin pode dar EXP a qualquer mascote
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot) return { error: "Mascote não encontrado." };
    // Temporariamente força isEquipped para calcular EXP
    const originalEquipped = mascot.isEquipped;
    if (!originalEquipped) {
      await prisma.mascot.update({ where: { id: mascotId }, data: { isEquipped: true } });
    }
    const result = await addExp(mascotId, amount);
    if (!originalEquipped) {
      await prisma.mascot.update({ where: { id: mascotId }, data: { isEquipped: false } });
    }
    revalidate();
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: dar ovo a um jogador
export async function grantEggToPlayer(playerId: string, eggType: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return { error: "Sem permissão." };
    await prisma.mascotEgg.create({ data: { playerId, type: eggType as "COMMON" | "RARE" | "SPECIAL" | "EVENT", origin: "Admin" } });
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}
