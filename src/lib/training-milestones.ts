export const TRAINING_STANCE_KEYS = [
  "EXECUTOR", "COMMANDER", "PURIFIER", "BLOODTHIRSTY", "ARTILLERY",
  "RETRIBUTOR", "CORROSIVE", "STRATEGIST", "UNSHAKABLE", "FORTRESS",
  "ACCUMULATOR", "EXPLOSIVE", "TRAPPER",
] as const;

export type TrainingStanceKey = typeof TRAINING_STANCE_KEYS[number];
export type TrainingPersonality = "LOYAL" | "PROUD" | "MISCHIEVOUS" | "LAZY" | "COMPETITIVE" | "DRAMATIC" | "PLAYFUL" | "ELECTRIC" | "TIMID" | "CHAOTIC" | "CURIOUS" | "GLUTTON" | "SERENE";
export type TrainingObjectiveType =
  | "ARENA_Z" | "LEAGUE" | "EXPEDITIONS" | "DIRECT_ATTACKS" | "DAMAGE" | "KOS"
  | "MULTI_KO_BATTLE" | "TYPE_KOS" | "ROLE_KOS" | "LAST_SURVIVOR" | "SURVIVE_DEBUFF"
  | "BUFFS" | "HEALS" | "PROTECT_DANGER" | "DEBUFFS" | "SUPER_EFFECTIVE" | "ULTRA_EFFECTIVE"
  | "RESISTED_HITS" | "HEAVILY_RESISTED_HITS" | "ARMOR_PENETRATION" | "LOWEST_HP_ATTACK"
  | "FOCUS_CHAIN" | "ROUND_SURVIVAL" | "PRESSURE_UNDER_RISK" | "THIRD_ATTACK" | "TURN_THREE_HOLD"
  | "TURN_FIVE_HOLD" | "AFFINITY" | "SELF_HEAL_AFTER_LOW_HP";

export type TrainingObjective = {
  id: string;
  type: TrainingObjectiveType;
  label: string;
  target: number;
  progress: number;
  perBattleCap: number;
};

export type TrainingJourney = {
  stance: TrainingStanceKey;
  personality: TrainingPersonality;
  itemName: string;
  objectives: TrainingObjective[];
};

type StanceDefinition = {
  label: string;
  role: "attacker" | "defender" | "support";
  focus: [string, string];
  effect: string;
  preferredObjectives: TrainingObjectiveType[];
};

