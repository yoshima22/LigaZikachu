"use server";

import { revalidatePath } from "next/cache";
import { Prisma, ZikaCoinTxType } from "@prisma/client";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { KANTO_MVP_BY_ID } from "@/world-data/kanto/mvp";
import { getSpeciesSnapshot } from "@/lib/species-registry";
import { registerPokemonDiscovery } from "@/lib/pokemon-dex";
import {
  PERSONALITIES,
  getPokemonName,
  getSpriteUrl,
} from "@/lib/mascot-data";
import { defaultCombatRoleFor, normalizeCombatRole } from "@/lib/combat-roles";
import {
  WORLD_PARTY_MAX,
  readWorldParty,
  readWorldWild,
  worldMaxHp,
  type WorldWildState,
} from "@/world-data/party";
import type { MascotPersonality, WorldEncounterStatus } from "@prisma/client";
import { creditCoins } from "@/lib/zikacoins";
import { KANTO_MVP_MART_BY_ID } from "@/world-data/kanto/mart";
import { worldItemTable } from "@/world-data/kanto/items";
import { KANTO_MVP_TRAINER_BY_ID } from "@/world-data/kanto/trainers";
import {
  scaleTrainerTeam,
  playerLeaderHandicap,
  scaleWildProfile,
} from "@/world-data/difficulty";
import { runLeagueCombat, toLeagueMascot } from "@/lib/league-combat";
import { WORLD_STARTER_IDS } from "@/world-data/starters";
import { getPokemonTypes, getTypeAdvantageMultiplier } from "@/lib/mascot-data";
import { worldLevelCap } from "@/world-data/progression";
import { changeLigaCash } from "@/lib/liga-cash-wallet";
import { normalizeWorldAvatar, type WorldAvatarSelection } from "@/world-data/avatar";

// Chance-base (selvagem com vida cheia). Deliberadamente baixa: capturar exige
// enfraquecer o selvagem em combate (bônus de até +45% por HP perdido).
const CAPTURE_CHANCE: Record<string, number> = {
  COMMON: 38,
  UNCOMMON: 30,
  RARE: 22,
  VERY_RARE: 12,
  SPECIAL: 6,
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

function inventorySize(value: Prisma.JsonValue | null | undefined): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value).reduce<number>((sum, amount) => sum + Math.max(0, Number(amount) || 0), 0);
}

