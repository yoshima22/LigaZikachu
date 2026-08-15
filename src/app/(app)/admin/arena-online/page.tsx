import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { getPreferredSpriteUrl } from "@/lib/sprite-preferences";
import { ArenaOnlineLab } from "./arena-online-lab";
import { LivePvpAccessPanel } from "./access-panel";
import { getLivePvpAccessConfig } from "@/lib/live-pvp-access";

export const dynamic = "force-dynamic";

export default async function ArenaOnlinePage() {
  await requireAdmin();
  const [mascots, accessConfig, players] = await Promise.all([
    prisma.mascot.findMany({
      where: { player: { user: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } } },
      orderBy: [{ player: { displayName: "asc" } }, { level: "desc" }],
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
    }),
    getLivePvpAccessConfig(),
    prisma.player.findMany({
      where: { active: true, user: { status: "ACTIVE" } },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        user: { select: { email: true } },
      },
    }),
  ]);
  return (
    <div className="space-y-5">
      <LivePvpAccessPanel
        initialConfig={accessConfig}
        players={players.map((player) => ({
          id: player.id,
          displayName: player.displayName,
          email: player.user.email,
        }))}
      />
      <ArenaOnlineLab
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
