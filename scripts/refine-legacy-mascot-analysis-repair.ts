import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient, Prisma } from "@prisma/client";
import { computeMascotAnalysis, type MascotAnalysis } from "../src/lib/mascot-analysis";

const prisma = new PrismaClient();
const backupPath = process.argv[2];

if (!backupPath) throw new Error("Informe o caminho do backup da análise.");

async function main() {
  const backup = JSON.parse(await readFile(backupPath, "utf8")) as {
    mascots: Array<{
      id: string;
      pokemonId: number;
      level: number;
      personality: string;
      evolutionLocked: boolean;
      statForce: number;
      statAgility: number;
      statCharisma: number;
      statInstinct: number;
      statVitality: number;
      ivScore: number;
      ivRating: MascotAnalysis["ivRating"];
      analysisJson: MascotAnalysis;
    }>;
  };

  let structurallyRepaired = 0;
  let preserved = 0;
  for (const mascot of backup.mascots) {
    const previous = mascot.analysisJson;
    const corrected = computeMascotAnalysis(
      mascot,
      Math.max(mascot.level, Math.min(100, Number(previous?.targetLevel ?? 100))),
    );
    const structuralError =
      previous?.speciesPotentialPct !== corrected.speciesPotentialPct ||
      previous?.evoPotentialPct !== corrected.evoPotentialPct;
    const analysis = structuralError
      ? corrected
      : { ...previous, analysisVersion: 2 };

    await prisma.mascot.update({
      where: { id: mascot.id },
      data: {
        ivScore: structuralError ? corrected.ivScore : mascot.ivScore,
        ivRating: structuralError ? corrected.ivRating : mascot.ivRating,
        analysisJson: analysis as unknown as Prisma.InputJsonValue,
      },
    });
    if (structuralError) structurallyRepaired++;
    else preserved++;
  }
  console.log(JSON.stringify({ structurallyRepaired, preserved }, null, 2));
}

main().finally(async () => prisma.$disconnect());
