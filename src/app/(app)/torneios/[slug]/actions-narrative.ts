"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { generateTournamentNarrativeText } from "@/lib/narrative";

export async function generateTournamentNarrative(
  tournamentId: string,
  slug: string
): Promise<{ narrative: string } | { error: string }> {
  try {
    await requireAdmin();

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });
    if (!tournament) return { error: "Torneio não encontrado." };

    const narrative = await generateTournamentNarrativeText(tournamentId);

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { narrativeText: narrative, narrativeGeneratedAt: new Date() },
    });

    revalidatePath(`/torneios/${slug}`);
    return { narrative };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[TournamentNarrative]", msg);
    return { error: msg };
  }
}
