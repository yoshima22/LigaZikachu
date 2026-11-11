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
    return r;
  } catch (e) {
    console.error("[amigo-oculto]", e);
    return { error: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export const createEditionAction = (i: { name: string; startsOn: string; deliverAt: string }) => guarded(() => svc.createEdition(i));
export const registerMeAction = (editionId: string) => guarded((a) => svc.register(editionId, a.playerId, a.displayName));
export const addBotsAction = (editionId: string, n: number) => guarded(() => svc.addBots(editionId, n));
export const drawAction = (editionId: string) => guarded(() => svc.runDraw(editionId));
export const checkinAction = (participantId: string, day?: string) => guarded(() => svc.checkin(participantId, day));
export const updateConfigAction = (editionId: string, i: { goalPct: number; levels: number[]; mimoMinPct: number }) => guarded(() => svc.updateConfig(editionId, i));
export const saveBuildAction = (participantId: string, giftKey: string, card: unknown) => guarded(() => svc.saveBuild(participantId, giftKey, card));
export const deliverAction = (editionId: string) => guarded(() => svc.deliver(editionId));
export const resetEditionAction = (editionId: string) => guarded(() => svc.resetEdition(editionId));
export const openCardAction = (participantId: string) => guarded(() => svc.openCard(participantId));
export const debugCheckinsAction = (editionId: string, mode: "random" | "clear" | "fill", pct?: number) => guarded(() => svc.debugCheckins(editionId, mode, pct));
