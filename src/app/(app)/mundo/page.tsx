import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { KANTO_MVP_LOCATIONS } from "@/world-data/kanto/mvp";
import { getAdminWorldEncounters, getAdminWorldState } from "./actions";
import { WorldModeClient } from "./world-mode-client";

export const dynamic = "force-dynamic";

export default async function WorldModePage() {
  await requirePlatformAdmin();
  const [state, encounterData] = await Promise.all([
    getAdminWorldState(),
    getAdminWorldEncounters(),
  ]);
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
      initialState={
        state
          ? {
              currentLocationId: state.currentLocationId,
              discoveredLocationIds: state.discoveredLocationIds,
              badges: state.badges,
              fatigue: state.fatigue,
              inventory: state.inventoryJson as {
                pokeBalls?: number;
                potions?: number;
                antidotes?: number;
              },
              travelingToId: state.travelingToId,
              travelStartedAt: state.travelStartedAt?.toISOString() ?? null,
              travelEndsAt: state.travelEndsAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
