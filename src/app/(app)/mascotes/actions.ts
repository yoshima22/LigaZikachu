"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  startIncubation, hatchEgg, equipMascot, unequipMascot,
  interactWithMascot, startExpedition, claimExpedition, recalculateMood,
  skipExpedition, cancelExpedition, addExp, battleMascots, formFriendship, triggerSocialEvents,
} from "@/lib/mascot";
import { healMascotSus } from "@/lib/arena-z";
import type { InteractionType, ExpeditionDuration } from "@/lib/mascot";

function revalidate() {
  revalidatePath("/mascotes");
  revalidatePath("/arena-z");
}

export async function putEggInIncubator(eggId: string, genOverride?: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };

    // Se jogador escolheu uma geração específica, atualiza o tipo do ovo antes de incubar
    if (genOverride) {
      const validGens = ["EGG_GEN1","EGG_GEN2","EGG_GEN3","EGG_GEN4","EGG_GEN5","EGG_GEN6","EGG_GEN7","EGG_GEN8","EGG_GEN9","EGG_GEN6PLUS"];
      if (validGens.includes(genOverride)) {
        await prisma.mascotEgg.update({
          where: { id: eggId },
          data: { type: genOverride as import("@prisma/client").EggType }
        });
      }
    }

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
    // Não recalcula mood antes de alimentar — o decay comeria o ganho de felicidade
    if (type !== "FEED_FOOD" && type !== "FEED_SWEET") {
      await recalculateMood(mascotId);
    }
    // Admin bypassa cooldown
    const isAdminUser = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const result = await interactWithMascot(player.id, mascotId, type, isAdminUser);
    revalidate();
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function startExpeditionAction(mascotId: string, duration: ExpeditionDuration = "1h", mode: import("@/lib/mascot-data").ExpeditionMode = "STANDARD"): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    await startExpedition(player.id, mascotId, duration, mode);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function healMascotSusAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil nao encontrado." };
    await healMascotSus(player.id, mascotId);
    revalidate();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro no Atendimento SUS." };
  }
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

export async function cancelExpeditionAction(expeditionId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };
    await cancelExpedition(player.id, expeditionId);
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

// Admin: batalha manual entre mascotes
export async function adminBattleMascotsAction(mascotAId: string, mascotBId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof battleMascots>> }> {
  try {
    await requireAdmin();
    const result = await battleMascots(mascotAId, mascotBId);
    revalidate();
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: formar amizade entre mascotes
export async function adminFormFriendshipAction(mascotAId: string, mascotBId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await formFriendship(mascotAId, mascotBId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Usar buff em um mascote
export async function useMascotBuffAction(mascotId: string, itemId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!player) return { error: "Perfil não encontrado." };

    const [mascot, inventoryItem] = await Promise.all([
      prisma.mascot.findUnique({ where: { id: mascotId } }),
      prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId } }, include: { item: true } }),
    ]);
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    if (!inventoryItem || inventoryItem.quantity <= 0) return { error: "Você não tem este item." };

    const BUFF_CONFIG: Record<string, { type: "EXP_BOOST"|"STAT_BOOST"|"HAPPINESS"|"LUCK_BOOST"|"MOOD_RESET"; hours: number; label: string }> = {
      // ⚡ Vitamina Elétrica: EXP dobrado por 2h (verificado em addExp via MascotBuff)
      MASCOT_BUFF_EXP:   { type: "EXP_BOOST",  hours: 2, label: "Vitamina Elétrica — EXP dobrado por 2h" },
      // 💊 Proteína Zika: +3 PERMANENTE em todos os 5 atributos (sem expiração)
      MASCOT_BUFF_STAT:  { type: "STAT_BOOST",  hours: 0, label: "Proteína Zika — +3 permanente em todos os atributos" },
      // 🍯 Bala de Mel: felicidade vai para 100 imediatamente + humor HAPPY
      MASCOT_BUFF_HAPPY: { type: "HAPPINESS",   hours: 0, label: "Bala de Mel — felicidade máxima instantânea" },
      // 🍀 Amuleto da Sorte: chance dobrada de loot raro em expedições por 6h
      MASCOT_BUFF_LUCK:  { type: "LUCK_BOOST",  hours: 6, label: "Amuleto da Sorte — loot raro dobrado por 6h" },
      // 💧 Água Sagrada: remove humor negativo (Bravo/Cansado/Carente) imediatamente
      MASCOT_BUFF_MOOD:  { type: "MOOD_RESET",  hours: 0, label: "Água Sagrada — remove humor negativo" },
    };

    const config = BUFF_CONFIG[inventoryItem.item.type];
    if (!config) return { error: "Este item não é um buff." };

    const expiresAt = new Date(Date.now() + config.hours * 3_600_000);

    await prisma.$transaction(async (tx) => {
      // Remove 1 do inventário
      await tx.playerInventory.update({
        where: { playerId_itemId: { playerId: player.id, itemId } },
        data: { quantity: { decrement: 1 } }
      });

      if (config.type === "MOOD_RESET") {
        // Efeito imediato — remove humores negativos
        await tx.mascot.update({ where: { id: mascotId }, data: { mood: "NEUTRAL", happiness: Math.min(100, mascot.happiness + 20) } });
      } else if (config.type === "HAPPINESS") {
        await tx.mascot.update({ where: { id: mascotId }, data: { happiness: 100, mood: "HAPPY" } });
      } else if (config.type === "STAT_BOOST") {
        await tx.mascot.update({
          where: { id: mascotId },
          data: {
            statForce: { increment: 3 }, statAgility: { increment: 3 },
            statCharisma: { increment: 3 }, statInstinct: { increment: 3 }, statVitality: { increment: 3 }
          }
        });
      }

      // Salva buff com expiração (para EXP_BOOST e LUCK_BOOST)
      if (config.hours > 0) {
        await tx.mascotBuff.create({ data: { mascotId, type: config.type, expiresAt } });
      }

      // Log evento
      await tx.mascotEvent.create({ data: { mascotId, emoji: "✨", description: `Usou ${config.label}!` } });
    });

    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: limpa todas as expedições ativas de um jogador (para corrigir bugs)
export async function adminClearExpeditionsAction(playerId: string): Promise<{ error?: string; cleared: number }> {
  try {
    await requireAdmin();
    const result = await prisma.mascotExpedition.updateMany({
      where: { mascot: { playerId }, status: "ACTIVE" },
      data: { status: "CLAIMED", rewardJson: { type: "NOTHING" } }
    });
    revalidate();
    return { cleared: result.count };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro.", cleared: 0 }; }
}

// Admin: disparar eventos sociais entre mascotes
export async function adminTriggerSocialEventsAction(): Promise<{ error?: string; summary?: { battles: number; friendships: number; events: string[] } }> {
  try {
    await requireAdmin();
    const summary = await triggerSocialEvents();
    revalidate();
    return { summary };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: dar ovo a um jogador
export async function grantEggToPlayer(playerId: string, eggType: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return { error: "Sem permissão." };
    await prisma.mascotEgg.create({ data: { playerId, type: eggType as import("@prisma/client").EggType, origin: "Admin" } });
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}