// Referência exclusivamente da equipe carregada no World Mode. A coleção normal
// apenas autoriza espécies; nunca fornece nível, HP ou combatentes para a aventura.
async function playerBattleRefTx(
  tx: Prisma.TransactionClient,
  playerId: string,
  state: { partyJson: Prisma.JsonValue },
) {
  const party = readWorldParty(state.partyJson);
  const mascots = party.length
    ? await tx.worldMascot.findMany({
        where: { id: { in: party.map((e) => e.mascotId) }, playerId, isInParty: true },
        select: {
          level: true,
          statForce: true,
          statAgility: true,
          statCharisma: true,
          statInstinct: true,
          statVitality: true,
        },
      })
    : [];
  if (mascots.length === 0)
    return { avgLevel: 5, avgStatTotal: 60 };
  const avgLevel = mascots.reduce((s, m) => s + m.level, 0) / mascots.length;
  const avgStatTotal =
    mascots.reduce(
      (s, m) =>
        s + m.statForce + m.statAgility + m.statCharisma + m.statInstinct + m.statVitality,
      0,
    ) / mascots.length;
  return { avgLevel, avgStatTotal };
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

export async function saveWorldAvatarAction(selection: WorldAvatarSelection) {
  try {
    const player = await adminPlayer();
    const state = await prisma.worldPlayerState.findUnique({ where: { playerId: player.id }, select: { avatarJson: true } });
    if (!state) throw new Error("Inicie sua aventura primeiro.");
    const previous = state.avatarJson && typeof state.avatarJson === "object" && !Array.isArray(state.avatarJson) ? state.avatarJson as Record<string, unknown> : {};
    const avatar = normalizeWorldAvatar(selection);
    await prisma.worldPlayerState.update({ where: { playerId: player.id }, data: { avatarJson: { ...previous, ...avatar, presenceAt: new Date().toISOString() } as Prisma.InputJsonValue } });
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível salvar o personagem." };
  }
}

export async function touchWorldPresenceAction() {
  try {
    const player = await adminPlayer();
    const state = await prisma.worldPlayerState.findUnique({ where: { playerId: player.id }, select: { avatarJson: true } });
    if (!state) return { ok: false as const, error: "Aventura não iniciada." };
    const previous = state.avatarJson && typeof state.avatarJson === "object" && !Array.isArray(state.avatarJson) ? state.avatarJson as Record<string, unknown> : {};
    await prisma.worldPlayerState.update({ where: { playerId: player.id }, data: { avatarJson: { ...previous, presenceAt: new Date().toISOString() } as Prisma.InputJsonValue } });
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Presença indisponível." };
  }
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

// ── Formação própria do World Mode (até 6 mascotes) ──────────────────────────
// Lista os mascotes do jogador para montar a equipe da aventura.
export async function getWorldPartyMascotsAction() {
  const player = await adminPlayer();
  const [mascots, mainMascots] = await Promise.all([prisma.worldMascot.findMany({
    where: { playerId: player.id },
    orderBy: [{ isInParty: "desc" }, { level: "desc" }, { createdAt: "asc" }],
    take: 400,
  }), prisma.mascot.findMany({ where: { playerId: player.id }, select: { id: true, pokemonId: true, nickname: true, level: true } })]);
  return mascots.map((mascot) => ({
    id: mascot.id,
    speciesId: mascot.pokemonId,
    name: getPokemonName(mascot.pokemonId),
    nickname: mascot.nickname,
    sprite: getSpriteUrl(mascot.pokemonId),
    level: mascot.level,
    personality: mascot.personality,
    mainMascotId: mascot.mainMascotId,
    baseOptions: mainMascots.filter((base) => base.pokemonId === mascot.pokemonId).map((base) => ({ id: base.id, label: `${base.nickname?.trim() || getPokemonName(base.pokemonId)} · Nv.${base.level}` })),
    posture: defaultCombatRoleFor({
      preferredCombatRole: null,
      statForce: mascot.statForce,
      statAgility: mascot.statAgility,
      statVitality: mascot.statVitality,
      statInstinct: mascot.statInstinct,
      statCharisma: mascot.statCharisma,
    }),
    stats: {
      force: mascot.statForce,
      agility: mascot.statAgility,
      charisma: mascot.statCharisma,
      instinct: mascot.statInstinct,
      vitality: mascot.statVitality,
    },
  }));
}

export async function setWorldMascotBaseAction(worldMascotId: string, mainMascotId: string) {
  try {
    const player = await adminPlayer();
    const [worldMascot, mainMascot] = await Promise.all([
      prisma.worldMascot.findFirst({ where: { id: worldMascotId, playerId: player.id } }),
      prisma.mascot.findFirst({ where: { id: mainMascotId, playerId: player.id } }),
    ]);
    if (!worldMascot || !mainMascot) throw new Error("Mascote de referência indisponível.");
    if (worldMascot.pokemonId !== mainMascot.pokemonId) throw new Error("A referência deve ser da mesma espécie.");
    await prisma.worldMascot.update({ where: { id: worldMascot.id }, data: { mainMascotId: mainMascot.id } });
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível vincular a referência." };
  }
}

export async function getWorldRosterSummaryAction() {
  const player = await adminPlayer();
  const [licenses, owned] = await Promise.all([
    prisma.playerPokemonDex.findMany({ where: { playerId: player.id }, orderBy: { pokemonId: "asc" }, select: { pokemonId: true } }),
    prisma.worldMascot.groupBy({ by: ["pokemonId"], where: { playerId: player.id }, _count: { _all: true } }),
  ]);
  const ownedByPokemon = new Map(owned.map((entry) => [entry.pokemonId, entry._count._all]));
  return licenses.map(({ pokemonId }) => ({
    pokemonId,
    name: getPokemonName(pokemonId),
    sprite: getSpriteUrl(pokemonId),
    worldCopies: ownedByPokemon.get(pokemonId) ?? 0,
  }));
}

// Salva a formação (IDs + posturas). Valida propriedade sem tocar em isEquipped.
export async function saveWorldPartyAction(
  entries: Array<{ mascotId: string; posture: string }>,
) {
  try {
    const player = await adminPlayer();
    const seen = new Set<string>();
    const cleaned = entries
      .filter((entry) => {
        if (seen.has(entry.mascotId)) return false;
        seen.add(entry.mascotId);
        return true;
      })
      .slice(0, WORLD_PARTY_MAX);
    if (cleaned.length === 0)
      throw new Error("Escolha ao menos um mascote para a equipe.");
    const owned = await prisma.worldMascot.findMany({
      where: { id: { in: cleaned.map((e) => e.mascotId) }, playerId: player.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((m) => m.id));
    const party = cleaned
      .filter((entry) => ownedIds.has(entry.mascotId))
      .map((entry) => ({
        mascotId: entry.mascotId,
        posture: normalizeCombatRole(entry.posture),
      }));
    if (party.length !== cleaned.length)
      throw new Error("Um ou mais mascotes não pertencem à sua conta.");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await tx.worldPlayerState.findUnique({ where: { playerId: player.id } });
      if (!state) throw new Error("Inicie sua aventura primeiro.");
      const location = KANTO_MVP_BY_ID.get(state.currentLocationId);
      if (state.travelingToId || !location?.services.some((service) => service === "CENTER" || service === "STORAGE")) throw new Error("Altere sua equipe apenas em uma área segura com Centro ou armazenamento.");
      await tx.worldMascot.updateMany({ where: { playerId: player.id }, data: { isInParty: false } });
      await tx.worldMascot.updateMany({ where: { playerId: player.id, id: { in: party.map((entry) => entry.mascotId) } }, data: { isInParty: true } });
      await tx.worldPlayerState.update({ where: { playerId: player.id }, data: { partyJson: party as unknown as Prisma.InputJsonValue } });
    });
    revalidatePath("/mundo");
    return { ok: true as const, size: party.length };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Não foi possível salvar a equipe.",
    };
  }
}

const POTION_HEAL = 60;
const MEGA_POTION_HEAL = 180;

// Usa um item da mochila num mascote da aventura: Potion cura HP, Antidote
// remove veneno. Consome o item e persiste o estado.
export async function useWorldItemAction(
  kind: "POTION" | "MEGA_POTION" | "ANTIDOTE",
  mascotId: string,
) {
  try {
    const player = await adminPlayer();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await tx.worldPlayerState.findUnique({ where: { playerId: player.id } });
      if (!state) throw new Error("Inicie sua aventura primeiro.");
      const party = readWorldParty(state.partyJson);
      if (!party.some((entry) => entry.mascotId === mascotId))
        throw new Error("Este mascote não está na sua equipe.");
      const mascot = await tx.worldMascot.findFirst({
        where: { id: mascotId, playerId: player.id },
        select: { id: true, level: true, statVitality: true, currentHp: true, poisoned: true },
      });
      if (!mascot) throw new Error("Mascote indisponível.");
      const inventory = (state.inventoryJson ?? {}) as Record<string, unknown>;
      const max = worldMaxHp(mascot.level, mascot.statVitality);
      const current = { hp: mascot.currentHp, poisoned: mascot.poisoned };
      const itemKey = kind === "POTION" ? "potions" : kind === "MEGA_POTION" ? "megaPotions" : "antidotes";
      const have = Number(inventory[itemKey] ?? 0);
      if (have < 1) throw new Error(kind === "ANTIDOTE" ? "Você não tem Antídotos." : kind === "MEGA_POTION" ? "Você não tem Mega Potions." : "Você não tem Potions.");
      if (kind === "POTION" || kind === "MEGA_POTION") {
        if (current.hp >= max) throw new Error("Este mascote já está com o HP cheio.");
        current.hp = Math.min(max, current.hp + (kind === "MEGA_POTION" ? MEGA_POTION_HEAL : POTION_HEAL));
      } else {
        if (!current.poisoned) throw new Error("Este mascote não está envenenado.");
        current.poisoned = false;
      }
      await tx.worldMascot.update({ where: { id: mascotId }, data: { currentHp: current.hp, poisoned: current.poisoned } });
      await tx.worldPlayerState.update({ where: { playerId: player.id }, data: { inventoryJson: { ...inventory, [itemKey]: have - 1 } as Prisma.InputJsonValue } });
      return { hp: current.hp, max };
    });
    revalidatePath("/mundo");
    return { ok: true as const, ...result };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Não foi possível usar o item.",
    };
  }
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
      // Perfil de combate do selvagem, escalado à equipe do jogador. O selvagem
      // precisa ser enfrentado (e enfraquecido) antes da captura.
      const ref = await playerBattleRefTx(tx, player.id, state);
      const scaled = scaleWildProfile(selected.rarity, ref);
      const profile = { ...scaled, level: Math.min(scaled.level, worldLevelCap(location.id)) };
      const maxHp = worldMaxHp(profile.level, profile.stats.vitality);
      const wild: WorldWildState = {
        level: profile.level,
        role: profile.role,
        stats: profile.stats,
        maxHp,
        hp: maxHp,
      };
      return tx.worldEncounterSession.create({
        data: {
          playerId: player.id,
          locationId: location.id,
          pokemonId: selected.speciesId,
          rarity: selected.rarity,
          captureChance: CAPTURE_CHANCE[selected.rarity] ?? 40,
          wildJson: wild as unknown as Prisma.InputJsonValue,
        },
      });
    });
    revalidatePath("/mundo");
    return { ok: true as const, encounterId: encounter.id };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível explorar." };
  }
}

