import { PrismaClient, type MascotPersonality, type Prisma } from "@prisma/client";
import { getMascotProgressMilestones } from "../src/lib/mascot-data";

const prisma = new PrismaClient();

type MascotStatKey = "statForce" | "statAgility" | "statCharisma" | "statInstinct" | "statVitality";

function emptyStats(): Record<MascotStatKey, number> {
  return { statForce: 0, statAgility: 0, statCharisma: 0, statInstinct: 0, statVitality: 0 };
}

function distributeStatPoints(total: number, weights: Record<MascotStatKey, number>): Record<MascotStatKey, number> {
  const keys = Object.keys(weights) as MascotStatKey[];
  const weightTotal = keys.reduce((sum, key) => sum + Math.max(1, weights[key]), 0);
  const exact = keys.map((key) => {
    const value = (Math.max(1, weights[key]) / weightTotal) * total;
    return { key, floor: Math.floor(value), remainder: value - Math.floor(value) };
  });
  const distributed = emptyStats();
  exact.forEach(({ key, floor }) => { distributed[key] += floor; });
  let leftover = total - keys.reduce((sum, key) => sum + distributed[key], 0);
  exact.sort((a, b) => b.remainder - a.remainder).forEach(({ key }) => {
    if (leftover <= 0) return;
    distributed[key]++;
    leftover--;
  });
  return distributed;
}

function addStats(a: Record<MascotStatKey, number>, b: Record<MascotStatKey, number>): Record<MascotStatKey, number> {
  return {
    statForce: a.statForce + b.statForce,
    statAgility: a.statAgility + b.statAgility,
    statCharisma: a.statCharisma + b.statCharisma,
    statInstinct: a.statInstinct + b.statInstinct,
    statVitality: a.statVitality + b.statVitality,
  };
}

async function main() {
  const mascots = await prisma.mascot.findMany({
    select: {
      id: true,
      pokemonId: true,
      nickname: true,
      level: true,
      personality: true,
      statForce: true,
      statAgility: true,
      statCharisma: true,
      statInstinct: true,
      statVitality: true,
      progressMilestones: { select: { key: true } },
    },
    orderBy: [{ playerId: "asc" }, { level: "desc" }],
  });

  let touched = 0;
  let milestonesCreated = 0;
  let pointsAdded = 0;

  for (const mascot of mascots) {
    const existing = new Set(mascot.progressMilestones.map((m) => m.key));
    const milestones = getMascotProgressMilestones(mascot.pokemonId, mascot.level, false)
      .filter((milestone) => !existing.has(milestone.key));
    if (milestones.length === 0) continue;

    let totalBonus = emptyStats();
    let currentStats: Record<MascotStatKey, number> = {
      statForce: mascot.statForce,
      statAgility: mascot.statAgility,
      statCharisma: mascot.statCharisma,
      statInstinct: mascot.statInstinct,
      statVitality: mascot.statVitality,
    };

    const milestoneRows: Prisma.MascotProgressMilestoneCreateManyInput[] = [];
    for (const milestone of milestones) {
      const weights: Record<MascotStatKey, number> = {
        statForce: currentStats.statForce * 3,
        statAgility: currentStats.statAgility * 3,
        statCharisma: currentStats.statCharisma * 3,
        statInstinct: currentStats.statInstinct * 3,
        statVitality: currentStats.statVitality * 3,
      };
      if ((mascot.personality as MascotPersonality) === "COMPETITIVE") weights.statForce *= 1.15;
      if ((mascot.personality as MascotPersonality) === "LOYAL") weights.statCharisma *= 1.15;
      if ((mascot.personality as MascotPersonality) === "DRAMATIC") weights.statVitality *= 0.85;

      const bonus = distributeStatPoints(milestone.points, weights);
      totalBonus = addStats(totalBonus, bonus);
      currentStats = addStats(currentStats, bonus);
      milestoneRows.push({
        mascotId: mascot.id,
        key: milestone.key,
        label: milestone.label,
        level: milestone.level,
        statsJson: bonus,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.mascot.update({
        where: { id: mascot.id },
        data: {
          statForce: { increment: totalBonus.statForce },
          statAgility: { increment: totalBonus.statAgility },
          statCharisma: { increment: totalBonus.statCharisma },
          statInstinct: { increment: totalBonus.statInstinct },
          statVitality: { increment: totalBonus.statVitality },
        },
      });
      await tx.mascotProgressMilestone.createMany({ data: milestoneRows, skipDuplicates: true });
      await tx.mascotEvent.create({
        data: {
          mascotId: mascot.id,
          emoji: "🌟",
          description: `Ajuste retroativo: ${milestones.map((m) => m.label).join(", ")} aplicado.`,
        },
      }).catch(() => null);
    });

    touched++;
    milestonesCreated += milestones.length;
    pointsAdded += Object.values(totalBonus).reduce((sum, value) => sum + value, 0);
  }

  console.log(`Marcos aplicados. Mascotes alterados: ${touched}. Marcos criados: ${milestonesCreated}. Pontos somados: ${pointsAdded}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
