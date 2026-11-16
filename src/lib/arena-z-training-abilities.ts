import { abilityPriorityIndices, evaluateTeamAbilities, resolveAbilitySlug, type AbilitySlot } from "@/lib/abilities";
import type { AbilityLineup } from "@/lib/abilities/combat";

export type TrainingAbilityMember = {
  id: string;
  pokemonId: number;
  abilityChoice?: string | null;
  hiddenAbilityUnlocked?: boolean | null;
};
export type TrainingAbilityState = { slug: string; state: AbilitySlot["state"]; factor: number; reason: string | null };

/**
 * Plano de habilidades de um time. `order` = ids por prioridade (independe do slot; sem ele vale a ordem do time). Mesmas regras do jogo real:
 * a habilidade oculta só vale se o mascote usou o TM (hiddenAbilityUnlocked).
 */
export function buildTrainingAbilityPlan(members: TrainingAbilityMember[], order?: ReadonlyArray<string> | null) {
  const slugs = members.map((m) =>
    resolveAbilitySlug({ pokemonId: m.pokemonId, choice: m.abilityChoice, hiddenUnlocked: Boolean(m.hiddenAbilityUnlocked), mode: "REAL" }),
  );
  const slots = evaluateTeamAbilities(slugs, abilityPriorityIndices(members.map((m) => m.id), order));
  const lineup: AbilityLineup = {};
  const states: Record<string, TrainingAbilityState> = {};
  members.forEach((m, i) => {
    const slug = slugs[i];
    if (!slug) return;
    states[m.id] = { slug, state: slots[i].state, factor: slots[i].factor, reason: slots[i].reason };
    if (slots[i].factor > 0) lineup[m.id] = { slug, factor: slots[i].factor };
  });
  return { lineup, states };
}
