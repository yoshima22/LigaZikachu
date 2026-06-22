// ── Modificadores Semanais ──────────────────────────────────────────────────

export type WeeklyModifier = {
  id: string;
  name: string;
  description: string;
  example: string;
  effectType: "STAT_BOOST" | "TYPE_BOOST" | "ROLE_BOOST" | "LEVEL_BOOST" | "CLEAN_FIGHT";
  affectedStats?: string[];
  affectedTypes?: string[];
  affectedRoles?: string[];
  bonusPct: number;
  penalty?: boolean;
};

export const WEEKLY_MODIFIERS: WeeklyModifier[] = [
  // Por status
  { id: "SEMANA_LIGEIROS", name: "Semana dos Ligeiros", description: "Mascotes com Agilidade alta recebem bônus leve de iniciativa.", example: "Mascotes com Agilidade ≥ 30: +5% iniciativa.", effectType: "STAT_BOOST", affectedStats: ["agility"], bonusPct: 5 },
  { id: "SEMANA_FORTOES", name: "Semana dos Fortões", description: "Mascotes com Força alta causam um pouco mais de dano.", example: "Mascotes com Força ≥ 30: +5% dano.", effectType: "STAT_BOOST", affectedStats: ["force"], bonusPct: 5 },
  { id: "SEMANA_RESISTENTES", name: "Semana dos Resistentes", description: "Mascotes com Vitalidade alta recebem leve redução de dano.", example: "Mascotes com Vitalidade ≥ 30: -5% dano recebido.", effectType: "STAT_BOOST", affectedStats: ["vitality"], bonusPct: 5 },
  { id: "SEMANA_INSTINTO", name: "Semana do Instinto", description: "Mascotes com Instinto alto melhoram chance de efeitos especiais.", example: "Mascotes com Instinto ≥ 30: +5% chance de efeitos.", effectType: "STAT_BOOST", affectedStats: ["instinct"], bonusPct: 5 },
  { id: "SEMANA_CARISMA", name: "Semana do Carisma", description: "Mascotes com Carisma alto melhoram efeitos de suporte e blefe.", example: "Mascotes com Carisma ≥ 30: +5% eficiência de suporte.", effectType: "STAT_BOOST", affectedStats: ["charisma"], bonusPct: 5 },
  { id: "EQUILIBRIO_FORCADO", name: "Equilíbrio Forçado", description: "O maior status de cada mascote recebe leve redução e o menor recebe leve aumento.", example: "Maior stat: -3%. Menor stat: +3%.", effectType: "STAT_BOOST", bonusPct: 3 },
  { id: "PEQUENOS_GIGANTES", name: "Pequenos Gigantes", description: "Mascotes de nível baixo recebem bônus temporário.", example: "Mascotes com nível ≤ 20: +7% em todos os stats.", effectType: "LEVEL_BOOST", bonusPct: 7 },
  { id: "DUELO_LIMPO", name: "Duelo Limpo", description: "Itens externos e buffs de outros modos não entram no cálculo.", example: "Combate puro, sem itens ou buffs externos.", effectType: "CLEAN_FIGHT", bonusPct: 0 },
  // Por tipo/elemento
  { id: "CHUVA_ENERGIZADA", name: "Chuva Energizada", description: "Mascotes do tipo Água e Elétrico recebem bônus leve de Agilidade.", example: "Tipos Água/Elétrico: +5% Agilidade.", effectType: "TYPE_BOOST", affectedTypes: ["water", "electric"], affectedStats: ["agility"], bonusPct: 5 },
  { id: "TERRENO_ROCHOSO", name: "Terreno Rochoso", description: "Mascotes do tipo Pedra e Terra recebem bônus leve de Vitalidade.", example: "Tipos Pedra/Terra: +5% Vitalidade.", effectType: "TYPE_BOOST", affectedTypes: ["rock", "ground"], affectedStats: ["vitality"], bonusPct: 5 },
  { id: "SEMANA_FLAMEJANTE", name: "Semana Flamejante", description: "Mascotes do tipo Fogo recebem bônus leve de Força.", example: "Tipo Fogo: +5% Força.", effectType: "TYPE_BOOST", affectedTypes: ["fire"], affectedStats: ["force"], bonusPct: 5 },
  { id: "JARDIM_VIVO", name: "Jardim Vivo", description: "Mascotes do tipo Planta recebem bônus leve de Vitalidade e Carisma.", example: "Tipo Planta: +4% Vitalidade e Carisma.", effectType: "TYPE_BOOST", affectedTypes: ["grass"], affectedStats: ["vitality", "charisma"], bonusPct: 4 },
  { id: "CEU_ABERTO", name: "Céu Aberto", description: "Mascotes do tipo Voador recebem bônus leve de Agilidade.", example: "Tipo Voador: +5% Agilidade.", effectType: "TYPE_BOOST", affectedTypes: ["flying"], affectedStats: ["agility"], bonusPct: 5 },
  { id: "NEVOA_PSIQUICA", name: "Névoa Psíquica", description: "Mascotes Psíquicos e Fantasmas recebem bônus leve de Instinto.", example: "Tipos Psíquico/Fantasma: +5% Instinto.", effectType: "TYPE_BOOST", affectedTypes: ["psychic", "ghost"], affectedStats: ["instinct"], bonusPct: 5 },
  { id: "CAMPO_METALICO", name: "Campo Metálico", description: "Mascotes do tipo Metal recebem leve redução de dano recebido.", example: "Tipo Metal: -5% dano recebido.", effectType: "TYPE_BOOST", affectedTypes: ["steel"], affectedStats: ["vitality"], bonusPct: 5 },
  { id: "NOITE_SOMBRIA", name: "Noite Sombria", description: "Mascotes Noturnos e Fantasmas recebem bônus leve em efeitos de Oportunista.", example: "Tipos Dark/Ghost: +5% eficiência Oportunista.", effectType: "TYPE_BOOST", affectedTypes: ["dark", "ghost"], affectedStats: ["instinct"], bonusPct: 5 },
  { id: "MARE_ALTA", name: "Maré Alta", description: "Mascotes Aquáticos recebem bônus leve de resistência.", example: "Tipo Água: +5% Vitalidade.", effectType: "TYPE_BOOST", affectedTypes: ["water"], affectedStats: ["vitality"], bonusPct: 5 },
  { id: "VENTANIA_SELVAGEM", name: "Ventania Selvagem", description: "Mascotes Voador e Elétrico recebem bônus de iniciativa no primeiro turno.", example: "Tipos Voador/Elétrico: +6% Agilidade.", effectType: "TYPE_BOOST", affectedTypes: ["flying", "electric"], affectedStats: ["agility"], bonusPct: 6 },
];

