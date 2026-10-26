import { prisma } from "@/lib/prisma";

/** Ovos seguidos sem raridade aumentada até o próximo ovo ser garantido. */
export const EGG_PITY_THRESHOLDS: Record<string, number> = {
  COMMON: 100,
  RARE: 80,
  EVENT: 20,
  SPECIAL: 30,
  LAB: 10,
};

export const EGG_PITY_LABELS: Record<string, string> = {
  COMMON: "Ovo comum",
  RARE: "Ovo raro",
  EVENT: "Ovo de evento",
  SPECIAL: "Ovo especial",
  LAB: "Ovo de laboratório",
};

type Db = Pick<typeof prisma, "eggPityCounter">;

/** Chave do contador, ou null para ovos sem garantia (celestial, por geração...). */
export function eggPityKey(eggTypeKey: string): string | null {
  return eggTypeKey in EGG_PITY_THRESHOLDS ? eggTypeKey : null;
}

/** O ovo deste tipo é garantido quando já passaram (limite - 1) ovos sem raridade. */
export async function isEggPityDue(playerId: string, eggTypeKey: string, db: Db = prisma) {
  const key = eggPityKey(eggTypeKey);
  if (!key) return false;
  const row = await db.eggPityCounter.findUnique({ where: { playerId_eggKey: { playerId, eggKey: key } } });
  return (row?.count ?? 0) >= EGG_PITY_THRESHOLDS[key] - 1;
}

/** Zera se veio alta raridade; senão soma 1 (atômico, sem read-modify-write). */
export async function recordEggPityResult(playerId: string, eggTypeKey: string, gotHighRarity: boolean, db: Db = prisma) {
  const key = eggPityKey(eggTypeKey);
  if (!key) return;
  await db.eggPityCounter.upsert({
    where: { playerId_eggKey: { playerId, eggKey: key } },
    create: { playerId, eggKey: key, count: gotHighRarity ? 0 : 1 },
    update: gotHighRarity ? { count: 0 } : { count: { increment: 1 } },
  });
}

export async function getEggPityProgress(playerId: string) {
  const rows = await prisma.eggPityCounter.findMany({ where: { playerId } });
  const counts = new Map(rows.map((r) => [r.eggKey, r.count]));
  return Object.entries(EGG_PITY_THRESHOLDS).map(([key, threshold]) => ({
    key,
    label: EGG_PITY_LABELS[key],
    threshold,
    count: Math.min(counts.get(key) ?? 0, threshold),
  }));
}
