import assert from "node:assert/strict";
import test from "node:test";
import { getOriginFusionRecipe, validateLabStarFusion } from "./lab-rarity-machine";

test("maps each origin fusion to its next origin and mutation", () => {
  assert.deepEqual(getOriginFusionRecipe("COMMON"), { sourceOrigin: "COMMON", resultOrigin: "RARE", mutationType: "GENETIC_MUTATION_RARE", mutationCost: 50 });
  assert.deepEqual(getOriginFusionRecipe("RARE"), { sourceOrigin: "RARE", resultOrigin: "EVENT", mutationType: "GENETIC_MUTATION_EVENT", mutationCost: 100 });
  assert.deepEqual(getOriginFusionRecipe("EVENT"), { sourceOrigin: "EVENT", resultOrigin: "SPECIAL", mutationType: "GENETIC_MUTATION_SPECIAL", mutationCost: 150 });
  assert.deepEqual(getOriginFusionRecipe("SPECIAL"), { sourceOrigin: "SPECIAL", resultOrigin: "LAB", mutationType: "GENETIC_MUTATION_LAB", mutationCost: 200 });
  assert.equal(getOriginFusionRecipe("LAB"), null);
});

test("upgrades equal level 100 Lab stars and rejects invalid pairs", () => {
  assert.equal(validateLabStarFusion({ survivorOrigin: "LAB", survivorLevel: 100, survivorStars: 2, consumedOrigin: "LAB", consumedLevel: 100, consumedStars: 2 }), 3);
  assert.throws(() => validateLabStarFusion({ survivorOrigin: "LAB", survivorLevel: 99, survivorStars: 1, consumedOrigin: "LAB", consumedLevel: 100, consumedStars: 1 }), /nível 100/i);
  assert.throws(() => validateLabStarFusion({ survivorOrigin: "LAB", survivorLevel: 100, survivorStars: 5, consumedOrigin: "LAB", consumedLevel: 100, consumedStars: 5 }), /5 estrelas/i);
});
