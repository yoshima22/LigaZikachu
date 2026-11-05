"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getAdminTrainingCompletionPlan } from "@/lib/admin-training-journeys";

const JOURNEYS_PAGE_SIZE = 15;

export type AdminTrainingJourneyListRow = {
  id: string;
  stanceKey: string;
  startedAt: Date;
  mascot: { id: string; nickname: string | null; pokemonId: number; player: { displayName: string } };
};
export type AdminTrainingJourneyMilestone = { milestoneKey: string; value: number; target: number; detailsJson: unknown };

/** Lista paginada de jornadas ativas (sem os marcos; eles são carregados ao expandir a jornada). */
export async function listAdminTrainingJourneysAction(input: { page: number; query: string }): Promise<{ rows: AdminTrainingJourneyListRow[]; total: number; pageSize: number }> {
  await requireAdmin();
  const query = input.query.trim().slice(0, 80);
  const pokedex = /^#?\d+$/.test(query) ? Number(query.replace("#", "")) : null;
  const where: Prisma.MascotTrainingJourneyWhereInput = {
    status: "ACTIVE",
    ...(query ? {
      OR: [
        { stanceKey: { contains: query, mode: "insensitive" } },
        { mascot: { nickname: { contains: query, mode: "insensitive" } } },
        { mascot: { player: { displayName: { contains: query, mode: "insensitive" } } } },
        ...(pokedex != null ? [{ mascot: { pokemonId: pokedex } }] : []),
      ],
    } : {}),
  };
  const page = Math.max(1, Math.floor(input.page) || 1);
  const [rows, total] = await Promise.all([
    prisma.mascotTrainingJourney.findMany({
      where, orderBy: [{ startedAt: "asc" }, { id: "asc" }], skip: (page - 1) * JOURNEYS_PAGE_SIZE, take: JOURNEYS_PAGE_SIZE,
      select: { id: true, stanceKey: true, startedAt: true, mascot: { select: { id: true, nickname: true, pokemonId: true, player: { select: { displayName: true } } } } },
    }),
    prisma.mascotTrainingJourney.count({ where }),
  ]);
  return { rows, total, pageSize: JOURNEYS_PAGE_SIZE };
}

export async function getAdminTrainingJourneyMilestonesAction(journeyId: string): Promise<AdminTrainingJourneyMilestone[]> {
  await requireAdmin();
  return prisma.mascotTrainingMilestoneProgress.findMany({
    where: { journeyId }, orderBy: { milestoneKey: "asc" },
    select: { milestoneKey: true, value: true, target: true, detailsJson: true },
  });
}

export async function adminCompleteTrainingJourneyAction(journeyId: string, milestoneKey: string): Promise<{ error?: string; completedJourney?: boolean }> {
  const admin = await requireAdmin();
  if (!journeyId || !milestoneKey) return { error: "Jornada ou objetivo inválido." };

  const result = await prisma.$transaction(async (tx) => {
    const journey = await tx.mascotTrainingJourney.findFirst({
      where: { id: journeyId, status: "ACTIVE" },
      include: {
        mascot: { select: { id: true, player: { select: { id: true, userId: true } } } },
        milestones: { select: { milestoneKey: true, value: true, target: true } },
      },
    });
    if (!journey) return { error: "Jornada ativa não encontrada." };

    const plan = getAdminTrainingCompletionPlan(journey.milestones, milestoneKey);
    if (plan.milestoneKeys.length === 0) return { error: "Objetivo não encontrado nesta jornada." };
    const now = new Date();
    const before = journey.milestones.filter((milestone) => plan.milestoneKeys.includes(milestone.milestoneKey));
    await Promise.all(plan.milestoneKeys.map((key) => tx.mascotTrainingMilestoneProgress.update({
      where: { journeyId_milestoneKey: { journeyId: journey.id, milestoneKey: key } },
      data: { value: journey.milestones.find((milestone) => milestone.milestoneKey === key)!.target, completedAt: now },
    })));

    const refreshed = journey.milestones.map((milestone) => plan.milestoneKeys.includes(milestone.milestoneKey)
      ? { ...milestone, value: milestone.target }
      : milestone,
    );
    const completedJourney = refreshed.every((milestone) => milestone.value >= milestone.target);
    if (completedJourney) {
      await tx.mascotTrainingJourney.update({ where: { id: journey.id }, data: { status: "COMPLETED", completedAt: now } });
      await tx.mascotStanceUnlock.upsert({
        where: { mascotId_stanceKey: { mascotId: journey.mascotId, stanceKey: journey.stanceKey } },
        update: {}, create: { mascotId: journey.mascotId, stanceKey: journey.stanceKey, journeyId: journey.id },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        entityType: "MascotTrainingJourney",
        entityId: journey.id,
        action: milestoneKey === "ALL" ? "ADMIN_COMPLETE_TRAINING_JOURNEY" : "ADMIN_COMPLETE_TRAINING_MILESTONE",
        before: before as unknown as Prisma.InputJsonValue,
        after: { milestoneKeys: plan.milestoneKeys, completedJourney } as Prisma.InputJsonValue,
      },
    });
    return { playerUserId: journey.mascot.player.userId, completedJourney };
  });
  if ("error" in result) return result;
  revalidatePath("/admin");
  revalidatePath("/mascotes");
  revalidateTag(`player-mascots-${result.playerUserId}`);
  return { completedJourney: result.completedJourney };
}
