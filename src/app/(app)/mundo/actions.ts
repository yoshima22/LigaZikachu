"use server";

import { revalidatePath } from "next/cache";
import { Prisma, ZikaCoinTxType } from "@prisma/client";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { KANTO_MVP_BY_ID } from "@/world-data/kanto/mvp";
import { getSpeciesSnapshot } from "@/lib/species-registry";
import { registerPokemonDiscovery } from "@/lib/pokemon-dex";
import { PERSONALITIES } from "@/lib/mascot-data";
import type { MascotPersonality, WorldEncounterStatus } from "@prisma/client";
import { creditCoins } from "@/lib/zikacoins";
import { KANTO_MVP_MART_BY_ID } from "@/world-data/kanto/mart";
import { KANTO_MVP_TRAINER_BY_ID } from "@/world-data/kanto/trainers";
import { runLeagueCombat, toLeagueMascot } from "@/lib/league-combat";

const CAPTURE_CHANCE: Record<string, number> = {
  COMMON: 72,
  UNCOMMON: 58,
  RARE: 42,
  VERY_RARE: 25,
  SPECIAL: 12,
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function adminPlayer() {
  const user = await requirePlatformAdmin();
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!player) throw new Error("A conta administrativa não possui jogador vinculado.");
  return player;
}

export async function getAdminWorldState() {
  const player = await adminPlayer();
  let state = await prisma.worldPlayerState.findUnique({
    where: { playerId: player.id },
  });
  if (state?.travelEndsAt && state.travelEndsAt.getTime() <= Date.now()) {
    state = await finishTravel(player.id, false);
  }
  return state;
}

