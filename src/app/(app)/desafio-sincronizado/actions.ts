"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionPlayer } from "@/lib/session";
import { getSessionUser } from "@/lib/auth/permissions";
import { SYNC_TICKET_TYPES, ensureSyncChallengeItems, grantSyncTicket } from "@/lib/sync-challenge";
import type { Prisma } from "@prisma/client";

async function requireCurrentPlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador nao encontrado.");
  return { user, player };
}

async function decrementInventoryItem(
  tx: Prisma.TransactionClient,
  inventoryId: string,
  quantity = 1,
) {
  const row = await tx.playerInventory.findUnique({
    where: { id: inventoryId },
    select: { id: true, quantity: true },
  });
  if (!row || row.quantity < quantity) throw new Error("Quantidade insuficiente.");
  if (row.quantity === quantity) {
    await tx.playerInventory.delete({ where: { id: row.id } });
  } else {
    await tx.playerInventory.update({ where: { id: row.id }, data: { quantity: { decrement: quantity } } });
  }
}

export async function combineSyncTicketsAction(): Promise<{ error?: string; success?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    await prisma.$transaction(async (tx) => {
      const items = await ensureSyncChallengeItems(tx);
      const fire = items.find((item) => item.type === SYNC_TICKET_TYPES.fireLeft);
      const water = items.find((item) => item.type === SYNC_TICKET_TYPES.waterRight);
      const complete = items.find((item) => item.type === SYNC_TICKET_TYPES.complete);
      if (!fire || !water || !complete) throw new Error("Tickets do evento nao encontrados.");

      const [fireInv, waterInv] = await Promise.all([
        tx.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: fire.id } }, select: { id: true, quantity: true } }),
        tx.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: water.id } }, select: { id: true, quantity: true } }),
      ]);
      if (!fireInv?.quantity || !waterInv?.quantity) {
        throw new Error("Voce precisa de 1 ticket de fogo e 1 ticket de agua.");
      }

      await decrementInventoryItem(tx, fireInv.id, 1);
      await decrementInventoryItem(tx, waterInv.id, 1);
      await tx.playerInventory.upsert({
        where: { playerId_itemId: { playerId: player.id, itemId: complete.id } },
        update: { quantity: { increment: 1 } },
        create: { playerId: player.id, itemId: complete.id, quantity: 1 },
      });
    });
    revalidatePath("/desafio-sincronizado");
    revalidatePath("/", "layout");
    return { success: "Ticket completo criado." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao juntar tickets." };
  }
}

const transferSchema = z.object({
  targetPlayerId: z.string().min(1),
  ticketType: z.enum([
    SYNC_TICKET_TYPES.fireLeft,
    SYNC_TICKET_TYPES.waterRight,
    SYNC_TICKET_TYPES.complete,
  ]),
  quantity: z.coerce.number().int().min(1).max(20),
});

export async function transferSyncTicketAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    const data = transferSchema.parse({
      targetPlayerId: formData.get("targetPlayerId"),
      ticketType: formData.get("ticketType"),
      quantity: formData.get("quantity"),
    });
    if (data.targetPlayerId === player.id) return { error: "Escolha outro jogador." };

    await prisma.$transaction(async (tx) => {
      const items = await ensureSyncChallengeItems(tx);
      const item = items.find((row) => row.type === data.ticketType);
      if (!item) throw new Error("Ticket nao encontrado.");

      const source = await tx.playerInventory.findUnique({
        where: { playerId_itemId: { playerId: player.id, itemId: item.id } },
        select: { id: true, quantity: true },
      });
      if (!source || source.quantity < data.quantity) throw new Error("Voce nao possui tickets suficientes.");
      const target = await tx.player.findUnique({ where: { id: data.targetPlayerId }, select: { id: true, displayName: true } });
      if (!target) throw new Error("Jogador de destino nao encontrado.");

      await decrementInventoryItem(tx, source.id, data.quantity);
      await tx.playerInventory.upsert({
        where: { playerId_itemId: { playerId: target.id, itemId: item.id } },
        update: { quantity: { increment: data.quantity } },
        create: { playerId: target.id, itemId: item.id, quantity: data.quantity },
      });
      await tx.playerGift.create({
        data: {
          playerId: target.id,
          type: "CUSTOM",
          title: "Ticket recebido",
          description: `${player.displayName} enviou ${data.quantity}x ${item.name}.`,
          payload: { rewardKind: "SYNC_CHALLENGE_TICKET", itemId: item.id, quantity: data.quantity },
        },
      });
    });
    revalidatePath("/desafio-sincronizado");
    revalidatePath("/caixa-de-presentes");
    revalidatePath("/", "layout");
    return { success: "Ticket enviado." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao enviar ticket." };
  }
}

const consumeSchema = z.object({
  ban1: z.string().trim().min(1).max(60),
  ban2: z.string().trim().min(1).max(60),
  ban3: z.string().trim().min(1).max(60),
});

export async function consumeSyncTicketAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    const bans = consumeSchema.parse({
      ban1: formData.get("ban1"),
      ban2: formData.get("ban2"),
      ban3: formData.get("ban3"),
    });
    const uniqueBans = Array.from(new Set([bans.ban1, bans.ban2, bans.ban3].map((ban) => ban.trim())));
    if (uniqueBans.length !== 3) return { error: "Informe 3 bans diferentes." };

    await prisma.$transaction(async (tx) => {
      const item = await ensureSyncChallengeItems(tx).then((items) => items.find((row) => row.type === SYNC_TICKET_TYPES.complete));
      if (!item) throw new Error("Ticket completo nao encontrado.");
      const inv = await tx.playerInventory.findUnique({
        where: { playerId_itemId: { playerId: player.id, itemId: item.id } },
        select: { id: true, quantity: true },
      });
      if (!inv || inv.quantity < 1) throw new Error("Voce precisa de um ticket completo.");

      await decrementInventoryItem(tx, inv.id, 1);
      await tx.syncChallengeEntry.create({
        data: {
          playerId: player.id,
          consumedItemId: item.id,
          bansJson: { bans: uniqueBans },
        },
      });
    });
    revalidatePath("/desafio-sincronizado");
    revalidatePath("/", "layout");
    return { success: "Entrada registrada e ticket consumido." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao consumir ticket." };
  }
}

export async function grantDebugSyncTicketAction(type: string): Promise<{ error?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    if (![SYNC_TICKET_TYPES.fireLeft, SYNC_TICKET_TYPES.waterRight].includes(type as never)) {
      return { error: "Tipo invalido." };
    }
    await prisma.$transaction((tx) => grantSyncTicket(tx, player.id, type as never, 1));
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao gerar ticket." };
  }
}
