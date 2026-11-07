/** Página automática para todo Pokémon sem registro escrito à mão em chapters.ts. */

export const GEN_INFO: Record<number, { region: string; games: string; year: number; accent: string }> = {
  1: { region: "Kanto", games: "Pokémon Red, Green e Blue", year: 1996, accent: "#d9534f" },
  2: { region: "Johto", games: "Pokémon Gold e Silver", year: 1999, accent: "#d4a72c" },
  3: { region: "Hoenn", games: "Pokémon Ruby e Sapphire", year: 2002, accent: "#3f8fd6" },
  4: { region: "Sinnoh", games: "Pokémon Diamond e Pearl", year: 2006, accent: "#8f7fd6" },
  5: { region: "Unova", games: "Pokémon Black e White", year: 2010, accent: "#7d8794" },
  6: { region: "Kalos", games: "Pokémon X e Y", year: 2013, accent: "#e0709f" },
  7: { region: "Alola", games: "Pokémon Sun e Moon", year: 2016, accent: "#f0a030" },
  8: { region: "Galar", games: "Pokémon Sword e Shield", year: 2019, accent: "#c04a8a" },
  9: { region: "Paldea", games: "Pokémon Scarlet e Violet", year: 2022, accent: "#c1492f" }
};

export const TYPE_PT: Record<string, string> = {
  normal: "Normal", fire: "Fogo", water: "Água", grass: "Planta", electric: "Elétrico", ice: "Gelo",
  fighting: "Lutador", poison: "Venenoso", ground: "Terrestre", flying: "Voador", psychic: "Psíquico",
  bug: "Inseto", rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio", steel: "Aço", fairy: "Fada"
};

const TYPE_FLAVOR: Record<string, string> = {
  normal: "Adaptável, aparece em quase todo tipo de terreno e costuma ser um dos primeiros companheiros de quem começa a jornada.",
  fire: "Guarda o calor dentro do corpo, e os treinadores dizem que a intensidade da chama acompanha o humor do Pokémon.",
  water: "Prefere rios, lagos e mares, e aprendeu a usar a água a seu favor, tanto para atacar quanto para se esconder.",
  grass: "Vive em harmonia com a natureza e tira energia do sol e do solo para crescer forte.",
  electric: "Acumula eletricidade no corpo e a libera em descargas rápidas; é comum ouvi-lo antes de vê-lo.",
  ice: "Resiste ao frio extremo e deixa um rastro de cristais por onde passa.",
  fighting: "Vive para treinar: cada dia é uma nova sessão de força, equilíbrio e disciplina.",
  poison: "Seu veneno é tanto defesa quanto ferramenta, e os pesquisadores o estudam com muito cuidado.",
  ground: "Conhece cada túnel e cada camada do solo, e se move debaixo da terra com facilidade.",
  flying: "Domina as correntes de ar e enxerga o mundo de cima, vendo longe antes de todo mundo.",
  psychic: "Percebe mais do que mostra: seus poderes mentais ainda intrigam quem tenta explicá-los.",
  bug: "Pequeno, mas incansável, tem papel importante no equilíbrio dos bosques e florestas.",
  rock: "Resistente como a montanha onde vive, suporta golpes que derrubariam muitos outros.",
  ghost: "Aparece onde há silêncio e mistério, e quase sempre prefere assustar a lutar.",
  dragon: "Raro e orgulhoso, é cercado de lendas e respeitado por quem já o enfrentou.",
  dark: "Age nas sombras e pensa antes de agir; confiança com ele se conquista aos poucos.",
  steel: "Seu corpo metálico é duro e brilhante, e quase nada o arranha.",
  fairy: "Delicado e encantador, parece trazer sorte a quem cruza o seu caminho."
};

const RARITY_PT: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Rara", EPIC: "Épica", LEGENDARY: "Lendária"
};

export type AutoCard = { nationalId: number; displayName: string; generation: number; types: string[]; rarity: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildAutoEntry(raw: AutoCard) {
  const c = { ...raw, displayName: cap(raw.displayName) };
  const gen = GEN_INFO[c.generation];
  const typeNames = c.types.map((t) => TYPE_PT[t] ?? t);
  const where = gen
    ? `catalogado pela primeira vez na região de ${gen.region}, a partir de ${gen.games} (${gen.year})`
    : "catalogado nos arquivos da Liga";
  return {
    title: `Registro de campo: ${c.displayName}`,
    story: [
      `${c.displayName} é um Pokémon do tipo ${typeNames.join(" / ") || "desconhecido"}, ${where}.`,
      TYPE_FLAVOR[c.types[0]] ?? "Ainda há muito a descobrir sobre seus hábitos e sua origem."
    ],
    facts: [`Nº ${c.nationalId} da Pokédex Nacional.`, `Raridade no álbum: ${RARITY_PT[c.rarity] ?? c.rarity}.`]
  };
}