export const TRAINING_STANCES: Record<TrainingStanceKey, StanceDefinition> = {
  EXECUTOR: { label: "Executor", role: "attacker", focus: ["Força", "Agilidade"], effect: "Uma vez por round, executa inimigo abaixo de 5–20% do HP máximo; a média de Força e Agilidade define o limiar e efeitos de sobrevivência ainda são verificados.", preferredObjectives: ["KOS", "DAMAGE", "PRESSURE_UNDER_RISK"] },
  COMMANDER: { label: "Comandante", role: "attacker", focus: ["Força", "Carisma"], effect: "No primeiro K.O. da batalha, cada aliado vivo mira o mesmo inimigo em sua próxima ação normal. Não concede ação extra nem muda a ordem de Agilidade.", preferredObjectives: ["KOS", "FOCUS_CHAIN", "DIRECT_ATTACKS"] },
  PURIFIER: { label: "Purificador", role: "support", focus: ["Agilidade", "Carisma"], effect: "Remove reduções elegíveis e converte a purificação em Agilidade própria.", preferredObjectives: ["PROTECT_DANGER", "HEALS", "SURVIVE_DEBUFF"] },
  BLOODTHIRSTY: { label: "Sanguinário", role: "attacker", focus: ["Força", "Vitalidade"], effect: "Ataques diretos curam 5–20% do dano efetivo; a média de Força e Vitalidade define o valor, limitado a 8% do HP máximo por round.", preferredObjectives: ["DAMAGE", "PRESSURE_UNDER_RISK", "KOS"] },
  ARTILLERY: { label: "Artilheiro", role: "attacker", focus: ["Força", "Agilidade"], effect: "O primeiro ataque direto do round causa 15–25% do dano final em outro inimigo vivo de menor HP; a média de Força e Agilidade define a parcela.", preferredObjectives: ["LOWEST_HP_ATTACK", "SUPER_EFFECTIVE", "DAMAGE"] },
  RETRIBUTOR: { label: "Revidador", role: "defender", focus: ["Vitalidade", "Força"], effect: "Após sobreviver a dano alto, devolve um ataque ao primeiro agressor.", preferredObjectives: ["RESISTED_HITS", "ROUND_SURVIVAL", "DAMAGE"] },
  CORROSIVE: { label: "Corrosivo", role: "attacker", focus: ["Força", "Instinto"], effect: "Ataques diretos aplicam Ferida, sujeita à resistência; ela reduz cura efetiva em 30–60% até o fim do próximo round, pela média de Força e Instinto.", preferredObjectives: ["DEBUFFS", "DAMAGE", "SUPER_EFFECTIVE"] },
  STRATEGIST: { label: "Estrategista", role: "support", focus: ["Instinto", "Agilidade"], effect: "Marca o primeiro alvo do round e recompensa o primeiro aliado diferente que o acerta.", preferredObjectives: ["FOCUS_CHAIN", "LOWEST_HP_ATTACK", "BUFFS"] },
  UNSHAKABLE: { label: "Inabalável", role: "defender", focus: ["Vitalidade", "Instinto"], effect: "Cada ataque próprio renova um escudo de 5% da vida máxima.", preferredObjectives: ["ROUND_SURVIVAL", "RESISTED_HITS", "DIRECT_ATTACKS"] },
  FORTRESS: { label: "Fortaleza", role: "defender", focus: ["Vitalidade", "Instinto"], effect: "Ao sofrer golpe, ganha Vitalidade e Instinto e perde a mesma proporção de Força, até 20%.", preferredObjectives: ["HEAVILY_RESISTED_HITS", "ROUND_SURVIVAL", "LAST_SURVIVOR"] },
  ACCUMULATOR: { label: "Acumulador", role: "attacker", focus: ["Força", "Agilidade"], effect: "Ao agir e sobreviver no round, ganha carga; com 3, o próximo ataque direto recebe 15–35% e consome tudo. A média de Força e Agilidade define o bônus.", preferredObjectives: ["ROUND_SURVIVAL", "DIRECT_ATTACKS", "DAMAGE"] },
  EXPLOSIVE: { label: "Explosivo", role: "attacker", focus: ["Agilidade", "Vitalidade"], effect: "No terceiro ataque, atinge o inimigo mais ágil, soma vida restante ao dano e se sacrifica.", preferredObjectives: ["THIRD_ATTACK", "DAMAGE", "ULTRA_EFFECTIVE"] },
  TRAPPER: { label: "Armadilheiro", role: "support", focus: ["Instinto", "Agilidade"], effect: "Nos rounds 3 e 5 bloqueia ativações bônus de posturas inimigas.", preferredObjectives: ["TURN_THREE_HOLD", "TURN_FIVE_HOLD", "SURVIVE_DEBUFF"] },
};