export async function resolveWorldEncounterAction(encounterId: string, choice: "CAPTURE" | "ESCAPE", ballId: "pokeBalls" = "pokeBalls") {
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
      if (ballId !== "pokeBalls") throw new Error("Este tipo de Poké Ball ainda não foi liberado.");
      const pokeBalls = Number(inventory[ballId] ?? 0);
      if (pokeBalls < 1) throw new Error("Você não possui Poké Balls.");
      // Chance efetiva: base da raridade + bônus por enfraquecer o selvagem
      // (até +45 quando quase desmaiado), limitada a 95%.
      const wild = readWorldWild(encounter.wildJson);
      const weakenPct = wild ? 1 - wild.hp / Math.max(1, wild.maxHp) : 0;
      const effectiveChance = Math.min(
        95,
        Math.round(encounter.captureChance + weakenPct * 45),
      );
      const roll = randomInt(1, 100);
      const captured = roll <= effectiveChance;
      let mascotId: string | undefined;
      if (captured) {
        const personality = PERSONALITIES[randomInt(0, PERSONALITIES.length - 1)] as MascotPersonality;
        // Captura pertence ao World Mode. Ela não fabrica uma nova cópia na
        // coleção principal; uma cópia já existente da mesma espécie pode ser
        // vinculada apenas como referência, sem importar nível ou atributos.
        const baseMascot = await tx.mascot.findFirst({ where: { playerId: player.id, pokemonId: encounter.pokemonId }, orderBy: { id: "asc" }, select: { id: true } });
        const worldStats = {
          force: randomInt(8, 12),
          agility: randomInt(8, 12),
          charisma: randomInt(8, 12),
          instinct: randomInt(8, 12),
          vitality: randomInt(8, 12),
        };
        const capturedWorldMascot = await tx.worldMascot.create({
          data: {
            playerId: player.id,
            mainMascotId: baseMascot?.id ?? null,
            pokemonId: encounter.pokemonId,
            level: Math.min(wild?.level ?? 1, worldLevelCap(encounter.locationId)),
            personality,
            statForce: worldStats.force,
            statAgility: worldStats.agility,
            statCharisma: worldStats.charisma,
            statInstinct: worldStats.instinct,
            statVitality: worldStats.vitality,
            currentHp: worldMaxHp(Math.min(wild?.level ?? 1, worldLevelCap(encounter.locationId)), worldStats.vitality),
            origin: `CAPTURE:${encounter.locationId}`,
            isInParty: false,
          },
        });
        mascotId = capturedWorldMascot.id;
        await registerPokemonDiscovery({ playerId: player.id, pokemonId: encounter.pokemonId, source: `world:${encounter.locationId}` }, tx);
      }
      // Enquanto o modo está restrito ao admin, Poké Balls são ilimitadas para
      // teste, mas ao menos uma precisa estar fisicamente na mochila.
      const status: WorldEncounterStatus = captured ? "CAPTURED" : "ACTIVE";
      await tx.worldEncounterSession.update({ where: { id: encounter.id }, data: { status, roll, mascotId, resolvedAt: captured ? new Date() : null } });
      return { captured, escaped: false };
    });
    revalidatePath("/mundo");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível resolver o encontro." };
  }
}

