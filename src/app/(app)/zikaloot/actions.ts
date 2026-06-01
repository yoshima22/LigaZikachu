"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { ZikaLootStatus, ZikaCoinTxType, ShopItemType, Prisma } from "@prisma/client";
import { creditCoins } from "@/lib/zikacoins";
import { onLootWon } from "@/lib/achievement-events";
import { sendNotificationToUser } from "@/lib/notifications";
import type { PrizeConfig } from "@/lib/zikaloot-types";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  prize: z.string().trim().min(1).max(500),
  drawAt: z.string().datetime(),
  prizeConfig: z.record(z.unknown()).optional()
});

export async function createZikaLoot(raw: z.infer<typeof createSchema>): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = createSchema.parse(raw);
    const { prizeConfig: rawPrize, ...rest } = data;
    await prisma.zikaLoot.create({
      data: {
        ...rest,
        description: rest.description ?? null,
        prizeConfig: rawPrize ? (rawPrize as Prisma.InputJsonValue) : Prisma.JsonNull,
        createdById: actor.id
      }
    });
    revalidatePath("/zikaloot");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Escolher número ────────────────────────────────────────────────────────────

export async function pickLootNumber(
  lootId: string,
  number: number
): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };
    if (number < 1 || number > 200) return { error: "Número deve ser entre 1 e 200." };

    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
    if (!player) return { error: "Jogador não encontrado." };

    const loot = await prisma.zikaLoot.findUnique({ where: { id: lootId } });
    if (!loot) return { error: "Loteria não encontrada." };
    if (loot.status !== ZikaLootStatus.SCHEDULED)
      return { error: "Esta loteria não está mais aceitando escolhas." };
    if (new Date() >= loot.drawAt) return { error: "O prazo para escolher números expirou." };

    // Verificar se tem ticket disponível
    const ticket = await prisma.playerInventory.findFirst({
      where: { playerId: player.id, item: { type: ShopItemType.ZIKALOOT_TICKET } },
      select: { id: true, quantity: true }
    });
    if (!ticket || ticket.quantity < 1) return { error: "Você não possui um Ticket ZikaLoot. Compre um na ZikaShop ou ganhe pela Caixa de Presentes." };

    // Verificar se já escolheu
    const existing = await prisma.zikaLootPick.findUnique({
      where: { lootId_playerId: { lootId, playerId: player.id } }
    });
    if (existing) return { error: `Você já escolheu o número ${existing.number} nesta loteria.` };

    // Verificar se número já foi pego
    const taken = await prisma.zikaLootPick.findUnique({
      where: { lootId_number: { lootId, number } }
    });
    if (taken) return { error: "Este número já foi escolhido por outro jogador." };

    await prisma.$transaction(async (tx) => {
      // Decrementar ticket (ou remover se última unidade)
      if (ticket.quantity > 1) {
        await tx.playerInventory.update({ where: { id: ticket.id }, data: { quantity: { decrement: 1 } } });
      } else {
        await tx.playerInventory.delete({ where: { id: ticket.id } });
      }
      await tx.zikaLootPick.create({ data: { lootId, playerId: player.id, number } });
    });

    revalidatePath("/zikaloot");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Executar sorteio (admin ou cron) ──────────────────────────────────────────

