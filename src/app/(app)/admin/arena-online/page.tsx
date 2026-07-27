import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { getPreferredSpriteUrl } from "@/lib/sprite-preferences";
import { ArenaOnlineLab } from "./arena-online-lab";

export const dynamic = "force-dynamic";

export default async function ArenaOnlinePage() {
  await requireAdmin();
  const mascots = await prisma.mascot.findMany({
    where: { player: { user: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } } },
    orderBy: [{ player: { displayName: "asc" } }, { level: "desc" }],
    take: 500,
    select: {
      id: true,
      pokemonId: true,
      nickname: true,
      level: true,
      isShiny: true,
      statForce: true,
      statAgility: true,
      statCharisma: true,
      statInstinct: true,
      statVitality: true,
      player: {
        select: {
          displayName: true,
          mascotSpritePreference: true,
          megaSpritePreference: true,
        },
      },
    },
  });
  return (
    <ArenaOnlineLab
      mascots={mascots.map((mascot) => ({
        ...mascot,
        name: mascot.nickname ?? getPokemonName(mascot.pokemonId),
        ownerName: mascot.player.displayName,
        types: getPokemonTypes(mascot.pokemonId),
        spriteUrl: getPreferredSpriteUrl(mascot.pokemonId, mascot.player, {
          shiny: mascot.isShiny,
        }),
      }))}
    />
  );
}
