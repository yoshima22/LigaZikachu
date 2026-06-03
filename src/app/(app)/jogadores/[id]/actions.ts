"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { EggType, FoodType } from "@prisma/client";

const EGG_TYPE_MAP: Record<string, EggType> = {
  EGG_COMMON:  EggType.COMMON,
  EGG_RARE:    EggType.RARE,
  EGG_SPECIAL: EggType.SPECIAL,
  EGG_EVENT:   EggType.EVENT,
};

const FOOD_TYPE_MAP: Record<string, FoodType> = {
  MASCOT_FOOD:  FoodType.FOOD,
  MASCOT_SWEET: FoodType.SWEET,
};

const BUFF_TYPES = ["MASCOT_BUFF_EXP","MASCOT_BUFF_STAT","MASCOT_BUFF_HAPPY","MASCOT_BUFF_LUCK","MASCOT_BUFF_MOOD"];

/**
 * Concede um item da ZikaShop diretamente ao jogador.
 * Redireciona para a tabela correta de acordo com o tipo do item.
 */
export async function grantItemToPlayer(
  playerId: string,
  itemId: string
): Promise<{ error?: string }> {
  try {
    await requireAdmin();

    const [player, item] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerId }, select: { id: true } }),
      prisma.shopItem.findUnique({ where: { id: itemId }, select: { id: true, name: true, type: true } }),
    ]);
    if (!player) return { error: "Jogador não encontrado." };
    if (!item)   return { error: "Item não encontrado." };

    const eggType = EGG_TYPE_MAP[item.type];
    const foodType = FOOD_TYPE_MAP[item.type];
    const isBuff = BUFF_TYPES.includes(item.type);

    if (eggType) {
      // Ovo → MascotEgg
      await prisma.mascotEgg.create({
        data: { playerId, type: eggType, origin: "Concedido pelo Admin" }
      });
    } else if (foodType) {
      // Comida/Doce → MascotFoodItem
      await prisma.mascotFoodItem.upsert({
        where: { playerId_type: { playerId, type: foodType } },
        update: { quantity: { increment: 1 } },
        create: { playerId, type: foodType, quantity: 1 }
      });
    } else if (isBuff) {
      // Buff → PlayerInventory com quantidade
      await prisma.playerInventory.upsert({
        where: { playerId_itemId: { playerId, itemId } },
        update: { quantity: { increment: 1 } },
        create: { playerId, itemId, quantity: 1, equipped: false }
      });
    } else {
      // Item cosmético → PlayerInventory (título, banner, moldura, ticket)
      await prisma.playerInventory.upsert({
        where: { playerId_itemId: { playerId, itemId } },
        update: { quantity: { increment: 1 } },
        create: { playerId, itemId, quantity: 1, equipped: false }
      });
    }

    revalidatePath(`/jogadores/${playerId}`);
    revalidatePath("/inventario");
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}
