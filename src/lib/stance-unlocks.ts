import { prisma } from "@/lib/prisma";

/** Posturas de jornada desbloqueadas por mascote do jogador (mascoteId → chaves). */
export async function getStanceUnlockMap(playerId: string): Promise<Record<string, string[]>> {
  const rows = await prisma.mascotStanceUnlock.findMany({ where: { mascot: { playerId } }, select: { mascotId: true, stanceKey: true } });
  const map: Record<string, string[]> = {};
  for (const row of rows) (map[row.mascotId] ??= []).push(row.stanceKey);
  return map;
}
