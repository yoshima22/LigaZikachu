// Limites de nível do World Mode por área. O nível da coleção principal nunca
// atravessa esta fronteira: ele serve apenas como licença/referência visual.
export const WORLD_LOCATION_LEVEL_CAP: Record<string, number> = {
  "pallet-town": 5,
  "route-1": 6,
  "viridian-city": 8,
  "route-2": 10,
  "viridian-forest": 12,
  "route-mtpath": 14,
  "pewter-city": 15,
};

export function worldLevelCap(locationId: string) {
  return WORLD_LOCATION_LEVEL_CAP[locationId] ?? 15;
}
