"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  applyBondOption,
  autoResolveExpiredBondEvents,
  createBondEventForPlayer,
  type BondBehavior,
} from "@/lib/mascot-bonds";

async function getPlayerId() {
  const session = await getAppSession();
  if (!session?.user) throw new Error("Sessao expirada.");
  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!player) throw new Error("Jogador nao encontrado.");
  return player.id;
}

export async function createBondEventAction() {
  try {
    const playerId = await getPlayerId();
    await autoResolveExpiredBondEvents(playerId);
    await createBondEventForPlayer(playerId);
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Nao foi possivel criar evento." };
  }
}

export async function resolveBondEventAction(eventId: string, optionId: string) {
  try {
    const playerId = await getPlayerId();
    await applyBondOption(eventId, playerId, optionId);
    revalidatePath("/lacos");
    revalidatePath("/mascotes");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Nao foi possivel resolver evento." };
  }
}

export async function updateBondBehaviorAction(behavior: BondBehavior) {
  try {
    const playerId = await getPlayerId();
    await prisma.player.update({ where: { id: playerId }, data: { mascotBondBehavior: behavior } });
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Nao foi possivel atualizar comportamento." };
  }
}
