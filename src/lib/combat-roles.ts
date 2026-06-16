export const COMBAT_ROLE_VALUES = [
  "DEFENDER",
  "ATTACKER",
  "FLANK",
  "OPPORTUNIST",
  "ENCOURAGER",
] as const;

export type CombatRole = typeof COMBAT_ROLE_VALUES[number];

export const COMBAT_ROLE_LABELS: Record<CombatRole, string> = {
  DEFENDER: "Defensor",
  ATTACKER: "Atacante",
  FLANK: "Flanco",
  OPPORTUNIST: "Oportunista",
  ENCOURAGER: "Encorajador",
};

export const COMBAT_ROLE_DESCRIPTIONS: Record<CombatRole, string> = {
  DEFENDER: "Atrai ataques e reduz parte do dano com Vitalidade.",
  ATTACKER: "Transforma Forca em dano bruto, especialmente contra defensores.",
  FLANK: "Usa Agilidade para buscar alvos vulneraveis e esquivar melhor.",
  OPPORTUNIST: "Usa Instinto para explorar brechas e aplicar enfraquecimentos.",
  ENCOURAGER: "Usa Carisma para melhorar a equipe enquanto continua lutando.",
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

export function recommendCombatRole(stats: {
  statForce?: number | null;
  statAgility?: number | null;
  statVitality?: number | null;
  statInstinct?: number | null;
  statCharisma?: number | null;
}): CombatRole {
  const candidates: Array<{ role: CombatRole; value: number }> = [
    { role: "ATTACKER", value: stats.statForce ?? 0 },
    { role: "FLANK", value: stats.statAgility ?? 0 },
    { role: "DEFENDER", value: stats.statVitality ?? 0 },
    { role: "OPPORTUNIST", value: stats.statInstinct ?? 0 },
    { role: "ENCOURAGER", value: stats.statCharisma ?? 0 },
  ];
  candidates.sort((a, b) => b.value - a.value);
  return candidates[0]?.value > 0 ? candidates[0].role : "ATTACKER";
}

