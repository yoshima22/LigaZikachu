import type { WorldMartItem } from "../types";

// Valores do protótipo ficam isolados do componente para facilitar balanceamento.
export const KANTO_MVP_MART: WorldMartItem[] = [
  { id: "pokeBalls", name: "Poké Ball", description: "Permite uma tentativa de captura no World Mode.", price: 25 },
  { id: "potions", name: "Potion", description: "Suprimento para recuperar mascotes durante expedições futuras.", price: 40 },
  { id: "antidotes", name: "Antidote", description: "Remove envenenamento durante explorações futuras.", price: 20 },
];

export const KANTO_MVP_MART_BY_ID = new Map(KANTO_MVP_MART.map((item) => [item.id, item]));
