"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SyncTicketSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionPlayer } from "@/lib/session";
import { getSessionUser, isAdmin, requireAdmin } from "@/lib/auth/permissions";
import { toBrtDateString } from "@/lib/date-utils";
import {
  combineSyncTicketHalves,
  createOpenSyncTeam,
  grantValidSyncTicketForPlayer,
  grantSyncTicketHalf,
  joinOpenSyncTeam,
  transferSyncTicketHalf,
  SYNC_TICKET_TYPES,
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

export async function createOpenSyncTeamAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const { user, player } = await requireCurrentPlayer();
    const ticketId = z.string().min(1).parse(formData.get("ticketId"));
    await prisma.$transaction((tx) => createOpenSyncTeam(tx, player.id, ticketId, { adminBypass: isAdmin(user.role) }));
    revalidatePath("/desafio-sincronizado");
    return { success: "Dupla aberta criada." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar dupla." };
  }
}

export async function joinOpenSyncTeamAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const { user, player } = await requireCurrentPlayer();
    const data = z.object({
      teamId: z.string().min(1),
      ticketId: z.string().min(1),
    }).parse({
      teamId: formData.get("teamId"),
      ticketId: formData.get("ticketId"),
    });
    await prisma.$transaction((tx) => joinOpenSyncTeam(tx, player.id, data.teamId, data.ticketId, { adminBypass: isAdmin(user.role) }));
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

export async function createAdminSyncSimulationTeamAction(): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const { player } = await requireCurrentPlayer();
    await prisma.$transaction(async (tx) => {
      const partner = await tx.player.findFirst({
        where: { id: { not: player.id }, active: true, user: { status: "ACTIVE" } },
        select: { id: true },
        orderBy: { displayName: "asc" },
      });
      if (!partner) throw new Error("E preciso ter outro jogador ativo para simular uma dupla completa.");

      const [ticketA, ticketB] = await Promise.all([
        grantValidSyncTicketForPlayer(tx, player.id),
        grantValidSyncTicketForPlayer(tx, partner.id),
      ]);
      await tx.syncTicket.updateMany({
        where: { id: { in: [ticketA.id, ticketB.id] } },
        data: { status: "RESERVED" },
      });
      const team = await tx.syncEventTeam.create({
        data: {
          playerAId: player.id,
          playerBId: partner.id,
          ticketAId: ticketA.id,
          ticketBId: ticketB.id,
          status: "COMPLETE",
          completedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: "SyncEventTeam",
          entityId: team.id,
          action: "ADMIN_SIMULATION_TEAM_CREATED",
          after: { playerAId: player.id, playerBId: partner.id, ticketAId: ticketA.id, ticketBId: ticketB.id },
        },
      }).catch(() => null);
    });
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao simular dupla." };
  }
}

const CANCELLABLE_STATUSES = ["OPEN", "COMPLETE", "LINEUP_PENDING", "LINEUP_READY"];

