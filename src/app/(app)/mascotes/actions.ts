"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getSessionPlayer } from "@/lib/session";
import {
  startIncubation, hatchEgg, equipMascot, unequipMascot,
  interactWithMascot, startExpedition, claimExpedition, recalculateMood,
  skipExpedition, cancelExpedition, addExp, battleMascots, formFriendship, triggerSocialEvents,
  applyLuckyEgg, applyWeaknessPolicy, applyPicnicBasket, applyVacationTicket,
  claimVacation, applyXpShare, removeXpShare, applyRainbowFeather,
} from "@/lib/mascot";
import { healMascotSus } from "@/lib/arena-z";
import type { InteractionType, ExpeditionDuration } from "@/lib/mascot";

function revalidate(playerId?: string) {
  revalidatePath("/mascotes");
  revalidateTag("arena-active-teams");
  if (playerId) revalidateTag(`player-mascots-${playerId}`);
}

export async function putEggInIncubator(eggId: string, genOverride?: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    // Bloqueia ovos que estão em escrow no Bazar
    const egg = await prisma.mascotEgg.findUnique({ where: { id: eggId }, select: { origin: true, playerId: true } });
    if (!egg || egg.playerId !== player.id) return { error: "Ovo não encontrado." };
    if (egg.origin?.startsWith("bazar:")) {
      return { error: "Este ovo está anunciado no Bazar. Cancele o anúncio antes de usá-lo." };
    }

    // Se jogador escolheu uma geração específica, atualiza o tipo do ovo antes de incubar
    if (genOverride) {
      const validGens = ["EGG_GEN1","EGG_GEN2","EGG_GEN3","EGG_GEN4","EGG_GEN5","EGG_GEN6","EGG_GEN7","EGG_GEN8","EGG_GEN9","EGG_GEN6PLUS"];
      if (validGens.includes(genOverride)) {
        await prisma.mascotEgg.update({
          where: { id: eggId },
          data: { type: genOverride as import("@prisma/client").EggType }
        });
      }
    }

    await startIncubation(player.id, eggId);
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function hatchEggAction(): Promise<{
  error?: string;
  result?: Awaited<ReturnType<typeof hatchEgg>>;
  labChoices?: number[];
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    // Ovo do laboratório: apresenta 3 opções ao jogador antes de criar o mascote
    const incubator = await prisma.mascotIncubator.findUnique({
      where: { playerId: player.id },
      include: { egg: { select: { origin: true, type: true } } },
    });
    if (!incubator) return { error: "Sem ovo na incubadora." };
    if (incubator.egg.type === "LAB") {
      const { rollLabEggChoice } = await import("@/lib/mascot");
      const seen = new Set<number>();
      const choices: number[] = [];
      while (choices.length < 3) {
        const id = rollLabEggChoice();
        if (!seen.has(id)) { seen.add(id); choices.push(id); }
      }
      return { labChoices: choices };
    }

    const result = await hatchEgg(player.id);
    revalidate(player.id);
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function confirmLabChoiceAction(chosenPokemonId: number): Promise<{
  error?: string;
  result?: Awaited<ReturnType<typeof hatchEgg>>;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const result = await hatchEgg(player.id, chosenPokemonId);
    revalidate(player.id);
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function skipIncubationAction(): Promise<{ error?: string }> {
  try {
    const user = await requireAdmin();
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nÃ£o encontrado." };

    const incubator = await prisma.mascotIncubator.findUnique({
      where: { playerId: player.id },
      select: { id: true }
    });
    if (!incubator) return { error: "Nenhum ovo na incubadora." };

    await prisma.mascotIncubator.update({
      where: { playerId: player.id },
      data: { finishAt: new Date() }
    });

    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function equipMascotAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await equipMascot(player.id, mascotId);
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function renameMascotAction(mascotId: string, nickname: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    await prisma.mascot.update({ where: { id: mascotId }, data: { nickname: nickname.trim().slice(0, 20) || null } });
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function toggleFavoriteMascotAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };

    const mascot = await prisma.mascot.findUnique({
      where: { id: mascotId },
      select: { id: true, playerId: true, isFavorite: true },
    });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote nao encontrado." };

    if (!mascot.isFavorite) {
      const favoriteCount = await prisma.mascot.count({ where: { playerId: player.id, isFavorite: true } });
      if (favoriteCount >= 6) return { error: "Voce ja tem 6 mascotes favoritos. Remova um favorito antes." };
    }

    await prisma.mascot.update({
      where: { id: mascotId },
      data: { isFavorite: !mascot.isFavorite },
    });
    revalidate(player.id);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao favoritar." };
  }
}

export async function interactAction(
  mascotId: string,
  type: InteractionType
): Promise<{ error?: string; result?: Awaited<ReturnType<typeof interactWithMascot>> }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!player) return { error: "Perfil não encontrado." };

    // Não recalcula mood antes de alimentar — o decay comeria o ganho de felicidade
    if (type !== "FEED_FOOD" && type !== "FEED_SWEET") {
      await recalculateMood(mascotId);
    }

    const isAdminUser = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const result = await interactWithMascot(player.id, mascotId, type, isAdminUser);

    revalidate(player.id);
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function interactAllAction(
  type: InteractionType,
  scope: "ALL" | "FAVORITES" = "FAVORITES"
): Promise<{
  error?: string;
  results: { mascotId: string; name: string; success: boolean; message: string }[];
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado.", results: [] };

    const player = await prisma.player.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!player) return { error: "Perfil não encontrado.", results: [] };

    const where =
      scope === "FAVORITES"
        ? { playerId: player.id, isFavorite: true }
        : { playerId: player.id };

    const mascots = await prisma.mascot.findMany({
      where,
      select: {
        id: true,
        nickname: true,
        pokemonId: true,
        isFavorite: true,
      },
      orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
      take: scope === "FAVORITES" ? 6 : 100,
    });

    const results: {
      mascotId: string;
      name: string;
      success: boolean;
      message: string;
    }[] = [];

    for (const mascot of mascots) {
      try {
        if (type !== "FEED_FOOD" && type !== "FEED_SWEET") {
          await recalculateMood(mascot.id);
        }

        const result = await interactWithMascot(player.id, mascot.id, type);

        results.push({
          mascotId: mascot.id,
          name: mascot.nickname ?? `#${mascot.pokemonId}`,
          success: result.success,
          message: result.message,
        });
      } catch (err) {
        results.push({
          mascotId: mascot.id,
          name: mascot.nickname ?? `#${mascot.pokemonId}`,
          success: false,
          message: err instanceof Error ? err.message : "Erro.",
        });
      }
    }

    revalidate(player.id);
    return { results };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro.",
      results: [],
    };
  }
}

