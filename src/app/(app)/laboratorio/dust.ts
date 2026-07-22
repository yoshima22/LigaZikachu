export type LabDustRarity = "COMMON" | "RARE" | "SPECIAL";

export function getLabDustBase(rarity: LabDustRarity): number {
  return rarity === "SPECIAL" ? 3 : rarity === "RARE" ? 2 : 1;
}

export function getLabDustMultiplier(selectedCopies: number): number {
  return selectedCopies >= 3 ? 3 : selectedCopies === 2 ? 1.5 : 1;
}

export function calculateLabDust(rarity: LabDustRarity, selectedCopies: number): number {
  return Math.ceil(getLabDustBase(rarity) * getLabDustMultiplier(selectedCopies));
}
