// Engine de análise de IV/potencial de mascotes (usada pelo Laboratório).
// Tudo determinístico — reaproveita as mesmas regras de crescimento de mascot.ts.
import {
  EVOLUTION_MAP, EVOLUTION_REVERSE_MAP, LEGENDARY_POOL,
  getMascotStatusGrowthMultiplier, getMascotProgressMilestones, getPokemonName,
} from "@/lib/mascot-data";

// Mesmo fator usado em mascot.ts (LEVEL_STAT_GAIN_MULTIPLIER)
const LEVEL_GAIN = 0.55;
// Banda de qualidade do roll inicial: 5×8 (pior) → 5×20 (ovo Especial, excelente)
const BASE_MIN_TOTAL = 40;
const BASE_MAX_TOTAL = 100;

export type StatKey = "force" | "agility" | "charisma" | "instinct" | "vitality";
export type MascotStats = Record<StatKey, number>;

export type MascotRating = "SSS" | "SS" | "S" | "A" | "B" | "C" | "D" | "E";

export interface AnalysisInput {
  pokemonId: number;
  level: number;
  personality: string;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
  evolutionLocked?: boolean;
}

export interface MascotAnalysis {
  currentLevel: number;
  targetLevel: number;
  currentStats: MascotStats;
  projectedStats: MascotStats;
  currentTotal: number;
  projectedTotal: number;
  perStat: { key: StatKey; label: string; current: number; projected: number; delta: number }[];
  finalPokemonId: number;
  finalName: string;
  willEvolve: boolean;
  evolutionChain: { pokemonId: number; name: string; level: number }[];
  ivScore: number;               // 0-100
  ivRating: MascotRating;
  rollQualityPct: number;        // 0-100 — qualidade do roll inicial
  speciesPotentialPct: number;   // 0-100 — bônus de crescimento da espécie
  evoPotentialPct: number;       // 0-100 — evoluções restantes
  verdict: string;
  evolutionNote: string | null;
  analyzedAtIso: string;
}

const STAT_LABELS: Record<StatKey, string> = {
  force: "Força", agility: "Agilidade", charisma: "Carisma", instinct: "Instinto", vitality: "Vitalidade",
};

// Pontos brutos por nível (antes do multiplicador), conforme levelStatBonuses de mascot.ts
function rawPointsPerLevel(personality: string): number {
  const comp = personality === "COMPETITIVE" ? 2 : 1;
  const loyal = personality === "LOYAL" ? 2 : 1;
  const dramatic = personality === "DRAMATIC" ? 0 : 1;
  return comp + 1 + loyal + 1 + dramatic;
}

function pointsPerLevel(personality: string, growthMult: number): number {
  const raw = rawPointsPerLevel(personality);
  return Math.max(1, Math.round(raw * LEVEL_GAIN * growthMult));
}

/** Evoluções restantes a partir deste pokémon (0, 1 ou 2). */
export function evolutionsRemaining(pokemonId: number): number {
  let current = pokemonId;
  let count = 0;
  const seen = new Set<number>();
  while (!seen.has(current)) {
    seen.add(current);
    const next = EVOLUTION_MAP.get(current);
    if (!next) break;
    count++;
    current = next.toOptions?.[0] ?? next.to;
  }
  return count;
}

/** Forma final a que o mascote chega ao atingir targetLevel (respeitando evolutionLocked). */
function finalFormAtLevel(pokemonId: number, targetLevel: number, evolutionLocked: boolean): number {
  if (evolutionLocked) return pokemonId;
  let current = pokemonId;
  const seen = new Set<number>();
  while (!seen.has(current)) {
    seen.add(current);
    const next = EVOLUTION_MAP.get(current);
    if (!next || targetLevel < next.level) break;
    current = next.toOptions?.[0] ?? next.to;
  }
  return current;
}

