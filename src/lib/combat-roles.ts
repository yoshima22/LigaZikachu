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

export const OPPORTUNIST_INSTINCT_CAP = 250;
export const COMBAT_ROLE_STAT_CAP = 250;

/** Curva única das posturas: o mínimo existe com atributo 0 e o teto só é
 * alcançado no cap publicado. Valores acima do cap não ampliam o efeito. */
export function scaleCombatRoleEffect(stat: number, minimum: number, maximum: number, cap = COMBAT_ROLE_STAT_CAP) {
  const ratio = Math.min(1, Math.max(0, stat) / cap);
  return minimum + (maximum - minimum) * ratio;
}

export function getDefenderReduction(vitality: number) { return scaleCombatRoleEffect(vitality, 0.08, 0.35); }
export function getAttackerDamageBonus(force: number) { return scaleCombatRoleEffect(force, 0.08, 0.26); }
export function getFlankDamageBonus(agility: number) { return scaleCombatRoleEffect(agility, 0.04, 0.18); }
export function getFlankBypassChance(agility: number) { return scaleCombatRoleEffect(agility, 0.35, 0.82); }
export function getEncouragerBonus(charisma: number) { return scaleCombatRoleEffect(charisma, 0.04, 0.18); }
export function getGuardianIntercept(vitality: number, charisma: number) { return scaleCombatRoleEffect((vitality + charisma) / 2, 0.15, 0.40); }
export function getGuardianReduction(vitality: number) { return scaleCombatRoleEffect(vitality, 0.05, 0.20); }
export function getDuelistDamageBonus(force: number, instinct: number) { return scaleCombatRoleEffect((force + instinct) / 2, 0.06, 0.18); }
export function getSaboteurSuppression(instinct: number, agility: number) { return scaleCombatRoleEffect((instinct + agility) / 2, 0.15, 0.40); }
export function getSaboteurProcChance(instinct: number, agility: number) { return scaleCombatRoleEffect((instinct + agility) / 2, 0.18, 0.55); }
export function getScoutBonus(agility: number, instinct: number) { return scaleCombatRoleEffect((agility + instinct) / 2, 0, 0.08); }
export function getProvokerChance(charisma: number, instinct: number) { return scaleCombatRoleEffect((charisma + instinct) / 2, 0.20, 0.55); }
export function getSpecialistDamageBonus(bestStat: number) { return scaleCombatRoleEffect(bestStat, 0.06, 0.20); }
export function getSurvivorReduction(vitality: number) { return scaleCombatRoleEffect(vitality, 0, 0.15); }

/** Escala linearmente entre os valores publicados no manual até 250 de Instinto. */
export function getOpportunistProfile(instinct: number) {
  return {
    procChance: scaleCombatRoleEffect(instinct, 0.22, 0.62, OPPORTUNIST_INSTINCT_CAP),
    debuffPct: scaleCombatRoleEffect(instinct, 0.08, 0.25, OPPORTUNIST_INSTINCT_CAP),
  };
}

