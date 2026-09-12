// Dificuldade do World Mode: os treinadores são pareados ao nível/força da
// equipe do jogador e ficam mais duros que os bots da Arena. Módulo puro,
// reutilizado no combate (servidor) e no preview (página).

export type TrainerTier = "TRAINER" | "VETERAN" | "LEADER";

export type PlayerBattleRef = {
  avgLevel: number;
  avgStatTotal: number; // média da soma dos 5 status da equipe do jogador
};

type TierParams = {
  levelBump: number; // níveis acima do jogador
  strength: number; // força-alvo do bot vs a média do jogador
  handicap: number; // multiplicador nos status ofensivos do jogador (líder)
  label: string;
};

// Bots claramente mais desafiadores que a Arena; líderes são o topo e ainda
// aplicam uma leve pressão (debuff) sobre o jogador.
export const TIER_PARAMS: Record<TrainerTier, TierParams> = {
  TRAINER: { levelBump: 1, strength: 1.18, handicap: 1.0, label: "Difícil" },
  VETERAN: { levelBump: 2, strength: 1.35, handicap: 1.0, label: "Muito difícil" },
  LEADER: { levelBump: 3, strength: 1.6, handicap: 0.9, label: "Líder · Extremo" },
};

export type TrainerTeamEntry = {
  pokemonId: number;
  level: number;
  role: string;
  stats: { force: number; agility: number; charisma: number; instinct: number; vitality: number };
};

function statSum(stats: TrainerTeamEntry["stats"]) {
  return stats.force + stats.agility + stats.charisma + stats.instinct + stats.vitality;
}

/** Escala uma equipe de treinador ao nível/força do jogador, preservando a
 * distribuição de status configurada (identidade dos NPCs). */
export function scaleTrainerTeam(
  team: TrainerTeamEntry[],
  tier: TrainerTier,
  ref: PlayerBattleRef,
): TrainerTeamEntry[] {
  const params = TIER_PARAMS[tier];
  const targetLevel = Math.round(ref.avgLevel) + params.levelBump;
  const targetTotal = Math.round(ref.avgStatTotal * params.strength);
  return team.map((entry) => {
    const sum = Math.max(1, statSum(entry.stats));
    // Nunca enfraquece a base configurada; só reforça quando o jogador é forte.
    const factor = Math.max(1, targetTotal / sum);
    const scale = (value: number) =>
      Math.max(1, Math.min(250, Math.round(value * factor)));
    return {
      pokemonId: entry.pokemonId,
      role: entry.role,
      level: Math.max(entry.level, targetLevel),
      stats: {
        force: scale(entry.stats.force),
        agility: scale(entry.stats.agility),
        charisma: scale(entry.stats.charisma),
        instinct: scale(entry.stats.instinct),
        vitality: scale(entry.stats.vitality),
      },
    };
  });
}

// Perfil do Pokémon selvagem escalado ao jogador. Raridades mais altas são
// mais fortes (e valem mais no combate de captura).
const WILD_RARITY: Record<string, { levelBump: number; strength: number; role: string; base: number }> = {
  COMMON: { levelBump: 0, strength: 0.8, role: "ATTACKER", base: 55 },
  UNCOMMON: { levelBump: 1, strength: 0.92, role: "FLANK", base: 60 },
  RARE: { levelBump: 2, strength: 1.05, role: "DUELIST", base: 68 },
  VERY_RARE: { levelBump: 3, strength: 1.2, role: "OPPORTUNIST", base: 75 },
  SPECIAL: { levelBump: 4, strength: 1.4, role: "SURVIVOR", base: 85 },
};

export type WildStats = {
  force: number;
  agility: number;
  charisma: number;
  instinct: number;
  vitality: number;
};

/** Gera nível, postura e status de um selvagem escalados ao jogador. O HP máximo
 * deve ser calculado com worldMaxHp(level, stats.vitality). */
export function scaleWildProfile(
  rarity: string,
  ref: PlayerBattleRef,
): { level: number; role: string; stats: WildStats } {
  const params = WILD_RARITY[rarity] ?? WILD_RARITY.COMMON;
  const level = Math.max(2, Math.round(ref.avgLevel) + params.levelBump);
  const total = Math.max(params.base, Math.round(ref.avgStatTotal * params.strength));
  // Distribuição levemente ofensiva; vitalidade sustenta o HP para dar tempo de
  // enfraquecer antes da captura.
  const weights = { force: 0.24, agility: 0.22, charisma: 0.12, instinct: 0.2, vitality: 0.22 };
  const stat = (w: number) => Math.max(1, Math.min(250, Math.round(total * w)));
  return {
    level,
    role: params.role,
    stats: {
      force: stat(weights.force),
      agility: stat(weights.agility),
      charisma: stat(weights.charisma),
      instinct: stat(weights.instinct),
      vitality: stat(weights.vitality),
    },
  };
}

/** Handicap ofensivo aplicado ao jogador (líderes reduzem levemente força,
 * agilidade, instinto e carisma — não mexe na vitalidade para manter o HP
 * persistente consistente). */
export function playerLeaderHandicap(tier: TrainerTier) {
  return TIER_PARAMS[tier].handicap;
}
