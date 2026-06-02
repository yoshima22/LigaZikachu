"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { generateNarrativeText } from "@/lib/narrative";

export async function generateWeekNarrative(
  weekId: string
): Promise<{ narrative: string } | { error: string }> {
  try {
    await requireAdmin();

    const week = await prisma.tournamentWeek.findUnique({
      where: { id: weekId },
      include: { tournament: { select: { slug: true } } },
    });
    if (!week) return { error: "Semana não encontrada." };

    const narrative = await generateNarrativeText(weekId);

    await prisma.tournamentWeek.update({
      where: { id: weekId },
      data: { narrativeText: narrative, narrativeGeneratedAt: new Date() },
    });

    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}`);
    return { narrative };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Narrative]", msg);
    return { error: msg };
  }
}