// ── Itens de Liga ──────────────────────────────────────────────────────────

export type LeagueItemDef = {
  type: string;
  name: string;
  description: string;
  price: number;
  effectType: "POSITIVE" | "NEGATIVE";
  targetType: "SELF" | "OPPONENT";
  effectCode: string;
};

export const LEAGUE_ITEMS: LeagueItemDef[] = [
  // Positivos (aplicam ao próprio time)
  { type: "LEAGUE_CAPTAIN_BAND", name: "Faixa de Capitão", description: "O mascote no slot 1 recebe +4% em Força, Agilidade, Instinto, Carisma e Vitalidade neste combate.", price: 800, effectType: "POSITIVE", targetType: "SELF", effectCode: "CAPTAIN_BAND" },
  { type: "LEAGUE_FORMATION_WHISTLE", name: "Apito de Formação", description: "O time recebe +5% de iniciativa no primeiro turno.", price: 500, effectType: "POSITIVE", targetType: "SELF", effectCode: "FORMATION_WHISTLE" },
  { type: "LEAGUE_BENCH_SHIELD", name: "Escudo de Banco", description: "Mascotes nos slots 5 e 6 recebem -6% de dano recebido neste combate.", price: 600, effectType: "POSITIVE", targetType: "SELF", effectCode: "BENCH_SHIELD" },
  { type: "LEAGUE_CHEER_FLAG", name: "Bandeira da Torcida", description: "Mascotes com Carisma como atributo principal recebem +5% nos efeitos de suporte.", price: 700, effectType: "POSITIVE", targetType: "SELF", effectCode: "CHEER_FLAG" },
  { type: "LEAGUE_ENGUICA_STRATEGY", name: "Estratégia do Enguiça", description: "Reduz em 20% o impacto de penalidades causadas pelo modificador semanal sobre o próprio time.", price: 1200, effectType: "POSITIVE", targetType: "SELF", effectCode: "ENGUICA_STRATEGY" },
  { type: "LEAGUE_ANALYSIS_LANTERN", name: "Lanterna de Análise", description: "Mascotes que usam Instinto recebem +5% de eficiência em efeitos de Oportunista, Batedor e Sabotador.", price: 900, effectType: "POSITIVE", targetType: "SELF", effectCode: "ANALYSIS_LANTERN" },
  { type: "LEAGUE_ROUND_BOOTS", name: "Botas de Rodada", description: "Mascotes com Agilidade alta recebem +5% de iniciativa e +3% de esquiva neste combate.", price: 800, effectType: "POSITIVE", targetType: "SELF", effectCode: "ROUND_BOOTS" },
  { type: "LEAGUE_LOCKER_TONIC", name: "Tônico de Vestiário", description: "O time recupera 5% da vida máxima de cada mascote no início do combate.", price: 1000, effectType: "POSITIVE", targetType: "SELF", effectCode: "LOCKER_TONIC" },
  // Negativos (aplicam ao adversário)
  { type: "LEAGUE_CONFUSION_SPRAY", name: "Spray de Confusão", description: "O adversário sofre -5% de iniciativa no primeiro turno.", price: 400, effectType: "NEGATIVE", targetType: "OPPONENT", effectCode: "CONFUSION_SPRAY" },
  { type: "LEAGUE_WRONG_SIGN", name: "Placa de Caminho Errado", description: "O mascote do slot 1 adversário tem 8% de chance de escolher um alvo sub-ótimo no primeiro turno.", price: 600, effectType: "NEGATIVE", targetType: "OPPONENT", effectCode: "WRONG_SIGN" },
  { type: "LEAGUE_ANNOYING_WHISTLE", name: "Apito Irritante", description: "Efeitos de Carisma do adversário têm -5% de eficiência neste combate.", price: 500, effectType: "NEGATIVE", targetType: "OPPONENT", effectCode: "ANNOYING_WHISTLE" },
  { type: "LEAGUE_FIELD_SAND", name: "Areia no Campo", description: "O adversário recebe -5% de Agilidade no primeiro turno.", price: 400, effectType: "NEGATIVE", targetType: "OPPONENT", effectCode: "FIELD_SAND" },
  { type: "LEAGUE_EVIL_EYE", name: "Olho Gordo do Miauvadão", description: "O adversário recebe -5% em rolagens positivas especiais neste combate.", price: 700, effectType: "NEGATIVE", targetType: "OPPONENT", effectCode: "EVIL_EYE" },
  { type: "LEAGUE_CROWD_NOISE", name: "Barulho da Arquibancada", description: "O adversário recebe -4% de precisão nas ações do primeiro turno.", price: 500, effectType: "NEGATIVE", targetType: "OPPONENT", effectCode: "CROWD_NOISE" },
  { type: "LEAGUE_EMBARRASSING_TAPE", name: "Fita Embaraçosa", description: "Um mascote aleatório do adversário recebe -6% de Agilidade no início do combate.", price: 600, effectType: "NEGATIVE", targetType: "OPPONENT", effectCode: "EMBARRASSING_TAPE" },
  { type: "LEAGUE_PROVOCATION_TICKET", name: "Bilhete de Provocação", description: "O mascote adversário com maior Força recebe +4% de dano causado, mas também +6% de dano recebido.", price: 800, effectType: "NEGATIVE", targetType: "OPPONENT", effectCode: "PROVOCATION_TICKET" },
];