// Um turno de captura é deliberadamente diferente do PvP: cada lado pode agir
// no máximo uma vez. A agilidade decide apenas quem age primeiro, nunca ações extras.
export async function battleWildAction(encounterId: string, requestedFighterId?: string) {
  try {
    const player = await adminPlayer();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const encounter = await tx.worldEncounterSession.findFirst({
        where: { id: encounterId, playerId: player.id, status: "ACTIVE" },
      });
      if (!encounter) throw new Error("Este encontro já foi resolvido.");
      const state = await tx.worldPlayerState.findUnique({ where: { playerId: player.id } });
      if (!state || state.currentLocationId !== encounter.locationId || state.travelingToId)
        throw new Error("Você não está mais no local deste encontro.");
      const wild = readWorldWild(encounter.wildJson);
      if (!wild) throw new Error("Este encontro é antigo; deixe-o ir e explore novamente.");
      if (wild.hp <= 0) throw new Error("O selvagem já foi derrotado.");

      const party = readWorldParty(state.partyJson);
      if (!party.length) throw new Error("Monte sua equipe do World Mode em uma área segura.");
      const found = await tx.worldMascot.findMany({
        where: { id: { in: party.map((entry) => entry.mascotId) }, playerId: player.id, isInParty: true },
      });
      const byId = new Map(found.map((mascot) => [mascot.id, mascot]));
      const mascots = party.map((entry) => byId.get(entry.mascotId)).filter((mascot): mascot is (typeof found)[number] => Boolean(mascot));
      const ready = mascots.filter((mascot) => mascot.currentHp > 0);
      if (ready.length === 0)
        throw new Error("Toda a sua equipe está desmaiada. Recupere-a no Pokémon Center.");
      const fighter = ready.find((mascot) => mascot.id === requestedFighterId) ?? ready[0];
      const fighterMax = worldMaxHp(fighter.level, fighter.statVitality);
      let fighterHp = fighter.currentHp;
      let wildHp = wild.hp;
      const log: string[] = [];
      const hit = (force: number, level: number, attackTypes: string[], vitality: number, defendTypes: string[]) => {
        const type = getTypeAdvantageMultiplier(attackTypes, defendTypes);
        const variance = 0.9 + Math.random() * 0.2;
        return Math.max(1, Math.round((8 + level * 1.5 + force * 0.65) * type * variance - vitality * 0.18));
      };
      const playerAttack = () => {
        const damage = hit(fighter.statForce, fighter.level, getPokemonTypes(fighter.pokemonId), wild.stats.vitality, getPokemonTypes(encounter.pokemonId));
        wildHp = Math.max(0, wildHp - damage);
        log.push(`${fighter.nickname?.trim() || getPokemonName(fighter.pokemonId)} causou ${damage} de dano.`);
      };
      const wildAttack = () => {
        const damage = hit(wild.stats.force, wild.level, getPokemonTypes(encounter.pokemonId), fighter.statVitality, getPokemonTypes(fighter.pokemonId));
        fighterHp = Math.max(0, fighterHp - damage);
        log.push(`${getPokemonName(encounter.pokemonId)} selvagem causou ${damage} de dano.`);
      };
      if (fighter.statAgility >= wild.stats.agility) {
        playerAttack();
        if (wildHp > 0) wildAttack();
      } else {
        wildAttack();
        if (fighterHp > 0) playerAttack();
      }
      await tx.worldMascot.update({ where: { id: fighter.id }, data: { currentHp: fighterHp } });

      const wildFainted = wildHp <= 0;
      if (wildFainted) {
        await tx.worldEncounterSession.update({
          where: { id: encounter.id },
          data: { status: "FAILED", resolvedAt: new Date(), wildJson: { ...wild, hp: 0 } as unknown as Prisma.InputJsonValue },
        });
      } else {
        await tx.worldEncounterSession.update({
          where: { id: encounter.id },
          data: { wildJson: { ...wild, hp: wildHp } as unknown as Prisma.InputJsonValue },
        });
      }
      return {
        wildHp,
        wildMaxHp: wild.maxHp,
        wildFainted,
        fighterName: fighter.nickname?.trim() || getPokemonName(fighter.pokemonId),
        fighterHp,
        fighterMax,
        partyDown: ready.length === 1 && fighterHp <= 0,
        log,
      };
    });
    revalidatePath("/mundo");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível lutar." };
  }
}