export async function getAdminWorldEncounters() {
  const player = await adminPlayer();
  const [active, history] = await Promise.all([
    prisma.worldEncounterSession.findFirst({
      where: { playerId: player.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.worldEncounterSession.findMany({
      where: { playerId: player.id, status: { not: "ACTIVE" } },
      orderBy: { resolvedAt: "desc" },
      take: 6,
    }),
  ]);
  return { active, history };
}

export async function getAdminWorldBattles() {
  const player = await adminPlayer();
  return prisma.worldBattleSession.findMany({
    where: { playerId: player.id },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
}

export async function exploreWorldLocationAction() {
  try {
    const player = await adminPlayer();
    const encounter = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await tx.worldPlayerState.findUnique({ where: { playerId: player.id } });
      if (!state) throw new Error("Inicie sua aventura antes de explorar.");
      if (state.travelingToId) throw new Error("Você não pode explorar durante uma viagem.");
      const existing = await tx.worldEncounterSession.findFirst({ where: { playerId: player.id, status: "ACTIVE" } });
      if (existing) throw new Error("Resolva o encontro atual antes de explorar novamente.");
      const location = KANTO_MVP_BY_ID.get(state.currentLocationId);
      if (!location?.activities.includes("EXPLORE") || location.encounters.length === 0) {
        throw new Error("Não há uma área de exploração disponível aqui.");
      }
      const hour = new Date().getHours();
      const period = hour >= 6 && hour < 18 ? "DAY" : "NIGHT";
      const eligible = location.encounters.filter((entry) => !entry.timeOfDay || entry.timeOfDay === "ANY" || entry.timeOfDay === period);
      const pool = eligible.length ? eligible : location.encounters.filter((entry) => entry.timeOfDay === "ANY");
      const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
      let weightedRoll = Math.random() * totalWeight;
      const selected = pool.find((entry) => (weightedRoll -= entry.weight) <= 0) ?? pool[pool.length - 1];
      if (!selected) throw new Error("A tabela de encontros desta área está vazia.");
      return tx.worldEncounterSession.create({
        data: {
          playerId: player.id,
          locationId: location.id,
          pokemonId: selected.speciesId,
          rarity: selected.rarity,
          captureChance: CAPTURE_CHANCE[selected.rarity] ?? 40,
        },
      });
    });
    revalidatePath("/mundo");
    return { ok: true as const, encounterId: encounter.id };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível explorar." };
  }
}

export async function resolveWorldEncounterAction(encounterId: string, choice: "CAPTURE" | "ESCAPE") {
  try {
    const player = await adminPlayer();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const encounter = await tx.worldEncounterSession.findFirst({ where: { id: encounterId, playerId: player.id, status: "ACTIVE" } });
      if (!encounter) throw new Error("Este encontro já foi resolvido.");
      const state = await tx.worldPlayerState.findUnique({ where: { playerId: player.id } });
      if (!state || state.currentLocationId !== encounter.locationId || state.travelingToId) throw new Error("Você não está mais no local deste encontro.");
      if (choice === "ESCAPE") {
        await tx.worldEncounterSession.update({ where: { id: encounter.id }, data: { status: "ESCAPED", resolvedAt: new Date() } });
        return { captured: false, escaped: true };
      }
      const inventory = (state.inventoryJson ?? {}) as Record<string, unknown>;
      const pokeBalls = Number(inventory.pokeBalls ?? 0);
      if (pokeBalls < 1) throw new Error("Você não possui Poké Balls.");
      const roll = randomInt(1, 100);
      const captured = roll <= encounter.captureChance;
      let mascotId: string | undefined;
      if (captured) {
        const personality = PERSONALITIES[randomInt(0, PERSONALITIES.length - 1)] as MascotPersonality;
        const mascot = await tx.mascot.create({
          data: {
            playerId: player.id,
            pokemonId: encounter.pokemonId,
            ...(await getSpeciesSnapshot(encounter.pokemonId, tx)),
            hatchedPokemonId: encounter.pokemonId,
            hatchedFromEggType: null,
            hatchedFromEggOrigin: `WORLD:${encounter.locationId}`,
            personality,
            statForce: randomInt(8, 12),
            statAgility: randomInt(8, 12),
            statCharisma: randomInt(8, 12),
            statInstinct: randomInt(8, 12),
            statVitality: randomInt(8, 12),
          },
        });
        mascotId = mascot.id;
        await registerPokemonDiscovery({ playerId: player.id, pokemonId: encounter.pokemonId, source: `world:${encounter.locationId}` }, tx);
      }
      await tx.worldPlayerState.update({
        where: { playerId: player.id },
        data: { inventoryJson: { ...inventory, pokeBalls: pokeBalls - 1 } as Prisma.InputJsonValue },
      });
      const status: WorldEncounterStatus = captured ? "CAPTURED" : "FAILED";
      await tx.worldEncounterSession.update({ where: { id: encounter.id }, data: { status, roll, mascotId, resolvedAt: new Date() } });
      return { captured, escaped: false };
    });
    revalidatePath("/mundo");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível resolver o encontro." };
  }
}

async function requireAvailableWorldService(playerId: string, service: "CENTER" | "MART", tx: Prisma.TransactionClient) {
  const state = await tx.worldPlayerState.findUnique({ where: { playerId } });
  if (!state) throw new Error("Inicie sua aventura primeiro.");
  if (state.travelingToId) throw new Error("Este serviço não está disponível durante uma viagem.");
  const location = KANTO_MVP_BY_ID.get(state.currentLocationId);
  if (!location?.services.includes(service)) throw new Error("Este serviço não existe na localização atual.");
  return state;
}

export async function restAtWorldCenterAction() {
  try {
    const player = await adminPlayer();
    const recovered = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await requireAvailableWorldService(player.id, "CENTER", tx);
      await tx.worldPlayerState.update({ where: { playerId: player.id }, data: { fatigue: 0 } });
      return state.fatigue;
    });
    revalidatePath("/mundo");
    return { ok: true as const, recovered };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível descansar." };
  }
}

export async function buyWorldMartItemAction(itemId: string, quantity: number) {
  try {
    const player = await adminPlayer();
    const item = KANTO_MVP_MART_BY_ID.get(itemId as "pokeBalls" | "potions" | "antidotes");
    const safeQuantity = Math.floor(quantity);
    if (!item || safeQuantity < 1 || safeQuantity > 20) throw new Error("Compra inválida.");
    const total = item.price * safeQuantity;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await requireAvailableWorldService(player.id, "MART", tx);
      await creditCoins(tx, { playerId: player.id, type: ZikaCoinTxType.SHOP_PURCHASE, amount: -total, description: `World Mode: ${safeQuantity}x ${item.name}` });
      const inventory = (state.inventoryJson ?? {}) as Record<string, unknown>;
      await tx.worldPlayerState.update({ where: { playerId: player.id }, data: { inventoryJson: { ...inventory, [item.id]: Number(inventory[item.id] ?? 0) + safeQuantity } as Prisma.InputJsonValue } });
    });
    revalidatePath("/mundo");
    return { ok: true as const, itemName: item.name, quantity: safeQuantity };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível concluir a compra." };
  }
}

