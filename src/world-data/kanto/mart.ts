import type { WorldMartItem } from "../types";

// Valores do protótipo ficam isolados do componente para facilitar balanceamento.
export const KANTO_MVP_MART: WorldMartItem[] = [
  { id: "pokeBalls", name: "Poké Ball", description: "Permite uma tentativa de captura no World Mode.", price: 25, ligaCashPrice: 3 },
  { id: "potions", name: "Potion", description: "Recupera 60 HP durante a expedição.", price: 40, ligaCashPrice: 4 },
  { id: "megaPotions", name: "Mega Potion", description: "Recupera 180 HP durante a expedição.", price: 100, ligaCashPrice: 10 },
  { id: "antidotes", name: "Antídoto", description: "Remove envenenamento durante explorações.", price: 20, ligaCashPrice: 2 },
];

export const KANTO_MVP_MART_BY_ID = new Map(KANTO_MVP_MART.map((item) => [item.id, item]));
