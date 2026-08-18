// ── Design das personalidades (reformulação "Personalidades com impacto real") ──
//
// Fonte única de verdade para afinidade de atributos e para as descrições de
// efeito por personalidade (interações, expedições, combate e limitações). O
// manual e as fases de implementação leem daqui. Nenhum valor é recalculado
// retroativamente; afinidades já existentes de mascotes são preservadas.

export type StatKey = "force" | "agility" | "instinct" | "vitality" | "charisma";

export const STAT_LABEL: Record<StatKey, string> = {
  force: "Força",
  agility: "Agilidade",
  instinct: "Instinto",
  vitality: "Vitalidade",
  charisma: "Carisma",
};

export type PersonalityAffinity = {
  /** Atributo "muito útil": nunca é apagado por debuffs inteligentes e é priorizado no crescimento. */
  veryUseful: StatKey | null;
  /** Atributo "útil": preferido em segundo grau. */
  useful: StatKey | null;
};

export type PersonalitySpec = {
  key: string;                // enum MascotPersonality
  label: string;              // rótulo em pt-BR
  affinity: PersonalityAffinity;
  interactions: string;
  expeditions: string;
  combat: string;
  limitation?: string;
  isNew?: boolean;            // personalidade introduzida nesta reformulação
};

// Afinidade de atributos (tabela da página 2). Caótico não tem preferência fixa.
export const PERSONALITY_AFFINITY: Record<string, PersonalityAffinity> = {
  LOYAL:       { veryUseful: "charisma",  useful: "vitality" },
  PROUD:       { veryUseful: "force",     useful: "charisma" },
  MISCHIEVOUS: { veryUseful: "instinct",  useful: "agility" },
  LAZY:        { veryUseful: "vitality",  useful: "charisma" },
  COMPETITIVE: { veryUseful: "force",     useful: "instinct" },
  DRAMATIC:    { veryUseful: "charisma",  useful: "force" },
  PLAYFUL:     { veryUseful: "agility",   useful: "charisma" },
  ELECTRIC:    { veryUseful: "agility",   useful: "force" },
  TIMID:       { veryUseful: "instinct",  useful: "vitality" },
  CHAOTIC:     { veryUseful: null,        useful: null },
  CURIOUS:     { veryUseful: "instinct",  useful: "agility" },
  GLUTTON:     { veryUseful: "vitality",  useful: "force" },
  SERENE:      { veryUseful: "charisma",  useful: "vitality" },
};