const ITEM_SEARCH_FATIGUE = 2;
const GYM_CHALLENGE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// Vasculha a área por itens (ITEM_SEARCH). Resultado decidido no servidor por
// tabela ponderada; custa um pouco de fadiga. Não aceita nada do cliente.
export async function searchWorldItemsAction() {
  try {
    const player = await adminPlayer();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await tx.worldPlayerState.findUnique({ where: { playerId: player.id } });
      if (!state) throw new Error("Inicie sua aventura antes de vasculhar.");
      if (state.travelingToId) throw new Error("Você não pode vasculhar durante uma viagem.");
      const active = await tx.worldEncounterSession.findFirst({
        where: { playerId: player.id, status: "ACTIVE" },
        select: { id: true },
      });
      if (active) throw new Error("Resolva o encontro atual antes de vasculhar.");
      const location = KANTO_MVP_BY_ID.get(state.currentLocationId);
      if (!location?.activities.includes("ITEM_SEARCH"))
        throw new Error("Não há o que vasculhar por aqui.");
      const table = worldItemTable(location.id);
      const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
      let roll = Math.random() * totalWeight;
      const drop = table.find((entry) => (roll -= entry.weight) <= 0) ?? table[table.length - 1];
      const amount = randomInt(drop.min, drop.max);
      const inventory = (state.inventoryJson ?? {}) as Record<string, unknown>;
      if (drop.itemId === "zc") {
        await creditCoins(tx, {
          playerId: player.id,
          type: ZikaCoinTxType.MATCH_WIN_REWARD,
          amount,
          description: `World Mode: item encontrado em ${location.name}`,
        });
        await tx.worldPlayerState.update({
          where: { playerId: player.id },
          data: { fatigue: { increment: ITEM_SEARCH_FATIGUE } },
        });
      } else {
        const freeSlots = Math.max(0, state.backpackCapacity - inventorySize(state.inventoryJson));
        if (amount > freeSlots) throw new Error(`Sua mochila não tem espaço para ${amount} item(ns). Guarde itens em um baú seguro.`);
        await tx.worldPlayerState.update({
          where: { playerId: player.id },
          data: {
            fatigue: { increment: ITEM_SEARCH_FATIGUE },
            inventoryJson: {
              ...inventory,
              [drop.itemId]: Number(inventory[drop.itemId] ?? 0) + amount,
            } as Prisma.InputJsonValue,
          },
        });
      }
      return { label: drop.label, amount, isCoins: drop.itemId === "zc" };
    });
    revalidatePath("/mundo");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível vasculhar." };
  }
}

