import { prisma } from "@/lib/prisma";
import { normalizeBattleDivision, type BattleDivision } from "@/lib/battle-divisions";

export type BattleModeKey = "ARENA_Z" | "WEEKLY_LEAGUE" | "SYNC_CHALLENGE";
export const DEFAULT_MODE_DIVISIONS: Record<BattleModeKey, BattleDivision> = { ARENA_Z: "UNLIMITED", WEEKLY_LEAGUE: "UNLIMITED", SYNC_CHALLENGE: "LIMITED" };

export async function getBattleModeDivision(mode: BattleModeKey) {
  const row = await prisma.siteContent.findUnique({ where: { id: "battle-division-settings" }, select: { data: true } });
  const data = row?.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data as Record<string, unknown> : {};
  return normalizeBattleDivision(data[mode] ?? DEFAULT_MODE_DIVISIONS[mode]);
}
