export type RushRewardBundle = {
  key: string;
  rankFrom: number;
  rankTo?: number;
  label: string;
  estimatedValue: number;
  coins?: number;
  food?: number;
  sweet?: number;
  creationDust?: number;
  eggs?: Array<{ type: "COMMON" | "RARE" | "EVENT" | "SPECIAL"; quantity: number }>;
  shopItems?: Array<{ type: string; quantity: number; label: string; itemName?: string }>;
  randomMegaStone?: boolean;
};

export type RushRewardPlan = {
  id: string;
  name: string;
  description: string;
  bundles: RushRewardBundle[];
};

export const RUSH_RULE_PRESETS = [
  { id: "RUSH_45", name: "Rush Clássica", description: "Formato-base com equipes curtas e teto de nível configurável. Mantém todos os tipos e personalidades disponíveis, enquanto a regra de repetição e a divisão determinam quanto o jogador pode reutilizar seus principais mascotes e suas Megas.", maxLevel: 45, teamSize: 3, uniqueSpecies: false, requiredType: null },
  { id: "MONOTYPE", name: "Semana Monotipo", description: "Um tipo é escolhido para a edição e todo mascote escalado precisa possuí-lo como tipo primário ou secundário. O teto de nível continua independente do tipo; equipes menores e repetição flexível ajudam coleções com poucas opções elegíveis.", maxLevel: 45, teamSize: 3, uniqueSpecies: false, requiredType: "ROTATING" },
  { id: "NO_REPEAT", name: "Semana Sem Repetição", description: "Cada mascote individual só pode participar uma vez durante toda a semana. O teto de nível define o grupo elegível, enquanto o jogador precisa distribuir seu elenco entre os 15 confrontos sem depender sempre dos mesmos favoritos.", maxLevel: 45, teamSize: 3, uniqueSpecies: true, requiredType: null },
  { id: "SPRINT_30", name: "Sprint", description: "Formato de desenvolvimento com teto de nível editável e rotação ampla de elenco. Mascotes acima do limite ficam inelegíveis; os que estão dentro dele precisam ser administrados entre as partidas conforme a regra de repetição ativa.", maxLevel: 30, teamSize: 3, uniqueSpecies: true, requiredType: null },
  { id: "DUO_RUSH", name: "Dupla Relâmpago", description: "Cada equipe possui no máximo 2 mascotes. O teto de nível é configurável e, com menos integrantes, postura, cobertura de tipos e escolha de cada participante pesam mais porque uma única eliminação altera rapidamente o combate.", maxLevel: 45, teamSize: 2, uniqueSpecies: true, requiredType: null },
  { id: "OPEN_45", name: "Rush Livre", description: "Formato acessível com teto de nível editável e repetição livre entre partidas. Permite testar e reaproveitar composições durante a semana, respeitando apenas os demais limitadores exibidos na edição.", maxLevel: 45, teamSize: 3, uniqueSpecies: false, requiredType: null, division: "UNLIMITED" },
] as const;

