export type FusionOrigin = "COMMON" | "RARE" | "EVENT" | "SPECIAL" | "LAB";
export type GeneticMutationType =
  | "GENETIC_MUTATION_RARE"
  | "GENETIC_MUTATION_EVENT"
  | "GENETIC_MUTATION_SPECIAL"
  | "GENETIC_MUTATION_LAB";

export type OriginFusionRecipe = {
  sourceOrigin: Exclude<FusionOrigin, "LAB">;
  resultOrigin: FusionOrigin;
  mutationType: GeneticMutationType;
  mutationCost: number;
};

const RECIPES: Record<Exclude<FusionOrigin, "LAB">, OriginFusionRecipe> = {
  COMMON: { sourceOrigin: "COMMON", resultOrigin: "RARE", mutationType: "GENETIC_MUTATION_RARE", mutationCost: 50 },
  RARE: { sourceOrigin: "RARE", resultOrigin: "EVENT", mutationType: "GENETIC_MUTATION_EVENT", mutationCost: 100 },
  EVENT: { sourceOrigin: "EVENT", resultOrigin: "SPECIAL", mutationType: "GENETIC_MUTATION_SPECIAL", mutationCost: 150 },
  SPECIAL: { sourceOrigin: "SPECIAL", resultOrigin: "LAB", mutationType: "GENETIC_MUTATION_LAB", mutationCost: 200 },
};

export function getOriginFusionRecipe(origin: string | null | undefined): OriginFusionRecipe | null {
  return origin && origin in RECIPES ? RECIPES[origin as Exclude<FusionOrigin, "LAB">] : null;
}

export function validateLabStarFusion(input: {
  survivorOrigin: string | null | undefined;
  survivorLevel: number;
  survivorStars: number;
  consumedOrigin: string | null | undefined;
  consumedLevel: number;
  consumedStars: number;
}): number {
  if (input.survivorOrigin !== "LAB" || input.consumedOrigin !== "LAB") throw new Error("Os dois mascotes precisam ser de origem Laboratório.");
  if (input.survivorLevel !== 100 || input.consumedLevel !== 100) throw new Error("Os dois mascotes precisam estar no nível 100.");
  const stars = Math.max(1, input.survivorStars);
  if (stars >= 5) throw new Error("Este mascote já possui 5 estrelas.");
  if (stars !== Math.max(1, input.consumedStars)) throw new Error("Os dois mascotes precisam ter a mesma quantidade de estrelas.");
  return stars + 1;
}

export const LAB_MUTATION_CATALOG = Object.fromEntries(
  Object.values(RECIPES).map((recipe) => [recipe.resultOrigin, { cost: recipe.mutationCost, itemType: recipe.mutationType }]),
) as Record<"RARE" | "EVENT" | "SPECIAL" | "LAB", { cost: number; itemType: GeneticMutationType }>;
