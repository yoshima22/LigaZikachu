import { evaluateTeamAbilities, resolveAbilitySlug } from "@/lib/abilities";
import type { AbilityLineup } from "@/lib/abilities/combat";

/** Habilidade escolhida pelo mascote (ou a padrão); a oculta é livre para facilitar testes. Ordem dos slots = ordem do time. */
export function buildTrainingAbilityLineup(
  members: Array<{ id: string; pokemonId: number; abilityChoice?: string | null }>,
): AbilityLineup {
  const slugs = members.map((m) =>
    resolveAbilitySlug({ pokemonId: m.pokemonId, choice: m.abilityChoice, hiddenUnlocked: true, mode: "CUSTOM" }),
  );
  const slots = evaluateTeamAbilities(slugs);
  const lineup: AbilityLineup = {};
  members.forEach((m, i) => {
    const slug = slugs[i];
    if (slug && slots[i].factor > 0) lineup[m.id] = { slug, factor: slots[i].factor };
  });
  return lineup;
}
