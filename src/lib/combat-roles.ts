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
  DEFENDER: "Atrai ataques e reduz parte do dano com Vitalidade. Protege o time absorvendo pressão.",
  ATTACKER: "Transforma Força em dano bruto, especialmente contra defensores. Pressiona alvos importantes.",
  FLANK: "Usa Agilidade para passar pela defesa e atingir alvos vulneráveis. Ótimo contra suportes.",
  OPPORTUNIST: "Usa Instinto para explorar brechas e aplicar enfraquecimentos nos stats do alvo.",
  ENCOURAGER: "Usa Carisma para fortalecer aliados com buffs temporários enquanto continua lutando.",
  GUARDIAN: "Protege um aliado específico, reduz dano recebido pelo protegido e pode tomar parte do dano no lugar dele. Ideal para proteger Encorajadores, Oportunistas ou Cuidadores.",
  DUELIST: "Marca um alvo e insiste nele, ganhando bônus em confrontos diretos. Bônus extra contra mascotes com relação de Rival ou Nemesis.",
  SABOTEUR: "Atrapalha buffs, ordem de ação e ritmo do combate inimigo. Diferente do Oportunista que reduz stats, o Sabotador interfere em efeitos temporários.",
  HEALER: "Recupera pouca vida e remove penalidades leves dos aliados, mantendo o time estável sem tornar a luta infinita.",
  SCOUT: "Reconhece fraquezas e ajuda o time a escolher alvo. Melhora precisão e chance de crítico. Combina com Flancos e Atacantes.",
  PROVOKER: "Manipula alvos, força decisões ruins e cria caos. Pode gerar sinergia com o sistema de Laços e rivalidades.",
  SPECIALIST: "Usa o melhor atributo do mascote e ganha bônus contextual. Flexível para mascotes com um stat dominante ou stats bem distribuídos.",
  SURVIVOR: "Fica mais resistente conforme a luta piora. Pode evitar ser finalizado uma vez. Opção para mascotes com boa Vitalidade e Instinto.",
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
