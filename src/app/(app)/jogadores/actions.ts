"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { Role, UserStatus } from "@prisma/client";

const editSchema = z.object({
  playerId: z.string().min(1),
  displayName: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(50),
  ptcglNick: z.string().max(50).nullish(),
  whatsapp: z.string().max(20).nullish(),
  notes: z.string().max(500).nullish()
});

async function getAdminActor() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  if (!isAdmin(session.user.role)) throw new Error("Sem permissão");
  return session.user;
}

export async function approvePlayerAction(userId: string) {
  const actor = await getAdminActor();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true }
  });
  if (!user) throw new Error("Usuário não encontrado");
  if (user.status === UserStatus.ACTIVE) return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE, approvedById: actor.id }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        entityType: "user",
        entityId: userId,
        action: "user.approved",
        before: { status: user.status },
        after: { status: UserStatus.ACTIVE }
      }
    })
  ]);

  revalidatePath("/jogadores");
}

export async function toggleSuspendPlayerAction(userId: string) {
  const actor = await getAdminActor();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true }
  });
  if (!user) throw new Error("Usuário não encontrado");

  const newStatus =
    user.status === UserStatus.SUSPENDED ? UserStatus.ACTIVE : UserStatus.SUSPENDED;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status: newStatus } }),
    prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        entityType: "user",
        entityId: userId,
        action: newStatus === UserStatus.SUSPENDED ? "user.suspended" : "user.reactivated",
        before: { status: user.status },
        after: { status: newStatus }
      }
    })
  ]);

  revalidatePath("/jogadores");
}

export async function editPlayerAction(
  data: z.infer<typeof editSchema>
): Promise<{ error?: string }> {
  try {
    const actor = await getAdminActor();
    const parsed = editSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join(", ") };
    }
    const { playerId, displayName, ptcglNick, whatsapp, notes } = parsed.data;

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, displayName: true, ptcglNick: true, whatsapp: true, notes: true }
    });
    if (!player) return { error: "Jogador não encontrado" };

    await prisma.$transaction([
      prisma.player.update({
        where: { id: playerId },
        data: {
          displayName,
          ptcglNick: ptcglNick ?? null,
          whatsapp: whatsapp ?? null,
          notes: notes ?? null
        }
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: "player",
          entityId: playerId,
          action: "player.edited",
          before: { displayName: player.displayName, ptcglNick: player.ptcglNick, whatsapp: player.whatsapp, notes: player.notes },
          after: { displayName, ptcglNick, whatsapp, notes }
        }
      })
    ]);

    revalidatePath("/jogadores");
    revalidatePath(`/jogadores/${playerId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function removeFromSeasonAction(playerId: string, seasonId: string) {
  const actor = await getAdminActor();
  if (actor.role !== Role.SUPER_ADMIN) throw new Error("Apenas SUPER_ADMIN pode remover jogadores da temporada");

  const sp = await prisma.seasonPlayer.findUnique({
    where: { seasonId_playerId: { seasonId, playerId } },
    select: { id: true, isActive: true }
  });
  if (!sp) throw new Error("Jogador não está nesta temporada");

  await prisma.$transaction([
    prisma.seasonPlayer.update({
      where: { seasonId_playerId: { seasonId, playerId } },
      data: { isActive: false, leftAt: new Date() }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        entityType: "seasonPlayer",
        entityId: sp.id,
        action: "seasonPlayer.removed",
        before: { isActive: true },
        after: { isActive: false },
        metadata: { seasonId, playerId }
      }
    })
  ]);

  revalidatePath("/jogadores");
}
