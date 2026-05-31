/**
 * Sistema de eventos de conquistas automáticas.
 * Emita um evento sempre que o jogador realizar uma ação relevante.
 * O sistema verifica se alguma conquista automática deve ser desbloqueada.
 */

import { prisma } from "@/lib/prisma";
import { AchievementEventType, ZikaCoinTxType } from "@prisma/client";

// ── Emitir evento e verificar conquistas ─────────────────────────────────────

export async function emitAchievementEvent(
  playerId: string,
  eventType: AchievementEventType,
  value = 1,
  metadata?: Record<string, unknown>,
  seasonId?: string
): Promise<void> {
  try {
    // Registrar evento
    await prisma.achievementEvent.create({
      data: { playerId, eventType, value, metadata: metadata ?? null, seasonId: seasonId ?? null }
    });

    // Verificar conquistas automáticas relacionadas a esse evento
    await checkAutomaticAchievements(playerId, eventType, seasonId);
  } catch (e) {
    console.warn("[AchievementEvent] erro ao emitir:", e);
  }
}

// ── Verificar e desbloquear conquistas ────────────────────────────────────────

async function checkAutomaticAchievements(
  playerId: string,
  eventType: AchievementEventType,
  seasonId?: string
): Promise<void> {
  // Buscar conquistas automáticas que monitoram esse tipo de evento
  const achievements = await prisma.achievement.findMany({
    where: {
      type: "AUTOMATIC",
      active: true,
      rules: { some: { eventType } }
    },
    include: {
      rules: { where: { eventType } },
      rewards: true
    }
  });

  for (const achievement of achievements) {
    const rule = achievement.rules[0];
    if (!rule) continue;

    // Verificar se já possui (para não repetíveis)
    if (!achievement.isRepeatable) {
      const alreadyHas = await prisma.playerAchievement.findFirst({
        where: { achievementId: achievement.id, playerId, seasonId: seasonId ?? null }
      });
      if (alreadyHas) continue;
    }

    // Calcular progresso atual
    const agg = await prisma.achievementEvent.aggregate({
      where: { playerId, eventType, seasonId: seasonId ?? undefined },
      _sum: { value: true }
    });
    const progress = agg._sum.value ?? 0;

    if (progress >= rule.targetValue) {
      // Desbloquear conquista
      await unlockAchievement(playerId, achievement.id, seasonId, progress, achievement.rewards);
    }
  }
}

// ── Desbloquear e entregar recompensas ────────────────────────────────────────

async function unlockAchievement(
  playerId: string,
  achievementId: string,
  seasonId: string | undefined,
  progress: number,
  rewards: Array<{
    id: string; rewardType: string; rewardAmount: number | null;
    rewardItemId: string | null; titleText: string | null; deliverViaGift: boolean;
  }>
): Promise<void> {
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) return;

  await prisma.$transaction(async (tx) => {
    const ua = await tx.playerAchievement.create({
      data: {
        achievementId,
        playerId,
        seasonId: seasonId ?? null,
        progress,
        source: "AUTOMATIC"
      }
    });

    // Entregar recompensas
    for (const reward of rewards) {
      if (!reward.deliverViaGift) continue;
      await tx.playerGift.create({
        data: {
          playerId,
          type: "CUSTOM",
          title: `🏆 Conquista: ${achievement.name}`,
          description: buildRewardDescription(reward),
          payload: {
            achievementId,
            playerAchievementId: ua.id,
            rewardType: reward.rewardType,
            rewardAmount: reward.rewardAmount,
            rewardItemId: reward.rewardItemId,
            titleText: reward.titleText
          }
        }
      });
    }
  });
}

function buildRewardDescription(reward: {
  rewardType: string; rewardAmount: number | null;
  rewardItemId: string | null; titleText: string | null
}): string {
  switch (reward.rewardType) {
    case "ZIKA_COINS": return `Você ganhou ${reward.rewardAmount} ZikaCoins!`;
    case "LOOT_TICKET": return `Você ganhou ${reward.rewardAmount ?? 1} ticket(s) da ZikaLoot!`;
    case "STICKER_PACK": return `Você ganhou ${reward.rewardAmount ?? 1} pacote(s) de figurinhas!`;
    case "SHOP_ITEM": return "Você ganhou um item da ZikaShop! Verifique seu inventário.";
    case "TITLE_TEXT": return `Você desbloqueou o título "${reward.titleText}"!`;
    default: return "Recompensa desbloqueada! Verifique sua Caixa de Presentes.";
  }
}

// ── Helpers para hookar nas actions existentes ─────────────────────────────────

export async function onShopPurchase(playerId: string, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.SHOP_ITEM_PURCHASED, 1, undefined, seasonId);
}

export async function onCoinsSpent(playerId: string, amount: number, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.COINS_SPENT, amount, undefined, seasonId);
}

export async function onCoinsEarned(playerId: string, amount: number, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.COINS_EARNED, amount, undefined, seasonId);
}

export async function onLootWon(playerId: string, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.LOOT_WON, 1, undefined, seasonId);
}

export async function onStickerPackOpened(playerId: string, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.STICKER_PACK_OPENED, 1, undefined, seasonId);
}

export async function onGiftSent(playerId: string, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.GIFT_SENT, 1, undefined, seasonId);
}

export async function onTitleEquipped(playerId: string, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.TITLE_EQUIPPED, 1, undefined, seasonId);
}

export async function onBannerEquipped(playerId: string, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.BANNER_EQUIPPED, 1, undefined, seasonId);
}

export async function onFrameEquipped(playerId: string, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.FRAME_EQUIPPED, 1, undefined, seasonId);
}

export async function onProfessorUsed(playerId: string, seasonId?: string) {
  await emitAchievementEvent(playerId, AchievementEventType.PROFESSOR_USED, 1, undefined, seasonId);
}