export async function startExpeditionAction(mascotId: string, duration: ExpeditionDuration = "1h", mode: import("@/lib/mascot-data").ExpeditionMode = "STANDARD"): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await startExpedition(player.id, mascotId, duration, mode);
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function healMascotSusAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    await healMascotSus(player.id, mascotId);
    revalidate(player.id);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro no Atendimento SUS." };
  }
}

export async function claimExpeditionAction(expeditionId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof claimExpedition>> }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const result = await claimExpedition(player.id, expeditionId);
    revalidate(player.id);
    revalidatePath("/caixa-de-presentes");
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function unequipMascotAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await unequipMascot(player.id, mascotId);
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function cancelExpeditionAction(expeditionId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await cancelExpedition(player.id, expeditionId);
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function skipExpeditionAction(expeditionId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await skipExpedition(expeditionId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function adminStartExpeditionAction(
  mascotId: string,
  duration: ExpeditionDuration = "1h",
  mode: import("@/lib/mascot-data").ExpeditionMode = "STANDARD",
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId }, select: { playerId: true } });
    if (!mascot) return { error: "Mascote nao encontrado." };
    await startExpedition(mascot.playerId, mascotId, duration, mode);
    revalidate(mascot.playerId);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function adminCancelExpeditionAction(expeditionId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const expedition = await prisma.mascotExpedition.findUnique({
      where: { id: expeditionId },
      include: { mascot: { select: { playerId: true } } },
    });
    if (!expedition) return { error: "Expedicao nao encontrada." };
    await cancelExpedition(expedition.mascot.playerId, expeditionId);
    revalidate(expedition.mascot.playerId);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function adminClaimExpeditionAction(expeditionId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof claimExpedition>> }> {
  try {
    await requireAdmin();
    const expedition = await prisma.mascotExpedition.findUnique({
      where: { id: expeditionId },
      include: { mascot: { select: { playerId: true } } },
    });
    if (!expedition) return { error: "Expedicao nao encontrada." };
    if (new Date() < expedition.finishAt) await skipExpedition(expeditionId);
    const result = await claimExpedition(expedition.mascot.playerId, expeditionId);
    revalidate(expedition.mascot.playerId);
    revalidatePath("/caixa-de-presentes");
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function addExpAdminAction(mascotId: string, amount: number): Promise<{ error?: string; result?: Awaited<ReturnType<typeof addExp>> }> {
  try {
    await requireAdmin();
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Informe uma quantidade positiva de EXP." };
    if (amount > 100000) return { error: "Limite por ajuste: 100000 EXP." };
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot) return { error: "Mascote nao encontrado." };
    const cleanAmount = Math.floor(amount);
    const result = await addExp(mascotId, cleanAmount, { ignoreBenchPenalty: true });
    await prisma.mascotEvent.create({
      data: {
        mascotId,
        emoji: "ADM",
        description: `Ajuste admin: +${cleanAmount} EXP${result.leveled ? `, nivel ${result.newLevel}` : ""}${result.evolved ? " e evolucao aplicada" : ""}.`,
      },
    });
    revalidate(mascot.playerId);
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: batalha manual entre mascotes
export async function adminBattleMascotsAction(mascotAId: string, mascotBId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof battleMascots>> }> {
  try {
    await requireAdmin();
    const result = await battleMascots(mascotAId, mascotBId);
    revalidate();
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: formar amizade entre mascotes
export async function adminFormFriendshipAction(mascotAId: string, mascotBId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await formFriendship(mascotAId, mascotBId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Usar buff em um mascote
export async function useMascotBuffAction(mascotId: string, itemId: string): Promise<{ error?: string; replacedExistingBuff?: boolean }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const [mascot, inventoryItem] = await Promise.all([
      prisma.mascot.findUnique({ where: { id: mascotId } }),
      prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId } }, include: { item: true } }),
    ]);
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    if (!inventoryItem || inventoryItem.quantity <= 0) return { error: "Você não tem este item." };

    const BUFF_CONFIG: Record<string, { type: "EXP_BOOST"|"STAT_BOOST"|"HAPPINESS"|"LUCK_BOOST"|"MOOD_RESET"; hours: number; label: string }> = {
      // ⚡ Vitamina Elétrica: +25% EXP por 2h (percentual e duração config via ShopItem.metadata)
      MASCOT_BUFF_EXP:   { type: "EXP_BOOST",  hours: 2, label: "Vitamina Elétrica — +25% EXP por 2h" },
      // Proteina Zika: +2 permanente em todos os 5 atributos, limitada a 3 mascotes por jogador.
      MASCOT_BUFF_STAT:  { type: "STAT_BOOST",  hours: 0, label: "Proteina Zika - +2 permanente em todos os atributos" },
      // 🍯 Bala de Mel: felicidade vai para 100 imediatamente + humor HAPPY
      MASCOT_BUFF_HAPPY: { type: "HAPPINESS",   hours: 0, label: "Bala de Mel — felicidade máxima instantânea" },
      // 🍀 Amuleto da Sorte: chance dobrada de loot raro em expedições por 6h
      MASCOT_BUFF_LUCK:  { type: "LUCK_BOOST",  hours: 6, label: "Amuleto da Sorte — loot raro dobrado por 6h" },
      // 💧 Água Sagrada: remove humor negativo (Bravo/Cansado/Carente) imediatamente
      MASCOT_BUFF_MOOD:  { type: "MOOD_RESET",  hours: 0, label: "Água Sagrada — remove humor negativo" },
    };

    const config = BUFF_CONFIG[inventoryItem.item.type];
    if (!config) return { error: "Este item nao e um buff." };

    if (inventoryItem.item.type === "MASCOT_BUFF_STAT") {
      // Rastreamento confiável via MascotBuff (expiresAt permanente = 2099)
      // Cada mascote pode receber até 3 doses de Proteína Zika
      const proteinDosesOnThisMascot = await prisma.mascotBuff.count({
        where: {
          mascotId,
          type: "STAT_BOOST",
          expiresAt: { gt: new Date("2090-01-01") }, // marcador permanente
        },
      });
      if (proteinDosesOnThisMascot >= 3) {
        return { error: "Este mascote ja recebeu o limite de 3 doses de Proteina Zika." };
      }
    }

    const itemMeta = inventoryItem.item.metadata as { buffHours?: number } | null;
    const effectiveHours = itemMeta?.buffHours ?? config.hours;
    const expiresAt = new Date(Date.now() + effectiveHours * 3_600_000);

    // Verifica se há EXP_BOOST ativo para informar o cliente que será substituído
    let replacedExistingBuff = false;
    if (config.type === "EXP_BOOST") {
      const existing = await prisma.mascotBuff.findFirst({ where: { mascotId, type: "EXP_BOOST", expiresAt: { gt: new Date() } } });
      if (existing) replacedExistingBuff = true;
    }

    await prisma.$transaction(async (tx) => {
      // Remove 1 do inventário
      await tx.playerInventory.update({
        where: { playerId_itemId: { playerId: player.id, itemId } },
        data: { quantity: { decrement: 1 } }
      });

      if (config.type === "MOOD_RESET") {
        // Efeito imediato — remove humores negativos
        await tx.mascot.update({ where: { id: mascotId }, data: { mood: "NEUTRAL", happiness: Math.min(100, mascot.happiness + 20) } });
      } else if (config.type === "HAPPINESS") {
        await tx.mascot.update({ where: { id: mascotId }, data: { happiness: 100, mood: "HAPPY" } });
      } else if (config.type === "STAT_BOOST") {
        await tx.mascot.update({
          where: { id: mascotId },
          data: {
            statForce: { increment: 2 }, statAgility: { increment: 2 },
            statCharisma: { increment: 2 }, statInstinct: { increment: 2 }, statVitality: { increment: 2 }
          }
        });
      }

      // Salva buff com expiração (para EXP_BOOST e LUCK_BOOST)
      // EXP_BOOST substitui qualquer buff ativo do mesmo tipo (sem acúmulo)
      // STAT_BOOST também grava com expiresAt permanente (2099) como marcador confiável de limite
      if (config.hours > 0) {
        if (config.type === "EXP_BOOST") {
          // Apaga buff anterior antes de criar novo (sem acúmulo de Vitaminas)
          await tx.mascotBuff.deleteMany({ where: { mascotId, type: "EXP_BOOST" } });
        }
        await tx.mascotBuff.create({ data: { mascotId, type: config.type, expiresAt } });
      } else if (config.type === "STAT_BOOST") {
        await tx.mascotBuff.create({
          data: { mascotId, type: "STAT_BOOST", expiresAt: new Date("2099-12-31T23:59:59Z") }
        });
      }

      // Log evento
      await tx.mascotEvent.create({ data: { mascotId, emoji: "✨", description: `Usou ${config.label}!` } });
    });

    revalidate(player.id);
    return { replacedExistingBuff };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// ── Novos itens especiais ─────────────────────────────────────────────────────

export async function useLuckyEggAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    // Consome 1 do inventário
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "LUCKY_EGG", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Ovo da Sorte no inventário." };
    await applyLuckyEgg(player.id, mascotId);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function useWeaknessPolicyAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "WEAKNESS_POLICY", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Política de Fraqueza no inventário." };
    await applyWeaknessPolicy(player.id, mascotId);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function usePicnicBasketAction(): Promise<{ error?: string; mascotCount?: number }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "PICNIC_BASKET", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Cesta de Piquenique no inventário." };
    const count = await applyPicnicBasket(player.id);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return { mascotCount: count };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function useVacationTicketAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "VACATION_TICKET", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Ticket de Férias no inventário." };
    await applyVacationTicket(player.id, mascotId);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function claimVacationAction(expeditionId: string): Promise<{ error?: string; reward?: { expBonus: number; gotEgg: boolean } }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const reward = await claimVacation(player.id, expeditionId);
    revalidate(player.id); return { reward };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function useXpShareAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "XP_SHARE", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Compartilhador de XP no inventário." };
    await applyXpShare(player.id, mascotId);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function removeXpShareAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    await removeXpShare(player.id, mascotId);
    // Devolve o item ao inventário do jogador
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "XP_SHARE", active: true }, select: { id: true } });
    if (shopItem) {
      await prisma.playerInventory.upsert({
        where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } },
        update: { quantity: { increment: 1 } },
        create: { playerId: player.id, itemId: shopItem.id, quantity: 1 },
      });
    }
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function useRainbowFeatherAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "RAINBOW_FEATHER", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Pena Arco-Íris no inventário." };
    await applyRainbowFeather(player.id, mascotId);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: limpa todas as expedições ativas de um jogador (para corrigir bugs)
