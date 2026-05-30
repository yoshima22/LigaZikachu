"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { rarityFromStats, generationFromId } from "@/lib/sticker-pack";
import { PokemonRarity } from "@prisma/client";

// ── Importar Pokémon da PokeAPI ───────────────────────────────────────────────

const importSchema = z.object({
  from: z.number().int().min(1).max(1025),
  to: z.number().int().min(1).max(1025)
});

export async function importPokemonRange(
  raw: z.infer<typeof importSchema>
): Promise<{ imported: number; error?: string }> {
  try {
    await requireAdmin();
    const { from, to } = importSchema.parse(raw);
    if (to < from) return { imported: 0, error: "Intervalo inválido." };
    if (to - from > 50) return { imported: 0, error: "Máximo de 50 Pokémon por importação." };

    let imported = 0;

    for (let id = from; id <= to; id++) {
      const existing = await prisma.pokemonCard.findUnique({ where: { nationalId: id } });
      if (existing) continue;

      try {
        const [pokemon, species] = await Promise.all([
          fetch(`https://pokeapi.co/api/v2/pokemon/${id}`, { next: { revalidate: 86400 } }).then((r) => r.json()),
          fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`, { next: { revalidate: 86400 } }).then((r) => r.json())
        ]);

        const baseStatTotal = (pokemon.stats as { base_stat: number }[]).reduce((s: number, st: { base_stat: number }) => s + st.base_stat, 0);
        const isLegendary = species.is_legendary as boolean;
        const isMythical = species.is_mythical as boolean;
        const rarity = rarityFromStats(baseStatTotal, isLegendary, isMythical);

        const ptName = (species.names as { language: { name: string }; name: string }[])
          .find((n) => n.language.name === "pt-BR")?.name ?? pokemon.name as string;

        const imageUrl = (pokemon.sprites?.other?.["official-artwork"]?.front_default as string | null)
          ?? (pokemon.sprites?.front_default as string | null)
          ?? null;

        const types = (pokemon.types as { type: { name: string } }[]).map((t) => t.type.name);
        const generation = generationFromId(id);

        await prisma.pokemonCard.create({
          data: {
            nationalId: id,
            name: pokemon.name as string,
            displayName: ptName,
            generation,
            types,
            imageUrl,
            rarity
          }
        });

        imported++;
        await new Promise((res) => setTimeout(res, 150)); // rate limit
      } catch {
        // Skip failed imports silently
      }
    }

    revalidatePath("/album");
    revalidatePath("/album/admin");
    return { imported };
  } catch (err) {
    if (err instanceof z.ZodError) return { imported: 0, error: err.issues[0].message };
    return { imported: 0, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Editar raridade de um Pokémon ─────────────────────────────────────────────

export async function setPokemonRarity(cardId: string, rarity: PokemonRarity): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.pokemonCard.update({ where: { id: cardId }, data: { rarity } });
    revalidatePath("/album");
    revalidatePath("/album/admin");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Gerenciar pacotes ─────────────────────────────────────────────────────────

const packSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  price: z.number().int().min(1),
  cardCount: z.number().int().min(1).max(10),
  generation: z.number().int().min(1).max(9).nullable(),
  rarityBoost: z.boolean()
});

export async function createStickerPack(raw: z.infer<typeof packSchema>): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const data = packSchema.parse(raw);
    await prisma.stickerPack.create({ data: { ...data, description: data.description || null } });
    revalidatePath("/album");
    revalidatePath("/album/admin");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function toggleStickerPack(packId: string, active: boolean): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.stickerPack.update({ where: { id: packId }, data: { active } });
    revalidatePath("/album");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