const OBJECTIVES: Record<Exclude<TrainingObjectiveType, "AFFINITY" | "SELF_HEAL_AFTER_LOW_HP">, Omit<TrainingObjective, "id" | "progress">> = {
  ARENA_Z: { type: "ARENA_Z", label: "Conclua 6 batalhas válidas da Arena-Z.", target: 6, perBattleCap: 1 },
  LEAGUE: { type: "LEAGUE", label: "Participe de 12 combates resolvidos de Liga Semanal ou Liga Rush.", target: 12, perBattleCap: 1 },
  EXPEDITIONS: { type: "EXPEDITIONS", label: "Conclua 24 expedições, sendo ao menos 6 de cada tipo.", target: 24, perBattleCap: 1 },
  DIRECT_ATTACKS: { type: "DIRECT_ATTACKS", label: "Realize 60 ataques diretos compatíveis com a postura.", target: 60, perBattleCap: 4 },
  DAMAGE: { type: "DAMAGE", label: "Cause dano efetivo equivalente a 80 vezes sua vida máxima inicial.", target: 80, perBattleCap: 8 },
  KOS: { type: "KOS", label: "Aplique 20 K.O.s.", target: 20, perBattleCap: 2 },
  MULTI_KO_BATTLE: { type: "MULTI_KO_BATTLE", label: "Em 10 combates, sua equipe deve aplicar dois ou mais K.O.s.", target: 10, perBattleCap: 1 },
  TYPE_KOS: { type: "TYPE_KOS", label: "Derrote 16 Pokémon de tipo indicado com sua equipe.", target: 16, perBattleCap: 2 },
  ROLE_KOS: { type: "ROLE_KOS", label: "Derrote 14 inimigos com postura pública indicada.", target: 14, perBattleCap: 2 },
  LAST_SURVIVOR: { type: "LAST_SURVIVOR", label: "Seja o último mascote vivo e sobreviva até o próximo round em 12 combates de Liga.", target: 12, perBattleCap: 1 },
  SURVIVE_DEBUFF: { type: "SURVIVE_DEBUFF", label: "Sobreviva por dois rounds após receber debuff em 15 combates.", target: 15, perBattleCap: 1 },
  BUFFS: { type: "BUFFS", label: "Aplique 40 buffs efetivos em aliados.", target: 40, perBattleCap: 3 },
  HEALS: { type: "HEALS", label: "Aplique 35 curas efetivas de ao menos 5% da vida máxima do alvo.", target: 35, perBattleCap: 3 },
  PROTECT_DANGER: { type: "PROTECT_DANGER", label: "Proteja 30 aliados abaixo de 50% de HP.", target: 30, perBattleCap: 2 },
  DEBUFFS: { type: "DEBUFFS", label: "Aplique 30 debuffs aceitos pela resistência dos alvos.", target: 30, perBattleCap: 3 },
  SUPER_EFFECTIVE: { type: "SUPER_EFFECTIVE", label: "Realize 50 ataques super-efetivos.", target: 50, perBattleCap: 4 },
  ULTRA_EFFECTIVE: { type: "ULTRA_EFFECTIVE", label: "Realize 25 ataques ultraefetivos.", target: 25, perBattleCap: 2 },
  RESISTED_HITS: { type: "RESISTED_HITS", label: "Receba 40 ataques resistentes.", target: 40, perBattleCap: 4 },
  HEAVILY_RESISTED_HITS: { type: "HEAVILY_RESISTED_HITS", label: "Receba 20 ataques de alta resistência.", target: 20, perBattleCap: 2 },
  ARMOR_PENETRATION: { type: "ARMOR_PENETRATION", label: "Cause dano por Penetração de Armadura em 30 ações.", target: 30, perBattleCap: 3 },
  LOWEST_HP_ATTACK: { type: "LOWEST_HP_ATTACK", label: "Acerte 30 vezes o inimigo vivo de menor HP.", target: 30, perBattleCap: 2 },
  FOCUS_CHAIN: { type: "FOCUS_CHAIN", label: "Crie 20 focos de equipe no mesmo alvo e round.", target: 20, perBattleCap: 1 },
  ROUND_SURVIVAL: { type: "ROUND_SURVIVAL", label: "Complete 15 sequências de três rounds agindo e sobrevivendo.", target: 15, perBattleCap: 1 },
  PRESSURE_UNDER_RISK: { type: "PRESSURE_UNDER_RISK", label: "Cause dano direto abaixo de 50% de HP e sobreviva ao próximo round em 30 ações.", target: 30, perBattleCap: 2 },
  THIRD_ATTACK: { type: "THIRD_ATTACK", label: "Execute o terceiro ataque direto em 15 combates.", target: 15, perBattleCap: 1 },
  TURN_THREE_HOLD: { type: "TURN_THREE_HOLD", label: "Chegue vivo ao início do round 3 em 20 combates.", target: 20, perBattleCap: 1 },
  TURN_FIVE_HOLD: { type: "TURN_FIVE_HOLD", label: "Chegue vivo ao início do round 5 em 12 combates.", target: 12, perBattleCap: 1 },
};

function affinity(stance: TrainingStanceKey, personality: TrainingPersonality): TrainingObjective {
  if (stance === "PURIFIER" && personality === "LOYAL") return { id: "affinity", type: "AFFINITY", label: "Proteja 30 vezes o aliado vinculado abaixo de 50% de HP.", target: 30, progress: 0, perBattleCap: 2 };
  if (stance === "EXECUTOR" && personality === "COMPETITIVE") return { id: "affinity", type: "AFFINITY", label: "Aplique 20 K.O.s em inimigos com status total maior que o seu.", target: 20, progress: 0, perBattleCap: 2 };
  if (stance === "COMMANDER" && personality === "LOYAL") return { id: "affinity", type: "AFFINITY", label: "Aplique 15 K.O.s no agressor do aliado vinculado em perigo.", target: 15, progress: 0, perBattleCap: 1 };
  const label = `${TRAINING_STANCES[stance].label}: conclua 20 feitos de treino coerentes com a personalidade ${personality}.`;
  return { id: "affinity", type: "AFFINITY", label, target: 20, progress: 0, perBattleCap: 1 };
}

