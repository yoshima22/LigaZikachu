import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const STAT_BASELINE = Number(process.env.MASCOT_STAT_REPAIR_BASELINE ?? 8);
const STARTING_STAT_TOTAL = Number(process.env.MASCOT_STAT_REPAIR_TOTAL ?? 40);
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

const statProfileCache = new Map<number, Record<StatKey, number>>();

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function levelGains(mascot: MascotForRepair): Record<StatKey, number> {
  const levelUps = Math.max(0, mascot.level - 1);

  return {
    statForce: levelUps * (mascot.personality === "COMPETITIVE" ? 2 : 1),
    statAgility: levelUps,
    statCharisma: levelUps * (mascot.personality === "LOYAL" ? 2 : 1),
    statInstinct: levelUps,
    statVitality: levelUps * (mascot.personality === "DRAMATIC" ? 0 : 1),
  };
}

function oldFlatMinimumStats(mascot: MascotForRepair): Record<StatKey, number> {
  const gains = levelGains(mascot);

  return {
    statForce: STAT_BASELINE + gains.statForce,
    statAgility: STAT_BASELINE + gains.statAgility,
    statCharisma: STAT_BASELINE + gains.statCharisma,
    statInstinct: STAT_BASELINE + gains.statInstinct,
    statVitality: STAT_BASELINE + gains.statVitality,
  };
}

function distributePoints(total: number, weights: Record<StatKey, number>, minimumPerStat?: number): Record<StatKey, number> {
  const keys = Object.keys(weights) as StatKey[];
  const minimum = minimumPerStat ?? Math.max(1, Math.floor(total * 0.1));
  const guaranteed = minimum * keys.length;
  const remaining = Math.max(0, total - guaranteed);
  const weightTotal = keys.reduce((sum, key) => sum + Math.max(1, weights[key]), 0);
  const exact = keys.map((key) => {
    const value = (Math.max(1, weights[key]) / weightTotal) * remaining;
    return { key, value, floor: Math.floor(value), remainder: value - Math.floor(value) };
  });
  const distributed = Object.fromEntries(keys.map((key) => [key, minimum])) as Record<StatKey, number>;

  exact.forEach(({ key, floor }) => {
    distributed[key] += floor;
  });

  let leftover = total - keys.reduce((sum, key) => sum + distributed[key], 0);
  exact
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ key }) => {
      if (leftover <= 0) return;
      distributed[key]++;
      leftover--;
    });

  return distributed;
}

function fallbackWeights(pokemonId: number): Record<StatKey, number> {
  const seed = Math.abs(pokemonId * 1103515245 + 12345);
  return {
    statForce: 80 + (seed % 45),
    statAgility: 70 + ((seed >> 3) % 55),
    statCharisma: 65 + ((seed >> 6) % 60),
    statInstinct: 75 + ((seed >> 9) % 50),
    statVitality: 85 + ((seed >> 12) % 45),
  };
}

async function pokemonStatProfile(pokemonId: number): Promise<Record<StatKey, number>> {
  const cached = statProfileCache.get(pokemonId);
  if (cached) return cached;

  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
    if (!response.ok) throw new Error(`PokeAPI HTTP ${response.status}`);
    const data = await response.json() as { stats?: { base_stat: number; stat: { name: string } }[] };
    const base = Object.fromEntries((data.stats ?? []).map((entry) => [entry.stat.name, entry.base_stat])) as Record<string, number>;
    const weights: Record<StatKey, number> = {
      statForce: (base.attack ?? 70) * 0.65 + (base["special-attack"] ?? 70) * 0.35,
      statAgility: base.speed ?? 70,
      statCharisma: (base["special-attack"] ?? 70) * 0.4 + (base["special-defense"] ?? 70) * 0.35 + (base.speed ?? 70) * 0.25,
      statInstinct: (base["special-defense"] ?? 70) * 0.55 + (base.defense ?? 70) * 0.35 + (base.hp ?? 70) * 0.1,
      statVitality: (base.hp ?? 70) * 0.6 + (base.defense ?? 70) * 0.4,
    };
    statProfileCache.set(pokemonId, weights);
    return weights;
  } catch {
    const weights = fallbackWeights(pokemonId);
    statProfileCache.set(pokemonId, weights);
    return weights;
  }
}

async function expectedRebalancedStats(mascot: MascotForRepair): Promise<Record<StatKey, number>> {
  const profile = await pokemonStatProfile(mascot.pokemonId);
  const base = distributePoints(STARTING_STAT_TOTAL, profile, Math.floor(STARTING_STAT_TOTAL * 0.1));
  const gains = levelGains(mascot);
  const oldFlat = oldFlatMinimumStats(mascot);
  const statKeys = Object.keys(base) as StatKey[];
  const currentTotal = statKeys.reduce((sum, key) => sum + mascot[key], 0);
  const oldFlatTotal = statKeys.reduce((sum, key) => sum + oldFlat[key], 0);
  const preservedBonusTotal = Math.max(0, currentTotal - oldFlatTotal);
  const preservedBonus = distributePoints(preservedBonusTotal, profile, 0);

  return {
    statForce: base.statForce + gains.statForce + preservedBonus.statForce,
    statAgility: base.statAgility + gains.statAgility + preservedBonus.statAgility,
    statCharisma: base.statCharisma + gains.statCharisma + preservedBonus.statCharisma,
    statInstinct: base.statInstinct + gains.statInstinct + preservedBonus.statInstinct,
    statVitality: base.statVitality + gains.statVitality + preservedBonus.statVitality,
  };
}

async function repairData(mascot: MascotForRepair): Promise<{ data: Partial<Record<StatKey, number>>; deltas: Partial<Record<StatKey, number>> }> {
  const expected = await expectedRebalancedStats(mascot);
  const data: Partial<Record<StatKey, number>> = {};
  const deltas: Partial<Record<StatKey, number>> = {};

  (Object.keys(expected) as StatKey[]).forEach((key) => {
    if (mascot[key] !== expected[key]) {
      data[key] = expected[key];
      deltas[key] = expected[key] - mascot[key];
    }
  });

  return { data, deltas };
}

function describeDeltas(deltas: Partial<Record<StatKey, number>>): string {
  return (Object.entries(deltas) as [StatKey, number][])
    .map(([key, amount]) => `${amount > 0 ? "+" : ""}${amount} ${STAT_LABELS[key]}`)
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
        startingStatTotal: STARTING_STAT_TOTAL,
        strategy: "pokemon-weighted-rebalance",
        totalMascots: mascots.length,
        mascots,
      },
      null,
      2,
    ),
    "utf8",
  );

  const repairs = (await Promise.all(mascots.map(async (mascot) => ({ mascot, ...(await repairData(mascot)) }))))
    .filter(({ data }) => Object.keys(data).length > 0);

  if (!dryRun && repairs.length > 0) {
    for (const repair of repairs) {
      await prisma.$transaction([
        prisma.mascot.update({
          where: { id: repair.mascot.id },
          data: repair.data,
        }),
        prisma.mascotEvent.create({
          data: {
            mascotId: repair.mascot.id,
            emoji: "FIX",
            description: `Recalculo de atributos por especie e level-ups acumulados: ${describeDeltas(repair.deltas)}.`,
          },
        }),
      ]);
    }
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