async function requireAvailableWorldService(playerId: string, service: "CENTER" | "MART" | "STORAGE", tx: Prisma.TransactionClient) {
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
      const carried = await tx.worldMascot.findMany({ where: { playerId: player.id, isInParty: true } });
      for (const mascot of carried) {
        await tx.worldMascot.update({
          where: { id: mascot.id },
          data: { currentHp: worldMaxHp(mascot.level, mascot.statVitality), poisoned: false },
        });
      }
      await tx.worldPlayerState.update({
        where: { playerId: player.id },
        data: {
          fatigue: 0,
          mascotStateJson: {} as Prisma.InputJsonValue,
        },
      });
      return state.fatigue;
    });
    revalidatePath("/mundo");
    return { ok: true as const, recovered };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível descansar." };
  }
}

export async function buyWorldMartItemAction(itemId: string, quantity: number, currency: "ZC" | "LC" = "ZC") {
  try {
    const player = await adminPlayer();
    const item = KANTO_MVP_MART_BY_ID.get(itemId as "pokeBalls" | "potions" | "megaPotions" | "antidotes");
    const safeQuantity = Math.floor(quantity);
    if (!item || safeQuantity < 1 || safeQuantity > 20) throw new Error("Compra inválida.");
    const total = (currency === "LC" ? item.ligaCashPrice : item.price) * safeQuantity;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await requireAvailableWorldService(player.id, "MART", tx);
      if (currency === "LC") await changeLigaCash(tx, { playerId: player.id, amount: -total, spentDelta: total, reason: "WORLD_MODE_PURCHASE", referenceType: "WorldMart", referenceId: item.id });
      else await creditCoins(tx, { playerId: player.id, type: ZikaCoinTxType.SHOP_PURCHASE, amount: -total, description: `World Mode: ${safeQuantity}x ${item.name}` });
      const inventory = (state.inventoryJson ?? {}) as Record<string, unknown>;
      const chest = (state.chestJson ?? {}) as Record<string, unknown>;
      const freeSlots = Math.max(0, state.backpackCapacity - inventorySize(state.inventoryJson));
      const toBackpack = Math.min(freeSlots, safeQuantity);
      const toChest = safeQuantity - toBackpack;
      await tx.worldPlayerState.update({ where: { playerId: player.id }, data: {
        inventoryJson: { ...inventory, [item.id]: Number(inventory[item.id] ?? 0) + toBackpack } as Prisma.InputJsonValue,
        chestJson: { ...chest, [item.id]: Number(chest[item.id] ?? 0) + toChest } as Prisma.InputJsonValue,
      } });
    });
    revalidatePath("/mundo");
    return { ok: true as const, itemName: item.name, quantity: safeQuantity };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível concluir a compra." };
  }
}