export function buildTrainingJourney(input: { stance: TrainingStanceKey; personality: TrainingPersonality; seed: number }): TrainingJourney {
  const stance = TRAINING_STANCES[input.stance];
  const eligible = ["ARENA_Z", "LEAGUE", "EXPEDITIONS", ...stance.preferredObjectives,
    ...(stance.role === "support" ? ["BUFFS", "HEALS", "PROTECT_DANGER"] : []),
    ...(stance.role === "defender" ? ["RESISTED_HITS", "HEAVILY_RESISTED_HITS", "LAST_SURVIVOR"] : []),
    ...(stance.role === "attacker" ? ["SUPER_EFFECTIVE", "ULTRA_EFFECTIVE", "TYPE_KOS"] : []),
  ] as Array<keyof typeof OBJECTIVES>;
  const unique = [...new Set(eligible)];
  const picked: Array<keyof typeof OBJECTIVES> = ["ARENA_Z", "LEAGUE", "EXPEDITIONS"];
  const offset = ((input.seed % unique.length) + unique.length) % unique.length;
  const ordered = [...unique.slice(offset), ...unique.slice(0, offset)];
  for (const candidate of ordered) {
    if (picked.length >= 6) break;
    if (!picked.includes(candidate)) picked.push(candidate);
  }
  const objectives = picked.map((type, index) => ({ ...OBJECTIVES[type], id: `${type.toLowerCase()}-${index}`, progress: 0 }));
  objectives.push(affinity(input.stance, input.personality));
  return { stance: input.stance, personality: input.personality, itemName: `Marco de Postura - ${stance.label}`, objectives };
}

export type TrainingEvent = {
  battleId: string;
  kos?: number;
  lowHpDirectAttacks?: number;
  survivedToNextRound?: boolean;
  directAttacks?: number;
  damageUnits?: number;
  buffs?: number;
  heals?: number;
  protects?: number;
  debuffs?: number;
  superEffective?: number;
  ultraEffective?: number;
  resistedHits?: number;
  heavilyResistedHits?: number;
  focusChains?: number;
  survivedSequences?: number;
  thirdAttacks?: number;
  turnThree?: number;
  turnFive?: number;
  typeKos?: number;
  roleKos?: number;
  lastSurvivor?: number;
  survivedDebuff?: number;
  lowestHpAttacks?: number;
  multiKoBattles?: number;
  armorPenetration?: number;
  affinity?: number;
};

export function evaluateTrainingEvent(journey: TrainingJourney, event: TrainingEvent): { delta: number; reason: string } {
  const objective = journey.objectives[0];
  const value: Partial<Record<TrainingObjectiveType, number>> = {
    KOS: event.kos,
    PRESSURE_UNDER_RISK: event.survivedToNextRound ? event.lowHpDirectAttacks : 0,
    DIRECT_ATTACKS: event.directAttacks,
    DAMAGE: event.damageUnits,
    BUFFS: event.buffs,
    HEALS: event.heals,
    PROTECT_DANGER: event.protects,
    DEBUFFS: event.debuffs,
    SUPER_EFFECTIVE: event.superEffective,
    ULTRA_EFFECTIVE: event.ultraEffective,
    RESISTED_HITS: event.resistedHits,
    HEAVILY_RESISTED_HITS: event.heavilyResistedHits,
    FOCUS_CHAIN: event.focusChains,
    ROUND_SURVIVAL: event.survivedSequences,
    THIRD_ATTACK: event.thirdAttacks,
    TURN_THREE_HOLD: event.turnThree,
    TURN_FIVE_HOLD: event.turnFive,
    TYPE_KOS: event.typeKos,
    ROLE_KOS: event.roleKos,
    LAST_SURVIVOR: event.lastSurvivor,
    SURVIVE_DEBUFF: event.survivedDebuff,
    LOWEST_HP_ATTACK: event.lowestHpAttacks,
    MULTI_KO_BATTLE: event.multiKoBattles,
    ARMOR_PENETRATION: event.armorPenetration,
    AFFINITY: event.affinity,
  };
  const raw = value[objective.type] ?? 0;
  const delta = Math.min(Math.max(0, raw), objective.perBattleCap);
  if (objective.type === "PRESSURE_UNDER_RISK" && !event.survivedToNextRound) return { delta: 0, reason: "Não contou: o mascote não sobreviveu até o próximo round." };
  if (delta === 0) return { delta: 0, reason: "Não contou: o evento não atende ao objetivo em teste." };
  const capped = raw > objective.perBattleCap;
  if (objective.type === "PRESSURE_UNDER_RISK") return { delta, reason: `Contou ${delta}: ataque abaixo de 50% de HP com sobrevivência.${capped ? ` Limite de ${objective.perBattleCap} por combate.` : ""}` };
  return { delta, reason: capped ? `Contou ${delta}: limite de ${objective.perBattleCap} por combate.` : `Contou ${delta} de progresso.` };
}