export const PERSONALITY_DESIGN: PersonalitySpec[] = [
  {
    key: "LOYAL", label: "Leal", affinity: PERSONALITY_AFFINITY.LOYAL,
    interactions: "Carinho dá +2 de felicidade; alimentação concede +10% de EXP; eventos sociais positivos são favorecidos.",
    expeditions: "Cada Super Amigo registrado no próprio mascote concede +1% de EXP final (até +3%). O amigo não precisa participar, o vínculo não é consumido e só vale em modos que entregam EXP.",
    combat: "Vincula-se a um aliado (Super Amigo da equipe; senão maior laço; senão maior Carisma). Enquanto esse aliado estiver vivo e abaixo de 35% de HP, o Leal recebe +5% de Carisma e Vitalidade efetivos, e cura/proteção/interceptação destinada a ele recebe +5%. Não é bônus de equipe.",
  },
  {
    key: "PROUD", label: "Orgulhoso", affinity: PERSONALITY_AFFINITY.PROUD,
    interactions: "Carinho satisfatório rende mais felicidade; vitórias favorecem o humor Confiante; derrotas causam perda adicional de felicidade.",
    expeditions: "Com felicidade acima de 70, recebe +8% de EXP. Ao encontrar ovo, item especial ou pedra de evolução, ganha +10 de felicidade e pode ficar Confiante.",
    combat: "Acima de 70% de HP, causa +6% de dano. O bônus some ao ficar ferido.",
  },
  {
    key: "MISCHIEVOUS", label: "Travesso", affinity: PERSONALITY_AFFINITY.MISCHIEVOUS,
    interactions: "Brincar tem 20% de chance de gerar um evento social específico entre ele e outro mascote.",
    expeditions: "Encontra 10% menos comida comum; a parcela removida é redistribuída só entre doce, ovo e item especial já válidos naquela expedição (nunca libera recompensa proibida).",
    combat: "O primeiro ataque contra cada inimigo tem 15% de chance de reduzir em 8% o atributo mais útil daquele alvo por 1 round. Afeta só o inimigo atacado; a equipe toda se beneficia ao atacá-lo. O maior efeito prevalece; reaplicar apenas renova a duração.",
  },
  {
    key: "LAZY", label: "Preguiçoso", affinity: PERSONALITY_AFFINITY.LAZY,
    interactions: "Brincar pode deixá-lo Cansado; comida gera +50% de felicidade; carinho remove Cansado.",
    expeditions: "Jornadas de 3h ou 6h dão +8% de EXP. Se obtiver ovo, ele nasce com +1 ponto percentual na chance de raridade do mascote (não aumenta a chance de encontrar o ovo).",
    combat: "Acima de 50% de HP, recebe -8% de dano.",
    limitation: "Ações extras (2º/3º atos por vantagem de Agilidade) exigem +10 pontos adicionais de diferença por ação.",
  },
  {
    key: "COMPETITIVE", label: "Competitivo", affinity: PERSONALITY_AFFINITY.COMPETITIVE,
    interactions: "Brincar concede +10% de EXP da interação e ativa humor Competitivo por 6h; a primeira vitória nesse humor dá +5 de felicidade.",
    expeditions: "Treinamento concede +8% de EXP.",
    combat: "Contra adversário de nível ou status total superior, causa +7% de dano; contra Rival direto, também recebe -4% de dano. Sem bônus contra mais fracos.",
  },
  {
    key: "DRAMATIC", label: "Dramático", affinity: PERSONALITY_AFFINITY.DRAMATIC,
    interactions: "Mudanças de felicidade (positivas ou negativas) são 20% maiores; eventos sociais positivos podem gerar presente.",
    expeditions: "Feliz ou Confiante concede +10% de EXP; Irritado ou Cansado não concede bônus.",
    combat: "Abaixo de 35% de HP, causa +10% de dano e recebe +8% de cura. Uma vez por batalha, 25% de chance de sobreviver a um golpe fatal com 1 HP.",
    limitation: "Mantém a afinidade atual de -15% no crescimento de Vitalidade (sem alteração retroativa).",
  },
  {
    key: "PLAYFUL", label: "Brincalhão", affinity: PERSONALITY_AFFINITY.PLAYFUL,
    interactions: "Brincar concede +3 de felicidade, +10 de EXP e 15% de chance de reduzir o próximo cooldown de Brincar.",
    expeditions: "Se uma expedição Padrão encontrar ovo, ele recebe +1 ponto percentual na raridade do mascote; eventos positivos com amigos ficam mais comuns.",
    combat: "Ao entrar, 12% de chance de dar +5% de Agilidade ao time por 2 rounds. É coletivo e não causa dano.",
  },
  {
    key: "ELECTRIC", label: "Elétrico", affinity: PERSONALITY_AFFINITY.ELECTRIC,
    interactions: "Cooldown de Brincar -20% e menor chance de ficar Cansado.",
    expeditions: "Reduz um pouco mais o tempo de expedições de 30 min e 1h, respeitando o limite geral e exibindo o desconto antes de confirmar.",
    combat: "+12% de Agilidade no primeiro round e +5% depois. Forte no começo e em lutas curtas.",
  },
  {
    key: "TIMID", label: "Tímido", affinity: PERSONALITY_AFFINITY.TIMID,
    interactions: "Abaixo de 30 de felicidade pode recusar carinho; a partir de 60, carinho dá +3; acima de 80, cria laços com mais facilidade.",
    expeditions: "Com felicidade acima de 70, reduz em 20% a chance de resultado vazio de material e tenta de novo só entre recompensas válidas.",
    combat: "Antes de sofrer o primeiro golpe, recebe -10% de dano; depois, ganha +5% de Instinto pelo resto da luta.",
  },
  {
    key: "CHAOTIC", label: "Caótico", affinity: PERSONALITY_AFFINITY.CHAOTIC,
    interactions: "A primeira brincadeira diária grava um resultado no servidor: 75% bônus aleatório para a próxima expedição (+10% EXP, -10% duração ou repetir resultado vazio), 15% sem efeito e 10% ida ao SUS sem combate. Atualizar a página não muda o sorteio.",
    expeditions: "Ver interações (o sorteio da brincadeira diária afeta a próxima expedição).",
    combat: "A cada round, um atributo próprio recebe modificador aleatório entre -8% e +12% (positivo ou negativo).",
    limitation: "Crescimento: pode concentrar vários pontos da mesma subida de nível num único atributo. O Laboratório deve sinalizar grande instabilidade.",
  },
  {
    key: "CURIOUS", label: "Curioso", affinity: PERSONALITY_AFFINITY.CURIOUS, isNew: true,
    interactions: "Carinho ou brincadeira pode revelar uma dica sobre a próxima expedição.",
    expeditions: "Em expedição de Itens, repete o sorteio se o primeiro resultado for só comida comum; a primeira expedição do dia concede +5% de EXP.",
    combat: "Identifica o inimigo de maior status total e recebe +5% de Instinto contra ele até que seja derrotado.",
  },
  {
    key: "GLUTTON", label: "Guloso", affinity: PERSONALITY_AFFINITY.GLUTTON, isNew: true,
    interactions: "Comida dá +50% de felicidade; comida e doces dão +15% de EXP; doce fornece +3% de Vitalidade temporária.",
    expeditions: "Aumenta a presença de comida e doce, reduzindo a parcela de item especial.",
    combat: "Quando Alimentado ou Satisfeito, recebe -6% de dano. Com fome, perde essa proteção.",
  },
  {
    key: "SERENE", label: "Sereno", affinity: PERSONALITY_AFFINITY.SERENE, isNew: true,
    interactions: "Uma vez por dia, carinho remove Irritado ou Cansado.",
    expeditions: "Pode repetir um resultado vazio comum.",
    combat: "Reduz em 1 round a duração de provocar e debuffs longos; efeitos de 1 round têm intensidade reduzida. Em troca, causa -4% de dano direto.",
  },
];