/** Cadeia evolutiva completa da linha (do estágio base ao final), com o nível de cada evolução. */
function fullEvolutionChain(pokemonId: number): { pokemonId: number; level: number }[] {
  // Anda para trás até a base
  let base = pokemonId;
  const seenBack = new Set<number>();
  while (!seenBack.has(base)) {
    seenBack.add(base);
    const prev = EVOLUTION_REVERSE_MAP.get(base)?.[0];
    if (!prev) break;
    base = prev.from;
  }
  // Anda para frente montando a cadeia
  const chain: { pokemonId: number; level: number }[] = [{ pokemonId: base, level: 1 }];
  let current = base;
  const seenFwd = new Set<number>();
  while (!seenFwd.has(current)) {
    seenFwd.add(current);
    const next = EVOLUTION_MAP.get(current);
    if (!next) break;
    const target = next.toOptions?.[0] ?? next.to;
    chain.push({ pokemonId: target, level: next.level });
    current = target;
  }
  return chain;
}

function milestonePointsUpTo(pokemonId: number, level: number): number {
  return getMascotProgressMilestones(pokemonId, level).reduce((sum, m) => sum + m.points, 0);
}

function distributeProportional(stats: MascotStats, totalToAdd: number): MascotStats {
  const total = stats.force + stats.agility + stats.charisma + stats.instinct + stats.vitality;
  if (totalToAdd <= 0 || total <= 0) return { ...stats };
  const keys: StatKey[] = ["force", "agility", "charisma", "instinct", "vitality"];
  const result = { ...stats };
  let distributed = 0;
  for (const k of keys) {
    const add = Math.round(totalToAdd * (stats[k] / total));
    result[k] = stats[k] + add;
    distributed += add;
  }
  // Ajuste do resto no maior stat
  const remainder = totalToAdd - distributed;
  if (remainder !== 0) {
    const biggest = keys.reduce((a, b) => (result[b] > result[a] ? b : a), keys[0]);
    result[biggest] += remainder;
  }
  return result;
}

function ratingFromScore(score: number): MascotRating {
  if (score >= 92) return "SSS";
  if (score >= 82) return "SS";
  if (score >= 72) return "S";
  if (score >= 60) return "A";
  if (score >= 47) return "B";
  if (score >= 34) return "C";
  if (score >= 20) return "D";
  return "E";
}

function verdictText(rating: MascotRating): string {
  switch (rating) {
    case "SSS": return "Potencial absoluto de elite. Invista tudo neste mascote.";
    case "SS":  return "Potencial de elite — vale investimento pesado.";
    case "S":   return "Excelente. Vale todo o esforço de evoluir e treinar.";
    case "A":   return "Muito bom para uso geral em qualquer modo.";
    case "B":   return "Sólido — cumpre bem seu papel no time.";
    case "C":   return "Mediano. Use se gostar dele ou para o dia a dia.";
    case "D":   return "Fraco. Considere reciclar no Lab por Pó de Criação.";
    case "E":   return "Baixíssimo potencial — ótimo candidato à reciclagem.";
  }
}