async function cancelTeamTx(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], teamId: string) {
  const team = await tx.syncEventTeam.findUnique({
    where: { id: teamId },
    select: { id: true, status: true, ticketAId: true, ticketBId: true },
  });
  if (!team || !CANCELLABLE_STATUSES.includes(team.status)) {
    throw new Error("Dupla não encontrada ou não pode ser cancelada.");
  }
  const ticketIds = [team.ticketAId, team.ticketBId].filter(Boolean) as string[];
  await tx.syncEventLineup.deleteMany({ where: { teamId: team.id } });
  await tx.syncEventTeam.update({
    where: { id: team.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (ticketIds.length > 0) {
    await tx.syncTicket.updateMany({
      where: { id: { in: ticketIds }, status: "RESERVED" },
      data: { status: "AVAILABLE" },
    });
  }
  return ticketIds;
}

export async function cancelSyncTeamAdminAction(formData: FormData): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const teamId = z.string().min(1).parse(formData.get("teamId"));
    await prisma.$transaction(async (tx) => {
      const ticketIds = await cancelTeamTx(tx, teamId);
      await tx.auditLog.create({
        data: {
          entityType: "SyncEventTeam",
          entityId: teamId,
          action: "ADMIN_TEAM_CANCELLED",
          after: { releasedTicketIds: ticketIds },
        },
      }).catch(() => null);
    });
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao cancelar dupla." };
  }
}

export async function confirmTeamAction(): Promise<{ error?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    const team = await prisma.syncEventTeam.findFirst({
      where: { status: "COMPLETE", OR: [{ playerAId: player.id }, { playerBId: player.id }] },
      select: { id: true, playerAId: true, playerBId: true, confirmedA: true, confirmedB: true },
    });
    if (!team) return { error: "Você não está em uma dupla aguardando confirmação." };

    const isA = team.playerAId === player.id;
    if (isA && team.confirmedA) return { error: "Você já confirmou." };
    if (!isA && team.confirmedB) return { error: "Você já confirmou." };

    const newA = isA ? true : team.confirmedA;
    const newB = isA ? team.confirmedB : true;
    const bothConfirmed = newA && newB;

    await prisma.syncEventTeam.update({
      where: { id: team.id },
      data: {
        confirmedA: newA,
        confirmedB: newB,
        ...(bothConfirmed ? { status: "LINEUP_PENDING", confirmedAt: new Date() } : {}),
      },
    });
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao confirmar dupla." };
  }
}

export async function leaveTeamAction(): Promise<{ error?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    await prisma.$transaction(async (tx) => {
      const team = await tx.syncEventTeam.findFirst({
        where: {
          status: "COMPLETE",
          OR: [{ playerAId: player.id }, { playerBId: player.id }],
        },
        select: { id: true, playerAId: true, playerBId: true, ticketAId: true, ticketBId: true, confirmedA: true, confirmedB: true },
      });
      if (!team) throw new Error("Você não está em uma dupla que pode ser desfeita.");

      // Bloqueia saída se o parceiro já confirmou (ambos só saem via admin após confirmação mútua)
      const isA = team.playerAId === player.id;
      const partnerConfirmed = isA ? team.confirmedB : team.confirmedA;
      if (partnerConfirmed) {
        throw new Error("Seu parceiro já confirmou a dupla. Apenas o admin pode desfazê-la agora.");
      }

      if (isA) {
        // Quem criou a dupla cancela tudo
        await cancelTeamTx(tx, team.id);
      } else {
        // Parceiro B sai: libera apenas o ticket de B, dupla volta para OPEN
        await tx.syncEventTeam.update({
          where: { id: team.id },
          data: {
            playerBId: null,
            ticketBId: null,
            status: "OPEN",
            confirmedA: false,
            confirmedB: false,
          },
        });
        if (team.ticketBId) {
          await tx.syncTicket.update({
            where: { id: team.ticketBId },
            data: { status: "AVAILABLE" },
          });
        }
      }
    });
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao sair da dupla." };
  }
}

export async function cancelMyOpenSyncTeamAction(teamId: string): Promise<{ error?: string }> {
  try {
    const { player } = await requireCurrentPlayer();
    await prisma.$transaction(async (tx) => {
      const team = await tx.syncEventTeam.findUnique({
        where: { id: teamId },
        select: { id: true, status: true, playerAId: true, playerBId: true },
      });
      if (!team || team.status !== "OPEN" || team.playerAId !== player.id || team.playerBId) {
        throw new Error("Esta sala nao pode ser encerrada por voce.");
      }
      await cancelTeamTx(tx, team.id);
    });
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao encerrar sala." };
  }
}

export async function adminGrantSyncTicketAction(
  targetPlayerId: string,
  type: "LEFT" | "RIGHT" | "COMPLETE",
  quantity: number,
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const safeQty = Math.max(1, Math.min(Math.floor(quantity), 20));
    const player = await prisma.player.findUnique({ where: { id: targetPlayerId }, select: { id: true } });
    if (!player) return { error: "Jogador não encontrado." };

    await prisma.$transaction(async (tx) => {
      for (let q = 0; q < safeQty; q++) {
        if (type === "LEFT" || type === "RIGHT") {
          await grantSyncTicketHalf(
            tx,
            targetPlayerId,
            "admin-grant",
            type === "LEFT" ? SyncTicketSide.LEFT : SyncTicketSide.RIGHT,
            targetPlayerId, // gerado pelo próprio jogador
          );
        } else {
          await grantValidSyncTicketForPlayer(tx, targetPlayerId);
        }
      }
    });
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao conceder ticket." };
  }
}

