"use server";

import { revalidatePath } from "next/cache";
import { EggType, FoodType, SyncTicketSide } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { grantSyncTicketHalf, grantValidSyncTicketForPlayer, SYNC_TICKET_TYPES } from "@/lib/sync-challenge";

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
    await requireAdmin();

    const [player, item] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerId }, select: { id: true } }),
      prisma.shopItem.findUnique({ where: { id: itemId }, select: { id: true, name: true, type: true } }),
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
      await prisma.$transaction(async (tx) => {
        for (let q = 0; q < safeQty; q++) {
          await grantSyncTicketHalf(tx, playerId, "admin-grant", side, playerId);
        }
      });
    } else if (item.type === SYNC_TICKET_TYPES.complete) {
      await prisma.$transaction(async (tx) => {
        for (let q = 0; q < safeQty; q++) {
          await grantValidSyncTicketForPlayer(tx, playerId);
        }
      });
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

export async function revokeItemFromPlayer(
  playerId: string,
  itemType: string,
  quantity = 1,
  itemId?: string,
): Promise<{ error?: string }> {
  try {
    await requireAdmin();

    if (!playerId) return { error: "Jogador nao encontrado." };
    const safeQty = Math.max(1, Math.min(Math.floor(quantity), 99));

    if (itemType === SYNC_TICKET_TYPES.fireLeft || itemType === SYNC_TICKET_TYPES.waterRight) {
      const side = itemType === SYNC_TICKET_TYPES.fireLeft ? SyncTicketSide.LEFT : SyncTicketSide.RIGHT;
      const halves = await prisma.syncTicketHalf.findMany({
        where: { ownerId: playerId, side, status: { in: ["AVAILABLE", "SENT"] } },
        select: { id: true },
        take: safeQty,
      });
      if (halves.length === 0) return { error: "Jogador nao possui esta metade de ticket." };
      await prisma.syncTicketHalf.deleteMany({ where: { id: { in: halves.map((h) => h.id) } } });
    } else if (itemType === SYNC_TICKET_TYPES.complete) {
      const tickets = await prisma.syncTicket.findMany({
        where: { ownerId: playerId, status: { in: ["AVAILABLE", "RESERVED"] } },
        select: { id: true, leftHalfId: true, rightHalfId: true },
        take: safeQty,
      });
      if (tickets.length === 0) return { error: "Jogador nao possui ticket completo." };
      for (const t of tickets) {
        await prisma.syncTicket.delete({ where: { id: t.id } });
        await prisma.syncTicketHalf.deleteMany({ where: { id: { in: [t.leftHalfId, t.rightHalfId] } } });
      }
    } else if (itemId) {
      const inv = await prisma.playerInventory.findUnique({
        where: { playerId_itemId: { playerId, itemId } },
        select: { quantity: true },
      });
      if (!inv || inv.quantity <= 0) return { error: "Jogador nao possui este item." };
      const newQty = inv.quantity - safeQty;
      if (newQty <= 0) {
        await prisma.playerInventory.delete({ where: { playerId_itemId: { playerId, itemId } } });
      } else {
        await prisma.playerInventory.update({
          where: { playerId_itemId: { playerId, itemId } },
          data: { quantity: newQty },
        });
      }
    } else {
      return { error: "Tipo de item nao suportado para retirada." };
    }

    revalidatePath(`/jogadores/${playerId}`);
    revalidatePath("/inventario");
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

// ── Admin: grant/revoke eggs ─────────────────────────────────────────────

export async function grantEggToPlayer(playerId: string, eggType: string, quantity = 1): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const mapped = EGG_TYPE_MAP[eggType] ?? (Object.values(EggType).includes(eggType as EggType) ? eggType as EggType : null);
    if (!mapped) return { error: `Tipo de ovo inválido: ${eggType}` };

    for (let i = 0; i < Math.min(quantity, 20); i++) {
      await prisma.mascotEgg.create({
        data: { playerId, type: mapped as EggType, origin: "ADMIN_GRANT" },
      });
    }

    revalidatePath(`/jogadores/${playerId}`);
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao conceder ovo." };
  }
}

export async function revokeEggFromPlayer(playerId: string, eggId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const egg = await prisma.mascotEgg.findUnique({ where: { id: eggId } });
    if (!egg || egg.playerId !== playerId) return { error: "Ovo não encontrado." };

    // Check not incubating
    const incubating = await prisma.mascotIncubator.findFirst({ where: { eggId } });
    if (incubating) return { error: "Este ovo está na incubadora. Remova primeiro." };

    await prisma.mascotEgg.delete({ where: { id: eggId } });
    revalidatePath(`/jogadores/${playerId}`);
    revalidatePath("/mascotes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao remover ovo." };
  }
}

// ── Admin: grant/revoke food ─────────────────────────────────────────────

export async function grantFoodToPlayer(playerId: string, foodType: "FOOD" | "SWEET", quantity = 1): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.mascotFoodItem.upsert({
      where: { playerId_type: { playerId, type: foodType as FoodType } },
      create: { playerId, type: foodType as FoodType, quantity },
      update: { quantity: { increment: quantity } },
    });
    revalidatePath(`/jogadores/${playerId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao conceder comida." };
  }
}

export async function revokeFoodFromPlayer(playerId: string, foodType: "FOOD" | "SWEET", quantity = 1): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const item = await prisma.mascotFoodItem.findUnique({
      where: { playerId_type: { playerId, type: foodType as FoodType } },
    });
    if (!item || item.quantity <= 0) return { error: "Jogador não possui este item." };
    const newQty = item.quantity - quantity;
    if (newQty <= 0) {
      await prisma.mascotFoodItem.delete({ where: { playerId_type: { playerId, type: foodType as FoodType } } });
    } else {
      await prisma.mascotFoodItem.update({
        where: { playerId_type: { playerId, type: foodType as FoodType } },
        data: { quantity: newQty },
      });
    }
    revalidatePath(`/jogadores/${playerId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao remover comida." };
  }
}
