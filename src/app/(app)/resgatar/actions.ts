"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { grantShopItemTx, normalizeRedeemCode } from "@/lib/redeem-codes";
import { recordPlayerActivity } from "@/lib/player-activity";

export async function redeemCodeAction(raw: string): Promise<{ ok: true; rewards: string[] } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Faça login para resgatar códigos." };
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) return { ok: false, error: "Crie um perfil de jogador para resgatar códigos." };

  const code = normalizeRedeemCode(String(raw ?? ""));
  if (!code) return { ok: false, error: "Digite um código." };

  try {
    const rewards = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"redeem>" + code}))`;
      const entry = await tx.redeemCode.findUnique({
        where: { code },
        include: {
          rewards: { include: { item: { select: { id: true, name: true, type: true } } } },
          _count: { select: { redemptions: true } },
        },
      });
      if (!entry || !entry.active) throw new Error("Código inválido.");
      if (entry.expiresAt && entry.expiresAt.getTime() <= Date.now()) throw new Error("Este código expirou.");
      if (entry.maxUses != null && entry._count.redemptions >= entry.maxUses) throw new Error("Este código atingiu o limite de usos.");
      if (entry.rewards.length === 0) throw new Error("Código sem prêmios.");
      const already = await tx.redeemCodeRedemption.findUnique({
        where: { codeId_playerId: { codeId: entry.id, playerId: player.id } },
        select: { id: true },
      });
      if (already) throw new Error("Você já resgatou este código.");

      await tx.redeemCodeRedemption.create({ data: { codeId: entry.id, playerId: player.id } });
      for (const r of entry.rewards) await grantShopItemTx(tx, player.id, r.item, r.quantity, "REDEEM_CODE");
      const labels = entry.rewards.map((r) => `${r.item.name} x${r.quantity}`);
      await recordPlayerActivity(tx, {
        playerId: player.id, actorUserId: user.id, category: "ITEM", action: "REDEEM_CODE",
        summary: `Resgatou o código ${entry.code}: ${labels.join(", ")}`, source: "REDEEM_CODE",
        entityType: "redeemCode", entityId: entry.id, after: { code: entry.code, rewards: labels },
      });
      return labels;
    }, { timeout: 20_000 });

    revalidatePath("/inventario");
    revalidatePath("/mascotes");
    revalidatePath("/desafio-sincronizado");
    return { ok: true, rewards };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Não foi possível resgatar o código." };
  }
}
