import { prisma } from "@/lib/prisma";
import { JOURNAL_CHAPTERS } from "./chapters";
import { GEN_INFO, buildAutoEntry, generatedFacts, type DexFact } from "./auto";
import { ANIME_FACTS } from "./anime-facts";
import { describeRule, isEntryUnlocked, type UnlockContext } from "./unlock";
import type { UnlockRule } from "./types";
import dexFacts from "./dex-facts.generated.json";
import formSpecies from "./form-species.generated.json";
import type { BookPage } from "@/app/(app)/journal/_components/journal-book";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// A lista de cartas é igual para todos: guarda em memória por 10 min para não reler 1025 linhas a cada visita.
type CardRow = { nationalId: number; displayName: string; imageUrl: string | null; generation: number; types: string[]; rarity: string };
let cardsCache: { at: number; rows: CardRow[] } | null = null;
async function getCards(): Promise<CardRow[]> {
  if (cardsCache && Date.now() - cardsCache.at < 10 * 60_000) return cardsCache.rows;
  const rows = await prisma.pokemonCard.findMany({
    where: { active: true },
    orderBy: { nationalId: "asc" },
    select: { nationalId: true, displayName: true, imageUrl: true, generation: true, types: true, rarity: true }
  });
  cardsCache = { at: Date.now(), rows };
  return rows;
}

/** Monta as 1025 páginas do Journal para um usuário (server-only). */
export async function buildJournalPages(userId: string, revealAll: boolean): Promise<BookPage[]> {
  const player = await prisma.player.findUnique({ where: { userId }, select: { id: true } });

  const [dex, owned, stickers, cards] = await Promise.all([
    player ? prisma.playerPokemonDex.findMany({ where: { playerId: player.id }, select: { pokemonId: true } }) : [],
    // Mascotes que o jogador tem agora (cobre quem ainda não abriu o álbum para sincronizar a Pokédex).
    player ? prisma.mascot.findMany({ where: { playerId: player.id }, distinct: ["pokemonId"], select: { pokemonId: true } }) : [],
    player
      ? prisma.playerSticker.findMany({
          where: { playerId: player.id },
          select: { card: { select: { nationalId: true, generation: true } } }
        })
      : [],
    getCards()
  ]);

  const genTotals: Record<number, number> = {};
  for (const c of cards) genTotals[c.generation] = (genTotals[c.generation] ?? 0) + 1;

  const ctx: UnlockContext = {
    // Mascote de forma (mega, regional, Unown...) conta como a espécie base.
    mascotIds: new Set([...dex, ...owned].map((d) => (formSpecies as Record<string, number>)[d.pokemonId] ?? d.pokemonId)),
    stickerIds: new Set(stickers.map((s) => s.card.nationalId)),
    gens: Object.fromEntries(Object.entries(genTotals).map(([g, total]) => [g, { owned: 0, total }]))
  };
  for (const s of stickers) if (ctx.gens[s.card.generation]) ctx.gens[s.card.generation].owned++;

  // Registros escritos à mão, por Pokémon.
  const curated = new Map(
    JOURNAL_CHAPTERS.flatMap((chapter) => chapter.entries.map((entry) => [entry.pokemonId, { chapter, entry }] as const))
  );
  const nameById = new Map(cards.map((c) => [c.nationalId, cap(c.displayName)]));
  const nameOf = (id: number) => nameById.get(id) ?? `#${id}`;

  // Uma página por Pokémon (1:1 com as figurinhas), na ordem da Pokédex.
  return cards.map((card) => {
    const gen = GEN_INFO[card.generation];
    const hand = curated.get(card.nationalId);
    // Toda página abre com o mascote OU a figurinha do próprio Pokémon; registros escritos à mão só acrescentam caminhos.
    const rules: UnlockRule[] = [
      { type: "mascot", pokemonId: card.nationalId },
      { type: "sticker", pokemonId: card.nationalId },
      ...(hand?.entry.unlock ?? []).filter((r) => r.type === "albumGen")
    ];
    const unlocked = revealAll || isEntryUnlocked(rules, ctx);
    const base = hand ? { title: hand.entry.title, story: hand.entry.story, facts: hand.entry.facts ?? [] } : buildAutoEntry(card);
    // Ordem: escritos à mão → anime/filmes → dados verdadeiros da Pokédex (no máximo 5, sem repetir).
    const facts = [
      ...new Set([
        ...(hand ? base.facts : []),
        ...(ANIME_FACTS[card.nationalId] ?? []),
        ...generatedFacts(card.nationalId, (dexFacts as unknown as Record<string, DexFact>)[card.nationalId], nameOf),
        ...(hand ? [] : base.facts)
      ])
    ].slice(0, 5);
    return {
      id: hand?.entry.id ?? `auto-${card.nationalId}`,
      generation: card.generation,
      region: gen?.region ?? "Outras terras",
      chapterTitle: hand ? hand.chapter.title : `${gen?.region ?? "Outras terras"} · Geração ${card.generation}`,
      accent: hand ? hand.chapter.accent : gen?.accent ?? "#c9a24a",
      locked: !unlocked,
      number: card.nationalId,
      pokemonName: unlocked ? nameOf(card.nationalId) : null,
      title: unlocked ? base.title : null,
      story: unlocked ? base.story : [],
      facts: unlocked ? facts : [],
      art: unlocked ? hand?.entry.art ?? null : null,
      imageUrl: card.imageUrl,
      hints: unlocked ? [] : rules.map((r) => describeRule(r, nameOf))
    };
  });
}