export function computeMascotAnalysis(input: AnalysisInput, targetLevelRaw?: number): MascotAnalysis {
  const currentLevel = Math.max(1, Math.min(100, input.level));
  const targetLevel = Math.max(currentLevel, Math.min(100, targetLevelRaw ?? Math.min(100, Math.max(currentLevel, 50))));
  const evolutionLocked = input.evolutionLocked ?? false;

  const currentStats: MascotStats = {
    force: input.statForce, agility: input.statAgility, charisma: input.statCharisma,
    instinct: input.statInstinct, vitality: input.statVitality,
  };
  const currentTotal = currentStats.force + currentStats.agility + currentStats.charisma + currentStats.instinct + currentStats.vitality;

  const finalPokemonId = finalFormAtLevel(input.pokemonId, targetLevel, evolutionLocked);
  const growthMult = getMascotStatusGrowthMultiplier(finalPokemonId);

  // Projeção de stats até targetLevel
  const ppl = pointsPerLevel(input.personality, growthMult);
  const levelPoints = (targetLevel - currentLevel) * ppl;
  const milestoneNow = milestonePointsUpTo(input.pokemonId, currentLevel);
  const milestoneTarget = milestonePointsUpTo(finalPokemonId, targetLevel);
  const milestoneGain = Math.max(0, milestoneTarget - milestoneNow);
  const totalAdded = levelPoints + milestoneGain;
  const projectedStats = distributeProportional(currentStats, totalAdded);
  const projectedTotal = projectedStats.force + projectedStats.agility + projectedStats.charisma + projectedStats.instinct + projectedStats.vitality;

  // ── IV / potencial futuro ──
  // 1) Qualidade do roll inicial: isola a contribuição do crescimento e compara com a banda base.
  const pplCurrent = pointsPerLevel(input.personality, getMascotStatusGrowthMultiplier(input.pokemonId));
  const growthContribution = (currentLevel - 1) * pplCurrent + milestoneNow;
  const estBase = Math.max(BASE_MIN_TOTAL, Math.min(BASE_MAX_TOTAL, currentTotal - growthContribution));
  const rollQuality = (estBase - BASE_MIN_TOTAL) / (BASE_MAX_TOTAL - BASE_MIN_TOTAL);

  // 2) Potencial de espécie (multiplicador de crescimento) e evoluções restantes.
  const speciesPotential = Math.max(0, Math.min(1, (growthMult - 1) / 0.3)); // 0, 0.33, 1
  const evoRemaining = evolutionsRemaining(input.pokemonId);
  const evoPotential = Math.max(0, Math.min(1, evoRemaining / 2));
  const isLegendary = LEGENDARY_POOL.includes(input.pokemonId);
  const ceiling = isLegendary ? 1 : (0.65 * speciesPotential + 0.35 * evoPotential);

  const ivScore = Math.round(100 * (0.55 * rollQuality + 0.45 * ceiling));
  const ivRating = ratingFromScore(ivScore);

  // Cadeia e nota de evolução
  const chainRaw = fullEvolutionChain(input.pokemonId);
  const evolutionChain = chainRaw.map(c => ({ pokemonId: c.pokemonId, name: getPokemonName(c.pokemonId), level: c.level }));
  const willEvolve = finalPokemonId !== input.pokemonId;

  let evolutionNote: string | null = null;
  if (evolutionLocked && evoRemaining > 0) {
    evolutionNote = "Evolução travada. Destrave para o mascote atingir todo o potencial estimado.";
  } else if (willEvolve) {
    const nextForm = getPokemonName(finalPokemonId);
    evolutionNote = `Ao chegar no Nv.${targetLevel} evolui para ${nextForm}, ganhando marcos de atributo. Vale a pena evoluir.`;
  } else if (evoRemaining > 0) {
    const next = EVOLUTION_MAP.get(input.pokemonId);
    if (next) evolutionNote = `Evolui para ${getPokemonName(next.toOptions?.[0] ?? next.to)} no Nv.${next.level}. Aumente o nível-alvo para ver o ganho.`;
  }

  const perStat = (Object.keys(STAT_LABELS) as StatKey[]).map(key => ({
    key,
    label: STAT_LABELS[key],
    current: currentStats[key],
    projected: projectedStats[key],
    delta: projectedStats[key] - currentStats[key],
  }));

  return {
    currentLevel,
    targetLevel,
    currentStats,
    projectedStats,
    currentTotal,
    projectedTotal,
    perStat,
    finalPokemonId,
    finalName: getPokemonName(finalPokemonId),
    willEvolve,
    evolutionChain,
    ivScore,
    ivRating,
    rollQualityPct: Math.round(rollQuality * 100),
    speciesPotentialPct: Math.round(speciesPotential * 100),
    evoPotentialPct: Math.round(evoPotential * 100),
    verdict: verdictText(ivRating),
    evolutionNote,
    analyzedAtIso: new Date().toISOString(),
  };
}

/** Cores por rating para uso na UI (badge do card e painel do Lab). */
export const RATING_STYLE: Record<MascotRating, { text: string; border: string; bg: string }> = {
  SSS: { text: "text-fuchsia-300", border: "border-fuchsia-400/50", bg: "bg-fuchsia-500/15" },
  SS:  { text: "text-purple-300",  border: "border-purple-400/50",  bg: "bg-purple-500/15" },
  S:   { text: "text-amber-300",   border: "border-amber-400/50",   bg: "bg-amber-500/15" },
  A:   { text: "text-emerald-300", border: "border-emerald-400/50", bg: "bg-emerald-500/15" },
  B:   { text: "text-sky-300",     border: "border-sky-400/50",     bg: "bg-sky-500/15" },
  C:   { text: "text-slate-300",   border: "border-slate-400/40",   bg: "bg-slate-500/15" },
  D:   { text: "text-orange-300",  border: "border-orange-400/40",  bg: "bg-orange-500/10" },
  E:   { text: "text-red-300",     border: "border-red-400/40",     bg: "bg-red-500/10" },
};
