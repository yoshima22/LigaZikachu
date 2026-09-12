"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { KANTO_MVP_BY_ID } from "@/world-data/kanto/mvp";

async function adminPlayer() {
  const user = await requirePlatformAdmin();
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!player) throw new Error("A conta administrativa não possui jogador vinculado.");
  return player;
}

export async function getAdminWorldState() {
  const player = await adminPlayer();
  let state = await prisma.worldPlayerState.findUnique({
    where: { playerId: player.id },
  });
  if (state?.travelEndsAt && state.travelEndsAt.getTime() <= Date.now()) {
    state = await finishTravel(player.id, false);
  }
  return state;
}

export async function startWorldAdventureAction() {
  try {
    const player = await adminPlayer();
    await prisma.worldPlayerState.upsert({
      where: { playerId: player.id },
      update: {},
      create: { playerId: player.id },
    });
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Não foi possível iniciar.",
    };
  }
}

export async function startWorldTravelAction(destinationId: string) {
  try {
    const player = await adminPlayer();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await tx.worldPlayerState.findUnique({
        where: { playerId: player.id },
      });
      if (!state) throw new Error("Inicie sua aventura antes de viajar.");
      if (state.travelingToId) throw new Error("Você já está viajando.");
      const current = KANTO_MVP_BY_ID.get(state.currentLocationId);
      const destination = KANTO_MVP_BY_ID.get(destinationId);
      if (!current || !destination) throw new Error("Localização indisponível.");
      const connection = current.connections.find((item) => item.to === destinationId);
      if (!connection) throw new Error("Não existe uma rota direta até esse local.");
      if (destination.locked) throw new Error("Esta área ainda está bloqueada.");
      if (
        connection.requirement?.badges &&
        state.badges.length < connection.requirement.badges
      )
        throw new Error(`Esta rota exige ${connection.requirement.badges} insígnias.`);
      const startedAt = new Date();
      const travelEndsAt = new Date(startedAt.getTime() + connection.minutes * 60_000);
      await tx.worldTravelLog.create({
        data: {
          playerId: player.id,
          fromLocationId: current.id,
          toLocationId: destination.id,
          durationMinutes: connection.minutes,
          fatigueGained: connection.fatigue,
          startedAt,
        },
      });
      await tx.worldPlayerState.update({
        where: { playerId: player.id },
        data: {
          travelingToId: destination.id,
          travelStartedAt: startedAt,
          travelEndsAt,
        },
      });
      return { destination: destination.name, travelEndsAt };
    });
    revalidatePath("/mundo");
    return { ok: true as const, ...result };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Não foi possível viajar.",
    };
  }
}

async function finishTravel(playerId: string, force: boolean) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${playerId}`}))`;
    const state = await tx.worldPlayerState.findUnique({ where: { playerId } });
    if (!state?.travelingToId || !state.travelEndsAt) return state;
    if (!force && state.travelEndsAt.getTime() > Date.now()) return state;
    const destination = KANTO_MVP_BY_ID.get(state.travelingToId);
    if (!destination) throw new Error("O destino da viagem não existe mais.");
    const current = KANTO_MVP_BY_ID.get(state.currentLocationId);
    const connection = current?.connections.find((item) => item.to === destination.id);
    const discovered = [...new Set([...state.discoveredLocationIds, destination.id])];
    const now = new Date();
    await tx.worldTravelLog.updateMany({
      where: {
        playerId,
        fromLocationId: state.currentLocationId,
        toLocationId: destination.id,
        arrivedAt: null,
      },
      data: { arrivedAt: now },
    });
    return tx.worldPlayerState.update({
      where: { playerId },
      data: {
        currentLocationId: destination.id,
        discoveredLocationIds: discovered,
        fatigue: { increment: connection?.fatigue ?? 0 },
        travelingToId: null,
        travelStartedAt: null,
        travelEndsAt: null,
      },
    });
  });
}

export async function finishWorldTravelNowAction() {
  try {
    const player = await adminPlayer();
    await finishTravel(player.id, true);
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Falha ao concluir viagem.",
    };
  }
}

export async function resetAdminWorldAction() {
  try {
    const player = await adminPlayer();
    await prisma.$transaction([
      prisma.worldTravelLog.deleteMany({ where: { playerId: player.id } }),
      prisma.worldPlayerState.deleteMany({ where: { playerId: player.id } }),
    ]);
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Falha ao reiniciar o teste.",
    };
  }
}

export type AdminWorldState = NonNullable<Awaited<ReturnType<typeof getAdminWorldState>>> & {
  inventoryJson: Prisma.JsonValue;
};