export async function adminClearExpeditionsAction(playerId: string): Promise<{ error?: string; cleared: number }> {
  try {
    await requireAdmin();
    const result = await prisma.mascotExpedition.updateMany({
      where: { mascot: { playerId }, status: "ACTIVE" },
      data: { status: "CLAIMED", rewardJson: { type: "NOTHING" } }
    });
    revalidate(playerId);
    return { cleared: result.count };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro.", cleared: 0 }; }
}

// Admin: disparar eventos sociais entre mascotes
export async function adminTriggerSocialEventsAction(): Promise<{ error?: string; summary?: { battles: number; friendships: number; events: string[] } }> {
  try {
    await requireAdmin();
    const summary = await triggerSocialEvents();
    revalidate();
    return { summary };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: dar ovo a um jogador
export async function grantEggToPlayer(playerId: string, eggType: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return { error: "Sem permissão." };
    const mappedType = eggType === "EGG_LAB" ? "LAB" : eggType;
    await prisma.mascotEgg.create({
      data: {
        playerId,
        type: mappedType as import("@prisma/client").EggType,
        origin: "Admin",
      },
    });
    revalidate(playerId);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// ── Carregamento sob demanda de um mascote do banco ─────────────────────────
// Chamado pelo cliente apenas ao clicar no mascote, evitando carregar todos.
export async function getMascotDetailAction(mascotId: string): Promise<{
  error?: string;
  data?: {
    id: string; pokemonId: number; nickname: string | null;
    level: number; exp: number; happiness: number; mood: string; personality: string;
    isEquipped: boolean; isFavorite: boolean;
    statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number;
    battleWins: number; battleLosses: number;
    arenaState: string; bazarListed: boolean;
    injuredAt: Date | null; restingUntil: Date | null; hatchedAt: Date;
    lastInteractedAt: Date | null; lastPlayedAt: Date | null; lastPettedAt: Date | null; lastFedAt: Date | null; socialCooldownUntil: Date | null;
    evolutionLocked: boolean; expLocked: boolean; isShiny: boolean;
    activeBuffs: { type: string; expiresAt: Date }[];
    relations: { type: string; interactionCount: number; mascotB: { id: string; pokemonId: number; nickname: string | null; ownerName: string; ownerId: string } }[];
    expeditions: { id: string; finishAt: Date; status: string; mode: string }[];
    events: { id: string; emoji: string; description: string; createdAt: Date }[];
  };
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const m = await prisma.mascot.findUnique({
      where: { id: mascotId },
      include: {
        expeditions: { where: { status: "ACTIVE" }, take: 1, select: { id: true, finishAt: true, status: true, rewardJson: true } },
        relationsAsA: {
          take: 5,
          include: { mascotB: { select: { id: true, pokemonId: true, nickname: true, player: { select: { id: true, displayName: true } } } } },
        },
      },
    });
    if (!m || m.playerId !== player.id) return { error: "Mascote não encontrado." };

    const activeBuffs = await prisma.mascotBuff.findMany({
      where: { mascotId, expiresAt: { gt: new Date() } },
      select: { type: true, expiresAt: true },
    });

    return {
      data: {
        id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
        level: m.level, exp: m.exp, happiness: m.happiness,
        mood: m.mood, personality: m.personality, isEquipped: m.isEquipped, isFavorite: m.isFavorite,
        statForce: m.statForce, statAgility: m.statAgility, statCharisma: m.statCharisma,
        statInstinct: m.statInstinct, statVitality: m.statVitality,
        battleWins: m.battleWins, battleLosses: m.battleLosses,
        arenaState: m.arenaState, bazarListed: m.bazarListed,
        injuredAt: m.injuredAt, restingUntil: m.restingUntil, hatchedAt: m.hatchedAt,
        lastInteractedAt: m.lastInteractedAt,
        lastPlayedAt: null,
        lastPettedAt:  null,
        lastFedAt: m.lastFedAt, socialCooldownUntil: m.socialCooldownUntil,
        evolutionLocked: m.evolutionLocked, expLocked: m.expLocked, isShiny: m.isShiny,
        activeBuffs,
        relations: m.relationsAsA.map(r => ({
          type: r.type, interactionCount: r.interactionCount,
          mascotB: { id: r.mascotB.id, pokemonId: r.mascotB.pokemonId, nickname: r.mascotB.nickname, ownerName: r.mascotB.player.displayName, ownerId: r.mascotB.player.id },
        })),
        expeditions: m.expeditions.map(e => ({
          id: e.id, finishAt: e.finishAt, status: e.status,
          mode: (e.rewardJson as Record<string, unknown> | null)?.mode as string ?? "STANDARD",
        })),
        events: [],
      },
    };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function toggleExpLockAction(mascotId: string, lock: boolean): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    await prisma.mascot.update({ where: { id: mascotId }, data: { expLocked: lock } });
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function toggleEvolutionLockAction(mascotId: string, lock: boolean): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    await prisma.mascot.update({ where: { id: mascotId }, data: { evolutionLocked: lock } });
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function feedAllAction(): Promise<{
  error?: string; fed: number; skipped: number; noFood: boolean;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado.", fed: 0, skipped: 0, noFood: false };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado.", fed: 0, skipped: 0, noFood: false };

    // Verifica estoque de comida
    const food = await prisma.mascotFoodItem.findUnique({
      where: { playerId_type: { playerId: player.id, type: "FOOD" } },
    });
    if (!food || food.quantity <= 0) {
      return { fed: 0, skipped: 0, noFood: true };
    }

    // Busca todos os mascotes não empanturrados (lastFedAt <= 2h atrás = disponível)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const mascots = await prisma.mascot.findMany({
      where: {
        playerId: player.id,
        arenaState: { notIn: ["INJURED", "ARENA"] },
        OR: [{ lastFedAt: null }, { lastFedAt: { lt: twoHoursAgo } }],
      },
      select: { id: true, pokemonId: true },
      orderBy: [{ isEquipped: "desc" }, { isFavorite: "desc" }, { level: "desc" }],
    });

    const toFeed = mascots.slice(0, food.quantity); // não alimenta mais do que tem no estoque
    if (toFeed.length === 0) {
      return { fed: 0, skipped: mascots.length, noFood: false };
    }

    // Alimenta em batch
    await prisma.$transaction(async (tx) => {
      // Decrementa estoque
      await tx.mascotFoodItem.update({
        where: { playerId_type: { playerId: player.id, type: "FOOD" } },
        data: { quantity: { decrement: toFeed.length } },
      });
      // Atualiza cada mascote individualmente para poder clampar happiness
      const now = new Date();
      await Promise.all(toFeed.map(m =>
        tx.mascot.update({
          where: { id: m.id },
          data: {
            happiness: { increment: 20 },
            lastFedAt: now,
          },
        })
      ));
    });

    revalidate(player.id);
    return { fed: toFeed.length, skipped: mascots.length - toFeed.length, noFood: false };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro.", fed: 0, skipped: 0, noFood: false };
  }
}
