import { prisma } from "@/lib/prisma";

export type ProfileCollectionGeneration = {
  generation: number;
  total: number;
  stickers: number;
  mascots: number;
};

export type ProfileCollectionProgress = {
  total: number;
  stickers: number;
  mascots: number;
  generations: ProfileCollectionGeneration[];
};

export async function getProfileCollectionProgress(playerId: string): Promise<ProfileCollectionProgress> {
  const [generationTotals, ownedStickers, dexRows] = await Promise.all([
    prisma.pokemonCard.groupBy({
      by: ["generation"],
      where: { active: true },
      _count: { id: true },
      orderBy: { generation: "asc" },
    }),
    prisma.playerSticker.findMany({
      where: { playerId },
      select: { cardId: true, card: { select: { generation: true } } },
    }),
    prisma.playerPokemonDex.findMany({
      where: { playerId },
      select: { pokemonId: true },
    }),
  ]);

  const discoveredIds = [...new Set(dexRows.map((row) => row.pokemonId))];
  const discoveredCards = discoveredIds.length > 0
    ? await prisma.pokemonCard.findMany({
        where: { active: true, nationalId: { in: discoveredIds } },
        select: { generation: true, nationalId: true },
      })
    : [];

  const stickersByGeneration = new Map<number, number>();
  for (const sticker of ownedStickers) {
    stickersByGeneration.set(sticker.card.generation, (stickersByGeneration.get(sticker.card.generation) ?? 0) + 1);
  }

  const mascotsByGeneration = new Map<number, Set<number>>();
  for (const card of discoveredCards) {
    const ids = mascotsByGeneration.get(card.generation) ?? new Set<number>();
    ids.add(card.nationalId);
    mascotsByGeneration.set(card.generation, ids);
  }

  const generations = generationTotals.map((row) => ({
    generation: row.generation,
    total: row._count.id,
    stickers: stickersByGeneration.get(row.generation) ?? 0,
    mascots: mascotsByGeneration.get(row.generation)?.size ?? 0,
  }));

  return {
    total: generations.reduce((sum, row) => sum + row.total, 0),
    stickers: ownedStickers.length,
    mascots: new Set(discoveredCards.map((card) => card.nationalId)).size,
    generations,
  };
}