// Posturas consideradas "suporte" em todo o jogo: Provocador, Encorajador e
// Cuidador. Usadas, por exemplo, nas reduções do Sabotador.
export const SUPPORT_ROLES: CombatRole[] = ["PROVOKER", "ENCOURAGER", "HEALER"];
export function isSupportRole(role: string): boolean {
  return (SUPPORT_ROLES as string[]).includes(role);
}

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
  DEFENDER: "Atributo direto: Vitalidade. Até 250, escala de 8% a 35% de redução de dano. Atrai 78% dos ataques, ou 62% quando o agressor é Atacante.",
  ATTACKER: "Atributo direto: Força. Até 250, escala de +8% a +26% de dano e recebe mais +15% contra Defensores.",
  FLANK: "Atributo direto: Agilidade. Até 250, escala de +4% a +18% de dano e de 35% a 82% de chance de furar a defesa; causa +12% contra suportes.",
  OPPORTUNIST: "Atributo direto: Instinto. Até 250, escala de 22% a 62% de chance e de 8% a 25% de redução. Instinto/Vitalidade do alvo reduzem a intensidade; causa +10% se superar o Instinto inimigo.",
  ENCOURAGER: "Atributo direto: Carisma. Até 250, concede de +4% a +18% de dano à equipe enquanto estiver ativo. Vale apenas o melhor Encorajador; Sabotadores reduzem o bônus.",
  GUARDIAN: "Atributos diretos: Vitalidade e Carisma. Pela média dos dois até 250, intercepta de 15% a 40% do dano; Vitalidade dá de 5% a 20% de redução pessoal. Causa 10% menos dano.",
  DUELIST: "Atributos diretos: Força e Instinto. Marca um alvo, recebe de +6% a +18% de dano base e +12% enquanto mantém o mesmo duelo.",
  SABOTEUR: "Atributos diretos: Instinto e Agilidade. Pela média dos dois até 250, reduz de 15% a 40% a eficácia do suporte inimigo e escala sua chance de interferência de 18% a 55%.",
  HEALER: "Atributos diretos: Carisma, Vitalidade e nível. Cura individualmente o aliado vivo ferido de menor HP em (35% do Carisma + 25% da Vitalidade + nível) × 2,5. O número de curas também escala com os atributos.",
  SCOUT: "Atributos diretos: Agilidade e Instinto. Pela média dos dois até 250, concede até +8% de dano à equipe; a Agilidade dá de 35% a 82% de chance de focar o alvo frágil. Causa 5% menos dano.",
  PROVOKER: "Atributos diretos: Carisma e Instinto. Pela média dos dois até 250, escala de 20% a 55% de chance de redirecionar ataques, reduzindo o golpe em 8%. Causa 8% menos dano.",
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

  // Posturas básicas usam um único atributo. As avançadas (dual-stat) recebem
  // peso primário 0.7 + secundário 0.6, de modo que superam a básica quando o
  // segundo atributo relevante é forte (acima de ~metade do principal). Assim a
  // recomendação também aproveita posturas avançadas em mascotes bem distribuídos,
  // sem deixar de recomendar a básica quando um único atributo domina.
  const dual = (primary: number, secondary: number) => primary * 0.7 + secondary * 0.6;
  const candidates: Array<{ role: CombatRole; value: number }> = [
    // Básicas — atributo único.
    { role: "ATTACKER", value: f },
    { role: "FLANK", value: a },
    { role: "DEFENDER", value: v },
    { role: "OPPORTUNIST", value: i },
    { role: "ENCOURAGER", value: c },
    // Avançadas — dois atributos complementares (primário, secundário).
    { role: "GUARDIAN", value: dual(v, c) },
    { role: "DUELIST", value: dual(f, i) },
    { role: "SABOTEUR", value: dual(i, a) },
    { role: "HEALER", value: dual(c, v) },
    { role: "SCOUT", value: dual(a, i) },
    { role: "PROVOKER", value: dual(c, i) },
    { role: "SURVIVOR", value: dual(v, i) },
    // Especialista — para quem tem um único atributo muito dominante.
    { role: "SPECIALIST", value: Math.max(f, a, v, i, c) },
  ];
  candidates.sort((a, b) => b.value - a.value);
  return candidates[0]?.value > 0 ? candidates[0].role : "ATTACKER";
}

/**
 * Postura padrão ao equipar um mascote numa equipe (Liga Semanal, Arena Z,
 * Desafio Sincronizado e futuros). Usa a postura preferida salva pelo jogador
 * (`preferredCombatRole`); se não houver, cai na recomendada pelo maior status.
 * Se a query não trouxer `preferredCombatRole`, comporta-se como antes.
 */
export function defaultCombatRoleFor(mascot: {
  preferredCombatRole?: string | null;
  statForce?: number | null;
  statAgility?: number | null;
  statVitality?: number | null;
  statInstinct?: number | null;
  statCharisma?: number | null;
}): CombatRole {
  const preferred = mascot.preferredCombatRole;
  if (preferred && COMBAT_ROLE_VALUES.includes(preferred as CombatRole)) return preferred as CombatRole;
  return recommendCombatRole(mascot);
}
