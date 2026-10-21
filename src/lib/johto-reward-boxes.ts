/** Preview catalog. No inventory, wallet, tournament state or persistence is touched here. */
export type JohtoBoxTier = "remembrance" | "common" | "rare" | "special";
export type JohtoRewardKind = "coins" | "food" | "sweet" | "ticket" | "protein" | "feather" | "egg" | "cosmetic";
export type JohtoReward = { id: string; label: string; kind: JohtoRewardKind; quantity: number; boostPercent?: number };
type Drop = Omit<JohtoReward, "quantity"> & { min: number; max: number; chance: number };
type Box = { name: string; subtitle: string; color: string; items: Drop[] };

function drop(id: string, label: string, kind: JohtoRewardKind, min: number, max: number, chance: number, boostPercent?: number): Drop {
  return { id, label, kind, min, max, chance, ...(boostPercent === undefined ? {} : { boostPercent }) };
}

// Source: user's edited Caixas-Johto.xlsx, 21/10/2026. Chances are independent.
export const JOHTO_BOXES: Record<JohtoBoxTier, Box> = {
  remembrance: { name: "Lembrança de Johto", subtitle: "Uma jornada para guardar", color: "#52d5c0", items: [
    drop("coins", "ZikaCoins", "coins", 1000, 1000, 1),
    drop("food", "Comida de Mascote", "food", 200, 200, 1),
    drop("sweet", "Doce de Mascote", "sweet", 150, 150, 1),
    drop("loot", "Ticket Zika Loot", "ticket", 0, 0, 0),
    drop("event-egg", "Ovo de Evento", "egg", 3, 3, 1, 10),
    drop("lab-egg", "Ovo de Laboratório", "egg", 1, 1, 0.01, 65),
  ] },
  common: { name: "Caixa Johto Comum", subtitle: "O começo de novas possibilidades", color: "#7caaff", items: [
    drop("coins", "ZikaCoins", "coins", 2000, 2000, 0.8),
    drop("food", "Comida de Mascote", "food", 50, 50, 1),
    drop("sweet", "Doce de Mascote", "sweet", 100, 100, 1),
    drop("loot", "Ticket Zika Loot", "ticket", 2, 2, 0.95),
    drop("protein", "Proteína Zika", "protein", 3, 4, 0.6),
    drop("rare-feather", "Pena de reset Rara", "feather", 1, 3, 0.5),
    drop("special-feather", "Pena de reset Especial", "feather", 1, 2, 0.85),
    drop("lab-feather", "Pena de reset de Laboratório", "feather", 1, 1, 0.45),
    drop("special-egg", "Ovo Especial", "egg", 1, 2, 0.6, 15),
    drop("lab-egg", "Ovo de Laboratório", "egg", 1, 1, 0.15, 6),
    drop("vacation", "Ticket de Férias", "ticket", 2, 3, 0.8),
  ] },
  rare: { name: "Caixa Johto Rara", subtitle: "Seu esforço abre novos caminhos", color: "#c191ff", items: [
    drop("coins", "ZikaCoins", "coins", 3500, 3500, 0.9),
    drop("food", "Comida de Mascote", "food", 100, 100, 1),
    drop("sweet", "Doce de Mascote", "sweet", 200, 200, 1),
    drop("loot", "Ticket Zika Loot", "ticket", 5, 10, 1),
    drop("protein", "Proteína Zika", "protein", 5, 6, 0.65),
    drop("rare-feather", "Pena de reset Rara", "feather", 2, 4, 0.55),
    drop("special-feather", "Pena de reset Especial", "feather", 3, 4, 0.9),
    drop("lab-feather", "Pena de reset de Laboratório", "feather", 2, 4, 0.5),
    drop("special-egg", "Ovo Especial", "egg", 2, 4, 0.65, 15),
    drop("lab-egg", "Ovo de Laboratório", "egg", 1, 3, 0.2, 10),
    drop("vacation", "Ticket de Férias", "ticket", 4, 5, 0.7),
  ] },
  special: { name: "Caixa Johto Especial", subtitle: "Uma conquista à altura da sua história", color: "#ffd273", items: [
    drop("coins", "ZikaCoins", "coins", 5000, 5000, 1),
    drop("food", "Comida de Mascote", "food", 200, 200, 1),
    drop("sweet", "Doce de Mascote", "sweet", 400, 400, 1),
    drop("loot", "Ticket Zika Loot", "ticket", 7, 12, 1),
    drop("protein", "Proteína Zika", "protein", 7, 9, 0.8),
    drop("rare-feather", "Pena de reset Rara", "feather", 5, 7, 1),
    drop("special-feather", "Pena de reset Especial", "feather", 3, 4, 0.95),
    drop("lab-feather", "Pena de reset de Laboratório", "feather", 2, 4, 0.6),
    drop("special-egg", "Ovo Especial", "egg", 2, 4, 0.7, 25),
    drop("lab-egg", "Ovo de Laboratório", "egg", 1, 3, 0.3, 20),
    drop("vacation", "Ticket de Férias", "ticket", 4, 5, 0.85),
  ] },
};

