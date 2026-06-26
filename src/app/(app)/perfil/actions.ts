"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/permissions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

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

  await prisma.$transaction([
    prisma.player.update({
      where: { id: player.id },
      data: {
        displayName: data.displayName,
        ptcglNick: data.ptcglNick || null,
        popId: data.popId || null,
        avatarUrl: data.avatarUrl || null,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.displayName,
        image: data.avatarUrl || null
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
