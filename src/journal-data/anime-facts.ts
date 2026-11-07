/**
 * Curiosidades de anime, filmes e jogos por Pokémon (id nacional), uma geração por arquivo em ./facts.
 * Regra: só entra fato confirmado. Expanda por geração; os dados da Pokédex (evolução, medidas...) vêm do script.
 */
import { GEN1_FACTS } from "./facts/gen1";
import { GEN2_FACTS } from "./facts/gen2";
import { GEN3_FACTS } from "./facts/gen3";
import { GEN4_FACTS } from "./facts/gen4";
import { GEN5_FACTS } from "./facts/gen5";
import { GEN6_FACTS } from "./facts/gen6";
import { GEN7_FACTS } from "./facts/gen7";
import { GEN8_FACTS } from "./facts/gen8";
import { GEN9_FACTS } from "./facts/gen9";

export const ANIME_FACTS: Record<number, string[]> = {
  ...GEN1_FACTS, ...GEN2_FACTS, ...GEN3_FACTS, ...GEN4_FACTS, ...GEN5_FACTS,
  ...GEN6_FACTS, ...GEN7_FACTS, ...GEN8_FACTS, ...GEN9_FACTS
};
