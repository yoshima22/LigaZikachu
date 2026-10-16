"use server";

import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { acknowledgeOccurrenceNotice, getOccurrenceNoticesForPlayer, type OccurrenceNotice } from "@/lib/mascot-occurrences";

async function currentPlayerId() {
  const user = await getSessionUser();
  if (!user) return null;
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  return player?.id ?? null;
}

export async function fetchOccurrenceNoticesAction(): Promise<OccurrenceNotice[]> {
  const playerId = await currentPlayerId();
  if (!playerId) return [];
  return getOccurrenceNoticesForPlayer(playerId).catch(() => []);
}

export async function acknowledgeOccurrenceNoticeAction(id: string, kind: "START" | "RETURN"): Promise<{ ok: boolean }> {
  const playerId = await currentPlayerId();
  if (!playerId) return { ok: false };
  await acknowledgeOccurrenceNotice(playerId, id, kind);
  return { ok: true };
}