export const PERSONALITY_DESIGN_BY_KEY: Record<string, PersonalitySpec> =
  Object.fromEntries(PERSONALITY_DESIGN.map((p) => [p.key, p]));

// ── Resistência de buff/debuff (página 8) ───────────────────────────────────
// A força de um debuff usa principalmente o Instinto da fonte; a resistência do
// alvo usa 60% de Instinto + 40% de Vitalidade. O confronto ajusta o efeito base
// entre 60% e 135%. Resistência reduz intensidade, não vira falha total.
export const DEBUFF_RESISTANCE = {
  targetInstinctWeight: 0.6,
  targetVitalityWeight: 0.4,
  minEffect: 0.6,
  maxEffect: 1.35,
} as const;

/** Postura → atributos principais que definem a força dos efeitos aplicados. */
export const ROLE_EFFECT_ATTRIBUTES: Record<string, string> = {
  ENCOURAGER: "Carisma",
  HEALER: "Carisma + Vitalidade + nível",
  GUARDIAN: "Vitalidade + Carisma",
  SCOUT: "Agilidade + Instinto",
  OPPORTUNIST: "Instinto",
  PROVOKER: "Carisma + Instinto",
  SABOTEUR: "Instinto + Agilidade",
};

// ── Linguagem visual dos replays (página 9) ─────────────────────────────────
export const EFFECT_ICON_COLORS = {
  buff: "verde",
  debuff: "vermelho",
  protection: "azul",
  personality: "roxo",
  item: "amarelo",
} as const;