export const ARENA_TRAINING_PAIR_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const ARENA_TRAINING_DAILY_CAP = 2;

export type ArenaTrainingCreditInput = {
  sourceMode: string;
  ownerId: string;
  opponentOwnerId: string;
  ownMascots: number;
  opponentMascots: number;
  resolvedActions: number;
  selectedTrainingMascot: boolean;
  pairLastCreditAt: Date | null;
  now: Date;
  ownerCreditsToday: number;
};

export type ArenaTrainingCreditResult = { eligible: boolean; reasons: string[]; nextEligibleAt?: Date };

export function validateArenaTrainingCredit(input: ArenaTrainingCreditInput): ArenaTrainingCreditResult {
  const reasons: string[] = [];
  if (input.sourceMode !== "ARENA_Z_PVP") reasons.push("Apenas Arena-Z PvP pode gerar crédito de treinamento.");
  if (input.ownerId === input.opponentOwnerId) reasons.push("A partida precisa envolver dois jogadores diferentes.");
  if (input.ownMascots < 2 || input.opponentMascots < 2) reasons.push("Cada lado precisa iniciar com ao menos dois mascotes.");
  if (input.resolvedActions < 6) reasons.push("A batalha precisa registrar ao menos seis ações resolvidas.");
  if (!input.selectedTrainingMascot) reasons.push("Selecione um mascote em treino antes da batalha.");
  if (input.ownerCreditsToday >= ARENA_TRAINING_DAILY_CAP) reasons.push("O limite diário de dois créditos de Arena-Z já foi alcançado.");
  if (input.pairLastCreditAt) {
    const nextEligibleAt = new Date(input.pairLastCreditAt.getTime() + ARENA_TRAINING_PAIR_COOLDOWN_MS);
    if (input.now.getTime() < nextEligibleAt.getTime()) {
      reasons.push("Esta dupla já recebeu crédito nas últimas 24 horas.");
      return { eligible: false, reasons, nextEligibleAt };
    }
  }
  return reasons.length ? { eligible: false, reasons } : { eligible: true, reasons: [] };
}

export function buildTrainingManualCopy() {
  return "Posturas desbloqueáveis — em preparação. Cada Marco de Postura - [Postura] iniciará uma jornada longa de 5 a 7 marcos após o lançamento. Arena-Z: a mesma dupla recebe no máximo um crédito a cada 24 horas, cada jogador ganha no máximo dois créditos por dia e somente um mascote em treino por batalha. Os objetivos têm limites por combate: K.O.s até 2, proteção de aliado em perigo até 2, buffs e curas até 3, e sobrevivência especial até 1. Fontes permitidas: Arena-Z PvP válida, Liga Semanal, Liga Rush e expedições Padrão, Treinamento e Itens. Arena Draft, Terreno, testes, admin, modos desligados e inacessíveis não contam. Aliado em perigo é aliado vivo abaixo de 50% de HP antes da ação. Cura efetiva é HP realmente recuperado. Penetração de Armadura é dano ofensivo adicional que atravessa a defesa; Resistência de Dano é a redução defensiva recebida.";
}
