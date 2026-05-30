"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { ShopItemType, ShopItemRarity, ZikaCoinTxType } from "@prisma/client";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";

// ── Admin: criar item ─────────────────────────────────────────────────────────

const createItemSchema = z.object({
  type: z.nativeEnum(ShopItemType),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  rarity: z.nativeEnum(ShopItemRarity),
  price: z.number().int().min(1).max(999999)
});

export async function createShopItem(
  raw: z.infer<typeof createItemSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = createItemSchema.parse(raw);
    await prisma.shopItem.create({
      data: {
        ...data,
        imageUrl: data.imageUrl || null,
        description: data.description || null,
        createdById: actor.id
      }
    });
    revalidatePath("/shop");
    revalidatePath("/shop/admin");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function toggleShopItem(itemId: string, active: boolean): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.shopItem.update({ where: { id: itemId }, data: { active } });
    revalidatePath("/shop");
    revalidatePath("/shop/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Comprar item ──────────────────────────────────────────────────────────────

export async function purchaseItem(itemId: string): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
    if (!player) return { error: "Jogador não encontrado." };

    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item) return { error: "Item não encontrado." };
    if (!item.active) return { error: "Este item não está disponível." };

    const alreadyOwns = await prisma.playerInventory.findUnique({
      where: { playerId_itemId: { playerId: player.id, itemId } }
    });
    if (alreadyOwns) return { error: "Você já possui este item." };

    const wallet = await getOrCreateWallet(player.id);
    if (wallet.balance < item.price)
      return { error: `Saldo insuficiente. Você tem ${wallet.balance} ZC, o item custa ${item.price} ZC.` };

    await prisma.$transaction(async (tx) => {
      await creditCoins(tx, {
        playerId: player.id,
        type: ZikaCoinTxType.SHOP_PURCHASE,
        amount: -item.price,
        description: `Compra: ${item.name}`
      });
      await tx.playerInventory.create({
        data: { playerId: player.id, itemId }
      });
    });

    revalidatePath("/shop");
    revalidatePath("/inventario");
    revalidatePath("/carteira");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Equipar / desequipar item ─────────────────────────────────────────────────

export async function equipItem(itemId: string, equip: boolean): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
    if (!player) return { error: "Jogador não encontrado." };

    const owned = await prisma.playerInventory.findUnique({
      where: { playerId_itemId: { playerId: player.id, itemId } },
      include: { item: { select: { type: true } } }
    });
    if (!owned) return { error: "Você não possui este item." };

    if (equip) {
      // Desequipar outros itens do mesmo tipo
      await prisma.playerInventory.updateMany({
        where: { playerId: player.id, item: { type: owned.item.type }, equipped: true },
        data: { equipped: false }
      });
    }

    await prisma.playerInventory.update({
      where: { playerId_itemId: { playerId: player.id, itemId } },
      data: { equipped: equip }
    });

    revalidatePath("/inventario");
    revalidatePath("/perfil");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
