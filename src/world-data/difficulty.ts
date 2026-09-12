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

/** Handicap ofensivo aplicado ao jogador (líderes reduzem levemente força,
 * agilidade, instinto e carisma — não mexe na vitalidade para manter o HP
 * persistente consistente). */
export function playerLeaderHandicap(tier: TrainerTier) {
  return TIER_PARAMS[tier].handicap;
}
