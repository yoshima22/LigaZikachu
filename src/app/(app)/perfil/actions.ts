"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(60),
  ptcglNick: z.string().max(60).optional(),
  avatarUrl: z.string().url().optional(),
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

  await prisma.player.update({
    where: { id: player.id },
    data: {
      displayName: data.displayName,
      ptcglNick: data.ptcglNick || null,
      avatarUrl: data.avatarUrl || null,
    },
  });

  revalidatePath("/perfil");
  revalidatePath("/dashboard");
  return { success: true };
}
