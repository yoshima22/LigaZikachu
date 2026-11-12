"use server";

import { revalidatePath } from "next/cache";
import * as svc from "@/lib/amigo-oculto/service";

// Toda action repete o guard: o modo é fechado a admins nesta etapa.
async function guarded<T>(fn: (a: NonNullable<Awaited<ReturnType<typeof svc.getSsAdmin>>>) => Promise<T>): Promise<T | { error: string }> {
  const a = await svc.getSsAdmin();
  if (!a) return { error: "Sem permissão." };
  try {
    const r = await fn(a);
    revalidatePath("/amigo-oculto");
    revalidatePath("/amigo-oculto/admin");
    return r;
  } catch (e) {
    console.error("[amigo-oculto]", e);
    return { error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function createEditionAction(i: { name: string; startsOn: string; deliverAt: string }) {
  return guarded(() => svc.createEdition(i));
}
export async function registerMeAction(editionId: string) {
  return guarded((a) => svc.register(editionId, a.playerId, a.displayName));
}
export async function addBotsAction(editionId: string, n: number) {
  return guarded(() => svc.addBots(editionId, n));
}
export async function drawAction(editionId: string) {
  return guarded(() => svc.runDraw(editionId));
}
export async function checkinAction(participantId: string, day?: string) {
  return guarded(() => svc.checkin(participantId, day));
}
export async function updateConfigAction(editionId: string, i: { levels: number[]; mimoMinPct: number }) {
  return guarded(() => svc.updateConfig(editionId, i));
}
export async function saveBuildAction(participantId: string, optionKeys: string[], card: unknown) {
  return guarded(() => svc.saveBuild(participantId, optionKeys, card));
}
export async function saveKitAction(editionId: string, key: string, items: { name: string; qty: number }[]) {
  return guarded(() => svc.saveKit(editionId, key, items));
}
export async function resetKitAction(editionId: string, key: string) {
  return guarded(() => svc.resetKit(editionId, key));
}
export async function deliverAction(editionId: string) {
  return guarded(() => svc.deliver(editionId));
}
export async function resetEditionAction(editionId: string) {
  return guarded(() => svc.resetEdition(editionId));
}
export async function openCardAction(participantId: string) {
  return guarded(() => svc.openCard(participantId));
}
export async function debugCheckinsAction(editionId: string, mode: "random" | "clear" | "fill", pct?: number) {
  return guarded(() => svc.debugCheckins(editionId, mode, pct));
}
export async function setPublishedAction(editionId: string, published: boolean) {
  return guarded(() => svc.setPublished(editionId, published));
}
