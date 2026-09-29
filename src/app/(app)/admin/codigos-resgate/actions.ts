"use server";

import { revalidatePath } from "next/cache";
import { EggType, ShopItemType } from "@prisma/client";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { parseBrtLocal } from "@/lib/brt";
import { prisma } from "@/lib/prisma";
import { ADMIN_LAB_RAINBOW_FEATHER_ID } from "@/lib/admin-lab-feather";
import { normalizeRedeemCode } from "@/lib/redeem-codes";

export type SaveRedeemCodeInput = {
  id?: string;
  code: string;
  description?: string;
  /** datetime-local no relógio BRT; vazio = não expira */
  expiresAt?: string;
  maxUses?: number | null;
  active: boolean;
  rewards: RewardInput[];
};

export type RewardInput = {
  kind: "ITEM" | "ITEM_TYPE" | "EGG" | "MEGA_CHOICE";
  itemId?: string;
  itemType?: string;
  eggType?: string;
  quantity: number;
};

export async function saveRedeemCode(input: SaveRedeemCodeInput): Promise<{ error?: string }> {
  try {
    const admin = await requirePlatformAdmin();
    const code = normalizeRedeemCode(input.code);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return { error: "Código deve ter 3–40 caracteres (letras, números, - ou _)." };

    const rewards: { kind: string; itemId: string | null; itemType: string | null; eggType: EggType | null; quantity: number }[] = [];
    const seen = new Set<string>();
    for (const r of input.rewards) {
      const quantity = Math.min(99, Math.floor(Number(r.quantity)));
      if (!(quantity >= 1)) return { error: "Quantidade inválida em um dos prêmios." };
      const key = `${r.kind}:${r.itemId ?? r.itemType ?? r.eggType ?? ""}`;
      if (seen.has(key)) return { error: "Há prêmios repetidos; junte-os aumentando a quantidade." };
      seen.add(key);
      const base = { kind: r.kind, itemId: null, itemType: null, eggType: null, quantity };
      if (r.kind === "ITEM") {
        if (!r.itemId) return { error: "Item inválido." };
        if (r.itemId === ADMIN_LAB_RAINBOW_FEATHER_ID) return { error: "A Pena Arco-Íris Primordial não pode ser prêmio de código." };
        rewards.push({ ...base, itemId: r.itemId });
      } else if (r.kind === "ITEM_TYPE") {
        if (!r.itemType || !Object.values(ShopItemType).includes(r.itemType as ShopItemType)) return { error: "Tipo de item inválido." };
        if (r.itemType === ShopItemType.RAINBOW_FEATHER) return { error: "Pena Arco-Íris não pode ser prêmio por tipo." };
        rewards.push({ ...base, itemType: r.itemType });
      } else if (r.kind === "EGG") {
        if (!r.eggType || !Object.values(EggType).includes(r.eggType as EggType)) return { error: "Tipo de ovo inválido." };
        rewards.push({ ...base, eggType: r.eggType as EggType });
      } else if (r.kind === "MEGA_CHOICE") {
        if (rewards.some((x) => x.kind === "MEGA_CHOICE")) return { error: "Use apenas uma escolha de pedra de Mega por código." };
        rewards.push(base);
      } else return { error: "Tipo de prêmio inválido." };
    }
    if (rewards.length === 0) return { error: "Adicione ao menos um prêmio." };
    const itemIds = rewards.flatMap((r) => (r.itemId ? [r.itemId] : []));
    if (itemIds.length && (await prisma.shopItem.count({ where: { id: { in: itemIds } } })) !== itemIds.length) {
      return { error: "Algum item selecionado não existe mais." };
    }

    const expiresAt = input.expiresAt ? parseBrtLocal(input.expiresAt) : null;
    if (input.expiresAt && !expiresAt) return { error: "Data de expiração inválida." };
    const maxUses = input.maxUses == null || !(input.maxUses >= 1) ? null : Math.floor(input.maxUses);

    const clash = await prisma.redeemCode.findUnique({ where: { code }, select: { id: true } });
    if (clash && clash.id !== input.id) return { error: "Já existe um código com esse nome." };

    const data = { code, description: input.description?.trim() || null, expiresAt, maxUses, active: input.active };
    await prisma.$transaction(async (tx) => {
      if (input.id) {
        await tx.redeemCodeReward.deleteMany({ where: { codeId: input.id } });
        await tx.redeemCode.update({ where: { id: input.id }, data: { ...data, rewards: { createMany: { data: rewards } } } });
      } else {
        await tx.redeemCode.create({ data: { ...data, createdById: admin.id, rewards: { createMany: { data: rewards } } } });
      }
    });
    revalidatePath("/admin/codigos-resgate");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar código." };
  }
}

export async function deleteRedeemCode(id: string): Promise<{ error?: string }> {
  try {
    await requirePlatformAdmin();
    await prisma.redeemCode.delete({ where: { id } });
    revalidatePath("/admin/codigos-resgate");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao excluir código." };
  }
}
