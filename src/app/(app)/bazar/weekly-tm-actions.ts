"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma, ZikaCoinTxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { creditCoins } from "@/lib/zikacoins";
import { changeLigaCash, suggestedLigaCashPrice } from "@/lib/liga-cash-wallet";
import { recordPlayerActivity } from "@/lib/player-activity";
import { filterAvailableTmItems, getDisabledSpeciesIds } from "@/lib/ability-tm-shop";
import { getAbilityInfo, describeAbility } from "@/lib/abilities";
import { getAbilityTmDef, readAbilityTmKey } from "@/lib/abilities/tm";
import { rollDiscountPct, settleVaultForPurchase } from "@/lib/miauvadao-pricing";
import { getWeeklyTmWindow, pickDistinct, WEEKLY_TM_SLOTS, type WeeklyTmSlot, type WeeklyTmView } from "@/lib/weekly-tm";

const SINGLETON = "singleton";

/**
 * Garante os 5 TMs da semana. Só sorteia quando a semana virou (segunda 00:00 de Brasília)
 * e nunca re-sorteia: o primeiro acesso da semana publica o conjunto e os demais o recebem.
 */
export async function ensureWeeklyTmSlots(): Promise<void> {
  try {
    const window = getWeeklyTmWindow();
    const stamp = await prisma.miauvadaoConfig.findUnique({ where: { id: SINGLETON }, select: { weeklyTmWeekStart: true } });
    if (stamp?.weeklyTmWeekStart && stamp.weeklyTmWeekStart >= window.start) return;
    const config = stamp
      ? await prisma.miauvadaoConfig.findUniqueOrThrow({ where: { id: SINGLETON }, select: { vaultBalance: true } })
      : await prisma.miauvadaoConfig.create({ data: { id: SINGLETON }, select: { vaultBalance: true } });

    const candidates = (await filterAvailableTmItems(await prisma.shopItem.findMany({
      where: { type: "ABILITY_TM", active: true },
      select: { id: true, name: true, type: true, price: true, rarity: true, metadata: true },
    }))).filter((item) => readAbilityTmKey(item.metadata));
    // Sem TMs liberados agora: não trava a semana, tenta de novo no próximo acesso.
    if (candidates.length === 0) return;

    const picks = pickDistinct(candidates, WEEKLY_TM_SLOTS);
    // Todos os slots recebem desconto, pela mesma regra dos slots padrão (teto de 20% para TMs).
    const slots: WeeklyTmSlot[] = picks.map((item) => {
      const discountPct = rollDiscountPct({ rarity: item.rarity, capped: true, vaultBalance: config.vaultBalance });
      return {
        shopItemId: item.id,
        abilityKey: readAbilityTmKey(item.metadata)!,
        name: item.name,
        originalPrice: item.price,
        discountPct,
        finalPrice: Math.max(1, Math.round(item.price * (1 - discountPct / 100))),
        sold: 0,
      };
    });
    await prisma.miauvadaoConfig.updateMany({
      where: { id: SINGLETON, OR: [{ weeklyTmWeekStart: null }, { weeklyTmWeekStart: { lt: window.start } }] },
      data: { weeklyTmSlots: slots as unknown as Prisma.InputJsonValue, weeklyTmWeekStart: window.start },
    });
    try { revalidateTag("miauvadao-config"); } catch { /* o sorteio já foi gravado */ }
  } catch (error) {
    console.error("[Miauvadao] Falha ao gerar os TMs da semana.", error);
  }
}