export const RUSH_REWARD_PLANS: RushRewardPlan[] = [
  {
    id: "VELOCIDADE",
    name: "Cofres da Velocidade",
    description: "Ovos e consumíveis úteis, com valor mais concentrado no pódio.",
    bundles: [
      { key: "first", rankFrom: 1, label: "1 Ovo Raro + 1 Bala de Mel + 1.300 ZC", estimatedValue: 5000, coins: 1300, eggs: [{ type: "RARE", quantity: 1 }], shopItems: [{ type: "MASCOT_BUFF_HAPPY", quantity: 1, label: "Bala de Mel" }] },
      { key: "second", rankFrom: 2, label: "1 Ovo Comum + 1 Ovo da Sorte + 900 ZC", estimatedValue: 3100, coins: 900, eggs: [{ type: "COMMON", quantity: 1 }], shopItems: [{ type: "LUCKY_EGG", quantity: 1, label: "Ovo da Sorte" }] },
      { key: "third", rankFrom: 3, label: "1 Ovo Comum + 1 Vitamina Chocante + 600 ZC", estimatedValue: 1950, coins: 600, eggs: [{ type: "COMMON", quantity: 1 }], shopItems: [{ type: "MASCOT_BUFF_EXP", quantity: 1, label: "Vitamina Chocante" }] },
      { key: "top6", rankFrom: 4, rankTo: 6, label: "1 Ovo Comum + 300 ZC", estimatedValue: 900, coins: 300, eggs: [{ type: "COMMON", quantity: 1 }] },
      { key: "participation", rankFrom: 7, rankTo: 9999, label: "Caixa de participação: 150 ZC, comidas e doce", estimatedValue: 350, coins: 150, food: 5, sweet: 1 },
    ],
  },
  {
    id: "EXPEDICAO",
    name: "Mochilas de Expedição",
    description: "Itens para acelerar e fortalecer expedições, sem ultrapassar a faixa de 6.000 ZC.",
    bundles: [
      { key: "first", rankFrom: 1, label: "1 Cesta de Piquenique + 1 Ovo da Sorte + 1.000 ZC", estimatedValue: 5100, coins: 1000, shopItems: [{ type: "PICNIC_BASKET", quantity: 1, label: "Cesta de Piquenique" }, { type: "LUCKY_EGG", quantity: 1, label: "Ovo da Sorte" }] },
      { key: "second", rankFrom: 2, label: "1 Cesta de Piquenique + 1 Ovo Comum + 500 ZC", estimatedValue: 3600, coins: 500, eggs: [{ type: "COMMON", quantity: 1 }], shopItems: [{ type: "PICNIC_BASKET", quantity: 1, label: "Cesta de Piquenique" }] },
      { key: "third", rankFrom: 3, label: "1 Ticket de Férias + 1 Vitamina Chocante + 400 ZC", estimatedValue: 2750, coins: 400, shopItems: [{ type: "VACATION_TICKET", quantity: 1, label: "Ticket de Férias" }, { type: "MASCOT_BUFF_EXP", quantity: 1, label: "Vitamina Chocante" }] },
      { key: "top6", rankFrom: 4, rankTo: 6, label: "1 Vitamina Chocante + 300 ZC", estimatedValue: 1050, coins: 300, shopItems: [{ type: "MASCOT_BUFF_EXP", quantity: 1, label: "Vitamina Chocante" }] },
      { key: "participation", rankFrom: 7, rankTo: 9999, label: "Caixa de participação: 200 ZC e 5 comidas", estimatedValue: 300, coins: 200, food: 5 },
    ],
  },
  {
    id: "CRIACAO",
    name: "Caixas do Laboratório",
    description: "Ovos, Pó de Criação e itens de manutenção para desenvolver novas equipes.",
    bundles: [
      { key: "first", rankFrom: 1, label: "1 Ovo Raro + 20 Pó de Criação + 1.000 ZC", estimatedValue: 5000, coins: 1000, creationDust: 20, eggs: [{ type: "RARE", quantity: 1 }] },
      { key: "second", rankFrom: 2, label: "1 Ovo Comum + 15 Pó de Criação + 900 ZC", estimatedValue: 2400, coins: 900, creationDust: 15, eggs: [{ type: "COMMON", quantity: 1 }] },
      { key: "third", rankFrom: 3, label: "1 Ovo Comum + 10 Pó de Criação + 500 ZC", estimatedValue: 1700, coins: 500, creationDust: 10, eggs: [{ type: "COMMON", quantity: 1 }] },
      { key: "top6", rankFrom: 4, rankTo: 6, label: "8 Pó de Criação + 350 ZC", estimatedValue: 750, coins: 350, creationDust: 8 },
      { key: "participation", rankFrom: 7, rankTo: 9999, label: "Caixa de participação: 5 Pó de Criação + 150 ZC", estimatedValue: 400, coins: 150, creationDust: 5 },
    ],
  },
  {
    id: "MIAUVADAO",
    name: "Surpresas do Miauvadão",
    description: "Tickets, ovos e caixas variadas para uma semana de prêmios imprevisíveis.",
    bundles: [
      { key: "first", rankFrom: 1, label: "1 Ovo Raro + 4 Tickets ZikaLoot + 1.000 ZC", estimatedValue: 5000, coins: 1000, eggs: [{ type: "RARE", quantity: 1 }], shopItems: [{ type: "ZIKALOOT_TICKET", quantity: 4, label: "Ticket ZikaLoot" }] },
      { key: "second", rankFrom: 2, label: "1 Ovo Comum + 3 Tickets ZikaLoot + 900 ZC", estimatedValue: 1950, coins: 900, eggs: [{ type: "COMMON", quantity: 1 }], shopItems: [{ type: "ZIKALOOT_TICKET", quantity: 3, label: "Ticket ZikaLoot" }] },
      { key: "third", rankFrom: 3, label: "2 Tickets ZikaLoot + 1 Bala de Mel + 700 ZC", estimatedValue: 1300, coins: 700, shopItems: [{ type: "ZIKALOOT_TICKET", quantity: 2, label: "Ticket ZikaLoot" }, { type: "MASCOT_BUFF_HAPPY", quantity: 1, label: "Bala de Mel" }] },
      { key: "top6", rankFrom: 4, rankTo: 6, label: "1 Ticket ZikaLoot + 400 ZC", estimatedValue: 550, coins: 400, shopItems: [{ type: "ZIKALOOT_TICKET", quantity: 1, label: "Ticket ZikaLoot" }] },
      { key: "participation", rankFrom: 7, rankTo: 9999, label: "Caixa surpresa de participação", estimatedValue: 350, coins: 150, food: 3, sweet: 1, creationDust: 2 },
    ],
  },
  {
    id: "MEGA_SPECIAL",
    name: "Semana da Evolução",
    description: "Rotação rara: o campeão recebe uma pedra de mega evolução aleatória; as demais faixas continuam moderadas.",
    bundles: [
      { key: "first", rankFrom: 1, label: "1 Pedra de Mega Evolução aleatória", estimatedValue: 6000, randomMegaStone: true },
      { key: "second", rankFrom: 2, label: "1 Ovo Raro + 700 ZC", estimatedValue: 4100, coins: 700, eggs: [{ type: "RARE", quantity: 1 }] },
      { key: "third", rankFrom: 3, label: "1 Ovo Comum + 1 Ovo da Sorte + 400 ZC", estimatedValue: 2600, coins: 400, eggs: [{ type: "COMMON", quantity: 1 }], shopItems: [{ type: "LUCKY_EGG", quantity: 1, label: "Ovo da Sorte" }] },
      { key: "top6", rankFrom: 4, rankTo: 6, label: "1 Ovo Comum + 250 ZC", estimatedValue: 850, coins: 250, eggs: [{ type: "COMMON", quantity: 1 }] },
      { key: "participation", rankFrom: 7, rankTo: 9999, label: "Caixa de participação: 150 ZC, comida e Pó", estimatedValue: 350, coins: 150, food: 3, creationDust: 3 },
    ],
  },
  {
    id: "OVOS_ESPECIAIS",
    name: "Incubadoras da Velocidade",
    description: "Rotação com Ovos Especiais e itens que melhoram progressão, sorte e expedições.",
    bundles: [
      { key: "first", rankFrom: 1, label: "1 Ovo Especial + 1 Amuleto da Sorte + 600 ZC", estimatedValue: 6000, coins: 600, eggs: [{ type: "SPECIAL", quantity: 1 }], shopItems: [{ type: "MASCOT_BUFF_LUCK", quantity: 1, label: "Amuleto da Sorte" }] },
      { key: "second", rankFrom: 2, label: "1 Ovo Raro + 1 Ovo da Sorte + 500 ZC", estimatedValue: 4300, coins: 500, eggs: [{ type: "RARE", quantity: 1 }], shopItems: [{ type: "LUCKY_EGG", quantity: 1, label: "Ovo da Sorte" }] },
      { key: "third", rankFrom: 3, label: "1 Ovo Comum + 1 Vitamina Chocante + 500 ZC", estimatedValue: 1850, coins: 500, eggs: [{ type: "COMMON", quantity: 1 }], shopItems: [{ type: "MASCOT_BUFF_EXP", quantity: 1, label: "Vitamina Chocante" }] },
      { key: "top6", rankFrom: 4, rankTo: 6, label: "1 Vitamina Chocante + 250 ZC", estimatedValue: 1000, coins: 250, shopItems: [{ type: "MASCOT_BUFF_EXP", quantity: 1, label: "Vitamina Chocante" }] },
      { key: "participation", rankFrom: 7, rankTo: 9999, label: "Caixa de participação: 150 ZC, comidas e doce", estimatedValue: 350, coins: 150, food: 5, sweet: 1 },
    ],
  },
  {
    id: "ARCO_IRIS",
    name: "Cofres Arco-Íris",
    description: "As Penas Arco-Íris entram em rotação respeitando o nível indicado no prêmio, do Comum ao Laboratório.",
    bundles: [
      { key: "first", rankFrom: 1, label: "1 Pena Arco-Íris de Laboratório + 800 ZC", estimatedValue: 5000, coins: 800, shopItems: [{ type: "RAINBOW_FEATHER", itemName: "Pena Arco-Íris de Laboratório", quantity: 1, label: "Pena Arco-Íris de Laboratório" }] },
      { key: "second", rankFrom: 2, label: "1 Pena Arco-Íris Especial + 600 ZC", estimatedValue: 3700, coins: 600, shopItems: [{ type: "RAINBOW_FEATHER", itemName: "Pena Arco-Íris Especial", quantity: 1, label: "Pena Arco-Íris Especial" }] },
      { key: "third", rankFrom: 3, label: "1 Pena Arco-Íris de Evento + 500 ZC", estimatedValue: 2700, coins: 500, shopItems: [{ type: "RAINBOW_FEATHER", itemName: "Pena Arco-Íris de Evento", quantity: 1, label: "Pena Arco-Íris de Evento" }] },
      { key: "top6", rankFrom: 4, rankTo: 6, label: "1 Pena Arco-Íris Rara + 250 ZC", estimatedValue: 2250, coins: 250, shopItems: [{ type: "RAINBOW_FEATHER", itemName: "Pena Arco-Íris Rara", quantity: 1, label: "Pena Arco-Íris Rara" }] },
      { key: "participation", rankFrom: 7, rankTo: 9999, label: "1 Pena Arco-Íris Comum + 100 ZC", estimatedValue: 1000, coins: 100, shopItems: [{ type: "RAINBOW_FEATHER", itemName: "Pena Arco-Íris Comum", quantity: 1, label: "Pena Arco-Íris Comum" }] },
    ],
  },
  {
    id: "FORTUNA_E_EVOLUCAO",
    name: "Fortuna e Evolução",
    description: "Rotação rara com Pedra de Mega Evolução, Ovo da Sorte, Vitamina Chocante e Amuleto da Sorte.",
    bundles: [
      { key: "first", rankFrom: 1, label: "1 Pedra de Mega Evolução aleatória", estimatedValue: 6000, randomMegaStone: true },
      { key: "second", rankFrom: 2, label: "1 Ovo Especial", estimatedValue: 5000, eggs: [{ type: "SPECIAL", quantity: 1 }] },
      { key: "third", rankFrom: 3, label: "1 Ovo da Sorte + 1 Amuleto da Sorte + 300 ZC", estimatedValue: 3100, coins: 300, shopItems: [{ type: "LUCKY_EGG", quantity: 1, label: "Ovo da Sorte" }, { type: "MASCOT_BUFF_LUCK", quantity: 1, label: "Amuleto da Sorte" }] },
      { key: "top6", rankFrom: 4, rankTo: 6, label: "1 Vitamina Chocante + 250 ZC", estimatedValue: 1000, coins: 250, shopItems: [{ type: "MASCOT_BUFF_EXP", quantity: 1, label: "Vitamina Chocante" }] },
      { key: "participation", rankFrom: 7, rankTo: 9999, label: "Caixa de participação: 150 ZC e 5 comidas", estimatedValue: 300, coins: 150, food: 5 },
    ],
  },
];

export const DEFAULT_RUSH_REWARDS = RUSH_REWARD_PLANS[0].bundles;

export const RUSH_BATTLE_TIMES = ["18:00", "18:10", "18:20"] as const;
export const RUSH_REWARD_TIME = "18:30";
export const RUSH_LEVEL_OPTIONS = [30, 45, 55, 65, 75, 85, 95] as const;
export const RUSH_TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"] as const;
