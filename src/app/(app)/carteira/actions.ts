"use server";

import { revalidatePath } from "next/cache";
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

    revalidatePath("/carteira");
    revalidatePath("/", "layout");
    revalidatePath("/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
