// Engine de análise de IV/potencial de mascotes (usada pelo Laboratório).
// Tudo determinístico — reaproveita as mesmas regras de crescimento de mascot.ts.
import {
  EVOLUTION_MAP, EVOLUTION_REVERSE_MAP, LEGENDARY_POOL,
  getMascotStatusGrowthMultiplier, getMascotProgressMilestones, getPokemonName,
} from "@/lib/mascot-data";
import { COMBAT_ROLE_LABELS, COMBAT_ROLE_DESCRIPTIONS } from "@/lib/combat-roles";

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
  // Dados extras da análise
  dominantStatLabel: string;
  balanceLabel: string;
  personalityNote: string | null;
  projectedPower: number;
  roleSuggestions: { role: string; label: string; statLabel: string; value: number; description: string }[];
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

// Ordem dos atributos igual à de mascot.ts (importa para o "wobble" por índice)
const STAT_KEYS: StatKey[] = ["force", "agility", "charisma", "instinct", "vitality"];

/** Distribui `total` pontos entre os atributos por peso — réplica exata de
 *  distributeStatPoints() de mascot.ts (maior resto). */
function distributeFaithful(total: number, weights: MascotStats): MascotStats {
  const weightTotal = STAT_KEYS.reduce((s, k) => s + Math.max(1, weights[k]), 0);
  const exact = STAT_KEYS.map((k) => {
    const v = (Math.max(1, weights[k]) / weightTotal) * total;
    const floor = Math.floor(v);
    return { key: k, floor, remainder: v - floor };
  });
  const dist: MascotStats = { force: 0, agility: 0, charisma: 0, instinct: 0, vitality: 0 };
  for (const e of exact) dist[e.key] += e.floor;
  let leftover = total - STAT_KEYS.reduce((s, k) => s + dist[k], 0);
  for (const e of [...exact].sort((a, b) => b.remainder - a.remainder)) {
    if (leftover <= 0) break;
    dist[e.key]++; leftover--;
  }
  return dist;
}

/** Ganho de atributos de UM nível — réplica de levelStatBonuses() de mascot.ts. */
function levelBonus(pokemonId: number, level: number, personality: string, stats: MascotStats): MascotStats {
  const raw = rawPointsPerLevel(personality);
  const growthMult = getMascotStatusGrowthMultiplier(pokemonId);
  const points = Math.max(1, Math.round(raw * LEVEL_GAIN * growthMult));
  const weights: MascotStats = {
    force: stats.force * 3, agility: stats.agility * 3, charisma: stats.charisma * 3,
    instinct: stats.instinct * 3, vitality: stats.vitality * 3,
  };
  if (personality === "COMPETITIVE") weights.force *= 1.15;
  if (personality === "LOYAL") weights.charisma *= 1.15;
  if (personality === "DRAMATIC") weights.vitality *= 0.85;
  STAT_KEYS.forEach((key, index) => {
    const wobble = 0.92 + (((pokemonId * (index + 3) + level * 11) % 17) / 100);
    weights[key] *= wobble;
  });
  return distributeFaithful(points, weights);
}

const addStats = (a: MascotStats, b: MascotStats): MascotStats => ({
  force: a.force + b.force, agility: a.agility + b.agility, charisma: a.charisma + b.charisma,
  instinct: a.instinct + b.instinct, vitality: a.vitality + b.vitality,
});

/**
 * Simula o crescimento nível a nível replicando fielmente addExp/levelStatBonuses
 * (composição, peso de personalidade, wobble, evolução e marcos). Determinístico,
 * então fica muito próximo da progressão real (assumindo ganho de 1 nível por vez).
 */
