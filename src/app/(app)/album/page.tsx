import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { isAdmin } from "@/lib/auth/permissions";
import Link from "next/link";
import { BookOpen, Coins, Settings } from "lucide-react";
import { AlbumCollection } from "./_components/album-collection";
import { PackShelf } from "./_components/pack-shelf";

export const dynamic = "force-dynamic";

export const RARITY_COLORS: Record<string, string> = {
  COMMON:    "border-slate-600 text-slate-400",
  UNCOMMON:  "border-[#7AC74C]/50 text-[#7AC74C]",
  RARE:      "border-[#6390F0]/50 text-[#6390F0]",
  EPIC:      "border-[#735797]/50 text-[#735797]",
  LEGENDARY: "border-[#FFCB05]/50 text-[#FFCB05]"
};

export const RARITY_LABELS: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Rara", EPIC: "Épica", LEGENDARY: "Lendária"
};

export default async function AlbumPage({
  searchParams
}: {
  searchParams: Promise<{ gen?: string }>;
}) {
  const [session, sp] = await Promise.all([auth(), searchParams]);
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);
  const selectedGen = sp.gen ? parseInt(sp.gen) : null;

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  const [wallet, packs, allCards, ownedStickers] = await Promise.all([
    player ? getOrCreateWallet(player.id) : null,
    prisma.stickerPack.findMany({ where: { active: true }, orderBy: { price: "asc" } }),
    prisma.pokemonCard.findMany({
      where: {
        active: true,
        ...(selectedGen ? { generation: selectedGen } : {})
      },
      orderBy: [{ generation: "asc" }, { nationalId: "asc" }]
    }),
    player
      ? prisma.playerSticker.findMany({
          where: { playerId: player.id },
          select: { cardId: true, quantity: true, isFavorite: true }
        })
      : []
  ]);

  const ownedMap = new Map(ownedStickers.map((s) => [s.cardId, s]));

  // Estatísticas por geração
  const genStats = await prisma.pokemonCard.groupBy({
    by: ["generation"],
    where: { active: true },
    _count: { id: true },
    orderBy: { generation: "asc" }
  });

  const genOwnedStats = player
    ? await prisma.playerSticker.groupBy({
        by: [],
        where: { playerId: player.id },
        _count: { id: true }
      })
    : [];

  // Owned per generation
  const ownedPerGen: Record<number, number> = {};
  if (player) {
    for (const card of allCards) {
      if (ownedMap.has(card.id)) {
        ownedPerGen[card.generation] = (ownedPerGen[card.generation] ?? 0) + 1;
      }
    }
    // Also count for other gens if not filtered
    if (!selectedGen) {
      const allOwned = await prisma.playerSticker.findMany({
        where: { playerId: player.id },
        include: { card: { select: { generation: true } } }
      });
      for (const s of allOwned) {
        ownedPerGen[s.card.generation] = (ownedPerGen[s.card.generation] ?? 0) + 1;
      }
    }
  }

  const totalCards = allCards.length;
  const totalOwned = allCards.filter((c) => ownedMap.has(c.id)).length;

  const generations = [...new Set(allCards.map((c) => c.generation))].sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
            <h1 className="font-pixel text-base text-[#FFCB05]">Álbum Zikachu</h1>
            <p className="mt-1 text-sm text-slate-400">Colecione figurinhas de Pokémon abrindo pacotes com ZikaCoins.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {wallet && (
              <Link href="/carteira" className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2 text-sm font-bold text-[#FFCB05]">
                <Coins size={16} />
                {wallet.balance.toLocaleString("pt-BR")} ZC
              </Link>
            )}
            {admin && (
              <Link href="/album/admin" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-slate-400 hover:text-slate-200">
                <Settings size={14} /> Admin
              </Link>
            )}
          </div>
        </div>

        {/* Progresso total */}
        {player && totalCards > 0 && (
          <div className="mt-4 border-t border-border/50 pt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="flex items-center gap-1"><BookOpen size={12} /> Coleção total</span>
              <span className="font-semibold text-white">{totalOwned}/{totalCards}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#FFCB05] to-[#7AC74C] transition-all"
                style={{ width: `${totalCards > 0 ? (totalOwned / totalCards) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Progresso por geração */}
      {genStats.length > 0 && player && (
        <div>
          <h2 className="mb-3 font-semibold text-slate-200">Progresso por Geração</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {genStats.map((gs) => {
              const total = gs._count.id;
              const owned = ownedPerGen[gs.generation] ?? 0;
              const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
              return (
                <Link
                  key={gs.generation}
                  href={`/album?gen=${gs.generation}`}
                  className={`rounded-xl border bg-slate-950/60 p-4 hover:border-[#FFCB05]/30 transition-colors ${
                    selectedGen === gs.generation ? "border-[#FFCB05]/50 bg-[#FFCB05]/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white">Geração {gs.generation}</p>
                    <p className="text-xs text-slate-400">{owned}/{total}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800">
                    <div className="h-1.5 rounded-full bg-[#FFCB05] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">{pct}% completo</p>
                </Link>
              );
            })}
          </div>
          {selectedGen && (
            <Link href="/album" className="mt-2 inline-block text-xs text-slate-500 hover:text-slate-300">
              ← Ver todas as gerações
            </Link>
          )}
        </div>
      )}

      {/* Pacotes disponíveis */}
      {packs.length > 0 && (
        <PackShelf
          packs={packs.map((p) => ({ ...p, description: p.description ?? null }))}
          balance={wallet?.balance ?? 0}
          isLoggedIn={!!player}
        />
      )}

      {/* Coleção */}
      {allCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">
            {admin
              ? "Nenhum Pokémon importado ainda. Use o painel admin para importar da PokeAPI."
              : "Nenhuma figurinha disponível ainda."}
          </p>
          {admin && (
            <Link href="/album/admin" className="mt-2 inline-block text-sm text-[#FFCB05] hover:underline">
              Ir para o admin →
            </Link>
          )}
        </div>
      ) : (
        <AlbumCollection
          cards={allCards.map((c) => ({
            id: c.id,
            nationalId: c.nationalId,
            displayName: c.displayName,
            imageUrl: c.imageUrl,
            rarity: c.rarity,
            generation: c.generation,
            types: c.types
          }))}
          ownedMap={Object.fromEntries(ownedMap)}
          generations={generations}
          selectedGen={selectedGen}
        />
      )}
    </div>
  );
}
