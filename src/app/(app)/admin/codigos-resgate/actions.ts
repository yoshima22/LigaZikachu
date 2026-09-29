"use server";

import { revalidatePath } from "next/cache";
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
  rewards: { itemId: string; quantity: number }[];
};

export async function saveRedeemCode(input: SaveRedeemCodeInput): Promise<{ error?: string }> {
  try {
    const admin = await requirePlatformAdmin();
    const code = normalizeRedeemCode(input.code);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return { error: "Código deve ter 3–40 caracteres (letras, números, - ou _)." };

    const merged = new Map<string, number>();
    for (const r of input.rewards) {
      const qty = Math.floor(Number(r.quantity));
      if (!r.itemId || !(qty >= 1)) return { error: "Quantidade inválida em um dos prêmios." };
      if (r.itemId === ADMIN_LAB_RAINBOW_FEATHER_ID) return { error: "A Pena Arco-Íris Primordial não pode ser prêmio de código." };
      merged.set(r.itemId, Math.min(99, (merged.get(r.itemId) ?? 0) + qty));
    }
    if (merged.size === 0) return { error: "Adicione ao menos um prêmio." };
    const found = await prisma.shopItem.count({ where: { id: { in: [...merged.keys()] } } });
    if (found !== merged.size) return { error: "Algum item selecionado não existe mais." };

    const expiresAt = input.expiresAt ? parseBrtLocal(input.expiresAt) : null;
    if (input.expiresAt && !expiresAt) return { error: "Data de expiração inválida." };
    const maxUses = input.maxUses == null || !(input.maxUses >= 1) ? null : Math.floor(input.maxUses);

    const clash = await prisma.redeemCode.findUnique({ where: { code }, select: { id: true } });
    if (clash && clash.id !== input.id) return { error: "Já existe um código com esse nome." };

    const data = { code, description: input.description?.trim() || null, expiresAt, maxUses, active: input.active };
    const rewards = [...merged].map(([itemId, quantity]) => ({ itemId, quantity }));
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
