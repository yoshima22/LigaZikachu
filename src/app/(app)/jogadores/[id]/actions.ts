"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";

/**
 * Concede um item da ZikaShop diretamente ao inventário do jogador.
 * Se já possuir o item, incrementa a quantidade.
 */
export async function grantItemToPlayer(
  playerId: string,
  itemId: string
): Promise<{ error?: string }> {
  try {
    await requireAdmin();

    // Confirma que player e item existem
    const [player, item] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerId }, select: { id: true } }),
      prisma.shopItem.findUnique({ where: { id: itemId }, select: { id: true, name: true } }),
    ]);
    if (!player) return { error: "Jogador não encontrado." };
    if (!item)   return { error: "Item não encontrado." };

    // Upsert: cria ou incrementa quantidade
    await prisma.playerInventory.upsert({
      where: { playerId_itemId: { playerId, itemId } },
      update: { quantity: { increment: 1 } },
      create: { playerId, itemId, quantity: 1, equipped: false },
    });

    revalidatePath(`/jogadores/${playerId}`);
    revalidatePath("/inventario");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}
