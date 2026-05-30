"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";

const deckSchema = z.object({
  name: z.string().trim().min(1).max(120),
  archetype: z.string().trim().max(120).optional(),
  deckList: z.string().trim().min(5).max(12000),
  isPublic: z.boolean().default(false)
});

export async function saveDeck(raw: z.infer<typeof deckSchema>): Promise<{ id?: string; error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
    if (!player) return { error: "Jogador não encontrado." };

    const data = deckSchema.parse(raw);
    const deck = await prisma.savedDeck.create({
      data: { ...data, archetype: data.archetype ?? null, playerId: player.id }
    });

    revalidatePath("/perfil/meus-decks");
    return { id: deck.id };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function updateDeck(deckId: string, raw: z.infer<typeof deckSchema>): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
    if (!player) return { error: "Jogador não encontrado." };

    const deck = await prisma.savedDeck.findUnique({ where: { id: deckId } });
    if (!deck || deck.playerId !== player.id) return { error: "Deck não encontrado." };

    const data = deckSchema.parse(raw);
    await prisma.savedDeck.update({
      where: { id: deckId },
      data: { ...data, archetype: data.archetype ?? null }
    });

    revalidatePath("/perfil/meus-decks");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function deleteDeck(deckId: string): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };
    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
    if (!player) return { error: "Jogador não encontrado." };

    const deck = await prisma.savedDeck.findUnique({ where: { id: deckId } });
    if (!deck || deck.playerId !== player.id) return { error: "Deck não encontrado." };

    await prisma.savedDeck.delete({ where: { id: deckId } });
    revalidatePath("/perfil/meus-decks");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
