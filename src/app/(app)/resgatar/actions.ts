"use server";

import { revalidatePath } from "next/cache";
import { ShopItemType, type EggType, type FoodType } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { FOOD_TYPE_LABELS, eggTypeLabel, findActiveMegaStone, grantShopItemTx, itemTypeLabel, listActiveMegaStones, normalizeRedeemCode } from "@/lib/redeem-codes";
import { recordPlayerActivity } from "@/lib/player-activity";

export type StoneOption = { id: string; name: string; imageUrl: string | null };
export type RedeemResult =
  | { ok: true; rewards: string[] }
  | { ok: false; error: string; reason?: "ALREADY" | "CHOOSE_STONE"; redeemedAt?: string; options?: StoneOption[]; quantity?: number };

class RedeemError extends Error {
  constructor(message: string, readonly extra: { reason?: "ALREADY"; redeemedAt?: string } = {}) { super(message); }
}

export async function redeemCodeAction(raw: string, stoneItemId?: string): Promise<RedeemResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Faça login para resgatar códigos." };
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) return { ok: false, error: "Crie um perfil de jogador para resgatar códigos." };

  const code = normalizeRedeemCode(String(raw ?? ""));
  if (!code) return { ok: false, error: "Digite um código." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"redeem>" + code}))`;
      const entry = await tx.redeemCode.findUnique({
        where: { code },
        include: {
          rewards: { include: { item: { select: { id: true, name: true, type: true } } } },
          _count: { select: { redemptions: true } },
        },
      });
      if (!entry || !entry.active) throw new RedeemError("Código inválido.");
      if (entry.expiresAt && entry.expiresAt.getTime() <= Date.now()) throw new RedeemError("Este código expirou.");
      const already = await tx.redeemCodeRedemption.findUnique({
        where: { codeId_playerId: { codeId: entry.id, playerId: player.id } },
        select: { redeemedAt: true },
      });
      if (already) throw new RedeemError("Você já resgatou este código.", { reason: "ALREADY", redeemedAt: already.redeemedAt.toISOString() });
      if (entry.maxUses != null && entry._count.redemptions >= entry.maxUses) throw new RedeemError("Este código atingiu o limite de usos.");
      if (entry.rewards.length === 0) throw new RedeemError("Código sem prêmios.");

      // Prêmio "escolha uma pedra": pede a escolha antes de consumir o código.
      const choiceReward = entry.rewards.find((r) => r.kind === "MEGA_CHOICE");
      let chosen: { id: string; name: string; type: ShopItemType } | null = null;
      if (choiceReward) {
        if (stoneItemId) chosen = await findActiveMegaStone(tx, stoneItemId);
        if (!chosen) {
          const options = await listActiveMegaStones(tx);
          if (options.length === 0) throw new RedeemError("Nenhuma pedra de Mega está disponível no momento.");
          return { needsChoice: true as const, options, quantity: choiceReward.quantity };
        }
      }

      const labels: string[] = [];
      for (const r of entry.rewards) {
        if (r.kind === "EGG" && r.eggType) {
          await tx.mascotEgg.createMany({
            data: Array.from({ length: r.quantity }, () => ({ playerId: player.id, type: r.eggType as EggType, origin: `Código de resgate: ${entry.code}` })),
          });
          labels.push(`${eggTypeLabel(r.eggType)} x${r.quantity}`);
          continue;
        }
        if (r.kind === "FOOD" && r.itemType && FOOD_TYPE_LABELS[r.itemType]) {
          await tx.mascotFoodItem.upsert({
            where: { playerId_type: { playerId: player.id, type: r.itemType as FoodType } },
            update: { quantity: { increment: r.quantity } },
            create: { playerId: player.id, type: r.itemType as FoodType, quantity: r.quantity },
          });
          labels.push(`${FOOD_TYPE_LABELS[r.itemType]} x${r.quantity}`);
          continue;
        }
        let item: { id: string; name: string; type: ShopItemType } | null = null;
        if (r.kind === "MEGA_CHOICE") item = chosen;
        else if (r.kind === "ITEM_TYPE" && r.itemType) {
          item = await tx.shopItem.findFirst({
            where: { type: r.itemType as ShopItemType, active: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true, type: true },
          });
          if (!item) throw new RedeemError(`O item "${itemTypeLabel(r.itemType)}" ainda não está disponível. Tente novamente mais tarde.`);
        } else item = r.item;
        if (!item) throw new RedeemError("Prêmio indisponível.");
        await grantShopItemTx(tx, player.id, item, r.quantity, "REDEEM_CODE");
        labels.push(`${item.name} x${r.quantity}`);
      }

      await tx.redeemCodeRedemption.create({ data: { codeId: entry.id, playerId: player.id, rewardsJson: labels } });
      await recordPlayerActivity(tx, {
        playerId: player.id, actorUserId: user.id, category: "ITEM", action: "REDEEM_CODE",
        summary: `Resgatou o código ${entry.code}: ${labels.join(", ")}`, source: "REDEEM_CODE",
        entityType: "redeemCode", entityId: entry.id, after: { code: entry.code, rewards: labels },
      });
      return { needsChoice: false as const, labels };
    }, { timeout: 20_000 });

    if (result.needsChoice) {
      return { ok: false, error: "Escolha a pedra de Mega que deseja receber.", reason: "CHOOSE_STONE", options: result.options, quantity: result.quantity };
    }
    revalidatePath("/inventario");
    revalidatePath("/mascotes");
    revalidatePath("/desafio-sincronizado");
    revalidatePath("/resgatar");
    return { ok: true, rewards: result.labels };
  } catch (err) {
    if (err instanceof RedeemError) return { ok: false, error: err.message, ...err.extra };
    return { ok: false, error: err instanceof Error ? err.message : "Não foi possível resgatar o código." };
  }
}
