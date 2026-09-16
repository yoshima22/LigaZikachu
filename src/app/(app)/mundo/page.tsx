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
  readWorldWild,
  worldMaxHp,
} from "@/world-data/party";
import { WorldModeClient } from "./world-mode-client";
import { KANTO_MVP_MART } from "@/world-data/kanto/mart";
import { prisma } from "@/lib/prisma";
import { KANTO_MVP_TRAINERS } from "@/world-data/kanto/trainers";
import { TIER_PARAMS } from "@/world-data/difficulty";
import { WORLD_STARTERS } from "@/world-data/starters";
import { normalizeWorldAvatar } from "@/world-data/avatar";

export const dynamic = "force-dynamic";

export default async function WorldModePage() {
  await requirePlatformAdmin();
  const [state, encounterData, battleData] = await Promise.all([
    getAdminWorldState(),
    getAdminWorldEncounters(),
    getAdminWorldBattles(),
  ]);
  const [wallet, ligaCashWallet] = state ? await Promise.all([
    prisma.zikaCoinWallet.findUnique({ where: { playerId: state.playerId }, select: { balance: true } }),
    prisma.ligaCoinWallet.findUnique({ where: { playerId: state.playerId }, select: { balance: true } }),
  ]) : [null, null];
  // Resolve os mascotes da formação com HP/condições persistentes para exibição.
  const party = state ? readWorldParty(state.partyJson) : [];
  const partyRows =
    state && party.length
      ? await prisma.worldMascot.findMany({
          where: { id: { in: party.map((e) => e.mascotId) }, playerId: state.playerId, isInParty: true },
          select: {
            id: true,
            pokemonId: true,
            nickname: true,
            level: true,
            statVitality: true,
            currentHp: true,
            poisoned: true,
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
        hp: m.currentHp,
        maxHp,
        poisoned: m.poisoned,
      };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  const publicStates = state ? await prisma.worldPlayerState.findMany({
    where: { starterPokemonId: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { playerId: true, currentLocationId: true, badges: true, partyJson: true, avatarJson: true, updatedAt: true, player: { select: { displayName: true } } },
  }) : [];
  const publicPartyIds = publicStates.flatMap((entry) => readWorldParty(entry.partyJson).map((partyEntry) => partyEntry.mascotId));
  const publicPartyRows = publicPartyIds.length ? await prisma.worldMascot.findMany({ where: { id: { in: publicPartyIds } }, select: { id: true, pokemonId: true, nickname: true, level: true } }) : [];
  const publicPartyById = new Map(publicPartyRows.map((entry) => [entry.id, entry]));
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
      ligaCash={ligaCashWallet?.balance ?? 0}
      avatar={normalizeWorldAvatar(state?.avatarJson)}
      worldPlayers={publicStates.map((entry) => ({
        playerId: entry.playerId,
        displayName: entry.player.displayName,
        isSelf: entry.playerId === state?.playerId,
        locationId: entry.currentLocationId,
        badges: entry.badges,
        avatar: normalizeWorldAvatar(entry.avatarJson),
        updatedAt: entry.updatedAt.toISOString(),
        team: readWorldParty(entry.partyJson).map((partyEntry) => publicPartyById.get(partyEntry.mascotId)).filter((mascot): mascot is NonNullable<typeof mascot> => Boolean(mascot)).map((mascot) => ({ name: mascot.nickname?.trim() || getPokemonName(mascot.pokemonId), pokemonId: mascot.pokemonId, level: mascot.level, sprite: getSpriteUrl(mascot.pokemonId) })),
      }))}
      starters={WORLD_STARTERS.map((starter) => ({
        ...starter,
        name: getPokemonName(starter.pokemonId),
        spriteUrl: getSpriteUrl(starter.pokemonId),
      }))}
      partyMascots={partyMascots}
      trainers={KANTO_MVP_TRAINERS.map((trainer) => ({
        ...trainer,
        cooldownUntil: state && trainer.tier === "LEADER"
          ? String((state.gymCooldownJson as Record<string, unknown> | null)?.[trainer.id] ?? "") || null
          : null,
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
                megaPotions?: number;
                antidotes?: number;
              },
              chest: state.chestJson as Record<string, number>,
              backpackCapacity: state.backpackCapacity,
              travelingToId: state.travelingToId,
              travelStartedAt: state.travelStartedAt?.toISOString() ?? null,
              travelEndsAt: state.travelEndsAt?.toISOString() ?? null,
              party: readWorldParty(state.partyJson),
              starterPokemonId: state.starterPokemonId,
            }
          : null
      }
    />
  );
}
