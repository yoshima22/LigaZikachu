"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/permissions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { getStandbyUntilFromNotes, setStandbyUntilInNotes } from "@/lib/account-standby";
import { retireArenaTeam } from "@/lib/arena-z";
import { uploadAvatarToStorage } from "@/lib/avatar-storage";
import { parseBirthDateInput } from "@/lib/birthday";

const MAX_WISHLIST_POKEMON = 9;
const MAX_WISHLIST_ITEMS = 12;

// Nick precisa ter ao menos 4 caracteres e não pode conter símbolos especiais
// (permitido: letras — inclusive acentuadas —, números e espaços).
const displayNameSchema = z
  .string()
  .trim()
  .min(4, "O nome precisa ter ao menos 4 caracteres.")
  .max(60, "O nome pode ter no máximo 60 caracteres.")
  .regex(/^[\p{L}\p{N} ]+$/u, "O nome não pode conter símbolos especiais.");

const updateProfileSchema = z.object({
  displayName: displayNameSchema,
  ptcglNick: z.string().max(60).optional(),
  popId: z.string().max(30).optional(),
  mascotSpritePreference: z.enum(["ANIMATED", "STATIC"]).optional(),
  megaSpritePreference: z.enum(["ANIMATED", "STATIC"]).optional(),
  disableProfileIntro: z.boolean().optional(),
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

const WISHLIST_EGG_RARITY = z.enum(["COMMON", "RARE", "SPECIAL", "EVENT", "LAB"]);
const updatePokemonWishlistSchema = z.object({
  pokemon: z.array(z.object({
    pokemonId: z.number().int().min(1).max(1025),
    eggRarities: z.array(WISHLIST_EGG_RARITY).max(5).default([]),
  })).max(MAX_WISHLIST_POKEMON),
  itemIds: z.array(z.string().min(1)).max(MAX_WISHLIST_ITEMS).default([]),
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

// Define a data de aniversário uma única vez (não pode ser alterada depois).
export async function setBirthDateAction(birthDate: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true, birthDate: true } });
  if (!player) return { ok: false, error: "Jogador não encontrado." };
  if (player.birthDate) return { ok: false, error: "Sua data de aniversário já foi definida e não pode ser alterada." };
  const parsed = parseBirthDateInput(birthDate);
  if (!parsed) return { ok: false, error: "Data de nascimento inválida." };
  // updateMany com guarda birthDate: null evita corrida (só grava se ainda estiver vazio).
  const res = await prisma.player.updateMany({ where: { id: player.id, birthDate: null }, data: { birthDate: parsed } });
  if (res.count === 0) return { ok: false, error: "Sua data de aniversário já foi definida e não pode ser alterada." };
  revalidatePath("/perfil");
  return { ok: true };
}

export async function updatePlayerProfile(input: z.infer<typeof updateProfileSchema>) {
  const user = await getSessionUser();
  if (!user) return { error: "Nao autenticado" };

  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true, nameChangeCount: true }
  });
  if (!player) return { error: "Jogador nao encontrado" };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  // Troca de nome: apenas 1 por conta (admin pode liberar outra). Só conta quando
  // o displayName realmente muda — editar avatar/nick/prefs não consome a troca.
  const nameChanged = data.displayName.trim() !== player.displayName.trim();
  if (nameChanged && player.nameChangeCount >= 1) {
    return { error: "Você já usou sua troca de nome. Peça a um admin para liberar outra." };
  }

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
        ...(nameChanged ? { nameChangeCount: { increment: 1 } } : {}),
        ptcglNick: data.ptcglNick || null,
        popId: data.popId || null,
        avatarUrl,
        mascotSpritePreference: data.mascotSpritePreference ?? "ANIMATED",
        megaSpritePreference: data.megaSpritePreference ?? "ANIMATED",
        ...(data.disableProfileIntro !== undefined ? { disableProfileIntro: data.disableProfileIntro } : {}),
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
  // Dedup por pokemonId, preservando a ordem e as raridades escolhidas.
  const pokemonMap = new Map<number, string[]>();
  for (const entry of data.pokemon) if (!pokemonMap.has(entry.pokemonId)) pokemonMap.set(entry.pokemonId, [...new Set(entry.eggRarities)]);
  const pokemonList = [...pokemonMap.entries()].map(([pokemonId, eggRarities]) => ({ pokemonId, eggRarities }));
  const pokemonIds = pokemonList.map((p) => p.pokemonId);
  const requestedItemIds = Array.from(new Set(data.itemIds));

  const validItems = requestedItemIds.length > 0
    ? await prisma.shopItem.findMany({
        where: { id: { in: requestedItemIds }, inventoryEnabled: true },
        select: { id: true },
      })
    : [];
  const validItemIds = requestedItemIds.filter((itemId) => validItems.some((item) => item.id === itemId));
  if (validItemIds.length !== requestedItemIds.length) return { error: "Um ou mais itens da wishlist nao estao disponiveis." };

  await prisma.$transaction(async (tx) => {
    await tx.playerPokemonWishlist.deleteMany({
      where: { playerId: player.id, pokemonId: { notIn: pokemonIds.length ? pokemonIds : [0] } },
    });

    for (const [index, { pokemonId, eggRarities }] of pokemonList.entries()) {
      await tx.playerPokemonWishlist.upsert({
        where: { playerId_pokemonId: { playerId: player.id, pokemonId } },
        create: { playerId: player.id, pokemonId, sortOrder: index, eggRarities },
        update: { sortOrder: index, eggRarities },
      });
    }

    await tx.playerItemWishlist.deleteMany({
      where: { playerId: player.id, itemId: { notIn: validItemIds.length ? validItemIds : [""] } },
    });

    for (const [index, itemId] of validItemIds.entries()) {
      await tx.playerItemWishlist.upsert({
        where: { playerId_itemId: { playerId: player.id, itemId } },
        create: { playerId: player.id, itemId, sortOrder: index },
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