export async function challengeWorldTrainerAction(trainerId: string) {
  try {
    const player = await adminPlayer();
    const trainer = KANTO_MVP_TRAINER_BY_ID.get(trainerId);
    if (!trainer) throw new Error("Treinador desconhecido.");
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await tx.worldPlayerState.findUnique({ where: { playerId: player.id } });
      if (!state || state.travelingToId || state.currentLocationId !== trainer.locationId) throw new Error("Você não está diante deste treinador.");
      if (trainer.prerequisiteId && !state.defeatedTrainerIds.includes(trainer.prerequisiteId)) throw new Error("Derrote o treinador anterior primeiro.");
      const activeEncounter = await tx.worldEncounterSession.findFirst({ where: { playerId: player.id, status: "ACTIVE" }, select: { id: true } });
      if (activeEncounter) throw new Error("Resolva seu encontro selvagem antes da batalha.");
      let mascots = await tx.mascot.findMany({ where: { playerId: player.id, isEquipped: true }, take: 6 });
      if (mascots.length === 0) mascots = await tx.mascot.findMany({ where: { playerId: player.id }, orderBy: [{ isFavorite: "desc" }, { level: "desc" }], take: 6 });
      if (mascots.length === 0) throw new Error("Você precisa ter ao menos um mascote para batalhar.");
      const teamA = mascots.map((mascot, index) => toLeagueMascot(mascot, index + 1, mascot.preferredCombatRole));
      const teamB = trainer.team.map((entry, index) => toLeagueMascot({
        id: `world-npc:${trainer.id}:${index}`,
        playerId: `world-npc:${trainer.id}`,
        pokemonId: entry.pokemonId,
        nickname: null,
        level: entry.level,
        statForce: entry.stats.force,
        statAgility: entry.stats.agility,
        statCharisma: entry.stats.charisma,
        statInstinct: entry.stats.instinct,
        statVitality: entry.stats.vitality,
        personality: null,
      }, index + 1, entry.role));
      const battle = runLeagueCombat(teamA, teamB);
      const won = battle.winner === "A";
      const firstWin = won && !state.defeatedTrainerIds.includes(trainer.id);
      const inventory = (state.inventoryJson ?? {}) as Record<string, unknown>;
      const reward = firstWin ? trainer.firstWinReward : {};
      if (firstWin) {
        await tx.worldPlayerState.update({
          where: { playerId: player.id },
          data: {
            defeatedTrainerIds: [...state.defeatedTrainerIds, trainer.id],
            inventoryJson: {
              ...inventory,
              pokeBalls: Number(inventory.pokeBalls ?? 0) + (reward.pokeBalls ?? 0),
              potions: Number(inventory.potions ?? 0) + (reward.potions ?? 0),
              antidotes: Number(inventory.antidotes ?? 0) + (reward.antidotes ?? 0),
            } as Prisma.InputJsonValue,
          },
        });
        if (reward.zikaCoins) await creditCoins(tx, { playerId: player.id, type: ZikaCoinTxType.MATCH_WIN_REWARD, amount: reward.zikaCoins, description: `World Mode: vitória contra ${trainer.name}` });
      }
      const session = await tx.worldBattleSession.create({
        data: {
          playerId: player.id,
          locationId: trainer.locationId,
          trainerId: trainer.id,
          trainerName: trainer.name,
          winner: battle.winner,
          rounds: battle.rounds,
          rewardJson: firstWin ? reward : Prisma.JsonNull,
          resultJson: battle as unknown as Prisma.InputJsonValue,
        },
      });
      return { won, draw: battle.winner === "DRAW", sessionId: session.id, firstWin };
    });
    revalidatePath("/mundo");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível iniciar a batalha." };
  }
}

export async function startWorldAdventureAction() {
  try {
    const player = await adminPlayer();
    await prisma.worldPlayerState.upsert({
      where: { playerId: player.id },
      update: {},
      create: { playerId: player.id },
    });
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Não foi possível iniciar.",
    };
  }
}