/** All inclusive integer quantities are equally likely, after that item's independent drop roll. */
export function rollJohtoBox(tier: JohtoBoxTier, { random = Math.random, guaranteeAll = false }: { random?: () => number; guaranteeAll?: boolean } = {}): JohtoReward[] {
  return JOHTO_BOXES[tier].items.flatMap(({ min, max, chance, ...reward }) => {
    if (chance <= 0 || max <= 0) return [];
    if (!guaranteeAll && random() >= chance) return [];
    const quantity = min === max ? min : min + Math.floor(random() * (max - min + 1));
    return [{ ...reward, quantity }];
  });
}

export type JohtoPlacement = "title-first" | "title-second" | "title-third" | "title-fourth" | "cup-first" | "cup-second" | "cup-semi" | "cup-first-round";
export const JOHTO_PLACEMENTS: { id: JohtoPlacement; label: string; message: string }[] = [
  { id: "title-first", label: "Campeão da Liga", message: "O topo de Johto tem o seu nome. Parabéns, campeão!" },
  { id: "title-second", label: "Vice-campeão da Liga", message: "Uma campanha de finalista. Você fez história em Johto!" },
  { id: "title-third", label: "3º lugar da Liga", message: "Seu lugar no pódio foi conquistado partida a partida!" },
  { id: "title-fourth", label: "4º lugar da Liga", message: "Entre os quatro melhores. Uma jornada para celebrar!" },
  { id: "cup-first", label: "Campeão da Copa Johto", message: "A Copa é sua! Parabéns por essa grande conquista!" },
  { id: "cup-second", label: "Vice-campeão da Copa", message: "Você chegou à final e deixou sua marca em Johto!" },
  { id: "cup-semi", label: "Semifinalista da Copa", message: "Uma campanha que merece aplausos. Parabéns pela semifinal!" },
  { id: "cup-first-round", label: "Primeira fase da Copa", message: "Cada partida fez parte dessa história. Obrigado por jogar em Johto!" },
];

function reward(id: string, label: string, kind: JohtoRewardKind, quantity = 1, boostPercent?: number): JohtoReward {
  return { id, label, kind, quantity, ...(boostPercent === undefined ? {} : { boostPercent }) };
}

export function getJohtoPrize(placement: JohtoPlacement): { boxes: JohtoBoxTier[]; items: JohtoReward[]; cosmeticsPending: boolean } {
  const egg = (quantity: number, boost: number) => reward("special-egg", "Ovo Especial", "egg", quantity, boost);
  const lab = (quantity: number, boost?: number) => reward("lab-egg", "Ovo de Laboratório", "egg", quantity, boost);
  const coins = (quantity: number) => reward("coins", "ZikaCoins", "coins", quantity);
  const feather = reward("special-feather", "Pena de reset Especial", "feather");
  const prizes: Record<JohtoPlacement, { boxes: JohtoBoxTier[]; items: JohtoReward[] }> = {
    "title-first": { boxes: ["special"], items: [lab(3), egg(2, 25), coins(3000)] },
    "title-second": { boxes: ["rare", "rare"], items: [lab(2), egg(2, 15), coins(2000)] },
    "title-third": { boxes: ["rare"], items: [lab(1), egg(2, 15), coins(1500)] },
    "title-fourth": { boxes: ["common"], items: [lab(1), egg(1, 15), coins(1000)] },
    "cup-first": { boxes: ["rare"], items: [lab(1, 5), reward("protein", "Proteína Zika", "protein"), reward("lab-feather", "Pena de reset de Laboratório", "feather")] },
    "cup-second": { boxes: ["common", "common"], items: [egg(2, 15), feather] },
    "cup-semi": { boxes: ["common"], items: [egg(1, 15), feather] },
    "cup-first-round": { boxes: ["remembrance"], items: [reward("event-egg", "Ovo de Evento", "egg", 2, 10), reward("vacation", "Ticket de Férias", "ticket", 3)] },
  };
  const prize = prizes[placement];
  return { boxes: ["remembrance", ...prize.boxes], items: prize.items, cosmeticsPending: placement.startsWith("title-") };
}