/** Dados da vitrine "TMs da Semana" para o jogador logado (ou visitante). */
export async function getWeeklyTmView(): Promise<WeeklyTmView | null> {
  await ensureWeeklyTmSlots();
  const window = getWeeklyTmWindow();
  const config = await prisma.miauvadaoConfig.findUnique({
    where: { id: SINGLETON },
    select: { weeklyTmSlots: true, weeklyTmWeekStart: true },
  });
  if (!config?.weeklyTmWeekStart || config.weeklyTmWeekStart < window.start) {
    return { weekEndsAt: window.next.toISOString(), slots: [], ligaCashEnabled: false };
  }
  const stored = (Array.isArray(config.weeklyTmSlots) ? config.weeklyTmSlots : []) as unknown as WeeklyTmSlot[];

  const user = await getSessionUser();
  const player = user ? await getSessionPlayer(user.id) : null;
  const [items, disabled, economy] = await Promise.all([
    prisma.shopItem.findMany({
      where: { id: { in: stored.map((slot) => slot.shopItemId) } },
      select: { id: true, name: true, type: true, imageUrl: true, description: true, active: true, metadata: true },
    }),
    getDisabledSpeciesIds(),
    prisma.economySettings.upsert({ where: { id: SINGLETON }, create: { id: SINGLETON }, update: {} }),
  ]);
  const byId = new Map(items.map((item) => [item.id, item]));
  const compat = stored.map((slot) => (getAbilityTmDef(slot.abilityKey)?.pokemonIds ?? []).filter((id) => !disabled.has(id)));
  const allIds = [...new Set(compat.flat())];
  const mine = player && allIds.length
    ? await prisma.mascot.findMany({
        where: { playerId: player.id, pokemonId: { in: allIds } },
        orderBy: [{ level: "desc" }],
        select: { id: true, pokemonId: true, nickname: true, level: true, hiddenAbilityUnlocked: true },
      })
    : [];

  const slots = stored.map((slot, index) => {
    const item = byId.get(slot.shopItemId);
    const info = getAbilityInfo(slot.abilityKey);
    const ids = compat[index];
    const idSet = new Set(ids);
    const available = Boolean(item?.active) && ids.length > 0;
    return {
      index,
      shopItemId: slot.shopItemId,
      abilityKey: slot.abilityKey,
      name: item?.name ?? slot.name,
      imageUrl: item?.imageUrl ?? null,
      ability: info ? {
        name: info.name,
        category: info.category,
        effectName: info.effectName,
        trigger: info.trigger,
        activations: info.activations,
        scale: info.scale,
        dex: info.dex,
        description: describeAbility(info),
      } : null,
      originalPrice: slot.originalPrice,
      discountPct: slot.discountPct,
      finalPrice: slot.finalPrice,
      priceLc: suggestedLigaCashPrice(slot.finalPrice, economy.shopLcValueMultiplier, economy.zcPerLcReference),
      sold: slot.sold === 1,
      soldToName: slot.soldToName ?? null,
      available,
      compatibleIds: ids,
      mine: mine.filter((m) => idSet.has(m.pokemonId)).map((m) => ({
        id: m.id, pokemonId: m.pokemonId, nickname: m.nickname, level: m.level, unlocked: m.hiddenAbilityUnlocked,
      })),
    };
  });
  return { weekEndsAt: window.next.toISOString(), slots, ligaCashEnabled: economy.allowLcShop };
}

