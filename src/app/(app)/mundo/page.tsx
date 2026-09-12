import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { KANTO_MVP_LOCATIONS } from "@/world-data/kanto/mvp";
import {
  getAdminWorldBattles,
  getAdminWorldEncounters,
  getAdminWorldState,
} from "./actions";
import { readWorldParty } from "@/world-data/party";
import { WorldModeClient } from "./world-mode-client";
import { KANTO_MVP_MART } from "@/world-data/kanto/mart";
import { prisma } from "@/lib/prisma";
import { KANTO_MVP_TRAINERS } from "@/world-data/kanto/trainers";

export const dynamic = "force-dynamic";

export default async function WorldModePage() {
  await requirePlatformAdmin();
  const [state, encounterData, battleData] = await Promise.all([
    getAdminWorldState(),
    getAdminWorldEncounters(),
    getAdminWorldBattles(),
  ]);
  const wallet = state
    ? await prisma.zikaCoinWallet.findUnique({ where: { playerId: state.playerId }, select: { balance: true } })
    : null;
  const locations = KANTO_MVP_LOCATIONS.map((location) => ({
    ...location,
    encounters: location.encounters.map((encounter) => ({
      ...encounter,
      name: getPokemonName(encounter.speciesId),
    })),
  }));
  return (
    <WorldModeClient
      locations={locations}
      encounters={{
        active: encounterData.active
          ? {
              ...encounterData.active,
              name: getPokemonName(encounterData.active.pokemonId),
              spriteUrl: getSpriteUrl(encounterData.active.pokemonId),
              createdAt: encounterData.active.createdAt.toISOString(),
              resolvedAt: null,
            }
          : null,
        history: encounterData.history.map((entry) => ({
          ...entry,
          name: getPokemonName(entry.pokemonId),
          resolvedAt: entry.resolvedAt?.toISOString() ?? null,
          createdAt: entry.createdAt.toISOString(),
        })),
      }}
      martItems={KANTO_MVP_MART}
      zikaCoins={wallet?.balance ?? 0}
      trainers={KANTO_MVP_TRAINERS.map((trainer) => ({
        ...trainer,
        team: trainer.team.map((mascot) => ({ ...mascot, name: getPokemonName(mascot.pokemonId), spriteUrl: getSpriteUrl(mascot.pokemonId) })),
      }))}
      battles={battleData.map((battle) => ({
        id: battle.id,
        trainerId: battle.trainerId,
        trainerName: battle.trainerName,
        winner: battle.winner,
        rounds: battle.rounds,
        reward: battle.rewardJson,
        result: battle.resultJson,
        createdAt: battle.createdAt.toISOString(),
      }))}
      initialState={
        state
          ? {
              currentLocationId: state.currentLocationId,
              discoveredLocationIds: state.discoveredLocationIds,
              badges: state.badges,
              defeatedTrainerIds: state.defeatedTrainerIds,
              fatigue: state.fatigue,
              inventory: state.inventoryJson as {
                pokeBalls?: number;
                potions?: number;
                antidotes?: number;
              },
              travelingToId: state.travelingToId,
              travelStartedAt: state.travelStartedAt?.toISOString() ?? null,
              travelEndsAt: state.travelEndsAt?.toISOString() ?? null,
              party: readWorldParty(state.partyJson),
            }
          : null
      }
    />
  );
}