// ── Premiação ──────────────────────────────────────────────────────────────

export const LEAGUE_PRIZES = {
  first: { boxItems: 3, eventEgg: true, label: "Caixa Surpresa com 3 itens + 1 Ovo de Evento" },
  second: { boxItems: 2, eventEgg: true, label: "Caixa Surpresa com 2 itens + 1 Ovo de Evento" },
  third: { boxItems: 1, eventEgg: true, label: "Caixa Surpresa com 1 item + 1 Ovo de Evento" },
  participation: { eventEgg: true, label: "1 Ovo de Evento" },
  zikaCoins: [
    { rank: 4, coins: 700 },
    { rank: 5, coins: 600 },
    { rank: 6, coins: 500 },
    { rank: [7, 10], coins: 400 },
    { rank: [11, 15], coins: 300 },
    { rank: [16, 999], coins: 200 },
  ] as Array<{ rank: number | [number, number]; coins: number }>,
};

// ── Horários ────────────────────────────────────────────────────────────────

export const BATTLE_TIMES_BRT = ["20:00", "20:10", "20:20"];
export const LEAGUE_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

// ── Pontuação ───────────────────────────────────────────────────────────────

export const POINTS = {
  WIN: 3,
  DRAW: 1,
  LOSS: 0,
  WIN_WO: 3,
  LOSS_WO: 0,
  BYE: 3,
};
