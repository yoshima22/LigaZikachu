// Calendário de recompensas do Passe Apoiador (sem "use server" — apenas dados)

export type DayReward = {
  day: number;
  label: string;
  type: "COINS" | "EGG" | "FOOD" | "SWEET" | "STICKER_PACK" | "SHOP_ITEM" | "ZIKALOOT";
  coins?: number;
  eggType?: string;
  foodType?: string;
  foodQty?: number;
  packId?: string;
  packName?: string;
  shopItemName?: string;
  zikalootSpecial?: boolean;
  emoji: string;
  isMilestone?: boolean;
};

export const PASS_SCHEDULE: DayReward[] = [
  { day:  1, label: "200 ZikaCoins + Ovo Especial",                  type: "EGG",          eggType: "SPECIAL",  coins: 200,  emoji: "🥚" },
  { day:  2, label: "150 ZikaCoins",                                  type: "COINS",        coins: 150,          emoji: "🪙" },
  { day:  3, label: "400 ZikaCoins + Pacote Comum de Figurinhas",    type: "STICKER_PACK", packName: "Pacote Comum", coins: 400, emoji: "🃏" },
  { day:  4, label: "500 ZikaCoins",                                  type: "COINS",        coins: 500,          emoji: "🪙" },
  { day:  5, label: "1 Doce de Mascote + 1 Água Fresca",             type: "SWEET",        foodType: "SWEET",   foodQty: 2,  emoji: "🍬" },
  { day:  6, label: "500 ZikaCoins + Ticket ZikaLoot",               type: "ZIKALOOT",     coins: 500,          emoji: "🎟️" },
  { day:  7, label: "Pacote Deluxe + Vitamina Chocante",             type: "STICKER_PACK", packName: "Pacote Deluxe", shopItemName: "Vitamina Chocante", emoji: "🃏", isMilestone: true },
  { day:  8, label: "600 ZikaCoins + 1 Ovo Comum",                   type: "EGG",          eggType: "COMMON",   coins: 600,  foodQty: 1, emoji: "🥚" },
  { day:  9, label: "500 ZikaCoins + 3 Comidas de Mascote",          type: "FOOD",         foodType: "FOOD",    foodQty: 3,  coins: 500, emoji: "🍖" },
  { day: 10, label: "600 ZikaCoins + 1 Ovo Comum",                   type: "EGG",          eggType: "COMMON",   coins: 600,  foodQty: 1, emoji: "🥚" },
  { day: 11, label: "600 ZikaCoins",                                  type: "COINS",        coins: 600,          emoji: "🪙" },
  { day: 12, label: "Pacote Comum (geração aleatória) + Bala de Mel", type: "STICKER_PACK", packName: "Pacote Comum", foodType: "SWEET", foodQty: 1, emoji: "🃏" },
  { day: 13, label: "600 ZikaCoins + Doce de Mascote + Ticket ZikaLoot", type: "ZIKALOOT", coins: 600, foodType: "SWEET", foodQty: 1, emoji: "🎟️" },
  { day: 14, label: "700 ZikaCoins",                                  type: "COINS",        coins: 700,          emoji: "🪙", isMilestone: true },
  { day: 15, label: "1 Ovo da Sorte",                                 type: "EGG",          eggType: "SPECIAL",  foodQty: 1,  emoji: "🍀", isMilestone: true },
  { day: 16, label: "650 ZikaCoins + 1 Comida de Mascote",           type: "FOOD",         foodType: "FOOD",    foodQty: 1,  coins: 650, emoji: "🍖" },
  { day: 17, label: "Pacote Deluxe + 1 Ovo Comum",                   type: "STICKER_PACK", packName: "Pacote Deluxe", eggType: "COMMON", foodQty: 1, emoji: "🃏" },
  { day: 18, label: "650 ZikaCoins + Política de Fraqueza",          type: "SHOP_ITEM",    shopItemName: "Política de Fraqueza", coins: 650, emoji: "📋" },
  { day: 19, label: "800 ZikaCoins",                                  type: "COINS",        coins: 800,          emoji: "🪙" },
  { day: 20, label: "1 Ovo Raro",                                     type: "EGG",          eggType: "RARE",     foodQty: 1,  emoji: "🥚" },
  { day: 21, label: "700 ZikaCoins + Ticket ZikaLoot Especial",      type: "ZIKALOOT",     zikalootSpecial: true, coins: 700, emoji: "⭐", isMilestone: true },
  { day: 22, label: "1 Cesta de Piquenique Chocante",                type: "SHOP_ITEM",    shopItemName: "Cesta de Piquenique Chocante", emoji: "🧺" },
  { day: 23, label: "800 ZikaCoins + Pacote Deluxe (gen. aleatória)", type: "STICKER_PACK", packName: "Pacote Deluxe", coins: 800, emoji: "🃏" },
  { day: 24, label: "900 ZikaCoins",                                  type: "COINS",        coins: 900,          emoji: "🪙" },
  { day: 25, label: "1 Ticket de Férias",                            type: "SHOP_ITEM",    shopItemName: "Ticket de Férias", emoji: "🏖️" },
  { day: 26, label: "700 ZikaCoins + 1 Ovo Raro",                    type: "EGG",          eggType: "RARE",     coins: 700,  foodQty: 1, emoji: "🥚" },
  { day: 27, label: "1.000 ZikaCoins + Amuleto da Sorte",            type: "SHOP_ITEM",    shopItemName: "Amuleto da Sorte", coins: 1000, emoji: "🔮" },
  { day: 28, label: "Item Forte Rotativo do Ciclo",                  type: "SHOP_ITEM",    shopItemName: "[Rotativo]", emoji: "🎁", isMilestone: true },
  { day: 29, label: "1.200 ZikaCoins",                               type: "COINS",        coins: 1200,         emoji: "🪙" },
  { day: 30, label: "1.000 ZikaCoins + Recompensa Premium Rotativa", type: "SHOP_ITEM",    shopItemName: "[Rotativo Premium]", coins: 1000, emoji: "🌟", isMilestone: true },
];
