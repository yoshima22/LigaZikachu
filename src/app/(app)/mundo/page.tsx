import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { getPokemonName } from "@/lib/mascot-data";
import { KANTO_MVP_LOCATIONS } from "@/world-data/kanto/mvp";
import { getAdminWorldState } from "./actions";
import { WorldModeClient } from "./world-mode-client";

export const dynamic = "force-dynamic";

export default async function WorldModePage() {
  await requirePlatformAdmin();
  const state = await getAdminWorldState();
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

