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

export function switchSoloFormation(
  mascots: readonly { mascotId: string; currentHp: number; formationSlot: number | null }[],
  orderedIds: readonly string[],
): TowerFormationSlot[] {
  if (mascots.length !== 4 || orderedIds.length !== 4 ||
      new Set(mascots.map((mascot) => mascot.mascotId)).size !== 4 ||
      ![1, 2, 3, 4].every((slot) => mascots.some((mascot) => mascot.formationSlot === slot)))
    throw new Error("A formação solo atual está incompleta.");
  const formation = validateTowerFormation("SOLO", orderedIds);
  if (!formation.ok || formation.slots.some((slot) => !mascots.some((mascot) => mascot.mascotId === slot.mascotId)))
    throw new Error("A troca deve usar os mesmos quatro mascotes, sem repetições.");
  const requiredActive = Math.min(2, mascots.filter((mascot) => mascot.currentHp > 0).length);
  if (requiredActive === 0 || formation.slots.slice(0, requiredActive).some((slot) =>
    (mascots.find((mascot) => mascot.mascotId === slot.mascotId)?.currentHp ?? 0) <= 0))
    throw new Error("Os slots ativos disponíveis precisam ter mascotes vivos.");
  return formation.slots;
}
