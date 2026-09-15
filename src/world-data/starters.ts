export type WorldStarter = { generation: number; pokemonId: number };

export const WORLD_STARTERS: WorldStarter[] = [
  { generation: 1, pokemonId: 1 }, { generation: 1, pokemonId: 4 }, { generation: 1, pokemonId: 7 },
  { generation: 2, pokemonId: 152 }, { generation: 2, pokemonId: 155 }, { generation: 2, pokemonId: 158 },
  { generation: 3, pokemonId: 252 }, { generation: 3, pokemonId: 255 }, { generation: 3, pokemonId: 258 },
  { generation: 4, pokemonId: 387 }, { generation: 4, pokemonId: 390 }, { generation: 4, pokemonId: 393 },
  { generation: 5, pokemonId: 495 }, { generation: 5, pokemonId: 498 }, { generation: 5, pokemonId: 501 },
  { generation: 6, pokemonId: 650 }, { generation: 6, pokemonId: 653 }, { generation: 6, pokemonId: 656 },
  { generation: 7, pokemonId: 722 }, { generation: 7, pokemonId: 725 }, { generation: 7, pokemonId: 728 },
  { generation: 8, pokemonId: 810 }, { generation: 8, pokemonId: 813 }, { generation: 8, pokemonId: 816 },
  { generation: 9, pokemonId: 906 }, { generation: 9, pokemonId: 909 }, { generation: 9, pokemonId: 912 },
];

export const WORLD_STARTER_IDS = new Set(WORLD_STARTERS.map((starter) => starter.pokemonId));