function simulateGrowth(
  input: AnalysisInput, currentLevel: number, targetLevel: number, currentStats: MascotStats,
): { finalPokemonId: number; projectedStats: MascotStats } {
  const evolutionLocked = input.evolutionLocked ?? false;
  let pokemonId = input.pokemonId;
  let stats: MascotStats = { ...currentStats };

  // Marcos já conquistados no nível atual — não reaplicar
  const applied = new Set<string>();
  for (const m of getMascotProgressMilestones(pokemonId, currentLevel, false)) applied.add(m.key);

  for (let lvl = currentLevel; lvl < targetLevel; lvl++) {
    // Ganho do nível lvl → lvl+1 (o wobble/peso usam o nível e stats de partida)
    stats = addStats(stats, levelBonus(pokemonId, lvl, input.personality, stats));
    const newLevel = lvl + 1;

    // Evolução ao atingir o nível
    let evolvedThisStep = false;
    if (!evolutionLocked) {
      const evo = EVOLUTION_MAP.get(pokemonId);
      if (evo && newLevel >= evo.level) { pokemonId = evo.toOptions?.[0] ?? evo.to; evolvedThisStep = true; }
    }

    // Marcos de maturidade/evolução no novo nível
    for (const m of getMascotProgressMilestones(pokemonId, newLevel, evolvedThisStep)) {
      if (applied.has(m.key)) continue;
      applied.add(m.key);
      const w: MascotStats = {
        force: stats.force * 3, agility: stats.agility * 3, charisma: stats.charisma * 3,
        instinct: stats.instinct * 3, vitality: stats.vitality * 3,
      };
      stats = addStats(stats, distributeFaithful(m.points, w));
    }
  }

  return { finalPokemonId: pokemonId, projectedStats: stats };
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

  const growthMult = getMascotStatusGrowthMultiplier(finalFormAtLevel(input.pokemonId, targetLevel, evolutionLocked));

  // Projeção de stats até targetLevel — simulação fiel nível a nível
  const sim = simulateGrowth(input, currentLevel, targetLevel, currentStats);
  const finalPokemonId = sim.finalPokemonId;
  const projectedStats = sim.projectedStats;
  const projectedTotal = projectedStats.force + projectedStats.agility + projectedStats.charisma + projectedStats.instinct + projectedStats.vitality;

  // ── IV / potencial futuro ──
  // 1) Qualidade do roll inicial: isola a contribuição do crescimento e compara com a banda base.
  const milestoneNow = milestonePointsUpTo(input.pokemonId, currentLevel);
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

  // ── Dados extras ──
  // Stat dominante e equilíbrio (com base na projeção)
  const projValues = perStat.map(s => ({ label: s.label, value: s.projected }));
  const dominant = projValues.reduce((a, b) => (b.value > a.value ? b : a), projValues[0]);
  const maxV = Math.max(...projValues.map(v => v.value));
  const minV = Math.min(...projValues.map(v => v.value));
  const avgV = projectedTotal / 5;
  const spread = avgV > 0 ? (maxV - minV) / avgV : 0;
  const balanceLabel = spread < 0.22 ? "Equilibrado (stats parelhos)" : `Especializado em ${dominant.label}`;

  // Sugestões de função de combate (papéis-base ligados a cada atributo)
  const roleByStat: { role: string; statLabel: string; value: number }[] = [
    { role: "ATTACKER",    statLabel: "Força",      value: projectedStats.force },
    { role: "FLANK",       statLabel: "Agilidade",  value: projectedStats.agility },
    { role: "DEFENDER",    statLabel: "Vitalidade", value: projectedStats.vitality },
    { role: "OPPORTUNIST", statLabel: "Instinto",   value: projectedStats.instinct },
    { role: "ENCOURAGER",  statLabel: "Carisma",    value: projectedStats.charisma },
  ];
  const roleSuggestions = roleByStat
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(r => ({
      role: r.role,
      label: COMBAT_ROLE_LABELS[r.role as keyof typeof COMBAT_ROLE_LABELS],
      statLabel: r.statLabel,
      value: r.value,
      description: COMBAT_ROLE_DESCRIPTIONS[r.role as keyof typeof COMBAT_ROLE_DESCRIPTIONS],
    }));

  // Poder de combate estimado (aproximação: soma ponderada dos atributos projetados)
  const projectedPower = Math.round(
    projectedStats.force * 1.1 + projectedStats.vitality * 1.0 + projectedStats.agility * 0.95 +
    projectedStats.instinct * 0.95 + projectedStats.charisma * 0.9,
  );

  // Nota de personalidade (afeta o crescimento)
  let personalityNote: string | null = null;
  if (input.personality === "COMPETITIVE") personalityNote = "Personalidade Competitiva: cresce mais rápido e favorece Força.";
  else if (input.personality === "LOYAL") personalityNote = "Personalidade Leal: cresce mais rápido e favorece Carisma.";
  else if (input.personality === "DRAMATIC") personalityNote = "Personalidade Dramática: crescimento levemente menor e Vitalidade reduzida.";

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
    dominantStatLabel: dominant.label,
    balanceLabel,
    personalityNote,
    projectedPower,
    roleSuggestions,
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
