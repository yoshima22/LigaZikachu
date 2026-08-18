// Helpers de combate por personalidade, compartilhados pelos engines
// (league-combat, arena-z, sync-battle). Determinísticos dado o estado — o
// combate roda uma vez no servidor e o resultado fica gravado no replay.

import { PERSONALITY_AFFINITY, DEBUFF_RESISTANCE } from "./personality-design";

export type CombatUnit = {
  id: string;
  force: number; agility: number; instinct: number; vitality: number; charisma: number;
  hp: number;
  personality?: string | null;
};

export function combatStatTotal(m: CombatUnit) {
  return m.force + m.agility + m.instinct + m.vitality + m.charisma;
}

// Multiplicador ofensivo do atacante (depende de HP atual e de estado com memória).
export function personalityOffenseMult(actor: CombatUnit, target: CombatUnit, hp: Map<string, number>, hitTaken: Set<string>) {
  const hpPct = (hp.get(actor.id) ?? 0) / Math.max(1, actor.hp);
  switch (actor.personality) {
    case "PROUD":       return hpPct > 0.70 ? 1.06 : 1;
    case "DRAMATIC":    return hpPct < 0.35 ? 1.10 : 1;
    case "SERENE":      return 0.96;
    case "COMPETITIVE": return (combatStatTotal(target) > combatStatTotal(actor)) ? 1.07 : 1;
    case "CURIOUS":     return combatStatTotal(target) >= combatStatTotal(actor) ? 1.05 : 1;
    case "TIMID":       return hitTaken.has(actor.id) ? 1.05 : 1;
    case "CHAOTIC":     return 0.92 + Math.random() * 0.20;
    case "GLUTTON":     return 0.96;
    default:            return 1;
  }
}

// Multiplicador defensivo do alvo (dano recebido).
export function personalityDefenseMult(target: CombatUnit, hp: Map<string, number>, hitTaken: Set<string>) {
  const hpPct = (hp.get(target.id) ?? 0) / Math.max(1, target.hp);
  if (target.personality === "LAZY" && hpPct > 0.50) return 0.92;
  if (target.personality === "TIMID" && !hitTaken.has(target.id)) return 0.90;
  return 1;
}

// Resistência de buff/debuff: força pelo Instinto da fonte vs 60% Instinto + 40%
// Vitalidade do alvo; efeito entre 60% e 135%. Guloso reduz a intensidade recebida.
export function debuffResistanceFactor(source: CombatUnit, target: CombatUnit) {
  const power = Math.max(1, source.instinct);
  const resist = target.instinct * DEBUFF_RESISTANCE.targetInstinctWeight + target.vitality * DEBUFF_RESISTANCE.targetVitalityWeight;
  const ratio = power / (power + Math.max(1, resist));
  const factor = DEBUFF_RESISTANCE.minEffect + (DEBUFF_RESISTANCE.maxEffect - DEBUFF_RESISTANCE.minEffect) * ratio;
  const clamped = Math.max(DEBUFF_RESISTANCE.minEffect, Math.min(DEBUFF_RESISTANCE.maxEffect, factor));
  return clamped * (target.personality === "GLUTTON" ? 0.6 : 1);
}

// Brincalhão: ao entrar, 12% (por Brincalhão no time) de +5% de agilidade ao time
// nos 2 primeiros rounds. Retorna se o buff foi ativado para a equipe.
export function rollPlayfulTeamBuff(team: CombatUnit[]) {
  return team.filter((m) => m.personality === "PLAYFUL").some(() => Math.random() < 0.12);
}

// Multiplicador de agilidade efetiva por personalidade (para ações extras).
export function personalityAgilityMult(actor: CombatUnit, round: number, playfulBuffActive: boolean) {
  let mult = 1;
  if (actor.personality === "ELECTRIC") mult *= round === 1 ? 1.12 : 1.05;
  if (round <= 2 && playfulBuffActive) mult *= 1.05;
  return mult;
}

// Debuff do Travesso: no 1º ataque contra cada inimigo, 15% de reduzir o atributo
// mais útil do alvo em 8% (× resistência). Retorna o stat e a intensidade, ou null.
export function rollTravessoDebuff(actor: CombatUnit, target: CombatUnit) {
  if (actor.personality !== "MISCHIEVOUS") return null;
  if (Math.random() >= 0.15) return null;
  const debuffable = ["force", "agility", "instinct", "vitality"] as const;
  const aff = PERSONALITY_AFFINITY[target.personality ?? ""]?.veryUseful;
  const stat = (aff && (debuffable as readonly string[]).includes(aff))
    ? aff as typeof debuffable[number]
    : debuffable.reduce((best, s) => (target[s] > target[best] ? s : best), "force");
  return { stat, amount: 0.08 * debuffResistanceFactor(actor, target) };
}
