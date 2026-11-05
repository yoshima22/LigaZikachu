import { prisma } from "@/lib/prisma";
import { buildPublicWeeklyReplay, type PublicWeeklyReplay } from "@/lib/public-weekly-replay";

/** A safe, anonymous replay selected for the unauthenticated home page. */
export async function getPublicWeeklyReplay(): Promise<PublicWeeklyReplay> {
  try {
    const matches = await prisma.weeklyMascotLeagueMatch.findMany({
      where: { status: "RESOLVED" },
      orderBy: { resolvedAt: "desc" },
      take: 12,
      select: { resultJson: true, replayJson: true },
    });
    for (const match of matches) {
      const replay = buildPublicWeeklyReplay(match);
      if (replay.source === "real") return replay;
    }
  } catch (error) {
    console.error("[public-home] weekly replay unavailable", error);
  }
  return buildPublicWeeklyReplay(null);
}
