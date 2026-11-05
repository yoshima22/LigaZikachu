import { prisma } from "@/lib/prisma";

// Espécies/formas desligadas no admin (EggPokemonToggle). Config que muda raramente:
// cache de 60 s por instância para não bater no banco a cada sorteio, loja ou página.
let cache: { ids: number[]; at: number } | null = null;
export async function getDisabledEggPokemonIds(): Promise<number[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.ids;
  const rows = await prisma.eggPokemonToggle.findMany({ where: { disabled: true }, select: { pokemonId: true } });
  const ids = rows.map((r) => r.pokemonId);
  cache = { ids, at: Date.now() };
  return ids;
}
