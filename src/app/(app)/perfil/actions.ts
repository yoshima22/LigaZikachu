"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/permissions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { getStandbyUntilFromNotes, setStandbyUntilInNotes } from "@/lib/account-standby";
import { retireArenaTeam } from "@/lib/arena-z";
import { uploadAvatarToStorage } from "@/lib/avatar-storage";

const MAX_WISHLIST_POKEMON = 9;

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(60),
  ptcglNick: z.string().max(60).optional(),
  popId: z.string().max(30).optional(),
  avatarUrl: z
    .string()
    .max(1_200_000, "A imagem esta muito grande. Use uma imagem menor.")
    .refine(
      (value) =>
        !value ||
        value.startsWith("data:image/") ||
        value.startsWith("https://") ||
        value.startsWith("http://"),
      "Use uma imagem valida."
    )
    .optional(),
});

const updatePokemonWishlistSchema = z.object({
  pokemonIds: z.array(z.number().int().min(1).max(1025)).max(MAX_WISHLIST_POKEMON),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8, "Informe sua senha atual."),
  newPassword: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres.").max(72),
  confirmPassword: z.string().min(8, "Confirme a nova senha.")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "A confirmacao nao confere com a nova senha.",
  path: ["confirmPassword"]
});

const standbySchema = z.object({
  days: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60), z.literal(90)]),
});

const SYNC_CANCELLABLE = ["OPEN", "COMPLETE", "LINEUP_PENDING", "LINEUP_READY"] as const;

export async function setCasualModeAction(
  enabled: boolean,
  force?: boolean
): Promise<{ error?: string; success?: boolean; requiresConfirm?: boolean; arenaTeamCount?: number; syncTeamCount?: number }> {
  const user = await getSessionUser();
  if (!user) return { error: "Nao autenticado" };

  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!player) return { error: "Jogador nao encontrado" };

  if (enabled && !force) {
    const [arenaTeamCount, syncTeamCount] = await Promise.all([
      prisma.arenaTeam.count({
        where: { playerId: player.id, status: { in: ["ACTIVE", "DEFEATED"] } },
      }),
      prisma.syncEventTeam.count({
        where: {
          OR: [{ playerAId: player.id }, { playerBId: player.id }],
          status: { in: [...SYNC_CANCELLABLE] },
        },
      }),
    ]);
    if (arenaTeamCount > 0 || syncTeamCount > 0) {
      return { requiresConfirm: true, arenaTeamCount, syncTeamCount };
    }
  }

  if (enabled && force) {
    // Retire all arena teams — collect vault when possible, force-abandon otherwise
    const arenaTeams = await prisma.arenaTeam.findMany({
      where: { playerId: player.id, status: { in: ["ACTIVE", "DEFEATED"] } },
      select: { id: true },
    });
    for (const team of arenaTeams) {
      try {
        await retireArenaTeam(player.id, team.id);
      } catch {
        // Exit locked or unseen PvP: force-retire with zero loot
        const members = await prisma.arenaTeamMember.findMany({
          where: { teamId: team.id },
          select: { mascotId: true },
        });
        await prisma.$transaction(async (tx) => {
          if (members.length > 0) {
            await tx.mascot.updateMany({
              where: { id: { in: members.map(m => m.mascotId) }, arenaState: { not: "INJURED" } },
              data: { arenaState: "FREE", restingUntil: null },
            });
          }
          await tx.arenaTeam.update({
            where: { id: team.id },
            data: { status: "RETIRED", vaultCoins: 0, vaultExp: 0, vaultFood: 0, vaultSweet: 0 },
          });
        });
      }
    }

    // Cancel all active sync teams and return tickets
    const syncTeams = await prisma.syncEventTeam.findMany({
      where: {
        OR: [{ playerAId: player.id }, { playerBId: player.id }],
        status: { in: [...SYNC_CANCELLABLE] },
      },
      select: { id: true, ticketAId: true, ticketBId: true },
    });
    for (const team of syncTeams) {
      const ticketIds = [team.ticketAId, team.ticketBId].filter(Boolean) as string[];
      await prisma.$transaction(async (tx) => {
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
      });
    }
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { casualMode: enabled },
  });

  revalidatePath("/perfil");
  revalidatePath("/arena-z");
  revalidatePath("/desafio-sincronizado");
  return { success: true };
}

