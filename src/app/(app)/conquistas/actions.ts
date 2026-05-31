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

// -- Vincular conquista a torneio --
export async function linkAchievementToTournament(achievementId: string, tournamentId: string | null): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.achievement.update({ where: { id: achievementId }, data: { tournamentId: tournamentId ?? null } });
    revalidatePath('/conquistas');
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : 'Erro' }; }
}

export async function getTournamentAchievements(tournamentId: string) {
  return prisma.achievement.findMany({ where: { tournamentId, active: true }, include: { rewards: true, _count: { select: { playerAchievements: true } } }, orderBy: [{ rarity: 'asc' }, { name: 'asc' }] });
}

// -- Gerenciar regras de conquistas autom�ticas --------------------------------

const ruleSchema = z.object({
  achievementId: z.string().min(1),
  eventType: z.string().min(1),
  targetValue: z.number().int().min(1).max(9999),
  metadataFilter: z.record(z.unknown()).optional()
});

export async function addAchievementRule(raw: {
  achievementId: string; eventType: string; targetValue: number; metadataFilter?: Record<string, unknown>
}): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const data = ruleSchema.parse(raw);
    await prisma.achievementRule.create({
      data: {
        achievementId: data.achievementId,
        eventType: data.eventType as import('@prisma/client').AchievementEventType,
        targetValue: data.targetValue,
        metadataFilter: data.metadataFilter ? (data.metadataFilter as import('@prisma/client').Prisma.InputJsonValue) : import('@prisma/client').Prisma.JsonNull
      }
    });
    revalidatePath('/conquistas');
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

export async function removeAchievementRule(ruleId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.achievementRule.delete({ where: { id: ruleId } });
    revalidatePath('/conquistas');
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro' };
  }
}

// -- Buscar conquistas recentes n�o exibidas (para popup) ----------------------

export async function getRecentUnlockedAchievements(): Promise<Array<{
  id: string; name: string; rarity: string; iconUrl: string | null; unlockedAt: string;
}>> {
  try {
    const actor = await getSessionUser();
    if (!actor) return [];
    const since = new Date(Date.now() - 10 * 60 * 1000); // �ltimos 10 minutos
    const records = await prisma.playerAchievement.findMany({
      where: { player: { userId: actor.id }, awardedAt: { gte: since } },
      include: { achievement: { select: { name: true, rarity: true, iconUrl: true } } },
      orderBy: { awardedAt: 'desc' },
      take: 5
    });
    return records.map(r => ({
      id: r.id,
      name: r.achievement.name,
      rarity: r.achievement.rarity,
      iconUrl: r.achievement.iconUrl,
      unlockedAt: r.awardedAt.toISOString()
    }));
  } catch { return []; }
}
