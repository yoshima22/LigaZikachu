"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { ShopItemType, ShopItemRarity, ZikaCoinTxType } from "@prisma/client";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";
import { onShopPurchase, onCoinsSpent } from "@/lib/achievement-events";

// ── Admin: criar item ─────────────────────────────────────────────────────────

const createItemSchema = z.object({
  type: z.nativeEnum(ShopItemType),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  rarity: z.nativeEnum(ShopItemRarity),
  price: z.number().int().min(1).max(999999),
  // metadata para molduras: posicionamento e escala
  metadata: z.object({
    // Moldura (FRAME)
    frameScale:   z.number().min(0.1).max(6).optional(),
    frameOffsetX: z.number().min(-200).max(200).optional(),
    frameOffsetY: z.number().min(-200).max(200).optional(),
    // Banner
    focusX: z.number().min(0).max(100).optional(),
    focusY: z.number().min(0).max(100).optional(),
  }).optional().nullable()
});

export async function createShopItem(
  raw: z.infer<typeof createItemSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = createItemSchema.parse(raw);
    await prisma.shopItem.create({
      data: {
        type: data.type, name: data.name, rarity: data.rarity, price: data.price,
        imageUrl: data.imageUrl || null,
        description: data.description || null,
        metadata: data.metadata ?? undefined,
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

export async function updateShopItem(
  itemId: string,
  raw: z.infer<typeof createItemSchema>
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const data = createItemSchema.parse(raw);
    await prisma.shopItem.update({
      where: { id: itemId },
      data: {
        type: data.type, name: data.name, rarity: data.rarity, price: data.price,
        imageUrl: data.imageUrl || null,
        description: data.description || null,
        metadata: data.metadata ?? undefined,
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

export async function deleteShopItem(itemId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.shopItem.delete({ where: { id: itemId } });
    revalidatePath("/shop");
    revalidatePath("/shop/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function reorderShopItem(
  itemId: string,
  direction: "up" | "down"
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const item = await prisma.shopItem.findUnique({
      where: { id: itemId },
      select: { id: true, sortOrder: true, type: true }
    });
    if (!item) return { error: "Item não encontrado." };

    // Busca o vizinho na mesma categoria na direção desejada
    const neighbor = await prisma.shopItem.findFirst({
      where: {
        type: item.type,
        sortOrder: direction === "up"
          ? { lt: item.sortOrder }
          : { gt: item.sortOrder }
      },
      orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
      select: { id: true, sortOrder: true }
    });

    if (!neighbor) {
      // Já está no extremo — normaliza os sortOrders do grupo
      const all = await prisma.shopItem.findMany({
        where: { type: item.type },
        orderBy: { sortOrder: "asc" },
        select: { id: true }
      });
      await Promise.all(all.map((i, idx) =>
        prisma.shopItem.update({ where: { id: i.id }, data: { sortOrder: idx * 10 } })
      ));
      revalidatePath("/shop/admin");
      return {};
    }

    // Troca os sortOrders entre item e vizinho
    await prisma.$transaction([
      prisma.shopItem.update({ where: { id: item.id },     data: { sortOrder: neighbor.sortOrder } }),
      prisma.shopItem.update({ where: { id: neighbor.id }, data: { sortOrder: item.sortOrder } }),
    ]);

    revalidatePath("/shop");
    revalidatePath("/shop/admin");
    return {};
  } catch (err) {
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

    // Tickets ZikaLoot podem ser comprados várias vezes
    if (item.type !== ShopItemType.ZIKALOOT_TICKET) {
      const alreadyOwns = await prisma.playerInventory.findUnique({
        where: { playerId_itemId: { playerId: player.id, itemId } }
      });
      if (alreadyOwns) return { error: "Você já possui este item." };
    }

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
      if (item.type === ShopItemType.ZIKALOOT_TICKET) {
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: player.id, itemId } },
          update: { quantity: { increment: 1 } },
          create: { playerId: player.id, itemId, quantity: 1 }
        });
      } else {
        await tx.playerInventory.create({ data: { playerId: player.id, itemId } });
      }
    });

    revalidatePath("/shop");
    revalidatePath("/inventario");
    revalidatePath("/carteira");

    // Emitir eventos de conquistas (fire-and-forget, não bloqueia)
    void onShopPurchase(player.id).catch(() => {});
    void onCoinsSpent(player.id, item.price).catch(() => {});

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

    // Emitir evento de conquista ao equipar
    if (equip) {
      const { onTitleEquipped, onBannerEquipped, onFrameEquipped } = await import("@/lib/achievement-events");
      if (owned.item.type === "TITLE") void onTitleEquipped(player.id).catch(() => {});
      if (owned.item.type === "BANNER") void onBannerEquipped(player.id).catch(() => {});
      if (owned.item.type === "FRAME") void onFrameEquipped(player.id).catch(() => {});
    }

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
