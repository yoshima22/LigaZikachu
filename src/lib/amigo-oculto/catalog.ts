// Catálogo curado de presentes por nível (1..4). Gratuito para quem presenteia: o nível vem dos laços da comunidade.
// payload = formato TOURNAMENT_BOX da Caixa de Presentes (a mesma entrega que os torneios usam).
export type GiftEntry = {
  key: string;
  tier: 1 | 2 | 3 | 4;
  name: string;
  emoji: string;
  payload: { coins?: number; food?: number; sweet?: number; eggs?: { type: string; quantity?: number }[]; shopItems?: { type: string; quantity?: number }[] };
};

export const GIFT_CATALOG: GiftEntry[] = [
  { key: "cesta", tier: 1, name: "Cesta de guloseimas", emoji: "🧺", payload: { food: 15, sweet: 8 } },
  { key: "moedas-1", tier: 1, name: "Sacola de moedas", emoji: "💰", payload: { coins: 150 } },
  { key: "ovo-comum", tier: 1, name: "Ovo comum", emoji: "🥚", payload: { eggs: [{ type: "COMMON", quantity: 2 }] } },
  { key: "sorte", tier: 2, name: "Pacote da sorte", emoji: "🍀", payload: { shopItems: [{ type: "MASCOT_BUFF_LUCK", quantity: 2 }, { type: "LUCKY_EGG", quantity: 1 }] } },
  { key: "ovo-raro", tier: 2, name: "Ovo raro", emoji: "🪺", payload: { eggs: [{ type: "RARE", quantity: 1 }], sweet: 5 } },
  { key: "treino", tier: 2, name: "Kit de treino", emoji: "🏋️", payload: { shopItems: [{ type: "MASCOT_BUFF_EXP", quantity: 2 }, { type: "MASCOT_BUFF_STAT", quantity: 1 }] } },
  { key: "ovo-especial", tier: 3, name: "Ovo especial", emoji: "🎁", payload: { eggs: [{ type: "SPECIAL", quantity: 1 }], coins: 200 } },
  { key: "mutacao", tier: 3, name: "Mutação genética rara", emoji: "🧬", payload: { shopItems: [{ type: "GENETIC_MUTATION_RARE", quantity: 1 }] } },
  { key: "loot", tier: 3, name: "Tíquetes Zikaloot", emoji: "🎟️", payload: { shopItems: [{ type: "ZIKALOOT_TICKET", quantity: 3 }] } },
  { key: "ovo-evento", tier: 4, name: "Ovo de evento + mutação", emoji: "🎄", payload: { eggs: [{ type: "EVENT", quantity: 1 }], shopItems: [{ type: "GENETIC_MUTATION_EVENT", quantity: 1 }] } },
  { key: "celestial", tier: 4, name: "Ovo celestial", emoji: "✨", payload: { eggs: [{ type: "CELESTIAL", quantity: 1 }] } },
];

// Mimo de constância: um agrado pequeno junto ao presente principal.
export const MIMO_PAYLOAD = { food: 5, sweet: 3 };

export const giftByKey = (key: string | null | undefined) => GIFT_CATALOG.find((g) => g.key === key);
export const giftsForLevel = (level: number) => GIFT_CATALOG.filter((g) => g.tier <= level);
// Presente padrão do nível (quando a pessoa não escolheu até o prazo): o de maior tier liberado, o primeiro da lista.
export const defaultGift = (level: number) => [...giftsForLevel(Math.max(1, level))].sort((a, b) => b.tier - a.tier)[0];