export async function startWorldTravelAction(destinationId: string) {
  try {
    const player = await adminPlayer();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await tx.worldPlayerState.findUnique({
        where: { playerId: player.id },
      });
      if (!state) throw new Error("Inicie sua aventura antes de viajar.");
      if (state.travelingToId) throw new Error("Você já está viajando.");
      const activeEncounter = await tx.worldEncounterSession.findFirst({
        where: { playerId: player.id, status: "ACTIVE" },
        select: { id: true },
      });
      if (activeEncounter) throw new Error("Resolva o encontro atual antes de viajar.");
      const current = KANTO_MVP_BY_ID.get(state.currentLocationId);
      const destination = KANTO_MVP_BY_ID.get(destinationId);
      if (!current || !destination) throw new Error("Localização indisponível.");
      const connection = current.connections.find((item) => item.to === destinationId);
      if (!connection) throw new Error("Não existe uma rota direta até esse local.");
      if (destination.locked) throw new Error("Esta área ainda está bloqueada.");
      if (
        connection.requirement?.badges &&
        state.badges.length < connection.requirement.badges
      )
        throw new Error(`Esta rota exige ${connection.requirement.badges} insígnias.`);
      const startedAt = new Date();
      const travelEndsAt = new Date(startedAt.getTime() + connection.minutes * 60_000);
      await tx.worldTravelLog.create({
        data: {
          playerId: player.id,
          fromLocationId: current.id,
          toLocationId: destination.id,
          durationMinutes: connection.minutes,
          fatigueGained: connection.fatigue,
          startedAt,
        },
      });
      await tx.worldPlayerState.update({
        where: { playerId: player.id },
        data: {
          travelingToId: destination.id,
          travelStartedAt: startedAt,
          travelEndsAt,
        },
      });
      return { destination: destination.name, travelEndsAt };
    });
    revalidatePath("/mundo");
    return { ok: true as const, ...result };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Não foi possível viajar.",
    };
  }
}

async function finishTravel(playerId: string, force: boolean) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${playerId}`}))`;
    const state = await tx.worldPlayerState.findUnique({ where: { playerId } });
    if (!state?.travelingToId || !state.travelEndsAt) return state;
    if (!force && state.travelEndsAt.getTime() > Date.now()) return state;
    const destination = KANTO_MVP_BY_ID.get(state.travelingToId);
    if (!destination) throw new Error("O destino da viagem não existe mais.");
    const current = KANTO_MVP_BY_ID.get(state.currentLocationId);
    const connection = current?.connections.find((item) => item.to === destination.id);
    const discovered = [...new Set([...state.discoveredLocationIds, destination.id])];
    const now = new Date();
    await tx.worldTravelLog.updateMany({
      where: {
        playerId,
        fromLocationId: state.currentLocationId,
        toLocationId: destination.id,
        arrivedAt: null,
      },
      data: { arrivedAt: now },
    });
    return tx.worldPlayerState.update({
      where: { playerId },
      data: {
        currentLocationId: destination.id,
        discoveredLocationIds: discovered,
        fatigue: { increment: connection?.fatigue ?? 0 },
        travelingToId: null,
        travelStartedAt: null,
        travelEndsAt: null,
      },
    });
  });
}

export async function finishWorldTravelNowAction() {
  try {
    const player = await adminPlayer();
    await finishTravel(player.id, true);
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Falha ao concluir viagem.",
    };
  }
}

export async function resetAdminWorldAction() {
  try {
    const player = await adminPlayer();
    await prisma.$transaction([
      prisma.mascot.deleteMany({
        where: { playerId: player.id, hatchedFromEggOrigin: { startsWith: "WORLD:" } },
      }),
      prisma.worldBattleSession.deleteMany({ where: { playerId: player.id } }),
      prisma.worldEncounterSession.deleteMany({ where: { playerId: player.id } }),
      prisma.worldTravelLog.deleteMany({ where: { playerId: player.id } }),
      prisma.worldPlayerState.deleteMany({ where: { playerId: player.id } }),
    ]);
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Falha ao reiniciar o teste.",
    };
  }
}

export type AdminWorldState = NonNullable<Awaited<ReturnType<typeof getAdminWorldState>>> & {
  inventoryJson: Prisma.JsonValue;
};
