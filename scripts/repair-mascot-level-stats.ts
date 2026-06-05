import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const STAT_BASELINE = Number(process.env.MASCOT_STAT_REPAIR_BASELINE ?? 8);
const dryRun = process.argv.includes("--dry-run");

type MascotForRepair = {
  id: string;
  playerId: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  exp: number;
  personality: string;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
};

type StatKey = "statForce" | "statAgility" | "statCharisma" | "statInstinct" | "statVitality";

const STAT_LABELS: Record<StatKey, string> = {
  statForce: "Forca",
  statAgility: "Agilidade",
  statCharisma: "Carisma",
  statInstinct: "Instinto",
  statVitality: "Vitalidade",
};

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function expectedMinimumStats(mascot: MascotForRepair): Record<StatKey, number> {
  const levelUps = Math.max(0, mascot.level - 1);

  return {
    statForce: STAT_BASELINE + levelUps * (mascot.personality === "COMPETITIVE" ? 2 : 1),
    statAgility: STAT_BASELINE + levelUps,
    statCharisma: STAT_BASELINE + levelUps * (mascot.personality === "LOYAL" ? 2 : 1),
    statInstinct: STAT_BASELINE + levelUps,
    statVitality: STAT_BASELINE + levelUps * (mascot.personality === "DRAMATIC" ? 0 : 1),
  };
}

function repairData(mascot: MascotForRepair): { data: Partial<Record<StatKey, number>>; deltas: Partial<Record<StatKey, number>> } {
  const expected = expectedMinimumStats(mascot);
  const data: Partial<Record<StatKey, number>> = {};
  const deltas: Partial<Record<StatKey, number>> = {};

  (Object.keys(expected) as StatKey[]).forEach((key) => {
    if (mascot[key] < expected[key]) {
      data[key] = expected[key];
      deltas[key] = expected[key] - mascot[key];
    }
  });

  return { data, deltas };
}

function describeDeltas(deltas: Partial<Record<StatKey, number>>): string {
  return (Object.entries(deltas) as [StatKey, number][])
    .map(([key, amount]) => `+${amount} ${STAT_LABELS[key]}`)
    .join(", ");
}

async function main(): Promise<void> {
  const mascots = await prisma.mascot.findMany({
    orderBy: [{ playerId: "asc" }, { level: "desc" }, { hatchedAt: "asc" }],
    select: {
      id: true,
      playerId: true,
      pokemonId: true,
      nickname: true,
      level: true,
      exp: true,
      happiness: true,
      mood: true,
      personality: true,
      isEquipped: true,
      isFavorite: true,
      statForce: true,
      statAgility: true,
      statCharisma: true,
      statInstinct: true,
      statVitality: true,
      battleWins: true,
      battleLosses: true,
      hatchedAt: true,
      lastInteractedAt: true,
      lastFedAt: true,
      bazarListed: true,
      socialCooldownUntil: true,
      susRestBonusMinutes: true,
      evolutionLocked: true,
      isShiny: true,
      arenaState: true,
      injuredAt: true,
      restingUntil: true,
    },
  });

  const backupDir = path.join(process.cwd(), "backups", "mascot-stat-repair");
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `mascots-before-${timestamp()}${dryRun ? "-dry-run" : ""}.json`);
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        dryRun,
        statBaseline: STAT_BASELINE,
        totalMascots: mascots.length,
        mascots,
      },
      null,
      2,
    ),
    "utf8",
  );

  const repairs = mascots
    .map((mascot) => ({ mascot, ...repairData(mascot) }))
    .filter(({ data }) => Object.keys(data).length > 0);

  if (!dryRun && repairs.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const repair of repairs) {
        await tx.mascot.update({
          where: { id: repair.mascot.id },
          data: repair.data,
        });

        await tx.mascotEvent.create({
          data: {
            mascotId: repair.mascot.id,
            emoji: "FIX",
            description: `Reparo de atributos por level-ups acumulados: ${describeDeltas(repair.deltas)}.`,
          },
        });
      }
    });
  }

  const totalDelta = repairs.reduce(
    (acc, repair) => {
      (Object.entries(repair.deltas) as [StatKey, number][]).forEach(([key, value]) => {
        acc[key] += value;
      });
      return acc;
    },
    { statForce: 0, statAgility: 0, statCharisma: 0, statInstinct: 0, statVitality: 0 } as Record<StatKey, number>,
  );

  console.log(
    JSON.stringify(
      {
        dryRun,
        backupPath,
        totalMascots: mascots.length,
        repairedMascots: repairs.length,
        totalDelta,
        sample: repairs.slice(0, 10).map((repair) => ({
          id: repair.mascot.id,
          playerId: repair.mascot.playerId,
          pokemonId: repair.mascot.pokemonId,
          nickname: repair.mascot.nickname,
          level: repair.mascot.level,
          deltas: repair.deltas,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
