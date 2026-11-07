import Link from "next/link";
import { BookMarked, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { JOURNAL_CHAPTERS } from "@/journal-data/chapters";
import { describeRule, isEntryUnlocked, type UnlockContext } from "@/journal-data/unlock";
import { GEN_INFO, buildAutoEntry } from "@/journal-data/auto";
import { JournalBook, type BookSpread } from "./_components/journal-book";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal | Liga Zikachu" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ tudo?: string }> }) {
  // Protótipo: só admins (inclui visão completa). Abrir ao público = trocar por getAppSession.
  const [user, sp] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const revealAll = sp.tudo === "1";

  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  const pokemonIds = [...new Set(JOURNAL_CHAPTERS.flatMap((c) => c.entries.map((e) => e.pokemonId)))];

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
  const cardById = new Map(cards.map((c) => [c.nationalId, c]));

  const spreads: BookSpread[] = JOURNAL_CHAPTERS.flatMap((chapter) =>
    chapter.entries.map((entry) => {
      const unlocked = revealAll || isEntryUnlocked(entry.unlock, ctx);
      const card = cardById.get(entry.pokemonId);
      return {
        id: entry.id,
        chapterTitle: chapter.title,
        accent: chapter.accent,
        locked: !unlocked,
        number: entry.pokemonId,
        pokemonName: unlocked ? card?.displayName ?? null : null,
        title: unlocked ? entry.title : null,
        story: unlocked ? entry.story : [],
        facts: unlocked ? entry.facts ?? [] : [],
        art: unlocked ? entry.art ?? null : null,
        imageUrl: card?.imageUrl ?? null,
        hints: unlocked ? [] : entry.unlock.map(describeRule)
      };
    })
  );
  // Todo Pokémon sem registro escrito à mão ganha uma página automática (por geração).
  const curated = new Set(pokemonIds);
  for (const card of cards) {
    if (curated.has(card.nationalId)) continue;
    const gen = GEN_INFO[card.generation];
    const unlocked = revealAll || isEntryUnlocked(
      [{ type: "mascot", pokemonId: card.nationalId }, { type: "sticker", pokemonId: card.nationalId }], ctx);
    const auto = buildAutoEntry(card);
    spreads.push({
      id: `auto-${card.nationalId}`,
      chapterTitle: `Registro Geral — ${gen?.region ?? "Outras terras"} (Geração ${card.generation})`,
      accent: gen?.accent ?? "#c9a24a",
      locked: !unlocked,
      number: card.nationalId,
      pokemonName: unlocked ? card.displayName.charAt(0).toUpperCase() + card.displayName.slice(1) : null,
      title: unlocked ? auto.title : null,
      story: unlocked ? auto.story : [],
      facts: unlocked ? auto.facts : [],
      art: null,
      imageUrl: card.imageUrl,
      hints: unlocked ? [] : [`Ter o mascote #${card.nationalId}`, `Ter a figurinha #${card.nationalId}`]
    });
  }
  const unlockedCount = spreads.filter((s) => !s.locked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-300/70">
            <BookMarked size={14} /> Diário de campo · visível só para admins
          </p>
          <h1 className="mt-2 font-pixel text-lg leading-snug text-[#FFCB05]">Journal</h1>
          <p className="mt-2 text-sm text-slate-400">
            {unlockedCount} de {spreads.length} registros desbloqueados. Use as setas do teclado ou os botões para virar a página.
          </p>
        </div>
        <Link
          href={revealAll ? "/journal" : "/journal?tudo=1"}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-slate-300 transition hover:border-[#FFCB05]/50 hover:text-[#FFCB05]"
        >
          <Eye size={14} /> {revealAll ? "Ver como jogador" : "Ver tudo (admin)"}
        </Link>
      </div>

      <JournalBook spreads={spreads} />
    </div>
  );
}
