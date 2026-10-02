import assert from "node:assert/strict";
import { updateAchievementSchema } from "../src/app/(app)/conquistas/achievement-validation";

const validEdit = {
  name: "Sem Retorno",
  description: "Descrição atualizada.",
  iconUrl: "",
  type: "MANUAL",
  rarity: "COMMON",
  category: "TOURNAMENT",
  scope: "TOURNAMENT",
  isSecret: false,
  isRepeatable: false,
  suggestedPoints: 2,
  seasonId: "season-1",
};

assert.deepEqual(
  updateAchievementSchema.parse(validEdit),
  validEdit,
  "Editar uma conquista existente não deve exigir nem revalidar a chave legada.",
);

console.log("achievement validation: ok");
