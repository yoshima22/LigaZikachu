export type TacticalBiomeId =
  | "VOLCANIC"
  | "AQUATIC"
  | "FOREST"
  | "FROZEN"
  | "ROCKY"
  | "MYSTIC";

export type TacticalBiome = {
  id: TacticalBiomeId;
  name: string;
  favoredTypes: string[];
  penalizedTypes: string[];
  color: string;
  imageUrl?: string;
};

export const TACTICAL_BIOMES: TacticalBiome[] = [
  {
    id: "VOLCANIC",
    name: "Vulcânico",
    favoredTypes: ["fire"],
    penalizedTypes: ["ice", "grass"],
    color: "rgba(239,68,68,.13)",
  },
  {
    id: "AQUATIC",
    name: "Aquático",
    favoredTypes: ["water"],
    penalizedTypes: ["fire", "ground"],
    color: "rgba(14,165,233,.14)",
  },
  {
    id: "FOREST",
    name: "Floresta",
    favoredTypes: ["grass", "bug"],
    penalizedTypes: ["rock"],
    color: "rgba(34,197,94,.13)",
  },
  {
    id: "FROZEN",
    name: "Congelado",
    favoredTypes: ["ice"],
    penalizedTypes: ["dragon"],
    color: "rgba(103,232,249,.13)",
  },
  {
    id: "ROCKY",
    name: "Rochoso",
    favoredTypes: ["rock", "ground"],
    penalizedTypes: ["electric"],
    color: "rgba(168,162,158,.15)",
  },
  {
    id: "MYSTIC",
    name: "Místico",
    favoredTypes: ["psychic", "fairy", "ghost"],
    penalizedTypes: ["dark"],
    color: "rgba(168,85,247,.14)",
  },
];

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1)
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

export function createTacticalBiomes(
  seed: string,
  images: Partial<Record<TacticalBiomeId, string>> = {},
) {
  return [...TACTICAL_BIOMES]
    .sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`))
    .slice(0, 4)
    .map((biome) => ({ ...biome, imageUrl: images[biome.id] || undefined }));
}

export function tacticalBiomeAt(biomes: TacticalBiome[], x: number, y: number) {
  if (!biomes.length) return null;
  const quadrant = (x >= 6 ? 1 : 0) + (y >= 4 ? 2 : 0);
  return biomes[quadrant % biomes.length] ?? null;
}

export type TacticalFogState = "SAFE" | "WARNING" | "ACTIVE";

export function tacticalFogActivationRound(x: number, y: number) {
  const dx = x < 4 ? 4 - x : x > 7 ? x - 7 : 0;
  const dy = y < 2 ? 2 - y : y > 5 ? y - 5 : 0;
  const ring = Math.max(dx, dy);
  if (ring >= 4) return 4;
  if (ring === 3) return 6;
  if (ring === 2) return 8;
  if (ring === 1) return 10;
  return 16;
}

export function tacticalFogState(
  round: number,
  x: number,
  y: number,
): TacticalFogState {
  const activation = tacticalFogActivationRound(x, y);
  if (round >= activation) return "ACTIVE";
  if (round >= activation - 1) return "WARNING";
  return "SAFE";
}
