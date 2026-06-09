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
  { day:  1, label: "200 ZikaCoins + Ovo Especial",       type: "EGG",          eggType: "SPECIAL",  coins: 200, emoji: "🥚" },
  { day:  2, label: "150 ZikaCoins",                       type: "COINS",        coins: 150,          emoji: "🪙" },
  { day:  3, label: "Pacote Comum + 150 ZikaCoins",        type: "STICKER_PACK", packName: "Pacote Comum", coins: 150, emoji: "🃏" },
  { day:  4, label: "250 ZikaCoins",                       type: "COINS",        coins: 250,          emoji: "🪙" },
  { day:  5, label: "Doce de Mascote (Água Fresca)",       type: "SWEET",        foodType: "SWEET",   foodQty: 1, emoji: "🍬" },
  { day:  6, label: "150 ZikaCoins + Ticket ZikaLoot",    type: "ZIKALOOT",     coins: 150,          emoji: "🎟️" },
  { day:  7, label: "Pacote Deluxe + Vitamina Chocante",  type: "STICKER_PACK", packName: "Pacote Deluxe", foodType: "SWEET", foodQty: 1, emoji: "🃏", isMilestone: true },
  { day:  8, label: "250 ZikaCoins",                       type: "COINS",        coins: 250,          emoji: "🪙" },
  { day:  9, label: "3 Comidas de Mascote",                type: "FOOD",         foodType: "FOOD",    foodQty: 3, emoji: "🍖" },
  { day: 10, label: "1 Ovo Comum",                         type: "EGG",          eggType: "COMMON",   emoji: "🥚" },
  { day: 11, label: "200 ZikaCoins",                       type: "COINS",        coins: 200,          emoji: "🪙" },
  { day: 12, label: "Pacote Comum Gen. Aleatória + Bala",  type: "STICKER_PACK", packName: "Pacote Comum", foodType: "SWEET", foodQty: 1, emoji: "🃏" },
  { day: 13, label: "Doce de Mascote + Ticket ZikaLoot",  type: "ZIKALOOT",     foodType: "SWEET",   foodQty: 1, emoji: "🎟️" },
  { day: 14, label: "300 ZikaCoins",                       type: "COINS",        coins: 300,          emoji: "🪙", isMilestone: true },
  { day: 15, label: "Ovo da Sorte",                        type: "EGG",          eggType: "SPECIAL",  emoji: "🍀", isMilestone: true },
  { day: 16, label: "250 ZikaCoins + Comida de Mascote",  type: "FOOD",         coins: 250, foodType: "FOOD", foodQty: 1, emoji: "🍖" },
  { day: 17, label: "Pacote Deluxe",                       type: "STICKER_PACK", packName: "Pacote Deluxe", emoji: "🃏" },
  { day: 18, label: "Política de Fraqueza",                type: "SHOP_ITEM",    shopItemName: "Política de Fraqueza", emoji: "📋" },
  { day: 19, label: "300 ZikaCoins",                       type: "COINS",        coins: 300,          emoji: "🪙" },
  { day: 20, label: "1 Ovo Raro",                          type: "EGG",          eggType: "RARE",     emoji: "🥚" },
  { day: 21, label: "Ticket ZikaLoot Especial",            type: "ZIKALOOT",     zikalootSpecial: true, emoji: "⭐", isMilestone: true },
  { day: 22, label: "Cesta de Piquenique Chocante",        type: "SHOP_ITEM",    shopItemName: "Cesta de Piquenique Chocante", emoji: "🧺" },
  { day: 23, label: "Pacote Deluxe Gen. Aleatória",        type: "STICKER_PACK", packName: "Pacote Deluxe", emoji: "🃏" },
  { day: 24, label: "350 ZikaCoins",                       type: "COINS",        coins: 350,          emoji: "🪙" },
  { day: 25, label: "Ticket de Férias",                    type: "SHOP_ITEM",    shopItemName: "Ticket de Férias", emoji: "🏖️" },
  { day: 26, label: "3 Ovos Raros",                        type: "EGG",          eggType: "RARE",     foodQty: 3, emoji: "🥚" },
  { day: 27, label: "400 ZikaCoins",                       type: "COINS",        coins: 400,          emoji: "🪙" },
  { day: 28, label: "Compartilhador de XP",                type: "SHOP_ITEM",    shopItemName: "Compartilhador de XP", emoji: "⚡", isMilestone: true },
  { day: 29, label: "500 ZikaCoins",                       type: "COINS",        coins: 500,          emoji: "🪙" },
  { day: 30, label: "Pena Arco-Íris + Pacote Especial",   type: "STICKER_PACK", packName: "Pacote Especial", shopItemName: "Pena Arco-Íris", emoji: "🌈", isMilestone: true },
];
