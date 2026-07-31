import { EVOLUTIONS, getPokemonName, getStaticSpriteUrl } from "@/lib/mascot-data";
import { validateMascotMissionDeckList } from "@/lib/tcg-mascot-mission-validation";

export type MascotMissionOption = {
  id: string;
  pokemonId: number;
  nickname: string | null;
  speciesName: string;
  displayName: string;
  level: number;
  spriteUrl: string;
  acceptedCardNames: string[];
};

function regionalCardAliases(name: string) {
  const aliases = [name];
  const regionalSuffixes: Array<[RegExp, string]> = [
    [/-Alola$/i, "Alolan"],
    [/-Galar$/i, "Galarian"],
    [/-Hisui$/i, "Hisuian"],
    [/-Paldea$/i, "Paldean"],
  ];
  for (const [suffix, prefix] of regionalSuffixes) {
    if (suffix.test(name)) aliases.push(`${prefix} ${name.replace(suffix, "")}`);
  }
  return aliases;
}

export function getMascotEvolutionFamilyIds(pokemonId: number) {
  const adjacency = new Map<number, Set<number>>();
  const connect = (from: number, to: number) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from)!.add(to);
    adjacency.get(to)!.add(from);
  };
  for (const evolution of EVOLUTIONS) {
    const targets = evolution.toOptions?.length ? evolution.toOptions : [evolution.to];
    for (const target of targets) connect(evolution.from, target);
  }

  const visited = new Set<number>();
  const queue = [pokemonId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }
  return Array.from(visited);
}

export function buildMascotMissionOption(mascot: {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
}): MascotMissionOption {
  const speciesName = getPokemonName(mascot.pokemonId);
  const acceptedCardNames = getMascotEvolutionFamilyIds(mascot.pokemonId)
    .flatMap((id) => regionalCardAliases(getPokemonName(id)));
  return {
    id: mascot.id,
    pokemonId: mascot.pokemonId,
    nickname: mascot.nickname,
    speciesName,
    displayName: mascot.nickname?.trim() || speciesName,
    level: mascot.level,
    spriteUrl: getStaticSpriteUrl(mascot.pokemonId),
    acceptedCardNames: Array.from(new Set(acceptedCardNames)),
  };
}

export function validateMascotMissionSubmission(deckList: string, mascot: MascotMissionOption) {
  return validateMascotMissionDeckList(deckList, mascot.acceptedCardNames);
}
