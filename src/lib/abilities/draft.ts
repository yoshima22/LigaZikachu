// Habilidades no Arena Draft: escolha por mascote, validação e plano ligado/reduzido/desligado.
import type { ArenaDraftPet, DraftMode } from "@/lib/arena-draft";
import { availableAbilities, evaluateTeamAbilities, getAbilityInfo, getSpeciesAbilities, type AbilitySlot } from "./index";
import type { AbilityLineup } from "./combat";

/** Habilidades que o time salvo pode escolher: no modo Customizado a oculta é livre. */
export function draftAbilityOptions(speciesId: number, mode: DraftMode, hiddenUnlocked = false): string[] {
  return availableAbilities(speciesId, mode === "CUSTOM" ? true : hiddenUnlocked, mode === "CUSTOM" ? "CUSTOM" : "REAL");
}

/** Habilidade em uso por um mascote do time (a escolhida se a espécie a tem, senão a padrão). */
export function draftAbilitySlug(pet: Pick<ArenaDraftPet, "speciesId" | "ability">, mode: DraftMode): string | null {
  const sp = getSpeciesAbilities(pet.speciesId);
  const all = [...sp.normal, ...(sp.hidden ? [sp.hidden] : [])];
  if (pet.ability && all.includes(pet.ability)) return pet.ability;
  // Padrão: a primeira com efeito entre as disponíveis (no Customizado a oculta entra na lista).
  const options = draftAbilityOptions(pet.speciesId, mode, false);
  return options.find((slug) => getAbilityInfo(slug)?.hasEffect) ?? options[0] ?? null;
}

/** Erro de validação se alguma habilidade escolhida não está disponível. */
export function validateDraftAbilities(pets: Array<Pick<ArenaDraftPet, "speciesId" | "ability">>, mode: DraftMode, hiddenUnlockedBySlot?: boolean[]): string | null {
  for (const [i, pet] of pets.entries()) {
    if (!pet.ability) continue;
    if (!draftAbilityOptions(pet.speciesId, mode, hiddenUnlockedBySlot?.[i] ?? false).includes(pet.ability)) {
      return `A habilidade escolhida não está disponível para um dos mascotes${mode === "REAL" ? " (a oculta exige o TM)" : ""}.`;
    }
  }
  return null;
}

export type DraftAbilityState = { slug: string; state: AbilitySlot["state"]; factor: number; reason: string | null };

/** Plano do time em campo: a ordem de `activeIds` define os slots. */
export function buildDraftAbilityPlan(
  pets: Array<Pick<ArenaDraftPet, "id" | "speciesId" | "ability">>,
  activeIds: string[],
  mode: DraftMode,
): { lineup: AbilityLineup; states: Record<string, DraftAbilityState> } {
  const byId = new Map(pets.map((pet) => [pet.id, pet]));
  const ordered = activeIds.map((id) => byId.get(id)).filter((pet): pet is NonNullable<typeof pet> => Boolean(pet));
  const slugs = ordered.map((pet) => draftAbilitySlug(pet, mode));
  const slots = evaluateTeamAbilities(slugs);
  const lineup: AbilityLineup = {};
  const states: Record<string, DraftAbilityState> = {};
  ordered.forEach((pet, index) => {
    const slug = slugs[index];
    if (!slug) return;
    states[pet.id] = { slug, state: slots[index].state, factor: slots[index].factor, reason: slots[index].reason };
    if (slots[index].factor > 0) lineup[pet.id] = { slug, factor: slots[index].factor };
  });
  return { lineup, states };
}
