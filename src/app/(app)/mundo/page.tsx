import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { KANTO_MVP_LOCATIONS } from "@/world-data/kanto/mvp";
import {
  getAdminWorldBattles,
  getAdminWorldEncounters,
  getAdminWorldState,
} from "./actions";
import {
  readWorldParty,
  readWorldMascotState,
  readWorldWild,
  worldMaxHp,
} from "@/world-data/party";
import { WorldModeClient } from "./world-mode-client";
import { KANTO_MVP_MART } from "@/world-data/kanto/mart";
import { prisma } from "@/lib/prisma";
import { KANTO_MVP_TRAINERS } from "@/world-data/kanto/trainers";
import { TIER_PARAMS } from "@/world-data/difficulty";

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
  // Resolve os mascotes da formação com HP/condições persistentes para exibição.
  const party = state ? readWorldParty(state.partyJson) : [];
  const mascotState = state ? readWorldMascotState(state.mascotStateJson) : {};
  const partyRows =
    state && party.length
      ? await prisma.mascot.findMany({
          where: { id: { in: party.map((e) => e.mascotId) }, playerId: state.playerId },
          select: {
            id: true,
            pokemonId: true,
            nickname: true,
            level: true,
            statVitality: true,
          },
        })
      : [];
  const partyRowById = new Map(partyRows.map((m) => [m.id, m]));
  const partyMascots = party
    .map((entry) => {
      const m = partyRowById.get(entry.mascotId);
      if (!m) return null;
      const maxHp = worldMaxHp(m.level, m.statVitality);
      return {
        id: m.id,
        name: m.nickname?.trim() || getPokemonName(m.pokemonId),
        sprite: getSpriteUrl(m.pokemonId),
        level: m.level,
        posture: entry.posture,
        hp: mascotState[m.id]?.hp ?? maxHp,
        maxHp,
        poisoned: mascotState[m.id]?.poisoned ?? false,
      };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
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
          ? (() => {
              const w = readWorldWild(encounterData.active.wildJson);
              const weakenPct = w ? 1 - w.hp / Math.max(1, w.maxHp) : 0;
              const effectiveChance = Math.min(
                95,
                Math.round(encounterData.active.captureChance + weakenPct * 45),
              );
              return {
                ...encounterData.active,
                name: getPokemonName(encounterData.active.pokemonId),
                spriteUrl: getSpriteUrl(encounterData.active.pokemonId),
                createdAt: encounterData.active.createdAt.toISOString(),
                resolvedAt: null,
                wildHp: w?.hp ?? null,
                wildMaxHp: w?.maxHp ?? null,
                wildLevel: w?.level ?? null,
                effectiveChance,
              };
            })()
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
      partyMascots={partyMascots}
      trainers={KANTO_MVP_TRAINERS.map((trainer) => ({
        ...trainer,
        difficultyLabel: TIER_PARAMS[trainer.tier].label,
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
