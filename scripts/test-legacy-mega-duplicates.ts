/** Regressão: uma Mega já cadastrada antes do painel não pode ser recriada como custom. */
import assert from "node:assert/strict";
import { EXTRA_MEGA_STONES } from "../src/lib/extra-mega-stones";
import { MEGA_STONES_OFFICIAL } from "../src/lib/mega-evolution";

const canonicalMegaName = (name: string) => name
  .toLowerCase()
  .replace(/^mega\s+/, "")
  .replace(/-mega$/, "")
  .replace(/\s+/g, " ")
  .trim();

const officialKeys = new Set(MEGA_STONES_OFFICIAL.map((stone) => `${stone.compatiblePokemonId}:${canonicalMegaName(stone.megaPokemonName)}`));
const duplicates = EXTRA_MEGA_STONES
  .filter((stone) => officialKeys.has(`${stone.compatiblePokemonId}:${canonicalMegaName(stone.megaPokemonName)}`))
  .map((stone) => stone.megaPokemonName);

assert.deepEqual(duplicates, [], `Megas custom duplicadas: ${duplicates.join(", ")}`);
console.log("ok");
