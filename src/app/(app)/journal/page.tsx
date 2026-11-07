import Link from "next/link";
import { BookMarked, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { JOURNAL_CHAPTERS } from "@/journal-data/chapters";
import { GEN_INFO, buildAutoEntry } from "@/journal-data/auto";
import { describeRule, isEntryUnlocked, type UnlockContext } from "@/journal-data/unlock";
import type { UnlockRule } from "@/journal-data/types";
import { JournalBook, type BookPage } from "./_components/journal-book";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal | Liga Zikachu" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ tudo?: string }> }) {
  // Protótipo: só admins (inclui visão completa). Abrir ao público = trocar por getAppSession.
  const [user, sp] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const revealAll = sp.tudo === "1";

  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });

  const [dex, stickers, genTotals, cards] = await Promise.all([
    player ? prisma.playerPokemonDex.findMany({ where: { playerId: player.id }, select: { pokemonId: true } }) : [],
    player
      ? prisma.playerSticker.findMany({
          where: { playerId: player.id },
          select: { card: { select: { nationalId: true, generation: true } } }
        })
      : [],
    prisma.pokemonCard.groupBy({ by: ["generation"], where: { active: true }, _count: { id: true } }),
    prisma.pokemonCard.findMany({
      where: { active: true },
      orderBy: { nationalId: "asc" },
      select: { nationalId: true, displayName: true, imageUrl: true, generation: true, types: true, rarity: true }
    })
  ]);

  const ctx: UnlockContext = {
    mascotIds: new Set(dex.map((d) => d.pokemonId)),
    stickerIds: new Set(stickers.map((s) => s.card.nationalId)),
    gens: Object.fromEntries(genTotals.map((g) => [g.generation, { owned: 0, total: g._count.id }]))
  };
  for (const s of stickers) if (ctx.gens[s.card.generation]) ctx.gens[s.card.generation].owned++;

  // Registros escritos à mão, por Pokémon.
  const curated = new Map(
    JOURNAL_CHAPTERS.flatMap((chapter) => chapter.entries.map((entry) => [entry.pokemonId, { chapter, entry }] as const))
  );

  // Uma página por Pokémon (1:1 com as figurinhas), na ordem da Pokédex.
  const pages: BookPage[] = cards.map((card) => {
    const gen = GEN_INFO[card.generation];
    const hand = curated.get(card.nationalId);
    const rules: UnlockRule[] = hand?.entry.unlock ?? [
      { type: "mascot", pokemonId: card.nationalId },
      { type: "sticker", pokemonId: card.nationalId }
    ];
    const unlocked = revealAll || isEntryUnlocked(rules, ctx);
    const content = hand ? { title: hand.entry.title, story: hand.entry.story, facts: hand.entry.facts ?? [] } : buildAutoEntry(card);
    return {
      id: hand?.entry.id ?? `auto-${card.nationalId}`,
      generation: card.generation,
      region: gen?.region ?? "Outras terras",
      chapterTitle: hand ? hand.chapter.title : `${gen?.region ?? "Outras terras"} · Geração ${card.generation}`,
      accent: hand ? hand.chapter.accent : gen?.accent ?? "#c9a24a",
      locked: !unlocked,
      number: card.nationalId,
      pokemonName: unlocked ? cap(card.displayName) : null,
      title: unlocked ? content.title : null,
      story: unlocked ? content.story : [],
      facts: unlocked ? content.facts : [],
      art: unlocked ? hand?.entry.art ?? null : null,
      imageUrl: card.imageUrl,
      hints: unlocked ? [] : rules.map(describeRule)
    };
  });
  const unlockedCount = pages.filter((p) => !p.locked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-300/70">
            <BookMarked size={14} /> Diário de campo · visível só para admins
          </p>
          <h1 className="mt-2 font-pixel text-lg leading-snug text-[#FFCB05]">Journal</h1>
          <p className="mt-2 text-sm text-slate-400">
            {unlockedCount} de {pages.length} registros desbloqueados — um por Pokémon (nº da página = nº da Pokédex), abertos pela figurinha ou pelo mascote.
            Use os marcadores, as setas do teclado ou o campo de página.
          </p>
        </div>
        <Link
          href={revealAll ? "/journal" : "/journal?tudo=1"}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-slate-300 transition hover:border-[#FFCB05]/50 hover:text-[#FFCB05]"
        >
          <Eye size={14} /> {revealAll ? "Ver como jogador" : "Ver tudo (admin)"}
        </Link>
      </div>

      <JournalBook pages={pages} />
    </div>
  );
}
