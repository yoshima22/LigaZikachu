import { PrismaClient } from "@prisma/client";
import {
  ALL_EVOLVED_IDS,
  EGG_POOLS,
  EVOLUTION_MAP,
  LEGENDARY_HATCH_BASE_OVERRIDES,
  LEGENDARY_POOL,
  getMascotRarity,
  getPokemonName,
  getPokemonTypes,
} from "../src/lib/mascot-data";
import { EGG_RATE_PROFILES, getEggRatePreview } from "../src/lib/mascot-egg-pools";

const prisma = new PrismaClient();

const NORMAL_TYPE_IDS = new Set([
  16, 19, 21, 39, 52, 83, 84, 108, 113, 115, 128, 132, 133, 137, 143,
  161, 162, 163, 164, 174, 190, 203, 206, 216, 217, 234, 235, 241, 242,
  263, 264, 276, 277, 287, 288, 289, 293, 294, 295, 300, 301, 327, 333,
  335, 351, 352, 396, 397, 398, 399, 400, 424, 427, 428, 431, 432, 440,
  441, 446, 474, 486, 493, 504, 505, 506, 507, 508, 519, 520, 521, 531,
  572, 573, 585, 586, 626, 627, 628, 648, 659, 660, 661, 667, 676, 694,
  695, 731, 732, 733, 734, 735, 759, 760, 765, 772, 773, 775, 780, 819,
  820, 821, 831, 832, 862, 899, 915, 916, 924, 925, 926, 927, 931, 982,
  1024,
]);

function describePokemon(pokemonId: number) {
  return {
    pokemonId,
    name: getPokemonName(pokemonId),
    types: getPokemonTypes(pokemonId).join("/"),
    rarity: getMascotRarity(pokemonId),
    isEvolved: ALL_EVOLVED_IDS.has(pokemonId),
    evolvesTo: EVOLUTION_MAP.get(pokemonId)?.to ?? EVOLUTION_MAP.get(pokemonId)?.toOptions ?? null,
  };
}

function hasMetadataIssue(pokemonId: number) {
  const name = getPokemonName(pokemonId);
  const types = getPokemonTypes(pokemonId).join("/");
  return name.startsWith("Pok") || (types === "normal" && !NORMAL_TYPE_IDS.has(pokemonId));
}

function collectConfiguredPoolSources() {
  const sources = new Map<number, Set<string>>();
  const add = (pokemonId: number, source: string) => {
    if (!sources.has(pokemonId)) sources.set(pokemonId, new Set());
    sources.get(pokemonId)!.add(source);
  };

  for (const [eggType, ids] of Object.entries(EGG_POOLS)) {
    for (const pokemonId of ids) add(pokemonId, eggType);
  }

  for (const [eggType, profile] of Object.entries(EGG_RATE_PROFILES)) {
    for (const bucket of profile.buckets) {
      for (const pokemonId of bucket.pokemonIds) add(pokemonId, `${eggType}:${bucket.label}`);
    }
  }

  return sources;
}

async function main() {
  const sources = collectConfiguredPoolSources();
  const poolIssues = [...sources.entries()]
    .map(([pokemonId, sourceSet]) => ({
      ...describePokemon(pokemonId),
      sources: [...sourceSet].sort(),
    }))
    .filter((entry) => hasMetadataIssue(entry.pokemonId));

  const hatchableLegendaryPool = [
    ...new Set(LEGENDARY_POOL.map((id) => LEGENDARY_HATCH_BASE_OVERRIDES[id] ?? id)),
  ].filter((id) => !ALL_EVOLVED_IDS.has(id));

  const dbGroups = await prisma.mascot.groupBy({
    by: ["pokemonId"],
    _count: { _all: true },
    orderBy: { pokemonId: "asc" },
  });

  const dbReport = dbGroups.map((group) => ({
    ...describePokemon(group.pokemonId),
    count: group._count._all,
  }));

  const dbIssues = dbReport.filter(
    (entry) => entry.pokemonId === 809 || hasMetadataIssue(entry.pokemonId),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    configuredPoolSpecies: sources.size,
    hatchableLegendarySpecies: hatchableLegendaryPool.length,
    totalMascotsInDatabase: dbReport.reduce((sum, entry) => sum + entry.count, 0),
    speciesInDatabase: dbReport.length,
    highlightedPokemon: [494, 808, 809, 905].map(describePokemon),
    eggRatePreview: Object.fromEntries(
      [
        "COMMON", "RARE", "SPECIAL", "EVENT",
        "EGG_GEN1", "EGG_GEN2", "EGG_GEN3", "EGG_GEN4", "EGG_GEN5",
        "EGG_GEN6", "EGG_GEN7", "EGG_GEN8", "EGG_GEN9",
        "EGG_ALOLA", "EGG_GALAR", "EGG_HISUI",
      ].map((eggType) => [eggType, getEggRatePreview(eggType)]),
    ),
    poolIssues,
    databaseIssues: dbIssues,
    databaseSpecies: dbReport,
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
