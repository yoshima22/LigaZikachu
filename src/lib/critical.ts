// Acerto crítico: mecânica padrão de TODOS os motores de combate.
// Dano +15% (menor que 1 passo de vantagem de tipo, que é ±20%). A chance vem de Instinto + Carisma
// e é baixa de propósito: (Instinto + Carisma) ÷ 40 (%), +30% sobre isso, teto natural de 15,6%.
// Habilidades somam pontos percentuais por cima, com teto total de 20%.
export const CRIT_DAMAGE_BONUS = 0.15;
const CRIT_CHANCE_SCALE = 1.3; // +30% sobre a fórmula base
export const CRIT_NATURAL_CAP = (12 / 100) * CRIT_CHANCE_SCALE; // 15,6%
export const CRIT_TOTAL_CAP = 0.2;

export function criticalChance(instinct: number, charisma: number, abilityBonus = 0): number {
  const natural = Math.min(CRIT_NATURAL_CAP, ((Math.max(0, instinct) + Math.max(0, charisma)) / 40 / 100) * CRIT_CHANCE_SCALE);
  return Math.min(CRIT_TOTAL_CAP, natural + Math.max(0, abilityBonus));
}

/** `random` deve ser o gerador do próprio motor (para manter replays/seeds idênticos). */
export function rollCritical(instinct: number, charisma: number, random: () => number, abilityBonus = 0) {
  const chance = criticalChance(instinct, charisma, abilityBonus);
  return { chance, hit: random() < chance };
}

export const criticalNote = (actorName: string, chance: number) =>
  `💥 Crítico! ${actorName} acertou um ponto fraco: +${Math.round(CRIT_DAMAGE_BONUS * 100)}% de dano (chance de ${(Math.round(chance * 1000) / 10).toString().replace(".", ",")}%).`;
