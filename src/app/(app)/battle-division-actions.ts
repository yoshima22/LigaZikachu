"use server";

import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { normalizeBattleDivision } from "@/lib/battle-divisions";
import { Prisma } from "@prisma/client";
import { DEFAULT_MODE_DIVISIONS, getBattleModeDivision, type BattleModeKey } from "@/lib/battle-division-settings";

export async function getBattleModeDivisionAction(mode: BattleModeKey) { return { division: await getBattleModeDivision(mode) }; }
export async function setBattleModeDivisionAction(mode: BattleModeKey, division: string) {
  const session = await getAppSession(); if (!session?.user || !isAdmin(session.user.role)) return { error: "Apenas o admin pode alterar a divisão." };
  const current = await prisma.siteContent.findUnique({ where: { id: "battle-division-settings" }, select: { data: true } });
  const data = current?.data && typeof current.data === "object" && !Array.isArray(current.data) ? current.data as Record<string, unknown> : { ...DEFAULT_MODE_DIVISIONS };
  const next = { ...data, [mode]: normalizeBattleDivision(division) } as Prisma.InputJsonValue;
  await prisma.siteContent.upsert({ where: { id: "battle-division-settings" }, create: { id: "battle-division-settings", data: next, updatedBy: session.user.id }, update: { data: next, updatedBy: session.user.id } });
  return { success: true };
}