export async function updatePlayerProfile(input: z.infer<typeof updateProfileSchema>) {
  const user = await getSessionUser();
  if (!user) return { error: "Nao autenticado" };

  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true }
  });
  if (!player) return { error: "Jogador nao encontrado" };

  const data = updateProfileSchema.parse(input);

  // Verifica unicidade do nick PTCG Live (case-insensitive, excluindo o próprio jogador)
  if (data.ptcglNick) {
    const conflicting = await prisma.player.findFirst({
      where: {
        ptcglNick: { equals: data.ptcglNick, mode: "insensitive" },
        id: { not: player.id }
      }
    });
    if (conflicting) {
      return { error: "Esse nick do PTCG Live já está em uso por outra conta." };
    }
  }

  // Avatar em base64 vai para o Storage — o banco guarda só a URL pública.
  // Salvar o base64 direto na coluna multiplicava o egress em todo select.
  let avatarUrl = data.avatarUrl || null;
  if (avatarUrl?.startsWith("data:image/")) {
    try {
      avatarUrl = await uploadAvatarToStorage(player.id, avatarUrl);
    } catch (err) {
      console.error("[Perfil] avatar upload failed", { playerId: player.id, err });
      return { error: "Falha ao enviar a imagem de avatar. Tente novamente." };
    }
  }

  await prisma.$transaction([
    prisma.player.update({
      where: { id: player.id },
      data: {
        displayName: data.displayName,
        ptcglNick: data.ptcglNick || null,
        popId: data.popId || null,
        avatarUrl,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.displayName,
        image: avatarUrl
      }
    })
  ]);

  revalidatePath("/perfil");
  revalidatePath("/dashboard");
  revalidatePath(`/jogadores/${player.id}`);
  return { success: true };
}

export async function updateOwnPassword(input: z.infer<typeof updatePasswordSchema>) {
  const user = await getSessionUser();
  if (!user) return { error: "Nao autenticado" };

  const data = updatePasswordSchema.parse(input);
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true }
  });

  if (!dbUser?.passwordHash) return { error: "Conta sem senha local para alterar." };

  const valid = await verifyPassword(data.currentPassword, dbUser.passwordHash);
  if (!valid) return { error: "Senha atual incorreta." };

  const passwordHash = await hashPassword(data.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "user",
        entityId: user.id,
        action: "user.password_changed"
      }
    })
  ]);

  return { success: true };
}

export async function updatePokemonWishlist(input: z.infer<typeof updatePokemonWishlistSchema>) {
  const user = await getSessionUser();
  if (!user) return { error: "Nao autenticado" };

  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!player) return { error: "Jogador nao encontrado" };

  const data = updatePokemonWishlistSchema.parse(input);
  const pokemonIds = Array.from(new Set(data.pokemonIds));

  await prisma.$transaction(async (tx) => {
    await tx.playerPokemonWishlist.deleteMany({
      where: { playerId: player.id, pokemonId: { notIn: pokemonIds.length ? pokemonIds : [0] } },
    });

    for (const [index, pokemonId] of pokemonIds.entries()) {
      await tx.playerPokemonWishlist.upsert({
        where: { playerId_pokemonId: { playerId: player.id, pokemonId } },
        create: { playerId: player.id, pokemonId, sortOrder: index },
        update: { sortOrder: index },
      });
    }
  });

  revalidatePath("/perfil");
  revalidatePath(`/jogadores/${player.id}`);
  return { success: true };
}

export async function activateAccountStandby(input: z.infer<typeof standbySchema>) {
  const user = await getSessionUser();
  if (!user) return { error: "Nao autenticado" };

  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true, notes: true },
  });
  if (!player) return { error: "Jogador nao encontrado" };
  const currentStandbyUntil = getStandbyUntilFromNotes(player.notes);
  if (currentStandbyUntil && currentStandbyUntil > new Date()) {
    return { error: "Sua conta ja esta em standby. Nao e possivel encerrar antes da data definida." };
  }

  const data = standbySchema.parse(input);
  const standbyUntil = new Date(Date.now() + data.days * 24 * 60 * 60_000);

  await prisma.$transaction([
    prisma.player.update({
      where: { id: player.id },
      data: { notes: setStandbyUntilInNotes(player.notes, standbyUntil) },
    }),
    prisma.mascot.updateMany({
      where: { playerId: player.id },
      data: {
        lastFedAt: standbyUntil,
        lastInteractedAt: standbyUntil,
        mood: "HAPPY",
      },
    }),
    prisma.mascotSocialEvent.updateMany({
      where: { ownerId: player.id, eventType: "RUNAWAY_WARNING", status: "PENDING" },
      data: {
        status: "RESOLVED",
        resolvedBy: "SYSTEM",
        resolvedOptionId: "account_standby",
        resolvedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "player",
        entityId: player.id,
        action: "player.account_standby",
        metadata: { days: data.days, standbyUntil: standbyUntil.toISOString() },
      },
    }),
  ]);

  revalidatePath("/perfil");
  revalidatePath("/mascotes");
  revalidatePath("/lacos");
  return { success: true, standbyUntil };
}
