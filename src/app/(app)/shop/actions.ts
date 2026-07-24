"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { invalidateShopCache } from "@/lib/shop-cache";
import { getSessionPlayer } from "@/lib/session";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { ShopItemType, ShopItemRarity, TitleTheme, TitleEntranceEffect, ZikaCoinTxType, EggType, FoodType } from "@prisma/client";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";
import { onShopPurchase, onCoinsSpent } from "@/lib/achievement-events";
import { CONSUMABLE_SHOP_ITEM_TYPES, EGG_SHOP_TO_EGG_TYPE, isEggShopItemType, UNIQUE_ITEM_TYPES } from "@/lib/shop-config";
import { isMegaStoneShopUnlocked } from "@/lib/mega-shop";
import { isMegaStoneType } from "@/lib/mega-evolution";
import { publishLeagueTicker } from "@/lib/league-ticker";

// ── Admin: criar item ─────────────────────────────────────────────────────────

const createItemSchema = z.object({
  type: z.nativeEnum(ShopItemType),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  rarity: z.nativeEnum(ShopItemRarity),
  price: z.number().int().min(1).max(999999),
  inventoryEnabled: z.boolean().default(true),
  // metadata para molduras, banners e buffs
  metadata: z.object({
    // Moldura (FRAME)
    frameScale:   z.number().min(0.1).max(6).optional(),
    frameOffsetX: z.number().min(-200).max(200).optional(),
    frameOffsetY: z.number().min(-200).max(200).optional(),
    // Banner
    focusX: z.number().min(0).max(100).optional(),
    focusY: z.number().min(0).max(100).optional(),
    brightnessPct: z.number().int().min(50).max(300).optional(),
    // Buff (MASCOT_BUFF_EXP, PICNIC_BASKET, LUCKY_EGG)
    buffHours:        z.number().min(1).max(72).optional(),
    expMultiplierPct: z.number().min(1).max(200).optional(),
    happinessBonus:   z.number().min(0).max(50).optional(),
    // Vacation (VACATION_TICKET)
    vacationDays:  z.number().int().min(1).max(30).optional(),
    expBonus:      z.number().int().min(100).max(100000).optional(),
    eggChancePct:  z.number().int().min(0).max(100).optional(),
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
  metadata?: Record<string, string | number | boolean>;
}> = [
  {
    type: ShopItemType.EGG_COMMON,
    name: "Ovo Comum",
    description: "Um ovo de mascote da Liga. Choca em 10 minutos na incubadora.",
    imageUrl: "/mascot/egg-common.webp",
    rarity: ShopItemRarity.COMMON,
    price: 1200,
    sortOrder: 10,
  },
  {
    type: ShopItemType.EGG_RARE,
    name: "Ovo Raro",
    description: "Um ovo com chance maior de mascotes mais procurados.",
    imageUrl: "/mascot/egg-common.webp",
    rarity: ShopItemRarity.RARE,
    price: 2800,
    sortOrder: 20,
  },
  {
    type: ShopItemType.EGG_SPECIAL,
    name: "Ovo Especial",
    description: "Um ovo limitado com pool especial de mascotes.",
    imageUrl: "/mascot/egg-common.webp",
    rarity: ShopItemRarity.EPIC,
    price: 5000,
    sortOrder: 30,
  },
  {
    type: ShopItemType.EGG_LAB,
    name: "Ovo de Laboratório",
    description: "Apresenta 3 opções de Pokémon ao chocar. Stats superiores e pool especial com 10% de chance lendária.",
    imageUrl: "/mascot/egg-common.webp",
    rarity: ShopItemRarity.LEGENDARY,
    price: 12000,
    sortOrder: 35,
  },
  {
    type: ShopItemType.MASCOT_FOOD,
    name: "Comida de Mascote",
    description: "Restaura humor e felicidade do seu mascote.",
    imageUrl: null,
    rarity: ShopItemRarity.COMMON,
    price: 20,
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
  // ── Itens Especiais ───────────────────────────────────────────────────────
  {
    type: ShopItemType.LUCKY_EGG,
    name: "Ovo da Sorte",
    description: "+20% EXP na próxima expedição de treinamento. Recarrega em 24h por mascote.",
    imageUrl: null,
    rarity: ShopItemRarity.UNCOMMON,
    price: 400,
    sortOrder: 60,
  },
  {
    type: ShopItemType.WEAKNESS_POLICY,
    name: "Política de Fraqueza",
    description: "Recupera completamente um mascote ferido ou em repouso, remove todo o tempo de repouso e o protege do próximo ataque oportunista. A proteção é consumida ao bloquear o ataque.",
    imageUrl: null,
    rarity: ShopItemRarity.UNCOMMON,
    price: 300,
    sortOrder: 61,
  },
  {
    type: ShopItemType.PICNIC_BASKET,
    name: "Cesta de Piquenique Chocante",
    description: "Reduz em 30% a próxima expedição iniciada. Por 3 horas: Treinamento recebe +25% EXP; Itens ganha +3 pontos percentuais de chance de ovo e item especial; Padrão recebe +12% EXP e +1,5 ponto percentual de chance de ovo e item especial.",
    imageUrl: null,
    rarity: ShopItemRarity.RARE,
    price: 2500,
    sortOrder: 62,
  },
  {
    type: ShopItemType.VACATION_TICKET,
    name: "Ticket de Férias do Prof. Carvalho",
    description: "Envia o mascote de férias. Ao voltar, recebe 4.000 EXP fixos mais um pequeno bônus que cresce conforme o nível.",
    imageUrl: null,
    rarity: ShopItemRarity.RARE,
    price: 1600,
    sortOrder: 63,
  },
  {
    type: ShopItemType.XP_SHARE,
    name: "Compartilhador de XP",
    description: "Equipe em um mascote para ele receber 50% da EXP obtida por outro mascote em Treinamento. Permanente; apenas um tipo de Compartilhador pode ficar equipado por vez.",
    imageUrl: null,
    rarity: ShopItemRarity.RARE,
    price: 8000,
    sortOrder: 64,
  },
  {
    type: ShopItemType.XP_SHARE_TEAM,
    name: "Compartilhador Geral de XP",
    description: "Nas expedições de Treinamento, todos os outros mascotes favoritos recebem 10% da EXP conquistada. Permanente; ao equipar, substitui qualquer outro Compartilhador ativo.",
    imageUrl: null,
    rarity: ShopItemRarity.RARE,
    price: 8000,
    sortOrder: 65,
  },
  {
    type: ShopItemType.RAINBOW_FEATHER,
    name: "Pena Arco-Íris Comum",
    description: "Faz o mascote renascer no nível 1: sorteia novamente personalidade e atributos dentro do intervalo do ovo de origem. Sem origem registrada, usa o intervalo de Ovo Raro. Irreversível.",
    imageUrl: null,
    rarity: ShopItemRarity.COMMON,
    price: 900,
    sortOrder: 66,
    metadata: { eggTier: "COMMON" },
  },
  {
    type: ShopItemType.RAINBOW_FEATHER,
    name: "Pena Arco-Íris Rara",
    description: "Ressorteia personalidade e atributos de um mascote originado de Ovo Raro. Mascotes sem origem registrada usam esta versão.",
    imageUrl: null,
    rarity: ShopItemRarity.RARE,
    price: 2000,
    sortOrder: 67,
    metadata: { eggTier: "RARE" },
  },
  {
    type: ShopItemType.RAINBOW_FEATHER,
    name: "Pena Arco-Íris de Evento",
    description: "Ressorteia personalidade e atributos respeitando sempre o intervalo do ovo de origem. Também pode ser usada em origens inferiores, sem elevar seus atributos.",
    imageUrl: null,
    rarity: ShopItemRarity.EPIC,
    price: 2600,
    sortOrder: 68,
    metadata: { eggTier: "EVENT" },
  },
  {
    type: ShopItemType.RAINBOW_FEATHER,
    name: "Pena Arco-Íris Especial",
    description: "Ressorteia personalidade e atributos de um mascote originado de Ovo Especial, preservando o intervalo original.",
    imageUrl: null,
    rarity: ShopItemRarity.EPIC,
    price: 3100,
    sortOrder: 69,
    metadata: { eggTier: "SPECIAL" },
  },
  {
    type: ShopItemType.RAINBOW_FEATHER,
    name: "Pena Arco-Íris de Laboratório",
    description: "Ressorteia personalidade e atributos de um mascote originado de Ovo de Laboratório, preservando seu intervalo superior.",
    imageUrl: null,
    rarity: ShopItemRarity.LEGENDARY,
    price: 4200,
    sortOrder: 70,
    metadata: { eggTier: "LAB" },
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
        inventoryEnabled: data.inventoryEnabled,
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
    void invalidateShopCache();
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
    await prisma.$transaction(async (tx) => {
      await tx.shopItem.update({
        where: { id: itemId },
        data: {
          type: data.type, name: data.name, rarity: data.rarity, price: data.price,
          inventoryEnabled: data.inventoryEnabled,
          imageUrl: data.imageUrl || null,
          description: data.description || null,
          metadata: data.metadata ?? undefined,
          theme: data.theme ?? undefined,
          flavorText: data.flavorText ?? null,
          entranceEffect: data.entranceEffect ?? undefined,
        }
      });
      if (!data.inventoryEnabled) {
        await tx.playerInventory.updateMany({
          where: { itemId, equipped: true },
          data: { equipped: false },
        });
      }
    });
    revalidatePath("/shop");
    revalidatePath("/shop/admin");
    revalidatePath("/inventario");
    revalidatePath("/perfil");
    void invalidateShopCache();
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
    void invalidateShopCache();
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

    // Busca o vizinho global (sem filtro de tipo) na direção desejada
    const neighbor = await prisma.shopItem.findFirst({
      where: {
        sortOrder: direction === "up"
          ? { lt: item.sortOrder }
          : { gt: item.sortOrder }
      },
      orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
      select: { id: true, sortOrder: true }
    });

    if (!neighbor) {
      // Já está no extremo — normaliza todos os sortOrders globalmente
      const all = await prisma.shopItem.findMany({
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
    void invalidateShopCache();
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
    void invalidateShopCache();
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
    void invalidateShopCache();
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

const CONSUMABLE_TYPES = CONSUMABLE_SHOP_ITEM_TYPES as readonly string[];

export async function purchaseItem(
  itemIdOrInput: string | z.infer<typeof purchaseItemSchema>
): Promise<{ error?: string; purchased?: number; autoSold?: { itemName: string; coins: number } }> {
  try {
    const { itemId, quantity } = purchaseItemSchema.parse(
      typeof itemIdOrInput === "string"
        ? { itemId: itemIdOrInput, quantity: 1 }
        : itemIdOrInput
    );

    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };

    const player = await getSessionPlayer(actor.id);
    if (!player) return { error: "Jogador não encontrado." };

    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item) return { error: "Item não encontrado." };
    if (!item.active) return { error: "Este item não está disponível." };

    // Itens consumíveis (ovos, comida) podem ser comprados várias vezes
    if (isMegaStoneType(item.type) && !(await isMegaStoneShopUnlocked())) {
      return { error: "As Pedras de Mega EvoluÃ§Ã£o ainda nÃ£o foram liberadas." };
    }

    const isConsumable = CONSUMABLE_TYPES.includes(item.type);
    if (!isConsumable && quantity > 1) {
      return { error: "Este item é único e só pode ser comprado uma vez." };
    }

    if (!isConsumable) {
      const alreadyOwns = await prisma.playerInventory.findUnique({
        where: { playerId_itemId: { playerId: player.id, itemId } }
      });
      if (alreadyOwns) {
        if (UNIQUE_ITEM_TYPES.has(item.type)) {
          // Item único: reembolsa metade do preço em vez de bloquear
          const halfPrice = Math.floor(item.price / 2);
          await prisma.$transaction(async (tx) => {
            await creditCoins(tx, {
              playerId: player.id,
              type: ZikaCoinTxType.SHOP_PURCHASE,
              amount: halfPrice,
              description: `Reembolso automático: ${item.name} (item único já possuído)`
            });
          });
          revalidatePath("/carteira");
          revalidateTag(`nav-${actor.id}`);
          return { autoSold: { itemName: item.name, coins: halfPrice } };
        }
        return { error: "Você já possui este item." };
      }
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

      if (isEggShopItemType(item.type)) {
        // Compra de ovo → cria MascotEgg no inventário
        const eggTypeMap: Record<string, EggType> = {
          [ShopItemType.EGG_COMMON]:   EggType.COMMON,
          [ShopItemType.EGG_LAB]:      EggType.LAB,
          [ShopItemType.EGG_RARE]:     EggType.RARE,
          [ShopItemType.EGG_SPECIAL]:  EggType.SPECIAL,
          [ShopItemType.EGG_GEN1]:     EggType.EGG_GEN1,
          [ShopItemType.EGG_GEN2]:     EggType.EGG_GEN2,
          [ShopItemType.EGG_GEN3]:     EggType.EGG_GEN3,
          [ShopItemType.EGG_GEN4]:     EggType.EGG_GEN4,
          [ShopItemType.EGG_GEN5]:     EggType.EGG_GEN5,
          [ShopItemType.EGG_GEN6]:     EggType.EGG_GEN6,
          [ShopItemType.EGG_GEN7]:     EggType.EGG_GEN7,
          [ShopItemType.EGG_GEN8]:     EggType.EGG_GEN8,
          [ShopItemType.EGG_GEN9]:     EggType.EGG_GEN9,
          [ShopItemType.EGG_GEN6PLUS]: EggType.EGG_GEN6PLUS,
        };
        await tx.mascotEgg.createMany({
          data: Array.from({ length: quantity }, () => ({
            playerId: player.id,
            type: eggTypeMap[item.type] ?? EggType.COMMON,
            origin: "Comprado na ZikaShop",
          }))
        });
      } else if ((["MASCOT_BUFF_EXP","MASCOT_BUFF_STAT","MASCOT_BUFF_HAPPY","MASCOT_BUFF_LUCK","MASCOT_BUFF_MOOD"] as string[]).includes(item.type)) {
        // Buff vai para inventário de food items como quantidade (jogador escolhe qual mascote usar depois)
        const buffTypeMap: Record<string, string> = {
          MASCOT_BUFF_EXP: "FOOD", MASCOT_BUFF_STAT: "FOOD",
          MASCOT_BUFF_HAPPY: "SWEET", MASCOT_BUFF_LUCK: "SWEET", MASCOT_BUFF_MOOD: "SWEET",
        };
        // Armazena como PlayerInventory consumível (quantidade)
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: player.id, itemId } },
          update: { quantity: { increment: quantity } },
          create: { playerId: player.id, itemId, quantity }
        });
      } else if (item.type === ShopItemType.MASCOT_FOOD || item.type === ShopItemType.MASCOT_SWEET) {
        // Compra de comida/doce → adiciona ao inventário de comida
        const foodType = item.type === ShopItemType.MASCOT_FOOD ? FoodType.FOOD : FoodType.SWEET;
        await tx.mascotFoodItem.upsert({
          where: { playerId_type: { playerId: player.id, type: foodType } },
          update: { quantity: { increment: quantity } },
          create: { playerId: player.id, type: foodType, quantity }
        });
      } else if (item.type === ShopItemType.ZIKALOOT_TICKET || isConsumable) {
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
    revalidateTag(`nav-${actor.id}`);

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

    const player = await getSessionPlayer(actor.id);
    if (!player) return { error: "Jogador não encontrado." };

    const owned = await prisma.playerInventory.findUnique({
      where: { playerId_itemId: { playerId: player.id, itemId } },
      include: { item: { select: { type: true, inventoryEnabled: true } } }
    });
    if (!owned) return { error: "Você não possui este item." };
    if (equip && !owned.item.inventoryEnabled) {
      return { error: "Este item foi desativado para uso no inventário." };
    }

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
      if (owned.item.type === "BANNER") {
        void onBannerEquipped(player.id).catch(() => {});
        await publishLeagueTicker({
          type: "PROFILE_BANNER_CHANGED",
          message: `${player.displayName} alterou o banner de perfil. Aproveite para conferir a wishlist!`,
          href: `/jogadores/${player.id}`,
          priority: 1,
          ttlHours: 4,
          sampleRate: 0.4,
        });
      }
      if (owned.item.type === "FRAME") void onFrameEquipped(player.id).catch(() => {});
    }

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
