// Tabelas de busca de itens (ITEM_SEARCH) por área. Valores provisórios do
// protótipo, centralizados aqui. "zc" concede ZikaCoins; os demais entram no
// inventário da aventura.

export type WorldItemDrop = {
  itemId: "pokeBalls" | "potions" | "antidotes" | "zc";
  label: string;
  weight: number;
  min: number;
  max: number;
};

const DEFAULT_TABLE: WorldItemDrop[] = [
  { itemId: "pokeBalls", label: "Poké Ball", weight: 34, min: 1, max: 1 },
  { itemId: "potions", label: "Potion", weight: 26, min: 1, max: 1 },
  { itemId: "antidotes", label: "Antídoto", weight: 16, min: 1, max: 1 },
  { itemId: "zc", label: "ZikaCoins", weight: 24, min: 5, max: 18 },
];

// Ajustes por área quando fizer sentido; senão usa a tabela padrão.
const TABLES: Record<string, WorldItemDrop[]> = {
  "route-1": [
    { itemId: "pokeBalls", label: "Poké Ball", weight: 40, min: 1, max: 1 },
    { itemId: "potions", label: "Potion", weight: 24, min: 1, max: 1 },
    { itemId: "antidotes", label: "Antídoto", weight: 12, min: 1, max: 1 },
    { itemId: "zc", label: "ZikaCoins", weight: 24, min: 4, max: 12 },
  ],
  "viridian-forest": [
    { itemId: "antidotes", label: "Antídoto", weight: 30, min: 1, max: 2 },
    { itemId: "potions", label: "Potion", weight: 28, min: 1, max: 1 },
    { itemId: "pokeBalls", label: "Poké Ball", weight: 26, min: 1, max: 1 },
    { itemId: "zc", label: "ZikaCoins", weight: 16, min: 5, max: 15 },
  ],
  "route-mtpath": [
    { itemId: "potions", label: "Potion", weight: 30, min: 1, max: 2 },
    { itemId: "pokeBalls", label: "Poké Ball", weight: 26, min: 1, max: 1 },
    { itemId: "zc", label: "ZikaCoins", weight: 28, min: 8, max: 22 },
    { itemId: "antidotes", label: "Antídoto", weight: 16, min: 1, max: 1 },
  ],
};

export function worldItemTable(locationId: string): WorldItemDrop[] {
  return TABLES[locationId] ?? DEFAULT_TABLE;
}