export async function moveWorldInventoryAction(itemId: string, quantity: number, direction: "TO_CHEST" | "TO_BACKPACK") {
  try {
    const player = await adminPlayer();
    const safeQuantity = Math.floor(quantity);
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(itemId) || safeQuantity < 1 || safeQuantity > 99) throw new Error("Movimentação inválida.");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await tx.worldPlayerState.findUnique({ where: { playerId: player.id } });
      if (!state || state.travelingToId) throw new Error("Acesse um baú em uma área segura.");
      const location = KANTO_MVP_BY_ID.get(state.currentLocationId);
      if (!location?.services.some((service) => service === "CENTER" || service === "STORAGE")) throw new Error("Não há um baú seguro neste local.");
      const inventory = (state.inventoryJson ?? {}) as Record<string, unknown>;
      const chest = (state.chestJson ?? {}) as Record<string, unknown>;
      const source = direction === "TO_CHEST" ? inventory : chest;
      const target = direction === "TO_CHEST" ? chest : inventory;
      if (Number(source[itemId] ?? 0) < safeQuantity) throw new Error("Quantidade indisponível.");
      if (direction === "TO_BACKPACK" && inventorySize(state.inventoryJson) + safeQuantity > state.backpackCapacity) throw new Error("Sua mochila não comporta esses itens.");
      const nextSource = { ...source, [itemId]: Number(source[itemId] ?? 0) - safeQuantity };
      const nextTarget = { ...target, [itemId]: Number(target[itemId] ?? 0) + safeQuantity };
      await tx.worldPlayerState.update({ where: { playerId: player.id }, data: direction === "TO_CHEST"
        ? { inventoryJson: nextSource as Prisma.InputJsonValue, chestJson: nextTarget as Prisma.InputJsonValue }
        : { chestJson: nextSource as Prisma.InputJsonValue, inventoryJson: nextTarget as Prisma.InputJsonValue } });
    });
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível mover o item." };
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
      const gymCooldowns = (state.gymCooldownJson ?? {}) as Record<string, unknown>;
      if (trainer.tier === "LEADER") {
        const availableAt = new Date(String(gymCooldowns[trainer.id] ?? 0)).getTime();
        if (Number.isFinite(availableAt) && availableAt > Date.now()) {
          const minutes = Math.ceil((availableAt - Date.now()) / 60_000);
          throw new Error(`O líder estará disponível novamente em ${minutes} min.`);
        }
      }
      const activeEncounter = await tx.worldEncounterSession.findFirst({ where: { playerId: player.id, status: "ACTIVE" }, select: { id: true } });
      if (activeEncounter) throw new Error("Resolva seu encontro selvagem antes da batalha.");
      // Apenas instâncias carregadas no World Mode podem participar.
      const party = readWorldParty(state.partyJson);
      if (!party.length) throw new Error("Monte sua equipe do World Mode em uma área segura.");
      const postureById = new Map(party.map((e) => [e.mascotId, e.posture]));
      const found = await tx.worldMascot.findMany({
        where: { id: { in: party.map((entry) => entry.mascotId) }, playerId: player.id, isInParty: true },
      });
      const byId = new Map(found.map((mascot) => [mascot.id, mascot]));
      const mascots = party.map((entry) => byId.get(entry.mascotId)).filter((mascot): mascot is (typeof found)[number] => Boolean(mascot));
      if (!mascots.length) throw new Error("Sua equipe do World Mode está vazia ou inválida.");
      const maxHpById = new Map(
        mascots.map((m) => [m.id, worldMaxHp(m.level, m.statVitality)] as const),
      );
      const battleReady = mascots.filter((m) => m.currentHp > 0);
      if (battleReady.length === 0)
        throw new Error("Toda a sua equipe está desmaiada. Recupere-a no Pokémon Center.");
      // Referência do jogador para escalar o desafio ao seu nível/força.
      const avgLevel =
        battleReady.reduce((sum, m) => sum + m.level, 0) / battleReady.length;
      const avgStatTotal =
        battleReady.reduce(
          (sum, m) =>
            sum +
            m.statForce +
            m.statAgility +
            m.statCharisma +
            m.statInstinct +
            m.statVitality,
          0,
        ) / battleReady.length;
      const handicap = playerLeaderHandicap(trainer.tier);
      const teamA = battleReady.map((mascot, index) =>
        toLeagueMascot(
          // Líderes aplicam uma leve pressão nos status ofensivos do jogador
          // (vitalidade intacta para manter o HP persistente coerente).
          handicap === 1
            ? mascot
            : {
                ...mascot,
                statForce: Math.max(1, Math.round(mascot.statForce * handicap)),
                statAgility: Math.max(1, Math.round(mascot.statAgility * handicap)),
                statInstinct: Math.max(1, Math.round(mascot.statInstinct * handicap)),
                statCharisma: Math.max(1, Math.round(mascot.statCharisma * handicap)),
              },
          index + 1,
          postureById.get(mascot.id),
        ),
      );
      // HP inicial = HP persistente da aventura (ou cheio).
      const startingHp = new Map(
        battleReady.map((m) => [m.id, m.currentHp] as const),
      );
      // Escala a equipe do treinador ao nível/força do jogador (bots mais duros
      // que a Arena; líderes no topo).
      const scaledTeam = scaleTrainerTeam(trainer.team, trainer.tier, {
        avgLevel,
        avgStatTotal,
      });
      const teamB = scaledTeam.map((entry, index) => toLeagueMascot({
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
      // Líderes tomam a iniciativa como vantagem adicional.
      const battle = runLeagueCombat(teamA, teamB, null, [], [], {
        startingHp,
        ...(trainer.tier === "LEADER" ? { initiativeTeam: "B" as const } : {}),
      });
      const won = battle.winner === "A";
      const firstWin = won && !state.defeatedTrainerIds.includes(trainer.id);
      const inventory = (state.inventoryJson ?? {}) as Record<string, unknown>;
      const reward = firstWin ? trainer.firstWinReward : {};
      // HP persistente: reconstrói o HP final de cada mascote do jogador a partir
      // do log da batalha e grava no estado da aventura (dano fica entre lutas).
      const ownIds = new Set(battleReady.map((m) => m.id));
      const endHp = new Map(startingHp);
      for (const entry of battle.log) {
        if (
          entry.targetId &&
          ownIds.has(entry.targetId) &&
          typeof entry.targetHpAfter === "number"
        ) {
          const max = maxHpById.get(entry.targetId)!;
          endHp.set(entry.targetId, Math.max(0, Math.min(max, entry.targetHpAfter)));
        }
      }
      for (const mascot of battleReady)
        await tx.worldMascot.update({ where: { id: mascot.id }, data: { currentHp: endHp.get(mascot.id) ?? maxHpById.get(mascot.id)! } });
      const stateUpdate: Prisma.WorldPlayerStateUpdateInput = trainer.tier === "LEADER"
        ? { gymCooldownJson: { ...gymCooldowns, [trainer.id]: new Date(Date.now() + GYM_CHALLENGE_COOLDOWN_MS).toISOString() } as Prisma.InputJsonValue }
        : {};
      if (firstWin) {
        stateUpdate.defeatedTrainerIds = [...state.defeatedTrainerIds, trainer.id];
        stateUpdate.badges =
          trainer.badgeId && !state.badges.includes(trainer.badgeId)
            ? [...state.badges, trainer.badgeId]
            : state.badges;
        stateUpdate.inventoryJson = {
          ...inventory,
          pokeBalls: Number(inventory.pokeBalls ?? 0) + (reward.pokeBalls ?? 0),
          potions: Number(inventory.potions ?? 0) + (reward.potions ?? 0),
          antidotes: Number(inventory.antidotes ?? 0) + (reward.antidotes ?? 0),
        } as Prisma.InputJsonValue;
      }
      await tx.worldPlayerState.update({
        where: { playerId: player.id },
        data: stateUpdate,
      });
      if (firstWin && reward.zikaCoins)
        await creditCoins(tx, {
          playerId: player.id,
          type: ZikaCoinTxType.MATCH_WIN_REWARD,
          amount: reward.zikaCoins,
          description: `World Mode: vitória contra ${trainer.name}`,
        });
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

export async function chooseWorldStarterAction(pokemonId: number) {
  try {
    if (!WORLD_STARTER_IDS.has(pokemonId)) throw new Error("Inicial inválido.");
    const player = await adminPlayer();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`world:${player.id}`}))`;
      const state = await tx.worldPlayerState.findUnique({ where: { playerId: player.id } });
      if (!state) throw new Error("Registre a aventura antes de escolher o inicial.");
      if (state.starterPokemonId) throw new Error("O inicial desta aventura já foi escolhido.");
      const personality = PERSONALITIES[randomInt(0, PERSONALITIES.length - 1)] as MascotPersonality;
      const mainMascot = await tx.mascot.create({
        data: {
          playerId: player.id,
          pokemonId,
          ...(await getSpeciesSnapshot(pokemonId, tx)),
          hatchedPokemonId: pokemonId,
          hatchedFromEggType: "COMMON",
          hatchedFromEggOrigin: "WORLD_STARTER",
          personality,
          statForce: randomInt(8, 12),
          statAgility: randomInt(8, 12),
          statCharisma: randomInt(8, 12),
          statInstinct: randomInt(8, 12),
          statVitality: randomInt(8, 12),
        },
      });
      const worldMascot = await tx.worldMascot.create({
        data: {
          playerId: player.id,
          mainMascotId: mainMascot.id,
          pokemonId,
          level: 1,
          personality,
          statForce: 10,
          statAgility: 10,
          statCharisma: 10,
          statInstinct: 10,
          statVitality: 10,
          currentHp: worldMaxHp(1, 10),
          origin: "STARTER",
          isInParty: true,
        },
      });
      await tx.worldPlayerState.update({
        where: { playerId: player.id },
        data: {
          starterPokemonId: pokemonId,
          partyJson: [{ mascotId: worldMascot.id, posture: "ATTACKER" }],
        },
      });
      await registerPokemonDiscovery({ playerId: player.id, pokemonId, source: "world-starter" }, tx);
    });
    revalidatePath("/mundo");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível escolher o inicial." };
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
