"use server";

import { revalidatePath } from "next/cache";
import { MascotPersonality, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getPokemonTypes, getStaticSpriteUrl, getSpriteUrl } from "@/lib/mascot-data";
import { getHatchedEggLabel } from "@/lib/egg-origin";
import { uploadDataUrlAsset } from "@/lib/asset-storage";

const TYPES = new Set(["normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"]);
const PERSONALITIES = new Set(Object.values(MascotPersonality));

function generationFor(id: number) {
  if (id <= 151) return 1; if (id <= 251) return 2; if (id <= 386) return 3;
  if (id <= 493) return 4; if (id <= 649) return 5; if (id <= 721) return 6;
  if (id <= 809) return 7; if (id <= 905) return 8; return 9;
}

export async function getPlayerMascotEditorData(playerId: string) {
  await requireAdmin();
  const mascots = await prisma.mascot.findMany({
    where: { playerId },
    orderBy: [{ level: "desc" }, { hatchedAt: "desc" }],
    select: {
      id: true, pokemonId: true, nickname: true, level: true, exp: true, personality: true,
      statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
      happiness: true, mood: true, isShiny: true, isFavorite: true, isEquipped: true,
      battleWins: true, battleLosses: true, hatchedFromEggType: true, hatchedFromEggOrigin: true,
      speciesNameOverride: true, primaryTypeOverride: true, secondaryTypeOverride: true,
      staticSpriteUrlOverride: true, animatedSpriteUrlOverride: true,
    },
  });
  return mascots.map((m) => ({
    ...m,
    displayName: m.nickname || m.speciesNameOverride || getPokemonName(m.pokemonId),
    speciesName: m.speciesNameOverride || getPokemonName(m.pokemonId),
    types: [m.primaryTypeOverride, m.secondaryTypeOverride].filter(Boolean).length
      ? [m.primaryTypeOverride, m.secondaryTypeOverride].filter(Boolean)
      : getPokemonTypes(m.pokemonId),
    spriteUrl: m.animatedSpriteUrlOverride || m.staticSpriteUrlOverride || getSpriteUrl(m.pokemonId, true),
    eggOriginLabel: getHatchedEggLabel(m.hatchedFromEggType, m.hatchedFromEggOrigin),
    statTotal: m.statForce + m.statAgility + m.statCharisma + m.statInstinct + m.statVitality,
  }));
}

export async function updateMascotAdminAction(input: {
  mascotId: string; personality: string; level: number;
  statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number;
  randomBonusMin?: number; randomBonusMax?: number;
}) {
  const admin = await requireAdmin();
  if (!PERSONALITIES.has(input.personality as MascotPersonality)) return { error: "Personalidade inválida." };
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 100) return { error: "Nível inválido." };
  const base = [input.statForce,input.statAgility,input.statCharisma,input.statInstinct,input.statVitality];
  if (base.some((v) => !Number.isInteger(v) || v < 0 || v > 999)) return { error: "Status inválidos." };
  const min = Math.max(0, Math.floor(input.randomBonusMin ?? 0));
  const max = Math.max(min, Math.floor(input.randomBonusMax ?? min));
  const bonus = min + Math.floor(Math.random() * (max - min + 1));
  const extra = [0,0,0,0,0];
  for (let i = 0; i < bonus; i++) extra[Math.floor(Math.random() * extra.length)]++;
  const before = await prisma.mascot.findUnique({ where: { id: input.mascotId } });
  if (!before) return { error: "Mascote não encontrado." };
  const after = await prisma.mascot.update({
    where: { id: input.mascotId },
    data: {
      personality: input.personality as MascotPersonality, level: input.level,
      statForce: input.statForce + extra[0], statAgility: input.statAgility + extra[1],
      statCharisma: input.statCharisma + extra[2], statInstinct: input.statInstinct + extra[3],
      statVitality: input.statVitality + extra[4], analyzedAt: null, ivScore: null, ivRating: null, analysisJson: Prisma.JsonNull,
    },
  });
  await prisma.auditLog.create({ data: { actorUserId: admin.id, entityType: "Mascot", entityId: after.id, action: "ADMIN_EDIT_MASCOT", before: before as unknown as Prisma.InputJsonValue, after: after as unknown as Prisma.InputJsonValue, metadata: { randomBonus: bonus } } });
  revalidatePath("/mascotes"); revalidatePath("/admin/mascotes");
  return { ok: true, randomBonus: bonus };
}

