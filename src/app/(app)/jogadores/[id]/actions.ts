"use server";

import { revalidatePath } from "next/cache";
import { EggType, FoodType, SyncTicketSide } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { SYNC_TICKET_TYPES } from "@/lib/sync-challenge";

const EGG_TYPE_MAP: Record<string, EggType> = {
  EGG_COMMON: EggType.COMMON,
  EGG_RARE: EggType.RARE,
  EGG_SPECIAL: EggType.SPECIAL,
  EGG_LAB: EggType.LAB,
  EGG_EVENT: EggType.EVENT,
  EGG_GEN1: EggType.EGG_GEN1,
  EGG_GEN2: EggType.EGG_GEN2,
  EGG_GEN3: EggType.EGG_GEN3,
  EGG_GEN4: EggType.EGG_GEN4,
  EGG_GEN5: EggType.EGG_GEN5,
  EGG_GEN6: EggType.EGG_GEN6,
  EGG_GEN7: EggType.EGG_GEN7,
  EGG_GEN8: EggType.EGG_GEN8,
  EGG_GEN9: EggType.EGG_GEN9,
  EGG_GEN6PLUS: EggType.EGG_GEN6PLUS,
};

const FOOD_TYPE_MAP: Record<string, FoodType> = {
  MASCOT_FOOD: FoodType.FOOD,
  MASCOT_SWEET: FoodType.SWEET,
};

export async function grantItemToPlayer(
  playerId: string,
  itemId: string,
  quantity = 1
): Promise<{ error?: string }> {
  try {
    const adminUser = await requireAdmin();

    const [player, item, adminPlayer] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerId }, select: { id: true } }),
      prisma.shopItem.findUnique({ where: { id: itemId }, select: { id: true, name: true, type: true } }),
      prisma.player.findFirst({ where: { userId: adminUser.id }, select: { id: true } }),
    ]);
    if (!player) return { error: "Jogador nao encontrado." };
    if (!item) return { error: "Item nao encontrado." };

    const safeQty = Math.max(1, Math.min(Math.floor(quantity), 99));
    const eggType = EGG_TYPE_MAP[item.type];
    const foodType = FOOD_TYPE_MAP[item.type];

    if (eggType) {
      await prisma.playerInventory.deleteMany({ where: { playerId, itemId } });
      for (let q = 0; q < safeQty; q++) {
        await prisma.mascotEgg.create({
          data: { playerId, type: eggType, origin: `Concedido pelo Admin: ${item.name}` },
        });
      }
    } else if (foodType) {
      await prisma.mascotFoodItem.upsert({
        where: { playerId_type: { playerId, type: foodType } },
        update: { quantity: { increment: safeQty } },
        create: { playerId, type: foodType, quantity: safeQty },
      });
    } else if (item.type === SYNC_TICKET_TYPES.fireLeft || item.type === SYNC_TICKET_TYPES.waterRight) {
      const side = item.type === SYNC_TICKET_TYPES.fireLeft ? SyncTicketSide.LEFT : SyncTicketSide.RIGHT;
      for (let q = 0; q < safeQty; q++) {
        await prisma.syncTicketHalf.create({
          data: { side, ownerId: playerId, generatedByPlayerId: playerId, sourceAction: "admin-grant", status: "AVAILABLE" },
        });
      }
    } else if (item.type === SYNC_TICKET_TYPES.complete) {
      // SyncTicket requer dois halfIds e dois bannedUser não-nulos.
      // As metades são registradas como geradas pelo próprio jogador.
      // Os campos de ban apontam para o admin (ou fallback para o jogador)
      // para que o jogador-alvo não fique banido de usar o ticket.
      const bannedId = adminPlayer?.id ?? playerId;
      for (let q = 0; q < safeQty; q++) {
        const [leftHalf, rightHalf] = await Promise.all([
          prisma.syncTicketHalf.create({
            data: { side: SyncTicketSide.LEFT, ownerId: playerId, generatedByPlayerId: playerId, sourceAction: "admin-grant", status: "COMBINED" },
          }),
          prisma.syncTicketHalf.create({
            data: { side: SyncTicketSide.RIGHT, ownerId: playerId, generatedByPlayerId: playerId, sourceAction: "admin-grant", status: "COMBINED" },
          }),
        ]);
        await prisma.syncTicket.create({
          data: {
            ownerId: playerId,
            leftHalfId: leftHalf.id,
            rightHalfId: rightHalf.id,
            bannedUserAId: bannedId,
            bannedUserBId: bannedId,
            status: "AVAILABLE",
          },
        });
      }
    } else {
      await prisma.playerInventory.upsert({
        where: { playerId_itemId: { playerId, itemId } },
        update: { quantity: { increment: safeQty } },
        create: { playerId, itemId, quantity: safeQty, equipped: false, source: "ADMIN_GRANT" },
      });
    }

    revalidatePath(`/jogadores/${playerId}`);
    revalidatePath("/inventario");
    revalidatePath("/desafio-sincronizado");
    revalidatePath("/shop");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}
