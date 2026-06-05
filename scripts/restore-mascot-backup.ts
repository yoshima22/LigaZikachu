import { PrismaClient } from "@prisma/client";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

type BackupMascot = {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  exp: number;
  happiness: number;
  mood: string;
  personality: string;
  isEquipped: boolean;
  isFavorite: boolean;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
  battleWins: number;
  battleLosses: number;
  hatchedAt: string | Date;
  lastInteractedAt: string | Date | null;
  lastFedAt: string | Date | null;
  bazarListed: boolean;
  socialCooldownUntil: string | Date | null;
  susRestBonusMinutes: number;
  evolutionLocked: boolean;
  isShiny: boolean;
  arenaState: string;
  injuredAt: string | Date | null;
  restingUntil: string | Date | null;
};

type MascotBackup = {
  createdAt?: string;
  dryRun?: boolean;
  totalMascots?: number;
  mascots: BackupMascot[];
};

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toDate(value: string | Date | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

async function findLatestRealRepairBackup(): Promise<string> {
  const backupDir = path.join(process.cwd(), "backups", "mascot-stat-repair");
  const names = await readdir(backupDir);
  const candidates = names
    .filter((name) => name.endsWith(".json") && !name.includes("-dry-run"))
    .sort()
    .reverse();

  if (candidates.length === 0) {
    throw new Error(`Nenhum backup real encontrado em ${backupDir}.`);
  }

  return path.join(backupDir, candidates[0]);
}

async function readBackup(filePath: string): Promise<MascotBackup> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as MascotBackup;
  if (!Array.isArray(parsed.mascots)) {
    throw new Error("Arquivo de backup invalido: campo mascots ausente.");
  }
  return parsed;
}

async function backupCurrentState(): Promise<string> {
  const mascots = await prisma.mascot.findMany({
    orderBy: [{ playerId: "asc" }, { level: "desc" }, { hatchedAt: "asc" }],
  });

  const backupDir = path.join(process.cwd(), "backups", "mascot-stat-restore");
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `mascots-current-before-restore-${timestamp()}.json`);

  await writeFile(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        totalMascots: mascots.length,
        mascots,
      },
      null,
      2,
    ),
    "utf8",
  );

  return backupPath;
}

async function main(): Promise<void> {
  const explicitPath = process.argv.find((arg) => arg.endsWith(".json"));
  const backupPath = explicitPath ? path.resolve(explicitPath) : await findLatestRealRepairBackup();
  const backup = await readBackup(backupPath);
  const currentBackupPath = await backupCurrentState();

  let restored = 0;
  let missing = 0;

  for (const mascot of backup.mascots) {
    const existing = await prisma.mascot.findUnique({
      where: { id: mascot.id },
      select: { id: true },
    });

    if (!existing) {
      missing++;
      continue;
    }

    await prisma.mascot.update({
      where: { id: mascot.id },
      data: {
        pokemonId: mascot.pokemonId,
        nickname: mascot.nickname,
        level: mascot.level,
        exp: mascot.exp,
        happiness: mascot.happiness,
        mood: mascot.mood as never,
        personality: mascot.personality as never,
        isEquipped: mascot.isEquipped,
        isFavorite: mascot.isFavorite,
        statForce: mascot.statForce,
        statAgility: mascot.statAgility,
        statCharisma: mascot.statCharisma,
        statInstinct: mascot.statInstinct,
        statVitality: mascot.statVitality,
        battleWins: mascot.battleWins,
        battleLosses: mascot.battleLosses,
        hatchedAt: toDate(mascot.hatchedAt) ?? new Date(),
        lastInteractedAt: toDate(mascot.lastInteractedAt),
        lastFedAt: toDate(mascot.lastFedAt),
        bazarListed: mascot.bazarListed,
        socialCooldownUntil: toDate(mascot.socialCooldownUntil),
        susRestBonusMinutes: mascot.susRestBonusMinutes,
        evolutionLocked: mascot.evolutionLocked,
        isShiny: mascot.isShiny,
        arenaState: mascot.arenaState as never,
        injuredAt: toDate(mascot.injuredAt),
        restingUntil: toDate(mascot.restingUntil),
      },
    });

    restored++;
  }

  console.log(
    JSON.stringify(
      {
        restoredFrom: backupPath,
        currentBackupPath,
        sourceCreatedAt: backup.createdAt,
        sourceTotalMascots: backup.totalMascots,
        restored,
        missing,
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