export async function searchSpeciesAdminAction(query: string) {
  await requireAdmin();
  const q = query.trim().toLocaleLowerCase("pt-BR");
  if (!q) return [];
  const numeric = Number(q);
  const official = Array.from({ length: 1025 }, (_, i) => i + 1)
    .filter((id) => Number.isInteger(numeric) ? id === numeric : getPokemonName(id).toLocaleLowerCase("pt-BR").includes(q))
    .slice(0, 25)
    .map((pokemonId) => ({ pokemonId, name: getPokemonName(pokemonId), generation: generationFor(pokemonId), types: getPokemonTypes(pokemonId), custom: false, staticSpriteUrl: getStaticSpriteUrl(pokemonId), animatedSpriteUrl: getSpriteUrl(pokemonId, true) }));
  const definitions = await prisma.pokemonSpeciesDefinition.findMany({
    where: Number.isInteger(numeric) ? { pokemonId: numeric } : { name: { contains: query.trim(), mode: "insensitive" } },
    take: 25,
  });
  const merged = new Map(official.map((item) => [item.pokemonId, item]));
  for (const d of definitions) merged.set(d.pokemonId, { pokemonId: d.pokemonId, name: d.name, generation: d.generation, types: [d.primaryType, d.secondaryType].filter(Boolean) as string[], custom: d.custom, staticSpriteUrl: d.staticSpriteUrl || getStaticSpriteUrl(d.pokemonId), animatedSpriteUrl: d.animatedSpriteUrl || d.staticSpriteUrl || getSpriteUrl(d.pokemonId, true) });
  return [...merged.values()].slice(0, 30);
}

export async function updateSpeciesTypesAdminAction(input: { pokemonId: number; name: string; generation: number; primaryType: string; secondaryType?: string | null }) {
  const admin = await requireAdmin();
  const primary = input.primaryType.toLowerCase(); const secondary = input.secondaryType?.toLowerCase() || null;
  if (!TYPES.has(primary) || (secondary && !TYPES.has(secondary))) return { error: "Tipo inválido." };
  const current = await prisma.pokemonSpeciesDefinition.findUnique({ where: { pokemonId: input.pokemonId } });
  const definition = await prisma.pokemonSpeciesDefinition.upsert({
    where: { pokemonId: input.pokemonId },
    create: { pokemonId: input.pokemonId, name: input.name, generation: input.generation, primaryType: primary, secondaryType: secondary },
    update: { name: input.name, generation: input.generation, primaryType: primary, secondaryType: secondary },
  });
  const affected = await prisma.mascot.updateMany({ where: { pokemonId: input.pokemonId }, data: { speciesNameOverride: definition.name, primaryTypeOverride: primary, secondaryTypeOverride: secondary, generationOverride: definition.generation } });
  const activeListings = await prisma.bazarListing.findMany({
    where: { category: "MASCOT", status: { in: ["ACTIVE", "RESERVED"] }, payload: { path: ["pokemonId"], equals: input.pokemonId } },
    select: { id: true, payload: true },
  });
  await prisma.$transaction(activeListings.map((listing) => prisma.bazarListing.update({
    where: { id: listing.id },
    data: { payload: { ...(listing.payload as Record<string, unknown>), pokemonName: definition.name, primaryTypeOverride: primary, secondaryTypeOverride: secondary } as Prisma.InputJsonValue },
  })));
  await prisma.auditLog.create({ data: { actorUserId: admin.id, entityType: "PokemonSpecies", entityId: String(input.pokemonId), action: "ADMIN_UPDATE_SPECIES_TYPES", before: current as unknown as Prisma.InputJsonValue, after: definition as unknown as Prisma.InputJsonValue, metadata: { affectedMascots: affected.count } } });
  revalidatePath("/mascotes"); revalidatePath("/bazar"); revalidatePath("/admin/mascotes");
  return { ok: true, affected: affected.count };
}

export async function createCustomSpeciesAdminAction(input: { name: string; generation: number; primaryType: string; secondaryType?: string; rarity: string; staticSpriteDataUrl: string; animatedSpriteDataUrl?: string }) {
  const admin = await requireAdmin();
  const name = input.name.trim(); const primary = input.primaryType.toLowerCase(); const secondary = input.secondaryType?.toLowerCase() || null;
  if (name.length < 2 || name.length > 60) return { error: "Informe um nome válido." };
  if (input.generation < 1 || input.generation > 99) return { error: "Geração inválida." };
  if (!TYPES.has(primary) || (secondary && !TYPES.has(secondary))) return { error: "Tipo inválido." };
  if (!input.staticSpriteDataUrl?.startsWith("data:image/")) return { error: "Envie ao menos o sprite estático." };
  const latest = await prisma.pokemonSpeciesDefinition.findFirst({ where: { pokemonId: { gte: 200000 } }, orderBy: { pokemonId: "desc" }, select: { pokemonId: true } });
  const pokemonId = (latest?.pokemonId ?? 199999) + 1;
  const staticSpriteUrl = await uploadDataUrlAsset(input.staticSpriteDataUrl, "custom-mascots", `${pokemonId}-${name}-static`);
  const animatedSpriteUrl = input.animatedSpriteDataUrl?.startsWith("data:image/") ? await uploadDataUrlAsset(input.animatedSpriteDataUrl, "custom-mascots", `${pokemonId}-${name}-animated`) : null;
  const definition = await prisma.pokemonSpeciesDefinition.create({ data: { pokemonId, name, generation: input.generation, primaryType: primary, secondaryType: secondary, rarity: input.rarity, staticSpriteUrl, animatedSpriteUrl, custom: true, eggEligible: true } });
  await prisma.auditLog.create({ data: { actorUserId: admin.id, entityType: "PokemonSpecies", entityId: String(pokemonId), action: "ADMIN_CREATE_CUSTOM_SPECIES", after: definition as unknown as Prisma.InputJsonValue } });
  revalidatePath("/admin/mascotes");
  return { ok: true, pokemonId };
}
