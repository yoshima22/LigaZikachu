"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { REFUGE_LOCATIONS, simulateRefugeMoment, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { uploadDataUrlAsset } from "@/lib/asset-storage";
import { Prisma } from "@prisma/client";
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

async function getAdminPlayerId() {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) throw new Error("Prévia disponível somente para administradores.");
  const player = await prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!player) throw new Error("Jogador não encontrado.");
  return player.id;
}

export async function setMascotRoutineV2Action(mascotId: string, location: RefugeLocation | "NONE") {
  try {
    const playerId = await getAdminPlayerId();
    const mascot = await prisma.mascot.findFirst({ where: { id: mascotId, playerId }, select: { id: true } });
    if (!mascot) throw new Error("Mascote não encontrado na sua conta.");
    if (location === "NONE") {
      await prisma.mascotRoutine.deleteMany({ where: { mascotId, playerId } });
    } else {
      if (!REFUGE_LOCATIONS[location]) throw new Error("Local inválido.");
      const occupied = await prisma.mascotRoutine.count({ where: { playerId, locationType: location, status: "ACTIVE", mascotId: { not: mascotId } } });
      if (occupied >= REFUGE_LOCATIONS[location].capacity) throw new Error(`${REFUGE_LOCATIONS[location].label} está lotado.`);
      await prisma.mascotRoutine.upsert({
        where: { mascotId },
        update: { playerId, locationType: location, status: "ACTIVE", startedAt: new Date(), lastProcessedAt: new Date(), accumulatedUnits: 0 },
        create: { playerId, mascotId, locationType: location },
      });
    }
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível definir a rotina." };
  }
}

export async function simulateRefugeV2Action(location: RefugeLocation) {
  try {
    const playerId = await getAdminPlayerId();
    if (!REFUGE_LOCATIONS[location]) throw new Error("Local inválido.");
    const result = await prisma.$transaction((tx) => simulateRefugeMoment(tx, playerId, location));
    revalidatePath("/lacos");
    return { ok: true, message: result.description };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível simular o Refúgio." };
  }
}

export async function saveRefugeBackgroundV2Action(location: RefugeLocation, image: string) {
  try {
    const playerId = await getAdminPlayerId();
    if (!REFUGE_LOCATIONS[location]) throw new Error("Local inválido.");
    if (image && !image.startsWith("data:image/") && !/^https:\/\//i.test(image)) throw new Error("Envie uma imagem ou URL HTTPS válida.");
    const session = await getAppSession();
    const storedUrl = image.startsWith("data:image/") ? await uploadDataUrlAsset(image, "bonds-v2", `refugio-${location.toLowerCase()}`) : image;
    const current = await prisma.siteContent.findUnique({ where: { id: "bonds-v2-settings" }, select: { data: true } });
    const data = current?.data && typeof current.data === "object" && !Array.isArray(current.data) ? current.data as Record<string, unknown> : {};
    const backgrounds = data.backgrounds && typeof data.backgrounds === "object" && !Array.isArray(data.backgrounds) ? data.backgrounds as Record<string, unknown> : {};
    const next = { ...data, backgrounds: { ...backgrounds, [location]: storedUrl || null } } as Prisma.InputJsonValue;
    await prisma.siteContent.upsert({
      where: { id: "bonds-v2-settings" },
      create: { id: "bonds-v2-settings", data: next, updatedBy: session?.user.id },
      update: { data: next, updatedBy: session?.user.id },
    });
    revalidatePath("/lacos");
    return { ok: true, url: storedUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o cenário." };
  }
}

export async function updateActiveBondV2Action(relationId: string, operation: "TOGGLE_ACTIVE" | "TOGGLE_PROTECTED") {
  try {
    const playerId = await getAdminPlayerId();
    const relation = await prisma.mascotRelation.findFirst({ where: { id: relationId, mascotA: { playerId } }, select: { id: true, isActive: true, isProtected: true, mascotAId: true } });
    if (!relation) throw new Error("Laço não encontrado.");
    if (operation === "TOGGLE_ACTIVE") {
      if (!relation.isActive) {
        const activeCount = await prisma.mascotRelation.count({ where: { mascotAId: relation.mascotAId, isActive: true } });
        if (activeCount >= 10) throw new Error("Este mascote já possui 10 Laços Ativos.");
      }
      await prisma.mascotRelation.update({ where: { id: relation.id }, data: { isActive: !relation.isActive, dormantAt: relation.isActive ? new Date() : null } });
    } else {
      await prisma.mascotRelation.update({ where: { id: relation.id }, data: { isProtected: !relation.isProtected } });
    }
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível alterar o laço." };
  }
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
