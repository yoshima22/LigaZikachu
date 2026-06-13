"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { EggType, FoodType } from "@prisma/client";

const EGG_TYPE_MAP: Record<string, EggType> = {
  EGG_COMMON:   EggType.COMMON,
  EGG_RARE:     EggType.RARE,
  EGG_SPECIAL:  EggType.SPECIAL,
  EGG_LAB:      EggType.LAB,
  EGG_EVENT:    EggType.EVENT,
  EGG_GEN1:     EggType.EGG_GEN1,
  EGG_GEN2:     EggType.EGG_GEN2,
  EGG_GEN3:     EggType.EGG_GEN3,
  EGG_GEN4:     EggType.EGG_GEN4,
  EGG_GEN5:     EggType.EGG_GEN5,
  EGG_GEN6:     EggType.EGG_GEN6,
  EGG_GEN7:     EggType.EGG_GEN7,
  EGG_GEN8:     EggType.EGG_GEN8,
  EGG_GEN9:     EggType.EGG_GEN9,
  EGG_GEN6PLUS: EggType.EGG_GEN6PLUS,
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
  itemId: string,
  quantity = 1
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

    const safeQty = Math.max(1, Math.min(quantity, 99));

    if (eggType) {
      // Limpa entradas incorretas em PlayerInventory (ovos nunca devem ficar lá)
      await prisma.playerInventory.deleteMany({ where: { playerId, itemId } });
      // Ovo → Caixa de Presentes (um gift por unidade)
      for (let q = 0; q < safeQty; q++) {
        await prisma.playerGift.create({
          data: {
            playerId,
            type: "CUSTOM",
            title: item.name,
            description: `${item.name} concedido pelo admin.`,
            payload: {
              rewardKind: "MASCOT_EGG",
              eggType: eggType.toString(),
              origin: "Concedido pelo Admin",
              rewardLabel: item.name,
            }
          }
        });
      }
    } else if (foodType) {
      // Comida/Doce → Caixa de Presentes (com quantity)
      await prisma.playerGift.create({
        data: {
          playerId,
          type: "CUSTOM",
          title: item.name,
          description: `${item.name} x${safeQty} concedido pelo admin.`,
          payload: { rewardKind: "MASCOT_FOOD", foodType: foodType.toString(), quantity: safeQty, rewardLabel: item.name }
        }
      });
    } else if (isBuff) {
      // Buff → Caixa de Presentes
      for (let q = 0; q < safeQty; q++) {
        await prisma.playerGift.create({
          data: {
            playerId,
            type: "CUSTOM",
            title: item.name,
            description: `${item.name} concedido pelo admin.`,
            payload: { rewardKind: "MASCOT_BUFF", buffType: item.type, rewardLabel: item.name }
          }
        });
      }
    } else {
      // Item cosmético → PlayerInventory (título, banner, moldura, ticket)
      await prisma.playerInventory.upsert({
        where: { playerId_itemId: { playerId, itemId } },
        update: { quantity: { increment: safeQty } },
        create: { playerId, itemId, quantity: safeQty, equipped: false }
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
