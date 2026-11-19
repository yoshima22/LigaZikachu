"use server";

import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import { TRAINING_STANCES, type TrainingStanceKey } from "@/lib/training-milestones";

export type StanceCompleteNotice = { id: string; mascotName: string; pokemonId: number; stanceLabel: string; effect: string };

/** Jornadas de postura concluídas nos últimos 7 dias; quem já viu é controlado no navegador (localStorage). */
export async function fetchStanceCompleteNoticesAction(): Promise<StanceCompleteNotice[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) return [];
  const rows = await prisma.mascotTrainingJourney.findMany({
    where: { status: "COMPLETED", completedAt: { gte: new Date(Date.now() - 7 * 86_400_000) }, mascot: { playerId: player.id } },
    orderBy: { completedAt: "asc" },
    select: { id: true, stanceKey: true, mascot: { select: { pokemonId: true, nickname: true } } },
  }).catch(() => []);
  return rows.map((r) => {
    const stance = TRAINING_STANCES[r.stanceKey as TrainingStanceKey];
    return { id: r.id, mascotName: r.mascot.nickname?.trim() || getPokemonName(r.mascot.pokemonId), pokemonId: r.mascot.pokemonId, stanceLabel: stance?.label ?? r.stanceKey, effect: stance?.effect ?? "" };
  });
}
