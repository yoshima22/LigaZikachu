import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { computeMascotAnalysis, type MascotAnalysis } from "../src/lib/mascot-analysis";

const prisma = new PrismaClient();

async function main() {
  const mascots = await prisma.mascot.findMany({
    where: {
      analyzedAt: { not: null },
      ivScore: { not: null },
      ivRating: { not: null },
    },
    select: {
      id: true,
      playerId: true,
      pokemonId: true,
      nickname: true,
      level: true,
      personality: true,
      evolutionLocked: true,
      statForce: true,
      statAgility: true,
      statCharisma: true,
      statInstinct: true,
      statVitality: true,
      analyzedAt: true,
      ivScore: true,
      ivRating: true,
      analysisJson: true,
      player: { select: { displayName: true } },
    },
  });

  const legacy = mascots.filter((mascot) => {
    const stored = mascot.analysisJson as Partial<MascotAnalysis> | null;
    return stored?.analysisVersion !== 2;
  });

  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupDirectory = path.join(process.cwd(), "reports", "mascot-analysis-backups");
  const backupPath = path.join(backupDirectory, `legacy-analysis-${timestamp}.json`);
  await mkdir(backupDirectory, { recursive: true });
  await writeFile(backupPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    count: legacy.length,
    mascots: legacy,
  }, null, 2), "utf8");

  const changes: Array<{
    id: string;
    owner: string;
    nickname: string | null;
    before: string;
    after: string;
    scoreBefore: number;
    scoreAfter: number;
  }> = [];

  for (const mascot of legacy) {
    const previous = mascot.analysisJson as Partial<MascotAnalysis> | null;
    const targetLevel = Math.max(
      mascot.level,
      Math.min(100, Number(previous?.targetLevel ?? 100)),
    );
    const analysis = computeMascotAnalysis(mascot, targetLevel);
    changes.push({
      id: mascot.id,
      owner: mascot.player.displayName,
      nickname: mascot.nickname,
      before: mascot.ivRating!,
      after: analysis.ivRating,
      scoreBefore: mascot.ivScore!,
      scoreAfter: analysis.ivScore,
    });
    await prisma.mascot.update({
      where: { id: mascot.id },
      data: {
        ivScore: analysis.ivScore,
        ivRating: analysis.ivRating,
        analysisJson: analysis as unknown as Prisma.InputJsonValue,
      },
    });
  }

  console.log(JSON.stringify({
    backupPath,
    repaired: changes.length,
    changedRatings: changes.filter((change) => change.before !== change.after),
  }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect());