export async function runDraw(lootId: string): Promise<{ drawnNumber: number; winner: string | null; error?: string }> {
  try {
    const loot = await prisma.zikaLoot.findUnique({
      where: { id: lootId },
      include: { picks: { include: { player: { select: { id: true, displayName: true, userId: true } } } } }
    });
    if (!loot) return { drawnNumber: 0, winner: null, error: "Loteria não encontrada." };
    if (loot.status !== ZikaLootStatus.SCHEDULED)
      return { drawnNumber: 0, winner: null, error: "Loteria já foi executada." };

    // Sortear número de 1 a 200
    const drawnNumber = Math.floor(Math.random() * 200) + 1;
    const winningPick = loot.picks.find((p) => p.number === drawnNumber);

    if (winningPick) {
      const rawConfig = loot.prizeConfig as PrizeConfig | null;
      // Suporta tanto { prizes: [] } (novo) quanto item único (legado)
      const prizes: import("@/lib/zikaloot-types").PrizeItem[] =
        rawConfig?.prizes?.length ? rawConfig.prizes
        : rawConfig ? [rawConfig as unknown as import("@/lib/zikaloot-types").PrizeItem]
        : [];

      await prisma.$transaction(async (tx) => {
        await tx.zikaLoot.update({
          where: { id: lootId },
          data: { status: ZikaLootStatus.DRAWN, drawnNumber, winnerId: winningPick.playerId }
        });

        // Processar cada prêmio da lista
        for (const prize of prizes) {
          if (prize.type === "COINS") {
            await creditCoins(tx, {
              playerId: winningPick.playerId,
              type: ZikaCoinTxType.ACHIEVEMENT_REWARD,
              amount: prize.amount,
              description: `Prêmio ZikaLoot: ${loot.name}`
            });
            await tx.playerGift.create({ data: {
              playerId: winningPick.playerId, type: "CUSTOM",
              title: `🎉 ZikaLoot: ${loot.name}`,
              description: `Parabéns! Você recebeu ${prize.amount} ZikaCoins!`,
              payload: { lootId, drawnNumber }
            }});
          } else if (prize.type === "STICKER") {
            await tx.playerGift.create({ data: {
              playerId: winningPick.playerId, type: "STICKER",
              title: `🎉 ZikaLoot: ${loot.name}`,
              description: `Você ganhou a figurinha ${prize.cardName}!`,
              payload: { lootId, drawnNumber, cardId: prize.cardId, cardName: prize.cardName }
            }});
          } else if (prize.type === "TICKET" || prize.type === "COSMETIC") {
            const item = await tx.shopItem.findUnique({ where: { id: prize.itemId } });
            if (item) {
              await tx.playerInventory.upsert({
                where: { playerId_itemId: { playerId: winningPick.playerId, itemId: item.id } },
                update: { quantity: { increment: 1 } },
                create: { playerId: winningPick.playerId, itemId: item.id, quantity: 1 }
              });
              await tx.playerGift.create({ data: {
                playerId: winningPick.playerId, type: "CUSTOM",
                title: `🎉 ZikaLoot: ${loot.name}`,
                description: `Você ganhou: ${item.name}! Verifique seu inventário.`,
                payload: { lootId, drawnNumber, itemId: item.id }
              }});
            }
          } else if (prize.type === "CUSTOM") {
            await tx.playerGift.create({ data: {
              playerId: winningPick.playerId, type: "CUSTOM",
              title: `🎉 ZikaLoot: ${loot.name}`,
              description: prize.description || `Você ganhou! Prêmio: ${loot.prize}`,
              payload: { lootId, drawnNumber }
            }});
          }
        }

        // Fallback se não há prizeConfig: notificação simples
        if (prizes.length === 0) {
          await tx.playerGift.create({ data: {
            playerId: winningPick.playerId, type: "CUSTOM",
            title: `🎉 ZikaLoot: ${loot.name}`,
            description: `Você ganhou! Número ${drawnNumber} sorteado. Prêmio: ${loot.prize}`,
            payload: { lootId, drawnNumber, prize: loot.prize }
          }
          });
        }
      });
      // Emitir evento de conquista
      void onLootWon(winningPick.player.id).catch(() => {});

      // Push notification para o vencedor
      await sendNotificationToUser(winningPick.player.userId, {
        title: "🏆 Você ganhou na ZikaLoot!",
        body: `Número ${drawnNumber} sorteado em "${loot.name}". Verifique sua Caixa de Presentes!`,
        url: "/caixa-de-presentes"
      });

      revalidatePath("/zikaloot");
      return { drawnNumber, winner: winningPick.player.displayName };
    } else {
      // Ninguém escolheu — bloquear número, agendar novo sorteio em 24h
      const nextDraw = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.zikaLoot.update({
        where: { id: lootId },
        data: {
          drawnNumber,
          drawnNumbers: { push: drawnNumber },
          // Manter SCHEDULED e atualizar drawAt para 24h depois
          drawAt: nextDraw
        }
      });
      revalidatePath("/zikaloot");
      return { drawnNumber, winner: null };
    }
  } catch (err) {
    return { drawnNumber: 0, winner: null, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Editar loteria (apenas SCHEDULED) ────────────────────────────────────────

export async function updateZikaLoot(
  lootId: string,
  raw: { name: string; description?: string; prize: string; drawAt: string; prizeConfig?: Record<string, unknown> }
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const loot = await prisma.zikaLoot.findUnique({ where: { id: lootId }, select: { status: true } });
    if (!loot) return { error: "Loteria não encontrada." };
    if (loot.status !== "SCHEDULED") return { error: "Só é possível editar loterias aguardando sorteio." };

    await prisma.zikaLoot.update({
      where: { id: lootId },
      data: {
        name: raw.name.trim(),
        description: raw.description?.trim() || null,
        prize: raw.prize.trim(),
        drawAt: new Date(raw.drawAt),
        prizeConfig: raw.prizeConfig ? (raw.prizeConfig as Prisma.InputJsonValue) : undefined,
      }
    });
    revalidatePath("/zikaloot");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Cancelar loteria ──────────────────────────────────────────────────────────

export async function deleteZikaLoot(lootId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.zikaLoot.delete({ where: { id: lootId } });
    revalidatePath("/zikaloot");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Executar sorteios pendentes (chamado ao carregar a página) ─────────────────

export async function checkAndRunPendingDraws(): Promise<void> {
  try {
    const now = new Date();
    const due = await prisma.zikaLoot.findMany({
      where: { status: ZikaLootStatus.SCHEDULED, drawAt: { lte: now } },
      select: { id: true }
    });
    for (const loot of due) {
      await runDraw(loot.id);
    }
  } catch { /* silently ignore */ }
}

export async function cancelZikaLoot(lootId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const loot = await prisma.zikaLoot.findUnique({
      where: { id: lootId },
      include: { picks: true }
    });
    if (!loot) return { error: "Loteria não encontrada." };
    if (loot.status === ZikaLootStatus.DRAWN) return { error: "Não é possível cancelar uma loteria já sorteada." };

    await prisma.$transaction(async (tx) => {
      // Devolver tickets aos jogadores que escolheram
      for (const pick of loot.picks) {
        const ticketItem = await tx.shopItem.findFirst({ where: { type: ShopItemType.ZIKALOOT_TICKET, active: true } });
        if (ticketItem) {
          await tx.playerInventory.create({
            data: { playerId: pick.playerId, itemId: ticketItem.id }
          });
        }
      }
      await tx.zikaLoot.update({ where: { id: lootId }, data: { status: ZikaLootStatus.CANCELLED } });
    });

    revalidatePath("/zikaloot");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
