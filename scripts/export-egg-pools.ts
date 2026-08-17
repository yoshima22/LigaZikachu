import fs from "node:fs";
import path from "node:path";
import {
  ALL_EVOLVED_IDS,
  EGG_POOLS,
  LEGENDARY_HATCH_BASE_OVERRIDES,
  LEGENDARY_POOL,
  getPokemonName,
} from "../src/lib/mascot-data";
import { EGG_RATE_PROFILES, getEggRatePreview } from "../src/lib/mascot-egg-pools";

type PoolReport = {
  eggType: string;
  title: string;
  statRange: string;
  notes: string[];
  pokemonIds: number[];
};

function uniquePokemonIds(ids: number[]) {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
}

function sanitizeNormalEggPool(ids: number[]) {
  return uniquePokemonIds(ids).filter((id) => {
    if (LEGENDARY_POOL.includes(id)) return false;
    if (ALL_EVOLVED_IDS.has(id)) return false;
    if (id === 10006 || id === 10007) return false;
    return true;
  });
}

function hatchableLegendaryPool() {
  return uniquePokemonIds(
    LEGENDARY_POOL.map((id) => LEGENDARY_HATCH_BASE_OVERRIDES[id] ?? id),
  ).filter((id) => !ALL_EVOLVED_IDS.has(id));
}

function possibleFromWeightedEgg(eggType: keyof typeof EGG_RATE_PROFILES) {
  const profile = EGG_RATE_PROFILES[eggType];
  return uniquePokemonIds([
    ...profile.buckets.flatMap((bucket) => sanitizeNormalEggPool(bucket.pokemonIds)),
    ...hatchableLegendaryPool(),
  ]);
}

function possibleFromLabEgg() {
  return uniquePokemonIds([
    ...sanitizeNormalEggPool(EGG_POOLS.SPECIAL ?? []),
    ...hatchableLegendaryPool(),
  ]);
}

function formatPokemonList(ids: number[]) {
  return ids
    .map((id) => `- ${id} - ${getPokemonName(id)}`)
    .join("\n");
}

function bucketSummary(eggType: string) {
  const preview = getEggRatePreview(eggType);
  const bucketLines = preview.buckets.map((bucket) => (
    `- ${bucket.label}: peso ${bucket.weight}, ${bucket.count} possibilidades`
  ));
  return [
    `- Chance lendaria/mistica separada: ${(preview.legendaryChance * 100).toFixed(2)}%`,
    ...bucketLines,
  ];
}

const reports: PoolReport[] = [
  {
    eggType: "COMMON",
    title: "Ovo Comum",
    statRange: "8-14 por atributo",
    notes: bucketSummary("COMMON"),
    pokemonIds: possibleFromWeightedEgg("COMMON"),
  },
  {
    eggType: "RARE",
    title: "Ovo Raro",
    statRange: "11-17 por atributo",
    notes: bucketSummary("RARE"),
    pokemonIds: possibleFromWeightedEgg("RARE"),
  },
  {
    eggType: "SPECIAL",
    title: "Ovo Especial",
    statRange: "13-20 por atributo",
    notes: bucketSummary("SPECIAL"),
    pokemonIds: possibleFromWeightedEgg("SPECIAL"),
  },
  {
    eggType: "EVENT",
    title: "Ovo de Evento",
    statRange: "12-19 por atributo",
    notes: bucketSummary("EVENT"),
    pokemonIds: possibleFromWeightedEgg("EVENT"),
  },
  {
    eggType: "LAB",
    title: "Ovo de Laboratorio",
    statRange: "17-26 por atributo",
    notes: [
      "- Chance lendaria/mistica separada: 7.00%",
      "- Pool normal: pool SPECIAL filtrado, com stats melhores de laboratorio",
    ],
    pokemonIds: possibleFromLabEgg(),
  },
];

const pidgeyInfo = reports.map((report) => ({
  title: report.title,
  hasPidgey: report.pokemonIds.includes(16),
}));

const out = [
  "# Pools possiveis de ovos - Liga Zikachu",
  "",
  `Gerado em: ${new Date().toISOString()}`,
  "",
  "Este arquivo lista todas as especies que podem sair de cada tipo de ovo principal considerando buckets ponderados, filtros contra formas evoluidas e a rolagem separada de lendarios/miticos configurada no codigo.",
  "",
  "## Confirmacao: Pidgey",
  "",
  ...pidgeyInfo.map((row) => `- ${row.title}: ${row.hasPidgey ? "SIM" : "nao"}`),
  "",
  ...reports.flatMap((report) => [
    `## ${report.title} (${report.eggType})`,
    "",
    `- Total de possibilidades: ${report.pokemonIds.length}`,
    `- Faixa inicial de atributos: ${report.statRange}`,
    ...report.notes,
    "",
    formatPokemonList(report.pokemonIds),
    "",
  ]),
].join("\n");

const outDir = path.join(process.cwd(), "reports");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "egg-pools.md");
fs.writeFileSync(outPath, out, "utf8");
console.log(outPath);
