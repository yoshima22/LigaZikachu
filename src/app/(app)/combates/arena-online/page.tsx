import { redirect } from "next/navigation";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { getPreferredSpriteUrl } from "@/lib/sprite-preferences";
import { ArenaOnlineLab } from "../../admin/arena-online/arena-online-lab";

export const dynamic = "force-dynamic";

export default async function LivePvpPage() {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const player = await getSessionPlayer(session.user.id);
  if (!player) redirect("/dashboard");
  const mascots = await prisma.mascot.findMany({
    where: { playerId: player.id },
    orderBy: [{ level: "desc" }, { nickname: "asc" }],
    take: 500,
    select: {
      id: true,
      pokemonId: true,
      nickname: true,
      level: true,
      isShiny: true,
      performanceTag: true,
      arenaState: true,
      restingUntil: true,
      bazarListed: true,
      statForce: true,
      statAgility: true,
      statCharisma: true,
      statInstinct: true,
      statVitality: true,
      player: {
        select: {
          displayName: true,
          avatarUrl: true,
          mascotSpritePreference: true,
          megaSpritePreference: true,
        },
      },
      expeditions: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { id: true },
      },
    },
  });

  return (
    <div className="space-y-5">
      <ArenaOnlineLab
        onlineIdentity={{ playerId: player.id, playerName: player.displayName }}
        mascots={mascots.map((mascot) => ({
          id: mascot.id,
          pokemonId: mascot.pokemonId,
          name: mascot.nickname ?? getPokemonName(mascot.pokemonId),
          ownerName: mascot.player.displayName,
          ownerAvatarUrl: mascot.player.avatarUrl,
          performanceTag: mascot.performanceTag,
          level: mascot.level,
          types: getPokemonTypes(mascot.pokemonId),
          spriteUrl: getPreferredSpriteUrl(mascot.pokemonId, mascot.player, {
            shiny: mascot.isShiny,
          }),
          statForce: mascot.statForce,
          statAgility: mascot.statAgility,
          statCharisma: mascot.statCharisma,
          statInstinct: mascot.statInstinct,
          statVitality: mascot.statVitality,
          gameStatus: mascot.expeditions.length
            ? "Em expedição"
            : mascot.bazarListed
              ? "Anunciado no bazar"
              : mascot.arenaState === "INJURED"
                ? "Ferido"
                : mascot.arenaState === "RESTING" ||
                    (mascot.restingUntil && mascot.restingUntil > new Date())
                  ? "Em repouso"
                  : mascot.arenaState === "ARENA"
                    ? "Na Arena"
                    : "Disponível",
        }))}
      />
    </div>
  );
}
