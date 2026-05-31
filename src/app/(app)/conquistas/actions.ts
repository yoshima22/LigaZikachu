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
