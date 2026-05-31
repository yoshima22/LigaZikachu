"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getSessionUser } from "@/lib/auth/permissions";
import { AchievementType, AchievementRarity, AchievementCategory, AchievementScope } from "@prisma/client";

// ── Criar/editar conquista ────────────────────────────────────────────────────

const achievementSchema = z.object({
  key: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  iconUrl: z.string().url().optional().or(z.literal("")),
  type: z.nativeEnum(AchievementType),
  rarity: z.nativeEnum(AchievementRarity),
  category: z.nativeEnum(AchievementCategory),
  scope: z.nativeEnum(AchievementScope),
  isSecret: z.boolean().default(false),
  isRepeatable: z.boolean().default(false),
  suggestedPoints: z.number().int().min(0).max(100).optional(),
  seasonId: z.string().optional(),
});

export async function createAchievement(raw: z.infer<typeof achievementSchema>): Promise<{ id?: string; error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = achievementSchema.parse(raw);

    const existing = await prisma.achievement.findFirst({
      where: {
        key: data.key,
        seasonId: data.seasonId ?? null
      }
    });
    if (existing) return { error: "Já existe uma conquista com esta chave nesta temporada." };

    const achievement = await prisma.achievement.create({
      data: {
        ...data,
        iconUrl: data.iconUrl || null,
        description: data.description || null,
        seasonId: data.seasonId || null,
        suggestedPoints: data.suggestedPoints ?? null,
        criteria: {},
        createdById: actor.id
      }
    });

    revalidatePath("/conquistas");
    return { id: achievement.id };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function toggleAchievement(id: string, active: boolean): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.achievement.update({ where: { id }, data: { active } });
    revalidatePath("/conquistas");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Atribuir conquista manualmente ────────────────────────────────────────────

const awardSchema = z.object({
  achievementId: z.string().min(1),
  playerId: z.string().min(1),
  seasonId: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
  pointsAwarded: z.number().int().min(0).max(100).optional(),
  weekId: z.string().optional(),
});

export async function awardAchievement(raw: z.infer<typeof awardSchema>): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const data = awardSchema.parse(raw);

    const achievement = await prisma.achievement.findUnique({ where: { id: data.achievementId } });
    if (!achievement) return { error: "Conquista não encontrada." };

    // Checar se já tem (para não repetíveis)
    if (!achievement.isRepeatable) {
      const existing = await prisma.playerAchievement.findFirst({
        where: {
          achievementId: data.achievementId,
          playerId: data.playerId,
          seasonId: data.seasonId ?? null
        }
      });
      if (existing) return { error: "Este jogador já possui esta conquista." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.playerAchievement.create({
        data: {
          achievementId: data.achievementId,
          playerId: data.playerId,
          seasonId: data.seasonId || null,
          awardedById: actor.id,
          notes: data.notes || null,
          pointsAwarded: data.pointsAwarded ?? null,
          weekId: data.weekId || null,
        }
      });

      // Entregar recompensas via Caixa de Presentes
      const rewards = await tx.achievementReward.findMany({
        where: { achievementId: data.achievementId }
      });

      for (const reward of rewards) {
        if (!reward.deliverViaGift) continue;
        await tx.playerGift.create({
          data: {
            playerId: data.playerId,
            type: "CUSTOM",
            title: `🏆 Conquista: ${achievement.name}`,
            description: `Recompensa por desbloquear "${achievement.name}"`,
            payload: {
              achievementId: data.achievementId,
              rewardType: reward.rewardType,
              rewardAmount: reward.rewardAmount,
              rewardItemId: reward.rewardItemId,
              titleText: reward.titleText
            }
          }
        });
      }

      // Se tem pontos extras, aplicar via applyTournamentWeekBonus
      if (data.pointsAwarded && data.pointsAwarded > 0 && data.weekId) {
        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            entityType: "playerAchievement",
            entityId: data.achievementId,
            action: "achievement.awarded_with_points",
            after: { playerId: data.playerId, points: data.pointsAwarded, weekId: data.weekId }
          }
        });
      }
    });

    revalidatePath("/conquistas");
    revalidatePath("/jogadores");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function revokeAchievement(playerAchievementId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.playerAchievement.delete({ where: { id: playerAchievementId } });
    revalidatePath("/conquistas");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Gerenciar recompensas de conquista ────────────────────────────────────────

const rewardSchema = z.object({
  achievementId: z.string().min(1),
  rewardType: z.enum(["ZIKA_COINS","LOOT_TICKET","STICKER_PACK","SHOP_ITEM","TITLE_TEXT","BADGE"]),
  rewardAmount: z.number().int().min(1).optional(),
  rewardItemId: z.string().optional(),
  titleText: z.string().trim().max(80).optional(),
  deliverViaGift: z.boolean().default(true)
});

export async function addAchievementReward(raw: z.infer<typeof rewardSchema>): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const data = rewardSchema.parse(raw);
    await prisma.achievementReward.create({
      data: {
        achievementId: data.achievementId,
        rewardType: data.rewardType as import("@prisma/client").AchievementRewardType,
        rewardAmount: data.rewardAmount ?? null,
        rewardItemId: data.rewardItemId ?? null,
        titleText: data.titleText ?? null,
        deliverViaGift: data.deliverViaGift
      }
    });
    revalidatePath("/conquistas");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function removeAchievementReward(rewardId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.achievementReward.delete({ where: { id: rewardId } });
    revalidatePath("/conquistas");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Destaque no perfil (Stage 3) ──────────────────────────────────────────────

export async function toggleHighlightAchievement(
  playerAchievementId: string,
  highlight: boolean
): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };

    const pa = await prisma.playerAchievement.findUnique({
      where: { id: playerAchievementId },
      include: { player: { select: { userId: true } } }
    });
    if (!pa) return { error: "Conquista não encontrada." };
    if (pa.player.userId !== actor.id && !isAdmin(actor.role))
      return { error: "Sem permissão." };

    if (highlight) {
      const count = await prisma.playerAchievement.count({
        where: { playerId: pa.playerId, isHighlighted: true }
      });
      if (count >= 3) return { error: "Máximo de 3 conquistas em destaque." };
    }

    await prisma.playerAchievement.update({
      where: { id: playerAchievementId },
      data: { isHighlighted: highlight }
    });
    revalidatePath("/conquistas");
    revalidatePath(`/jogadores/${pa.playerId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Buscar conquistas do jogador logado ───────────────────────────────────────

export async function getMyAchievements(): Promise<{
  unlocked: Array<{
    id: string; achievementId: string; unlockedAt: string; isHighlighted: boolean;
    pointsAwarded: number | null;
    achievement: { name: string; description: string | null; rarity: string; category: string; iconUrl: string | null };
  }>;
  error?: string;
}> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { unlocked: [], error: "Não autenticado." };

    const player = await prisma.player.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (!player) return { unlocked: [] };

    const records = await prisma.playerAchievement.findMany({
      where: { playerId: player.id },
      include: { achievement: { select: { name: true, description: true, rarity: true, category: true, iconUrl: true } } },
      orderBy: { awardedAt: "desc" }
    });

    return {
      unlocked: records.map(r => ({
        id: r.id,
        achievementId: r.achievementId,
        unlockedAt: r.awardedAt.toISOString(),
        isHighlighted: r.isHighlighted,
        pointsAwarded: r.pointsAwarded,
        achievement: r.achievement
      }))
    };
  } catch (err) {
    return { unlocked: [], error: String(err) };
  }
}

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}
