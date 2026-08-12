export const RUSH_RULE_PRESETS = [
  { id: "RUSH_45", name: "Rush Nv.45", description: "Equipes de 3 e nível máximo 45.", maxLevel: 45, teamSize: 3, uniqueSpecies: false },
  { id: "MONOTYPE", name: "Monotipo", description: "Todos os mascotes usados precisam possuir o tipo escolhido.", maxLevel: 45, teamSize: 3, uniqueSpecies: false },
  { id: "NO_REPEAT", name: "Sem Repetição", description: "A mesma espécie só pode lutar uma vez durante toda a semana.", maxLevel: 45, teamSize: 3, uniqueSpecies: true },
  { id: "SPRINT_30", name: "Sprint Nv.30", description: "Formato rápido para mascotes até o nível 30.", maxLevel: 30, teamSize: 3, uniqueSpecies: true },
  { id: "DUO_RUSH", name: "Dupla Relâmpago", description: "Equipes de 2; confrontos ainda mais curtos.", maxLevel: 45, teamSize: 2, uniqueSpecies: true },
] as const;

export const DEFAULT_RUSH_REWARDS = [
  { rank: 1, coins: 10000, item: "RANDOM_MEGA_STONE_OR_ZC", label: "10.000 ZC ou 1 Pedra de Mega Evolução aleatória" },
  { rank: 2, coins: 6000, label: "6.000 ZC" },
  { rank: 3, coins: 3500, label: "3.500 ZC" },
  { rank: 4, coins: 2000, label: "2.000 ZC" },
  { rank: 5, coins: 1000, label: "1.000 ZC" },
  { rank: 6, coins: 500, label: "500 ZC" },
] as const;
