import Image from "next/image";
import Link from "next/link";
import { BookMarked, Eye, Lock, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { JOURNAL_CHAPTERS } from "@/journal-data/chapters";
import { describeRule, isEntryUnlocked, type UnlockContext } from "@/journal-data/unlock";

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
      where: { nationalId: { in: pokemonIds } },
      select: { nationalId: true, displayName: true, imageUrl: true }
    })
  ]);

  const ctx: UnlockContext = {
    mascotIds: new Set(dex.map((d) => d.pokemonId)),
    stickerIds: new Set(stickers.map((s) => s.card.nationalId)),
    gens: Object.fromEntries(genTotals.map((g) => [g.generation, { owned: 0, total: g._count.id }]))
  };
  for (const s of stickers) if (ctx.gens[s.card.generation]) ctx.gens[s.card.generation].owned++;
  const cardById = new Map(cards.map((c) => [c.nationalId, c]));

  const all = JOURNAL_CHAPTERS.flatMap((c) => c.entries);
  const unlockedCount = all.filter((e) => isEntryUnlocked(e.unlock, ctx)).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-300/70">
            <BookMarked size={14} /> Diário de campo · visível só para admins
          </p>
          <h1 className="mt-2 font-pixel text-lg leading-snug text-[#FFCB05]">Journal</h1>
          <p className="mt-2 text-sm text-slate-400">
            {unlockedCount} de {all.length} registros desbloqueados. Complete álbuns e adquira mascotes para revelar mais histórias.
          </p>
        </div>
        <Link
          href={revealAll ? "/journal" : "/journal?tudo=1"}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-slate-300 transition hover:border-[#FFCB05]/50 hover:text-[#FFCB05]"
        >
          <Eye size={14} /> {revealAll ? "Ver como jogador" : "Ver tudo (admin)"}
        </Link>
      </div>

      {JOURNAL_CHAPTERS.map((chapter) => (
        <section key={chapter.id} className="space-y-4">
          <div className="border-l-4 pl-4" style={{ borderColor: chapter.accent }}>
            <h2 className="text-base font-bold text-slate-100">{chapter.title}</h2>
            <p className="text-xs italic text-slate-500">{chapter.subtitle}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {chapter.entries.map((entry) => {
              const unlocked = revealAll || isEntryUnlocked(entry.unlock, ctx);
              const card = cardById.get(entry.pokemonId);
              return (
                <article
                  key={entry.id}
                  className="relative overflow-hidden rounded-2xl border p-5 shadow-lg"
                  style={{
                    borderColor: unlocked ? `${chapter.accent}55` : "rgb(51 65 85 / 0.6)",
                    background: unlocked
                      ? `linear-gradient(135deg, ${chapter.accent}14, rgb(15 23 42 / 0.9) 55%)`
                      : "rgb(15 23 42 / 0.6)"
                  }}
                >
                  <div className="flex gap-4">
                    <div
                      className="relative h-28 w-28 shrink-0 rounded-xl border bg-slate-950/70"
                      style={{ borderColor: unlocked ? `${chapter.accent}40` : "rgb(51 65 85 / 0.6)" }}
                    >
                      {card?.imageUrl && (
                        <Image
                          src={card.imageUrl}
                          alt={unlocked ? card.displayName : "Registro bloqueado"}
                          fill
                          unoptimized
                          sizes="112px"
                          className={`object-contain p-2 ${unlocked ? "" : "brightness-0 invert opacity-25"}`}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        #{String(entry.pokemonId).padStart(3, "0")} · {unlocked ? card?.displayName : "???"}
                      </p>
                      <h3 className="mt-1 text-base font-bold text-white">{unlocked ? entry.title : "Registro bloqueado"}</h3>
                      {!unlocked && (
                        <ul className="mt-2 space-y-1 text-xs text-slate-500">
                          <li className="flex items-center gap-1.5 text-slate-400"><Lock size={12} /> Para abrir (qualquer um):</li>
                          {entry.unlock.map((r, i) => <li key={i}>• {describeRule(r)}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>

                  {unlocked && (
                    <div className="mt-4 space-y-3">
                      {entry.art && (
                        <div className="relative aspect-[16/7] overflow-hidden rounded-xl border border-white/10">
                          <Image src={entry.art} alt={entry.title} fill sizes="600px" className="object-cover" />
                        </div>
                      )}
                      {entry.story.map((p, i) => (
                        <p key={i} className="text-sm leading-relaxed text-slate-300">{p}</p>
                      ))}
                      {entry.facts && (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: chapter.accent }}>
                            <Sparkles size={12} /> Você sabia?
                          </p>
                          <ul className="space-y-1 text-xs text-slate-400">
                            {entry.facts.map((f, i) => <li key={i}>• {f}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
