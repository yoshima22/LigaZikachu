"use server";

import { FoodType } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { creditCoins } from "@/lib/zikacoins";
import { recordPlayerActivity } from "@/lib/player-activity";
import { isSantaActive, nextSantaAt, rollSantaPrize } from "@/lib/papai-noel";
import { ZikaCoinTxType } from "@prisma/client";

async function sessionPlayerId() {
  const user = await getSessionUser();
  if (!user) return null;
  const p = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  return p?.id ?? null;
}

/** Leitura barata (1 consulta por PK). O cliente só chama quando seu cache local diz que pode haver presente. */
export async function getSantaStatusAction(): Promise<{ available: boolean; nextAt: string | null }> {
  if (!(await isSantaActive())) return { available: false, nextAt: null };
  const playerId = await sessionPlayerId();
  if (!playerId) return { available: false, nextAt: null };
  const row = await prisma.santaClaim.findUnique({ where: { playerId }, select: { nextAvailableAt: true } });
  const available = !row || row.nextAvailableAt <= new Date();
  return { available, nextAt: available ? null : row!.nextAvailableAt.toISOString() };
}

export type SantaClaimResult =
  | { ok: true; label: string; emoji: string; nextAt: string }
  | { ok: false; error: string; nextAt?: string };

/** Resgate: servidor decide disponibilidade e prêmio; lock por jogador torna cliques duplos/abas idempotentes. */
export async function claimSantaGiftAction(): Promise<SantaClaimResult> {
  try {
    if (!(await isSantaActive())) return { ok: false, error: "O Papai Noel não está passando agora." };
    const playerId = await sessionPlayerId();
    if (!playerId) return { ok: false, error: "Faça login para receber o presente." };

    return await prisma.$transaction(async (tx): Promise<SantaClaimResult> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"santa:" + playerId}))`;
      const now = new Date();
      const row = await tx.santaClaim.findUnique({ where: { playerId }, select: { nextAvailableAt: true } });
      if (row && row.nextAvailableAt > now) {
        return { ok: false, error: "Você já pegou o presente desta rodada.", nextAt: row.nextAvailableAt.toISOString() };
      }
      const prize = rollSantaPrize();
      const nextAt = nextSantaAt(now);
      await tx.santaClaim.upsert({
        where: { playerId },
        create: { playerId, lastClaimAt: now, nextAvailableAt: nextAt, lastPrize: prize.id },
        update: { lastClaimAt: now, nextAvailableAt: nextAt, totalClaims: { increment: 1 }, lastPrize: prize.id },
      });
      if (prize.kind === "ZC") {
        await creditCoins(tx, { playerId, type: ZikaCoinTxType.ADMIN_ADJUSTMENT, amount: prize.amount, description: "Presente do Papai Noel 🎅" });
      } else {
        await tx.mascotFoodItem.upsert({
          where: { playerId_type: { playerId, type: FoodType[prize.food] } },
          update: { quantity: { increment: prize.amount } },
          create: { playerId, type: FoodType[prize.food], quantity: prize.amount },
        });
        await recordPlayerActivity(tx, {
          playerId, category: "ITEM", action: "SANTA_GIFT", summary: `Presente do Papai Noel: ${prize.label}`,
          source: "SANTA_EVENT", entityType: "santaClaim", entityId: playerId, amount: prize.amount, unit: "ITEM",
        });
      }
      return { ok: true, label: prize.label, emoji: prize.emoji, nextAt: nextAt.toISOString() };
    }, { timeout: 15000 });
  } catch (e) {
    console.error("[Santa] claim failed", e);
    return { ok: false, error: "Não foi possível pegar o presente agora. Tente de novo." };
  }
}
