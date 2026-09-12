export type WorldLocationType =
  | "CITY"
  | "TOWN"
  | "ROUTE"
  | "FOREST"
  | "CAVE"
  | "SPECIAL_AREA";

export type WorldService = "CENTER" | "MART" | "GYM" | "LAB" | "STORAGE";
export type WorldActivity =
  | "EXPLORE"
  | "CAPTURE"
  | "TRAINER_BATTLE"
  | "ITEM_SEARCH"
  | "DELIVERY";

export type WorldEncounterRarity =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "VERY_RARE"
  | "SPECIAL";

export type WorldEncounterConfig = {
  speciesId: number;
  weight: number;
  rarity: WorldEncounterRarity;
  timeOfDay?: "DAY" | "NIGHT" | "ANY";
  weather?: string;
  minimumBadges?: number;
  maximumBadges?: number;
  eventRequirement?: string;
};

export type WorldConnectionConfig = {
  to: string;
  minutes: number;
  fatigue: number;
  requirement?: { item?: string; badges?: number; flag?: string };
};

export type WorldLocationConfig = {
  id: string;
  name: string;
  shortName: string;
  region: "kanto";
  type: WorldLocationType;
  biome: string;
  description: string;
  danger: number;
  map: { x: number; y: number };
  imageUrl?: string;
  services: WorldService[];
  activities: WorldActivity[];
  encounters: WorldEncounterConfig[];
  connections: WorldConnectionConfig[];
  locked?: boolean;
};

export type WorldMartItem = {
  id: "pokeBalls" | "potions" | "antidotes";
  name: string;
  description: string;
  price: number;
};
