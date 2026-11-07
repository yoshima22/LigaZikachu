import { prisma } from "@/lib/prisma";
import { JOURNAL_CHAPTERS } from "./chapters";
import { GEN_INFO, buildAutoEntry, generatedFacts, type DexFact } from "./auto";
import { ANIME_FACTS } from "./anime-facts";
import { describeRule, isEntryUnlocked, type UnlockContext } from "./unlock";
import type { JournalMeta, UnlockRule } from "./types";
import dexFacts from "./dex-facts.generated.json";
import formSpecies from "./form-species.generated.json";
import type { BookPage } from "@/app/(app)/journal/_components/journal-book";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Páginas entregues na primeira carga e tamanho padrão de cada bloco pedido pelo livro. */
export const JOURNAL_CHUNK = 8;
/** Teto por pedido, para ninguém pedir o livro inteiro de uma vez. */
const MAX_CHUNK = 16;

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

// Registros escritos à mão, por Pokémon.
const curated = new Map(
  JOURNAL_CHAPTERS.flatMap((chapter) => chapter.entries.map((entry) => [entry.pokemonId, { chapter, entry }] as const))
);

/** Lê o que o jogador possui (3 consultas leves) e a lista de cartas (em cache). */
async function loadContext(userId: string) {
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

  const nameById = new Map(cards.map((c) => [c.nationalId, cap(c.displayName)]));
  const nameOf = (id: number) => nameById.get(id) ?? `#${id}`;
  return { cards, ctx, nameOf };
}
type Context = Awaited<ReturnType<typeof loadContext>>;

/**
 * A página abre quando o jogador tem (ou já teve) o mascote da espécie. A figurinha sozinha NÃO abre.
 * Registros escritos à mão podem acrescentar o caminho "álbum da geração completo".
 */
function rulesFor(card: CardRow): UnlockRule[] {
  const hand = curated.get(card.nationalId);
  return [
    { type: "mascot", pokemonId: card.nationalId },
    ...(hand?.entry.unlock ?? []).filter((r) => r.type === "albumGen")
  ];
}

function makePage(card: CardRow, position: number, { ctx, nameOf }: Context, revealAll: boolean): BookPage {
  const gen = GEN_INFO[card.generation];
  const hand = curated.get(card.nationalId);
  const rules = rulesFor(card);
  const unlocked = revealAll || isEntryUnlocked(rules, ctx);
  const base = hand ? { title: hand.entry.title, story: hand.entry.story, facts: hand.entry.facts ?? [] } : buildAutoEntry(card);
  // Ordem: escritos à mão → anime/filmes/jogos → dados verdadeiros da Pokédex (no máximo 5, sem repetir).
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
    position,
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
}

/** Primeira carga: só metadados leves (total, marcadores, contagem) + o primeiro bloco de páginas. */
export async function getJournalMeta(userId: string, revealAll: boolean): Promise<JournalMeta> {
  const c = await loadContext(userId);
  const bookmarks: JournalMeta["bookmarks"] = [];
  const seen = new Set<number>();
  c.cards.forEach((card, i) => {
    if (seen.has(card.generation)) return;
    seen.add(card.generation);
    const gen = GEN_INFO[card.generation];
    bookmarks.push({ gen: card.generation, region: gen?.region ?? "Outras terras", accent: gen?.accent ?? "#c9a24a", position: i + 1 });
  });
  const unlockedCount = revealAll ? c.cards.length : c.cards.filter((card) => isEntryUnlocked(rulesFor(card), c.ctx)).length;
  return {
    total: c.cards.length,
    unlockedCount,
    bookmarks,
    initial: c.cards.slice(0, JOURNAL_CHUNK).map((card, i) => makePage(card, i + 1, c, revealAll))
  };
}

/** Bloco sob demanda: posições `from`..`to` (1-based, no máximo 16 por pedido). */
export async function getJournalChunk(userId: string, revealAll: boolean, from: number, to: number): Promise<BookPage[]> {
  const c = await loadContext(userId);
  const start = Math.max(1, Math.floor(from));
  const end = Math.min(c.cards.length, Math.floor(to), start + MAX_CHUNK - 1);
  const out: BookPage[] = [];
  for (let p = start; p <= end; p++) out.push(makePage(c.cards[p - 1], p, c, revealAll));
  return out;
}
