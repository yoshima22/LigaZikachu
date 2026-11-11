"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getSessionPlayer } from "@/lib/session";
import { readConfig } from "@/lib/amigo-oculto/core";
import * as svc from "@/lib/amigo-oculto/service";

// Ações do jogador logado. Cada uma confere: sessão, edição publicada (ou admin) e inscrição própria.
// Nada de id de participante vindo do cliente: ele é resolvido aqui pelo jogador da sessão.
async function ctx(editionId: string) {
  const user = await getSessionUser();
  if (!user) return null;
  const player = await getSessionPlayer(user.id);
  if (!player) return null;
  const e = await prisma.secretSantaEdition.findUnique({ where: { id: editionId }, select: { configJson: true } });
  if (!e || (!readConfig(e.configJson).published && !isAdmin(user.role))) return null;
  return { player };
}

async function guarded<T>(editionId: string, fn: (c: NonNullable<Awaited<ReturnType<typeof ctx>>>, participantId: string | null) => Promise<T>): Promise<T | { error: string }> {
  const c = await ctx(editionId);
  if (!c) return { error: "Sem permissão." };
  try {
    const mine = await svc.myParticipant(editionId, c.player.id);
    const r = await fn(c, mine?.id ?? null);
    revalidatePath("/amigo-oculto");
    return r;
  } catch (e) {
    console.error("[amigo-oculto/player]", e);
    return { error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

const notIn = { error: "Você não está inscrito nesta edição." };

export async function registerSelfAction(editionId: string) {
  return guarded(editionId, (c) => svc.register(editionId, c.player.id, c.player.displayName));
}
export async function leaveSelfAction(editionId: string) {
  return guarded(editionId, (c) => svc.leaveEdition(editionId, c.player.id));
}
export async function checkinSelfAction(editionId: string) {
  return guarded(editionId, (_c, pid) => (pid ? svc.checkin(pid) : Promise.resolve(notIn)));
}
export async function saveBuildSelfAction(editionId: string, optionKeys: string[], card: unknown) {
  return guarded(editionId, (_c, pid) => (pid ? svc.saveBuild(pid, optionKeys, card) : Promise.resolve(notIn)));
}
export async function openMyCardAction(editionId: string) {
  return guarded(editionId, (_c, pid) => (pid ? svc.openCard(pid) : Promise.resolve(notIn)));
}