export async function adminRevokeSyncTicketAction(
  targetPlayerId: string,
  type: "LEFT" | "RIGHT" | "COMPLETE",
  quantity: number,
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const safeQty = Math.max(1, Math.min(Math.floor(quantity), 20));

    if (type === "LEFT" || type === "RIGHT") {
      const side = type === "LEFT" ? SyncTicketSide.LEFT : SyncTicketSide.RIGHT;
      const halves = await prisma.syncTicketHalf.findMany({
        where: { ownerId: targetPlayerId, side, status: { in: ["AVAILABLE", "SENT"] } },
        select: { id: true },
        take: safeQty,
      });
      if (halves.length === 0) return { error: "Jogador não possui esta metade de ticket." };
      await prisma.syncTicketHalf.deleteMany({ where: { id: { in: halves.map((h) => h.id) } } });
    } else {
      const tickets = await prisma.syncTicket.findMany({
        where: { ownerId: targetPlayerId, status: { in: ["AVAILABLE", "RESERVED"] } },
        select: { id: true, leftHalfId: true, rightHalfId: true },
        take: safeQty,
      });
      if (tickets.length === 0) return { error: "Jogador não possui ticket completo." };
      for (const t of tickets) {
        await prisma.syncTicket.delete({ where: { id: t.id } });
        await prisma.syncTicketHalf.deleteMany({ where: { id: { in: [t.leftHalfId, t.rightHalfId] } } });
      }
    }
    revalidatePath("/desafio-sincronizado");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao retirar ticket." };
  }
}

const configSchema = z.object({
  ticketsEnabled: z.coerce.boolean().default(false),
  adminSimulationEnabled: z.coerce.boolean().default(false),
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

function parseBrtDateTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.length === 16 ? `${raw}:00-03:00` : `${raw}-03:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function updateSyncChallengeConfigAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const data = configSchema.parse(raw);
  const schedule = {
    registrationOpensAt: parseBrtDateTime(formData.get("registrationOpensAt")),
    registrationClosesAt: parseBrtDateTime(formData.get("registrationClosesAt")),
    round1At: parseBrtDateTime(formData.get("round1At")),
    round2At: parseBrtDateTime(formData.get("round2At")),
    round3At: parseBrtDateTime(formData.get("round3At")),
    tiebreakAt: parseBrtDateTime(formData.get("tiebreakAt")),
    rewardsAt: parseBrtDateTime(formData.get("rewardsAt")),
  };
  await prisma.$transaction(async (tx) => {
    await tx.syncChallengeConfig.upsert({
      where: { id: "singleton" },
      update: {
        ticketsEnabled: data.ticketsEnabled,
        adminSimulationEnabled: data.adminSimulationEnabled,
        ...schedule,
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
        adminSimulationEnabled: data.adminSimulationEnabled,
        ...schedule,
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

    const today = toBrtDateString(new Date());
    const activeRooms = await tx.syncEventRoom.findMany({
      where: {
        date: { gte: today },
        status: { notIn: ["FINISHED", "CANCELLED"] },
      },
      select: { id: true },
    });
    const roomIds = activeRooms.map((room) => room.id);
    if (roomIds.length === 0) return;

    const roundSchedule = [
      { roundNumber: 1, scheduledAt: schedule.round1At },
      { roundNumber: 2, scheduledAt: schedule.round2At },
      { roundNumber: 3, scheduledAt: schedule.round3At },
    ];

    for (const round of roundSchedule) {
      if (!round.scheduledAt) continue;
      await tx.syncEventRound.updateMany({
        where: {
          roomId: { in: roomIds },
          roundNumber: round.roundNumber,
          status: { in: ["PENDING", "SELECTING"] },
        },
        data: { scheduledAt: round.scheduledAt },
      });
    }
  });
  revalidatePath("/desafio-sincronizado");
}
