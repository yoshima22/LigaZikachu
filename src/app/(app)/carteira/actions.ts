"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { ZikaCoinTxType } from "@prisma/client";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";

export async function adjustCoins(
  playerId: string,
  amount: number,
  description: string
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    if (!playerId || amount === 0) return { error: "Parâmetros inválidos." };

    await prisma.$transaction(async (tx) => {
      await getOrCreateWallet(playerId);
      await creditCoins(tx, {
        playerId,
        type: ZikaCoinTxType.ADMIN_ADJUSTMENT,
        amount,
        description: description || "Ajuste manual pelo admin",
        adminId: actor.id
      });
    });

    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { userId: true } }).catch(() => null);
    revalidatePath("/carteira");
    if (player?.userId) revalidateTag(`nav-${player.userId}`);
    revalidatePath("/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

/**
 * Envia ZC para todos os jogadores de uma vez (bônus em massa).
 * Só permite valores positivos — não é para descontos em massa.
 * Opcionalmente exclui contas de admin do envio.
 */
export async function adjustCoinsForAll(
  amount: number,
  description: string,
  includeAdmins = false
): Promise<{ error?: string; credited?: number }> {
  try {
    const actor = await requireAdmin();
    if (!Number.isInteger(amount) || amount <= 0) {
      return { error: "Informe um valor positivo de ZC." };
    }

    const players = await prisma.player.findMany({
      where: includeAdmins ? {} : { user: { role: "PLAYER" } },
      select: { id: true, userId: true },
    });
    if (players.length === 0) return { error: "Nenhum jogador encontrado." };

    // Processa em lotes para não estourar o tempo de uma única transação
    const BATCH_SIZE = 25;
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const p of batch) {
          await creditCoins(tx, {
            playerId: p.id,
            type: ZikaCoinTxType.ADMIN_ADJUSTMENT,
            amount,
            description: description || "Bônus da Liga (envio em massa)",
            adminId: actor.id,
          });
        }
      });
    }

    revalidatePath("/carteira");
    revalidatePath("/admin");
    for (const p of players) {
      if (p.userId) revalidateTag(`nav-${p.userId}`);
    }
    return { credited: players.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