/** Compra o TM de um slot da semana. Estoque 1: quem comprar primeiro leva, e o slot some até o reset. */
export async function buyWeeklyTmSlot(slotIndex: number, currency: "ZC" | "LC" = "ZC"): Promise<{ error?: string; price?: number; name?: string }> {
  try {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= WEEKLY_TM_SLOTS) return { error: "Slot inválido." };
    const user = await getSessionUser();
    if (!user) return { error: "Faça login para comprar." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await ensureWeeklyTmSlots();
    const window = getWeeklyTmWindow();

    const result = await prisma.$transaction(async (tx) => {
      const config = await tx.miauvadaoConfig.findUniqueOrThrow({ where: { id: SINGLETON } });
      if (!config.weeklyTmWeekStart || config.weeklyTmWeekStart < window.start) {
        throw new Error("Os TMs da semana acabaram de resetar. Recarregue a página.");
      }
      const slots = (Array.isArray(config.weeklyTmSlots) ? config.weeklyTmSlots : []) as unknown as WeeklyTmSlot[];
      const slot = slots[slotIndex];
      if (!slot) throw new Error("Slot não encontrado.");
      if (slot.sold === 1) throw new Error("Este TM já foi vendido nesta semana.");
      const item = await tx.shopItem.findUnique({ where: { id: slot.shopItemId } });
      if (!item || !item.active || (await filterAvailableTmItems([item])).length === 0) {
        throw new Error("Este TM está indisponível no momento.");
      }

      const economy = await tx.economySettings.upsert({ where: { id: SINGLETON }, create: { id: SINGLETON }, update: {} });
      if (currency === "LC" && !economy.allowLcShop) throw new Error("Pagamentos em LigaCash estão desativados no momento.");
      const price = currency === "LC"
        ? suggestedLigaCashPrice(slot.finalPrice, economy.shopLcValueMultiplier, economy.zcPerLcReference)
        : slot.finalPrice;
      const wallet = currency === "LC"
        ? await tx.ligaCoinWallet.findUnique({ where: { playerId: player.id } })
        : await tx.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
      if (!wallet || wallet.balance < price) {
        throw new Error(`Saldo insuficiente (${wallet?.balance ?? 0} ${currency} disponíveis, o TM custa ${price} ${currency}).`);
      }

      // Só compras em ZC alimentam o cofre (25%), como nos slots padrão.
      const coinsToVault = currency === "ZC" ? Math.floor(price * 0.25) : 0;
      if (currency === "ZC") {
        await creditCoins(tx, {
          playerId: player.id,
          type: ZikaCoinTxType.SHOP_PURCHASE,
          amount: -price,
          description: `Miauvadão: ${item.name} (TM da Semana)`,
        });
      } else {
        await changeLigaCash(tx, {
          playerId: player.id,
          amount: -price,
          reason: "SHOP_PURCHASE",
          referenceType: "MiauvadaoWeeklyTm",
          referenceId: item.id,
          spentDelta: price,
          metadata: { slotIndex, name: item.name },
        });
      }

      await tx.playerInventory.upsert({
        where: { playerId_itemId: { playerId: player.id, itemId: item.id } },
        update: { quantity: { increment: 1 } },
        create: { playerId: player.id, itemId: item.id, quantity: 1, source: "MIAUVADAO" },
      });

      const updated = slots.map((s, i) => (i === slotIndex
        ? { ...s, sold: 1 as const, soldAt: new Date().toISOString(), soldToName: player.displayName }
        : s));
      await tx.miauvadaoConfig.update({
        where: { id: SINGLETON },
        data: {
          weeklyTmSlots: updated as unknown as Prisma.InputJsonValue,
          lastNpcMessage: `${player.displayName} levou o ${item.name}, o TM da semana! 💿`,
          lastNpcMessageAt: new Date(),
        },
      });
      // O desconto concedido sai do cofre do Miauvadão.
      await settleVaultForPurchase(tx, { coinsToVault, discountZc: slot.originalPrice - slot.finalPrice });
      await recordPlayerActivity(tx, {
        playerId: player.id,
        actorUserId: user.id,
        category: "BAZAR",
        action: "MIAUVADAO_WEEKLY_TM_PURCHASE",
        summary: `Comprou ${item.name} (TM da Semana) por ${price} ${currency}`,
        source: "MIAUVADAO_WEEKLY_TM",
        entityType: "shopItem",
        entityId: item.id,
        amount: 1,
        unit: "ITEM",
        metadata: { slotIndex, price, currency, discountPct: slot.discountPct },
      });
      return { price, name: item.name };
    }, { isolationLevel: "Serializable" });

    try { revalidateTag("miauvadao-config"); } catch { /* ignora */ }
    revalidatePath("/bazar");
    revalidatePath("/mascotes");
    return result;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao comprar o TM." };
  }
}
