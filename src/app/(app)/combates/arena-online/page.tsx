import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/permissions";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  canAccessLivePvp,
  getLivePvpAccessConfig,
} from "@/lib/live-pvp-access";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { getPreferredSpriteUrl } from "@/lib/sprite-preferences";
import { ArenaOnlineLab } from "../../admin/arena-online/arena-online-lab";
import { LivePvpAccessPanel } from "../../admin/arena-online/access-panel";

export const dynamic = "force-dynamic";

export default async function LivePvpPage() {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const player = await getSessionPlayer(session.user.id);
  if (!player) redirect("/dashboard");
  const admin = isAdmin(session.user.role);
  const config = await getLivePvpAccessConfig();
  if (!canAccessLivePvp(config, player.id, admin)) redirect("/dashboard");

  const [mascots, accessPlayers] = await Promise.all([
    prisma.mascot.findMany({
      where: admin
        ? { player: { user: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } } }
        : { playerId: player.id },
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
    }),
    admin
      ? prisma.player.findMany({
          where: { active: true, user: { status: "ACTIVE" } },
          orderBy: { displayName: "asc" },
          select: {
            id: true,
            displayName: true,
            user: { select: { email: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      {admin && (
        <LivePvpAccessPanel
          initialConfig={config}
          players={accessPlayers.map((entry) => ({
            id: entry.id,
            displayName: entry.displayName,
            email: entry.user.email,
          }))}
        />
      )}
      <ArenaOnlineLab
        onlineIdentity={{ playerId: player.id, playerName: player.displayName }}
        mascots={mascots.map((mascot) => ({
          ...mascot,
          name: mascot.nickname ?? getPokemonName(mascot.pokemonId),
          ownerName: mascot.player.displayName,
          ownerAvatarUrl: mascot.player.avatarUrl,
          types: getPokemonTypes(mascot.pokemonId),
          spriteUrl: getPreferredSpriteUrl(mascot.pokemonId, mascot.player, {
            shiny: mascot.isShiny,
          }),
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
