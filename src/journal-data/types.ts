/** Regra de desbloqueio. Uma entrada abre quando QUALQUER regra da lista é satisfeita. */
export type UnlockRule =
  | { type: "mascot"; pokemonId: number } // tem/já teve um mascote da espécie
  | { type: "sticker"; pokemonId: number } // tem a figurinha no álbum
  | { type: "both"; pokemonId: number } // tem o mascote E a figurinha da espécie
  | { type: "albumGen"; generation: number; percent: number }; // % do álbum da geração

/** Marcador de geração: leva à primeira página dela. */
export type JournalBookmark = { gen: number; region: string; accent: string; position: number };

/** O que o servidor entrega na primeira carga (o resto das páginas vem sob demanda). */
export type JournalMeta = {
  total: number;
  unlockedCount: number;
  bookmarks: JournalBookmark[];
  initial: import("@/app/(app)/journal/_components/journal-book").BookPage[];
};

export type JournalEntry = {
  id: string;
  pokemonId: number; // imagem/nome vêm do PokemonCard
  title: string;
  /** Parágrafos da história. */
  story: string[];
  /** "Você sabia?" curtos. */
  facts?: string[];
  /** Imagem extra opcional (ilustração da lore), ex.: /journal/pikachu-floresta.webp */
  art?: string;
  unlock: UnlockRule[];
};

export type JournalChapter = {
  id: string;
  title: string;
  subtitle: string;
  /** Cor de destaque (hex). */
  accent: string;
  entries: JournalEntry[];
};
