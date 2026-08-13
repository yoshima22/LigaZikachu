import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getPokemonTypes, getShinySprite, getStaticSpriteUrl } from "@/lib/mascot-data";
import { DeliveryMapPrototype } from "./delivery-map-prototype";

export const dynamic = "force-dynamic";

export default async function DeliveryPrototypePage() {
  const user = await requireAdmin();
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: {
      mascots: {
        where: { arenaState: "FREE" },
        orderBy: [{ isEquipped: "desc" }, { isFavorite: "desc" }, { level: "desc" }],
        take: 120,
        select: {
          id: true,
          pokemonId: true,
          nickname: true,
          level: true,
          statAgility: true,
          statForce: true,
          statInstinct: true,
          statVitality: true,
          isShiny: true,
          staticSpriteUrlOverride: true,
          primaryTypeOverride: true,
          secondaryTypeOverride: true,
        },
      },
    },
  });

  const mascots = (player?.mascots ?? []).map((mascot) => ({
    id: mascot.id,
    name: mascot.nickname?.trim() || getPokemonName(mascot.pokemonId),
    species: getPokemonName(mascot.pokemonId),
    level: mascot.level,
    agility: mascot.statAgility,
    force: mascot.statForce,
    instinct: mascot.statInstinct,
    vitality: mascot.statVitality,
    types: [mascot.primaryTypeOverride, mascot.secondaryTypeOverride].filter((type): type is string => Boolean(type)).length
      ? [mascot.primaryTypeOverride, mascot.secondaryTypeOverride].filter((type): type is string => Boolean(type))
      : getPokemonTypes(mascot.pokemonId),
    spriteUrl: mascot.staticSpriteUrlOverride || (mascot.isShiny ? getShinySprite(mascot.pokemonId) : getStaticSpriteUrl(mascot.pokemonId)),
  }));

  return <DeliveryMapPrototype mascots={mascots} />;
}
