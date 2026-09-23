import { prisma } from "@/lib/prisma";

export const FAILED_DISTANCE_COOLDOWN_MS = 48 * 60 * 60_000;
export const FAILED_DISTANCE_MEMORY_TYPE = "AFASTAMENTO_FALHOU";

/** A recarga pertence ao mascote que tentou se afastar, não só à dupla. */
export async function failedDistanceCooldownUntil(mascotId: string, now = new Date()) {
  const failure = await prisma.mascotBondMemory.findFirst({
    where: { mascotAId: mascotId, memoryType: FAILED_DISTANCE_MEMORY_TYPE, createdAt: { gt: new Date(now.getTime() - FAILED_DISTANCE_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return failure ? new Date(failure.createdAt.getTime() + FAILED_DISTANCE_COOLDOWN_MS) : null;
}

export function failedDistanceMemoryData(initiatorMascotId: string, otherMascotId: string, relationId: string, cause: "CONTEST" | "CHARM", now = new Date()) {
  return {
    mascotAId: initiatorMascotId,
    mascotBId: otherMascotId,
    memoryType: FAILED_DISTANCE_MEMORY_TYPE,
    sourceType: "BOND_MANAGEMENT",
    sourceId: relationId,
    title: "Afastamento impedido",
    description: cause === "CONTEST"
      ? "A contestação preservou o vínculo. Este mascote só poderá iniciar outro afastamento após 48 horas."
      : "O Amuleto de Promessa preservou o vínculo. Este mascote só poderá iniciar outro afastamento após 48 horas.",
    intensity: 2,
    createdAt: now,
    metadata: { cause },
  };
}
