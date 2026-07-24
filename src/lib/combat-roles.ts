export const COMBAT_ROLE_VALUES = [
  "DEFENDER",
  "ATTACKER",
  "FLANK",
  "OPPORTUNIST",
  "ENCOURAGER",
  "GUARDIAN",
  "DUELIST",
  "SABOTEUR",
  "HEALER",
  "SCOUT",
  "PROVOKER",
  "SPECIALIST",
  "SURVIVOR",
] as const;

export type CombatRole = typeof COMBAT_ROLE_VALUES[number];

export const COMBAT_ROLE_LABELS: Record<CombatRole, string> = {
  DEFENDER: "Defensor",
  ATTACKER: "Atacante",
  FLANK: "Flanco",
  OPPORTUNIST: "Oportunista",
  ENCOURAGER: "Encorajador",
  GUARDIAN: "Guardião",
  DUELIST: "Duelista",
  SABOTEUR: "Sabotador",
  HEALER: "Cuidador",
  SCOUT: "Batedor",
  PROVOKER: "Provocador",
  SPECIALIST: "Especialista",
  SURVIVOR: "Sobrevivente",
};

export const COMBAT_ROLE_DESCRIPTIONS: Record<CombatRole, string> = {
  DEFENDER: "Atributo direto: Vitalidade. Atrai 62% a 78% dos ataques e reduz entre 8% e 35% do dano recebido, conforme a Vitalidade.",
  ATTACKER: "Atributo direto: Força. Recebe de +8% a +26% de dano conforme a Força e mais +15% contra Defensores.",
  FLANK: "Atributo direto: Agilidade. Ganha de +4% a +18% de dano, tem 35% a 82% de chance de furar a defesa e causa +12% contra suportes.",
  OPPORTUNIST: "Atributo direto: Instinto. Tem 22% a 62% de chance de reduzir um atributo inimigo em 8% a 25%; causa +10% se superar o Instinto do alvo.",
  ENCOURAGER: "Atributo direto: Carisma. Enquanto estiver ativo, concede de +4% a +18% de dano para toda a equipe. Sabotadores inimigos reduzem esse bônus.",
  GUARDIAN: "Atributos diretos: Vitalidade e Carisma. Intercepta de 15% a 40% do dano de um aliado e recebe de 5% a 20% menos dano; causa 10% menos dano.",
  DUELIST: "Atributos diretos: Força e Instinto. Marca um alvo, recebe de +6% a +18% de dano base e +12% enquanto mantém o mesmo duelo.",
  SABOTEUR: "Atributos diretos: Instinto e Agilidade. Prioriza suportes e reduz em 15% a 40% os bônus dos Encorajadores inimigos enquanto estiver ativo.",
  HEALER: "Atributos diretos: Carisma, Vitalidade e nível. Cura individualmente o aliado vivo ferido de menor HP em (35% do Carisma + 25% da Vitalidade + nível) × 2,5. O número de curas também escala com os atributos.",
  SCOUT: "Atributos diretos: Agilidade e Instinto. Concede até +8% de dano à equipe, tem 35% a 82% de chance de focar o alvo mais frágil e causa 5% menos dano.",
  PROVOKER: "Atributos diretos: Carisma e Instinto. Tem 20% a 55% de chance de redirecionar ataques para si e reduz o dano desviado em 8%; causa 8% menos dano.",
  SPECIALIST: "Atributo direto: o maior entre Força, Agilidade, Instinto, Vitalidade e Carisma. Recebe de +6% a +20% de dano.",
  SURVIVOR: "Atributos diretos: Vitalidade e Instinto. Reduz até 15% do dano; abaixo de 30% de HP ganha +15% de dano e mais 25% de redução, além de sobreviver uma vez com 1 HP.",
};

export const COMBAT_ROLE_OPTIONS = COMBAT_ROLE_VALUES.map((value) => ({
  value,
  label: COMBAT_ROLE_LABELS[value],
  description: COMBAT_ROLE_DESCRIPTIONS[value],
}));

export function normalizeCombatRole(value: unknown): CombatRole {
  return COMBAT_ROLE_VALUES.includes(value as CombatRole) ? (value as CombatRole) : "ATTACKER";
}

export function getCombatRoleLabel(value: unknown): string {
  return COMBAT_ROLE_LABELS[normalizeCombatRole(value)];
}

export const AGILITY_EXTRA_ACTION_GAP = 60;
export const AGILITY_THIRD_ACTION_GAP = 140;

/**
 * Regra geral de ações por rodada:
 * 1 ação normalmente; +1 com 60 de Agilidade acima da média adversária;
 * +1 adicional com 140 de diferença. Máximo de 3 ações.
 */
export function getCombatActionsPerRound(agility: number, opponentAgilities: number[]) {
  const opponentAverage = opponentAgilities.length > 0
    ? opponentAgilities.reduce((sum, value) => sum + value, 0) / opponentAgilities.length
    : agility;
  const gap = agility - opponentAverage;
  const actions = gap >= AGILITY_THIRD_ACTION_GAP ? 3 : gap >= AGILITY_EXTRA_ACTION_GAP ? 2 : 1;
  return { actions, opponentAverage, gap };
}

export const HEALER_POWER_MULTIPLIER = 2.5;

/** Cura individual do Cuidador, escalando com Carisma, Vitalidade e nível. */
export function getHealerHealAmount(stats: {
  charisma: number;
  vitality: number;
  level: number;
}) {
  const base = stats.charisma * 0.35 + stats.vitality * 0.25 + stats.level;
  return Math.max(15, Math.round(base * HEALER_POWER_MULTIPLIER));
}

export function recommendCombatRole(stats: {
  statForce?: number | null;
  statAgility?: number | null;
  statVitality?: number | null;
  statInstinct?: number | null;
  statCharisma?: number | null;
}): CombatRole {
  const f = stats.statForce ?? 0;
  const a = stats.statAgility ?? 0;
  const v = stats.statVitality ?? 0;
  const i = stats.statInstinct ?? 0;
  const c = stats.statCharisma ?? 0;

  const candidates: Array<{ role: CombatRole; value: number }> = [
    { role: "ATTACKER", value: f },
    { role: "FLANK", value: a },
    { role: "DEFENDER", value: v },
    { role: "OPPORTUNIST", value: i },
    { role: "ENCOURAGER", value: c },
    { role: "GUARDIAN", value: v * 0.6 + c * 0.4 },
    { role: "DUELIST", value: f * 0.6 + i * 0.4 },
    { role: "SABOTEUR", value: i * 0.55 + a * 0.45 },
    { role: "HEALER", value: c * 0.6 + v * 0.4 },
    { role: "SCOUT", value: a * 0.5 + i * 0.5 },
    { role: "PROVOKER", value: c * 0.55 + i * 0.45 },
    { role: "SPECIALIST", value: Math.max(f, a, v, i, c) },
    { role: "SURVIVOR", value: v * 0.6 + i * 0.4 },
  ];
  candidates.sort((a, b) => b.value - a.value);
  return candidates[0]?.value > 0 ? candidates[0].role : "ATTACKER";
}
