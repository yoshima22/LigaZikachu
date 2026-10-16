export type TowerPartyProfile = "SOLO" | "GROUP";

export type TowerFormationSlot = { mascotId: string; formationSlot: number };

export function validateTowerFormation(
  profile: TowerPartyProfile,
  mascotIds: readonly string[],
): { ok: true; slots: TowerFormationSlot[] } | { ok: false; reason: string } {
  const expected = profile === "SOLO" ? 4 : 2;
  if (mascotIds.length !== expected)
    return { ok: false, reason: `Selecione exatamente ${expected} mascotes.` };
  if (mascotIds.some((id) => typeof id !== "string" || !id.trim() || id !== id.trim()))
    return { ok: false, reason: "A formação contém um mascote inválido." };
  if (new Set(mascotIds).size !== expected)
    return { ok: false, reason: "A formação não pode repetir mascotes." };
  return {
    ok: true,
    slots: mascotIds.map((mascotId, index) => ({ mascotId, formationSlot: index + 1 })),
  };
}

export function activeTowerMascots<T extends { formationSlot: number | null; currentHp: number }>(
  profile: TowerPartyProfile | null,
  mascots: readonly T[],
): T[] {
  return mascots
    .filter((mascot) => mascot.currentHp > 0 && (profile !== "SOLO" ||
      mascot.formationSlot === 1 || mascot.formationSlot === 2))
    .sort((a, b) => (a.formationSlot ?? 0) - (b.formationSlot ?? 0));
}
