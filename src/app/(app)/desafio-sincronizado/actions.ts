"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SyncTicketSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionPlayer } from "@/lib/session";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import {
  combineSyncTicketHalves,
  createOpenSyncTeam,
  grantValidSyncTicketForPlayer,
  grantSyncTicketHalf,
  joinOpenSyncTeam,
  transferSyncTicketHalf,
} from "@/lib/sync-challenge";

async function requireCurrentPlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador nao encontrado.");
  return { user, player };
}

const transferSchema = z.object({
  halfId: z.string().min(1),
  targetPlayerId: z.string().min(1),
});

export async function transferSyncTicketHalfAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    const data = transferSchema.parse({
      halfId: formData.get("halfId"),
      targetPlayerId: formData.get("targetPlayerId"),
    });
    await prisma.$transaction((tx) => transferSyncTicketHalf(tx, {
      halfId: data.halfId,
      fromPlayerId: player.id,
      toPlayerId: data.targetPlayerId,
    }));
    revalidatePath("/desafio-sincronizado");
    revalidatePath("/caixa-de-presentes");
    return { success: "Metade enviada como presente." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao enviar metade." };
  }
}

const combineSchema = z.object({
  leftHalfId: z.string().min(1),
  rightHalfId: z.string().min(1),
});

export async function combineSyncTicketsAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    const data = combineSchema.parse({
      leftHalfId: formData.get("leftHalfId"),
      rightHalfId: formData.get("rightHalfId"),
    });
    await prisma.$transaction((tx) => combineSyncTicketHalves(tx, {
      playerId: player.id,
      leftHalfId: data.leftHalfId,
      rightHalfId: data.rightHalfId,
    }));
    revalidatePath("/desafio-sincronizado");
    return { success: "Ticket completo criado." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao montar ticket." };
  }
}

export async function reserveSyncTicketAction(ticketId: string): Promise<{ error?: string; success?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    await prisma.syncTicket.updateMany({
      where: { id: ticketId, ownerId: player.id, status: "AVAILABLE" },
      data: { status: "RESERVED" },
    });
    revalidatePath("/desafio-sincronizado");
    return { success: "Ticket reservado para entrada. A arena futura consumira o ticket apenas quando iniciar." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao reservar ticket." };
  }
}

export async function createOpenSyncTeamAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    const ticketId = z.string().min(1).parse(formData.get("ticketId"));
    await prisma.$transaction((tx) => createOpenSyncTeam(tx, player.id, ticketId));
    revalidatePath("/desafio-sincronizado");
    return { success: "Dupla aberta criada." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar dupla." };
  }
}

export async function joinOpenSyncTeamAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    const data = z.object({
      teamId: z.string().min(1),
      ticketId: z.string().min(1),
    }).parse({
      teamId: formData.get("teamId"),
      ticketId: formData.get("ticketId"),
    });
    await prisma.$transaction((tx) => joinOpenSyncTeam(tx, player.id, data.teamId, data.ticketId));
    revalidatePath("/desafio-sincronizado");
    return { success: "Voce entrou na dupla." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao entrar na dupla." };
  }
}

export async function grantDebugSyncHalfAction(side: "LEFT" | "RIGHT"): Promise<{ error?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    await prisma.$transaction((tx) => grantSyncTicketHalf(
      tx,
      player.id,
      "admin-debug",
      side === "LEFT" ? SyncTicketSide.LEFT : SyncTicketSide.RIGHT,
    ));
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao gerar metade." };
  }
}

export async function grantValidSyncTicketForMeAction(): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const { player } = await requireCurrentPlayer();
    await prisma.$transaction((tx) => grantValidSyncTicketForPlayer(tx, player.id));
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao gerar ticket valido." };
  }
}

const configSchema = z.object({
  ticketsEnabled: z.coerce.boolean().default(false),
  dropFromPve: z.coerce.boolean().default(false),
  dropFromPvp: z.coerce.boolean().default(false),
  dropFromExpedition: z.coerce.boolean().default(false),
  dropFromCraftingDustRecycle: z.coerce.boolean().default(false),
  dropFromTcgMatch: z.coerce.boolean().default(false),
  pveDropChance: z.coerce.number().min(0).max(100),
  pvpDropChance: z.coerce.number().min(0).max(100),
  expedition3hDropChance: z.coerce.number().min(0).max(100),
  expedition6hDropChance: z.coerce.number().min(0).max(100),
  recycleDropChance: z.coerce.number().min(0).max(100),
  tcgWinDropChance: z.coerce.number().min(0).max(100),
});

export async function updateSyncChallengeConfigAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const data = configSchema.parse(raw);
  await prisma.syncChallengeConfig.upsert({
    where: { id: "singleton" },
    update: {
      ticketsEnabled: data.ticketsEnabled,
      dropFromPve: data.dropFromPve,
      dropFromPvp: data.dropFromPvp,
      dropFromExpedition: data.dropFromExpedition,
      dropFromCraftingDustRecycle: data.dropFromCraftingDustRecycle,
      dropFromTcgMatch: data.dropFromTcgMatch,
      pveDropChance: data.pveDropChance / 100,
      pvpDropChance: data.pvpDropChance / 100,
      expedition3hDropChance: data.expedition3hDropChance / 100,
      expedition6hDropChance: data.expedition6hDropChance / 100,
      recycleDropChance: data.recycleDropChance / 100,
      tcgWinDropChance: data.tcgWinDropChance / 100,
    },
    create: {
      id: "singleton",
      ticketsEnabled: data.ticketsEnabled,
      dropFromPve: data.dropFromPve,
      dropFromPvp: data.dropFromPvp,
      dropFromExpedition: data.dropFromExpedition,
      dropFromCraftingDustRecycle: data.dropFromCraftingDustRecycle,
      dropFromTcgMatch: data.dropFromTcgMatch,
      pveDropChance: data.pveDropChance / 100,
      pvpDropChance: data.pvpDropChance / 100,
      expedition3hDropChance: data.expedition3hDropChance / 100,
      expedition6hDropChance: data.expedition6hDropChance / 100,
      recycleDropChance: data.recycleDropChance / 100,
      tcgWinDropChance: data.tcgWinDropChance / 100,
    },
  });
  revalidatePath("/desafio-sincronizado");
}
