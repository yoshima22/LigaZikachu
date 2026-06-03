"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { ShopItemType, ShopItemRarity, TitleTheme, TitleEntranceEffect, ZikaCoinTxType, EggType, FoodType } from "@prisma/client";
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
  }).optional().nullable(),
  // Título: tema visual, frase de sabor e efeito de entrada
  theme: z.nativeEnum(TitleTheme).optional(),
  flavorText: z.string().trim().max(200).optional().nullable(),
  entranceEffect: z.nativeEnum(TitleEntranceEffect).optional(),
});

const DEFAULT_MASCOT_SHOP_ITEMS: Array<{
  type: ShopItemType;
  name: string;
  description: string;
  imageUrl: string | null;
  rarity: ShopItemRarity;
  price: number;
  sortOrder: number;
}> = [
  {
    type: ShopItemType.EGG_COMMON,
    name: "Ovo Comum",
    description: "Um ovo de mascote da Liga. Choca em 10 minutos na incubadora.",
    imageUrl: "/mascot/egg-common.png",
    rarity: ShopItemRarity.COMMON,
    price: 1200,
    sortOrder: 10,
  },
  {
    type: ShopItemType.EGG_RARE,
    name: "Ovo Raro",
    description: "Um ovo com chance maior de mascotes mais procurados.",
    imageUrl: "/mascot/egg-common.png",
    rarity: ShopItemRarity.RARE,
    price: 2800,
    sortOrder: 20,
  },
  {
    type: ShopItemType.EGG_SPECIAL,
    name: "Ovo Especial",
    description: "Um ovo limitado com pool especial de mascotes.",
    imageUrl: "/mascot/egg-common.png",
    rarity: ShopItemRarity.EPIC,
    price: 5000,
    sortOrder: 30,
  },
  {
    type: ShopItemType.MASCOT_FOOD,
    name: "Comida de Mascote",
    description: "Restaura humor e felicidade do seu mascote.",
    imageUrl: null,
    rarity: ShopItemRarity.COMMON,
    price: 120,
    sortOrder: 40,
  },
  {
    type: ShopItemType.MASCOT_SWEET,
    name: "Doce de Mascote",
    description: "Doce especial que aumenta felicidade e EXP do mascote.",
    imageUrl: null,
    rarity: ShopItemRarity.RARE,
    price: 350,
    sortOrder: 50,
  },
];

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
        theme: data.theme ?? undefined,
        flavorText: data.flavorText ?? null,
        entranceEffect: data.entranceEffect ?? undefined,
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
        theme: data.theme ?? undefined,
        flavorText: data.flavorText ?? null,
        entranceEffect: data.entranceEffect ?? undefined,
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

export async function createDefaultMascotShopItems(): Promise<{ error?: string; created?: number }> {
  try {
    const actor = await requireAdmin();
    let created = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of DEFAULT_MASCOT_SHOP_ITEMS) {
        const existing = await tx.shopItem.findFirst({
          where: { type: item.type, name: item.name },
          select: { id: true }
        });
        if (existing) continue;

        await tx.shopItem.create({
          data: {
            ...item,
            createdById: actor.id
          }
        });
        created++;
      }
    });

    revalidatePath("/shop");
    revalidatePath("/shop/admin");
    return { created };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Comprar item ──────────────────────────────────────────────────────────────

const purchaseItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

const CONSUMABLE_TYPES: ShopItemType[] = [
  ShopItemType.ZIKALOOT_TICKET,
  ShopItemType.EGG_COMMON,
  ShopItemType.EGG_RARE,
  ShopItemType.EGG_SPECIAL,
  ShopItemType.MASCOT_FOOD,
  ShopItemType.MASCOT_SWEET,
];

export async function purchaseItem(
  itemIdOrInput: string | z.infer<typeof purchaseItemSchema>
): Promise<{ error?: string; purchased?: number }> {
  try {
    const { itemId, quantity } = purchaseItemSchema.parse(
      typeof itemIdOrInput === "string"
        ? { itemId: itemIdOrInput, quantity: 1 }
        : itemIdOrInput
    );

    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
    if (!player) return { error: "Jogador não encontrado." };

    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item) return { error: "Item não encontrado." };
    if (!item.active) return { error: "Este item não está disponível." };

    // Itens consumíveis (ovos, comida) podem ser comprados várias vezes
    const isConsumable = CONSUMABLE_TYPES.includes(item.type);
    if (!isConsumable && quantity > 1) {
      return { error: "Este item é único e só pode ser comprado uma vez." };
    }

    if (!isConsumable) {
      const alreadyOwns = await prisma.playerInventory.findUnique({
        where: { playerId_itemId: { playerId: player.id, itemId } }
      });
      if (alreadyOwns) return { error: "Você já possui este item." };
    }

    const wallet = await getOrCreateWallet(player.id);
    const totalPrice = item.price * quantity;
    if (wallet.balance < totalPrice)
      return { error: `Saldo insuficiente. Você tem ${wallet.balance} ZC, a compra custa ${totalPrice} ZC.` };

    await prisma.$transaction(async (tx) => {
      await creditCoins(tx, {
        playerId: player.id,
        type: ZikaCoinTxType.SHOP_PURCHASE,
        amount: -totalPrice,
        description: quantity > 1 ? `Compra: ${item.name} x${quantity}` : `Compra: ${item.name}`
      });

      if (item.type === ShopItemType.EGG_COMMON || item.type === ShopItemType.EGG_RARE || item.type === ShopItemType.EGG_SPECIAL) {
        // Compra de ovo → cria MascotEgg no inventário
        const eggTypeMap: Record<string, EggType> = {
          [ShopItemType.EGG_COMMON]:  EggType.COMMON,
          [ShopItemType.EGG_RARE]:    EggType.RARE,
          [ShopItemType.EGG_SPECIAL]: EggType.SPECIAL,
        };
        await tx.mascotEgg.createMany({
          data: Array.from({ length: quantity }, () => ({
            playerId: player.id,
            type: eggTypeMap[item.type],
            origin: "Comprado na ZikaShop"
          }))
        });
      } else if (item.type === ShopItemType.MASCOT_FOOD || item.type === ShopItemType.MASCOT_SWEET) {
        // Compra de comida/doce → adiciona ao inventário de comida
        const foodType = item.type === ShopItemType.MASCOT_FOOD ? FoodType.FOOD : FoodType.SWEET;
        await tx.mascotFoodItem.upsert({
          where: { playerId_type: { playerId: player.id, type: foodType } },
          update: { quantity: { increment: quantity } },
          create: { playerId: player.id, type: foodType, quantity }
        });
      } else if (item.type === ShopItemType.ZIKALOOT_TICKET) {
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: player.id, itemId } },
          update: { quantity: { increment: quantity } },
          create: { playerId: player.id, itemId, quantity }
        });
      } else {
        await tx.playerInventory.create({ data: { playerId: player.id, itemId } });
      }
    });

    revalidatePath("/shop");
    revalidatePath("/inventario");
    revalidatePath("/mascotes");
    revalidatePath("/carteira");

    // Emitir eventos de conquistas (fire-and-forget, não bloqueia)
    void onShopPurchase(player.id).catch(() => {});
    void onCoinsSpent(player.id, totalPrice).catch(() => {});

    return { purchased: quantity };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
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
