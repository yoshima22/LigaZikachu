import type { WorldLocationConfig } from "../types";

export const KANTO_MVP_LOCATIONS: WorldLocationConfig[] = [
  {
    id: "pallet-town",
    name: "Pallet Town",
    shortName: "Pallet",
    region: "kanto",
    type: "TOWN",
    biome: "Costa tranquila",
    description:
      "Uma pequena cidade à beira-mar. O Laboratório do Professor Oak é o ponto de partida para registrar esta nova aventura.",
    danger: 0,
    map: { x: 20, y: 82 },
    services: ["LAB", "STORAGE"],
    activities: ["DELIVERY"],
    encounters: [],
    connections: [{ to: "route-1", minutes: 10, fatigue: 3 }],
  },
  {
    id: "route-1",
    name: "Route 1",
    shortName: "Rota 1",
    region: "kanto",
    type: "ROUTE",
    biome: "Campos e trilhas",
    description:
      "A primeira estrada de Kanto. Trilhas abertas, pequenos desníveis e treinadores começando suas próprias jornadas.",
    danger: 1,
    map: { x: 28, y: 66 },
    services: [],
    activities: ["EXPLORE", "CAPTURE", "TRAINER_BATTLE", "ITEM_SEARCH", "DELIVERY"],
    encounters: [
      { speciesId: 16, weight: 50, rarity: "COMMON", timeOfDay: "DAY" },
      { speciesId: 19, weight: 50, rarity: "COMMON", timeOfDay: "ANY" },
      { speciesId: 21, weight: 25, rarity: "UNCOMMON", timeOfDay: "DAY" },
      { speciesId: 25, weight: 3, rarity: "VERY_RARE", timeOfDay: "ANY" },
    ],
    connections: [
      { to: "pallet-town", minutes: 10, fatigue: 3 },
      { to: "viridian-city", minutes: 20, fatigue: 5 },
    ],
  },
  {
    id: "viridian-city",
    name: "Viridian City",
    shortName: "Viridian",
    region: "kanto",
    type: "CITY",
    biome: "Cidade-jardim",
    description:
      "O primeiro centro urbano da jornada. Oferece descanso, suprimentos e caminhos para o norte; seu ginásio permanece fechado.",
    danger: 0,
    map: { x: 34, y: 49 },
    services: ["CENTER", "MART", "GYM"],
    activities: ["DELIVERY"],
    encounters: [],
    connections: [
      { to: "route-1", minutes: 20, fatigue: 5 },
      { to: "route-2", minutes: 12, fatigue: 3 },
    ],
  },
  {
    id: "route-2",
    name: "Route 2",
    shortName: "Rota 2",
    region: "kanto",
    type: "ROUTE",
    biome: "Campos de floresta",
    description:
      "Uma rota estreita cercada por árvores. O caminho principal conduz à entrada da Viridian Forest.",
    danger: 1,
    map: { x: 42, y: 36 },
    services: [],
    activities: ["EXPLORE", "CAPTURE", "TRAINER_BATTLE", "ITEM_SEARCH"],
    encounters: [
      { speciesId: 19, weight: 50, rarity: "COMMON", timeOfDay: "ANY" },
      { speciesId: 16, weight: 50, rarity: "COMMON", timeOfDay: "DAY" },
      { speciesId: 10, weight: 35, rarity: "COMMON", timeOfDay: "DAY" },
      { speciesId: 13, weight: 35, rarity: "COMMON", timeOfDay: "DAY" },
      { speciesId: 29, weight: 25, rarity: "UNCOMMON", timeOfDay: "ANY" },
      { speciesId: 32, weight: 25, rarity: "UNCOMMON", timeOfDay: "ANY" },
    ],
    connections: [
      { to: "viridian-city", minutes: 12, fatigue: 3 },
      { to: "viridian-forest", minutes: 8, fatigue: 3 },
    ],
  },
  {
    id: "viridian-forest",
    name: "Viridian Forest",
    shortName: "Floresta",
    region: "kanto",
    type: "FOREST",
    biome: "Floresta labiríntica",
    description:
      "Uma floresta densa, úmida e cheia de sons. Insetos dominam as trilhas, mas encontros incomuns recompensam exploradores atentos.",
    danger: 2,
    map: { x: 54, y: 27 },
    services: [],
    activities: ["EXPLORE", "CAPTURE", "TRAINER_BATTLE", "ITEM_SEARCH"],
    encounters: [
      { speciesId: 10, weight: 50, rarity: "COMMON", timeOfDay: "DAY" },
      { speciesId: 13, weight: 50, rarity: "COMMON", timeOfDay: "DAY" },
      { speciesId: 11, weight: 35, rarity: "COMMON", timeOfDay: "DAY" },
      { speciesId: 14, weight: 35, rarity: "COMMON", timeOfDay: "DAY" },
      { speciesId: 25, weight: 25, rarity: "UNCOMMON", timeOfDay: "ANY" },
      { speciesId: 46, weight: 10, rarity: "RARE", timeOfDay: "NIGHT" },
      { speciesId: 123, weight: 3, rarity: "VERY_RARE", timeOfDay: "DAY" },
      { speciesId: 127, weight: 3, rarity: "VERY_RARE", timeOfDay: "DAY" },
    ],
    connections: [
      { to: "route-2", minutes: 8, fatigue: 3 },
      { to: "pewter-city", minutes: 25, fatigue: 8 },
    ],
  },
  {
    id: "pewter-city",
    name: "Pewter City",
    shortName: "Pewter",
    region: "kanto",
    type: "CITY",
    biome: "Cidade de pedra",
    description:
      "Construída entre montanhas e rochas antigas. O museu observa a cidade, enquanto Brock aguarda no primeiro ginásio da jornada.",
    danger: 0,
    map: { x: 70, y: 17 },
    services: ["CENTER", "MART", "GYM"],
    activities: ["DELIVERY", "TRAINER_BATTLE"],
    encounters: [],
    connections: [{ to: "viridian-forest", minutes: 25, fatigue: 8 }],
  },
];

export const KANTO_MVP_BY_ID = new Map(
  KANTO_MVP_LOCATIONS.map((location) => [location.id, location]),
);

