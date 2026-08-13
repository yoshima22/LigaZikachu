// Kits da roleta de aniversário. Sem imports de servidor — pode ser usado no
// cliente (exibição) e no servidor (mapa de concessão).

export type BirthdayKit = {
  id: string;
  label: string;      // nome curto (fatia da roleta)
  emoji: string;
  color: string;      // cor da fatia
  items: string[];    // linhas legíveis do prêmio (para revelação)
  isMegaChoice?: boolean;
};

export const BIRTHDAY_KITS: BirthdayKit[] = [
  { id: "LAB_EGG_FEATHER", label: "Ovo de Lab + Pena de Lab", emoji: "🧪", color: "#a855f7",
    items: ["1 Ovo de Laboratório", "1 Pena Arco-Íris de Laboratório"] },
  { id: "SPECIAL_EGGS", label: "3 Ovos Especiais + 2 Vitaminas", emoji: "✨", color: "#f59e0b",
    items: ["3 Ovos Especiais", "2 Vitaminas Chocantes"] },
  { id: "SUPPORT_PACK", label: "Vitaminas, Amuletos, Balas e Políticas", emoji: "💊", color: "#22c55e",
    items: ["3 Vitaminas Chocantes", "2 Amuletos da Sorte", "5 Balas de Mel", "5 Políticas de Fraqueza"] },
  { id: "RARE_EGGS_PICNIC", label: "5 Ovos Raros + 2 Cestas", emoji: "🧺", color: "#3b82f6",
    items: ["5 Ovos Raros", "2 Cestas de Piquenique Chocante"] },
  { id: "FEATHERS", label: "Penas Arco-Íris variadas", emoji: "🌈", color: "#ec4899",
    items: ["2 Penas Arco-Íris Raras", "2 Penas Arco-Íris de Evento", "1 Pena Arco-Íris Especial", "1 Pena Arco-Íris de Laboratório"] },
  { id: "COINS_FOOD", label: "8.500 ZC + 50 Comidas + 50 Doces", emoji: "🪙", color: "#eab308",
    items: ["8.500 ZikaCoins", "50 Comidas de Mascote", "50 Doces de Mascote"] },
  { id: "MEGA_CHOICE", label: "Pedra de Mega à escolha", emoji: "🔮", color: "#06b6d4",
    items: ["Escolha 1 Pedra de Mega Evolução (qualquer uma do jogo)"], isMegaChoice: true },
];

export function getBirthdayKit(id: string): BirthdayKit | undefined {
  return BIRTHDAY_KITS.find((kit) => kit.id === id);
}

// Nome exato dos itens de loja usados nos kits (para concessão server-side).
export const FEATHER_NAME_BY_TIER: Record<string, string> = {
  RARE: "Pena Arco-Íris Rara",
  EVENT: "Pena Arco-Íris de Evento",
  SPECIAL: "Pena Arco-Íris Especial",
  LAB: "Pena Arco-Íris de Laboratório",
};

// Especificação de concessão de cada kit.
export type KitGrantSpec = {
  eggs?: Array<[type: "COMMON" | "RARE" | "SPECIAL" | "LAB", qty: number]>;
  shopByName?: Array<[name: string, qty: number]>;
  feathers?: Array<[tier: "RARE" | "EVENT" | "SPECIAL" | "LAB", qty: number]>;
  coins?: number;
  food?: number;
  sweet?: number;
  megaChoice?: boolean;
};

export const KIT_GRANT_SPEC: Record<string, KitGrantSpec> = {
  LAB_EGG_FEATHER: { eggs: [["LAB", 1]], feathers: [["LAB", 1]] },
  SPECIAL_EGGS: { eggs: [["SPECIAL", 3]], shopByName: [["Vitamina Chocante", 2]] },
  SUPPORT_PACK: { shopByName: [["Vitamina Chocante", 3], ["Amuleto da Sorte", 2], ["Bala de Mel", 5], ["Política de Fraqueza", 5]] },
  RARE_EGGS_PICNIC: { eggs: [["RARE", 5]], shopByName: [["Cesta de Piquenique Chocante", 2]] },
  FEATHERS: { feathers: [["RARE", 2], ["EVENT", 2], ["SPECIAL", 1], ["LAB", 1]] },
  COINS_FOOD: { coins: 8500, food: 50, sweet: 50 },
  MEGA_CHOICE: { megaChoice: true },
};
