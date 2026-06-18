import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getActiveStickerPacks } from "@/lib/shop-cache";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { isAdmin } from "@/lib/auth/permissions";
import Link from "next/link";
import { BookOpen, Coins, Search, Settings } from "lucide-react";
import { AlbumCollection } from "./_components/album-collection";
import { PackShelf } from "./_components/pack-shelf";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const TYPE_OPTIONS = [
  ["", "Todos os tipos"],
  ["normal", "Normal"],
  ["fire", "Fogo"],
  ["water", "Agua"],
  ["grass", "Grama"],
  ["electric", "Eletrico"],
  ["psychic", "Psiquico"],
  ["fighting", "Lutador"],
  ["dark", "Noturno"],
  ["steel", "Metal"],
  ["dragon", "Dragao"],
  ["fairy", "Fada"],
  ["ghost", "Fantasma"],
  ["poison", "Venenoso"],
  ["ground", "Terra"],
  ["rock", "Pedra"],
  ["flying", "Voador"],
  ["bug", "Inseto"],
  ["ice", "Gelo"],
] as const;

const RARITY_OPTIONS = [
  ["", "Todas as raridades"],
  ["COMMON", "Comum"],
  ["UNCOMMON", "Incomum"],
  ["RARE", "Rara"],
  ["EPIC", "Epica"],
  ["LEGENDARY", "Lendaria"],
] as const;

function albumUrl(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `/album?${text}` : "/album";
}

function parseNumber(value: string | undefined) {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function AlbumPage({
  searchParams,
}: {
  searchParams: Promise<{
    gen?: string;
    page?: string;
    owned?: string;
    mascot?: string;
    q?: string;
    type?: string;
    rarity?: string;
  }>;
}) {
  const [session, sp] = await Promise.all([getAppSession(), searchParams]);
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);
  const selectedGen = parseNumber(sp.gen);
  const currentPage = Math.max(1, parseNumber(sp.page) ?? 1);
  const onlyOwned = sp.owned === "1";
  const onlyMascot = sp.mascot === "1";
  const searchText = (sp.q ?? "").trim();
  const selectedType = TYPE_OPTIONS.some(([value]) => value === sp.type) ? sp.type ?? "" : "";
  const selectedRarity = RARITY_OPTIONS.some(([value]) => value === sp.rarity) ? sp.rarity ?? "" : "";

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const [
    wallet,
    packs,
    allOwnedStickers,
    dexRows,
    otherPlayers,
    genStats,
  ] = await Promise.all([
    player ? getOrCreateWallet(player.id) : null,
    getActiveStickerPacks(),
    player
      ? prisma.playerSticker.findMany({
          where: { playerId: player.id },
          select: {
            cardId: true,
            quantity: true,
            isFavorite: true,
            card: { select: { generation: true, nationalId: true } },
          },
        })
      : [],
    player
      ? prisma.playerPokemonDex.findMany({
          where: { playerId: player.id },
          select: { pokemonId: true },
        })
      : [],
    player
      ? prisma.player.findMany({
          where: { active: true, id: { not: player.id } },
          select: { id: true, displayName: true },
          orderBy: { displayName: "asc" },
        })
      : [],
    prisma.pokemonCard.groupBy({
      by: ["generation"],
      where: { active: true },
      _count: { id: true },
      orderBy: { generation: "asc" },
    }),
  ]);

  const ownedMap = new Map(
    allOwnedStickers.map((sticker) => [
      sticker.cardId,
      { cardId: sticker.cardId, quantity: sticker.quantity, isFavorite: sticker.isFavorite },
    ]),
  );
  const discoveredPokemonIds = new Set(dexRows.map((row) => row.pokemonId));

  const cardWhere: Prisma.PokemonCardWhereInput = {
    active: true,
    ...(selectedGen ? { generation: selectedGen } : {}),
    ...(selectedRarity ? { rarity: selectedRarity as never } : {}),
    ...(selectedType ? { types: { has: selectedType } } : {}),
    ...(onlyOwned && player ? { stickers: { some: { playerId: player.id } } } : {}),
    ...(onlyMascot && player ? { nationalId: { in: [...discoveredPokemonIds] } } : {}),
    ...(searchText
      ? {
          OR: [
            { displayName: { contains: searchText, mode: "insensitive" } },
            { name: { contains: searchText, mode: "insensitive" } },
            ...(Number.isFinite(Number(searchText)) ? [{ nationalId: Number(searchText) }] : []),
          ],
        }
      : {}),
  };

  const [cards, totalCardsInFilter, mascotCards] = await Promise.all([
    prisma.pokemonCard.findMany({
      where: cardWhere,
      orderBy: [{ generation: "asc" }, { nationalId: "asc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        nationalId: true,
        name: true,
        displayName: true,
        generation: true,
        types: true,
        rarity: true,
        imageUrl: true,
      },
    }),
    prisma.pokemonCard.count({ where: cardWhere }),
    discoveredPokemonIds.size > 0
      ? prisma.pokemonCard.findMany({
          where: { active: true, nationalId: { in: [...discoveredPokemonIds] } },
          select: { generation: true, nationalId: true },
        })
      : [],
  ]);

  const discoveredNationalIds = new Set(mascotCards.map((card) => card.nationalId));
  const totalCards = genStats.reduce((sum, generation) => sum + generation._count.id, 0);
  const totalOwned = ownedMap.size;
  const totalMascotSpecies = discoveredNationalIds.size;
  const totalPages = Math.max(1, Math.ceil(totalCardsInFilter / PAGE_SIZE));

  const ownedPerGen: Record<number, number> = {};
  for (const sticker of allOwnedStickers) {
    ownedPerGen[sticker.card.generation] = (ownedPerGen[sticker.card.generation] ?? 0) + 1;
  }

  const mascotPerGen: Record<number, number> = {};
  for (const card of mascotCards) {
    mascotPerGen[card.generation] = (mascotPerGen[card.generation] ?? 0) + 1;
  }

  const baseParams = {
    gen: selectedGen,
    owned: onlyOwned ? "1" : null,
    mascot: onlyMascot ? "1" : null,
    q: searchText,
    type: selectedType,
    rarity: selectedRarity,
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
            <h1 className="font-pixel text-base text-[#FFCB05]">Album Zikachu</h1>
            <p className="mt-1 text-sm text-slate-400">
              Colecione figurinhas e acompanhe quais Pokemon voce tambem possui como mascotes.
            </p>
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

        {player && totalCards > 0 && (
          <div className="mt-4 grid gap-4 border-t border-border/50 pt-4 md:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1"><BookOpen size={12} /> Figurinhas</span>
                <span className="font-semibold text-white">{totalOwned}/{totalCards}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-[#FFCB05] to-[#7AC74C]" style={{ width: `${(totalOwned / totalCards) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                <span>Mascotes ja obtidos</span>
                <span className="font-semibold text-white">{totalMascotSpecies}/{totalCards}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400" style={{ width: `${(totalMascotSpecies / totalCards) * 100}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {player && (
        <div className="rounded-2xl border border-border bg-slate-950/60 p-4">
          <form action="/album" className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
            {selectedGen && <input type="hidden" name="gen" value={selectedGen} />}
            {onlyOwned && <input type="hidden" name="owned" value="1" />}
            {onlyMascot && <input type="hidden" name="mascot" value="1" />}
            <label className="space-y-1 text-xs text-slate-400">
              <span>Buscar</span>
              <span className="flex items-center gap-2 rounded-xl border border-border bg-slate-900 px-3 py-2">
                <Search size={14} />
                <input name="q" defaultValue={searchText} placeholder="Nome ou numero" className="w-full bg-transparent text-sm text-slate-100 outline-none" />
              </span>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Tipo</span>
              <select name="type" defaultValue={selectedType} className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none">
                {TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Raridade</span>
              <select name="rarity" defaultValue={selectedRarity} className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none">
                {RARITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="submit" className="self-end rounded-xl bg-[#FFCB05] px-5 py-2 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700]">
              Filtrar
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={albumUrl({ ...baseParams, owned: null, mascot: null, page: null })} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${!onlyOwned && !onlyMascot ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-border text-slate-400 hover:text-slate-200"}`}>
              Todos
            </Link>
            <Link href={albumUrl({ ...baseParams, owned: "1", mascot: null, page: null })} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${onlyOwned ? "border-[#7AC74C]/50 bg-[#7AC74C]/10 text-[#7AC74C]" : "border-border text-slate-400 hover:text-slate-200"}`}>
              Minhas figurinhas ({totalOwned})
            </Link>
            <Link href={albumUrl({ ...baseParams, owned: null, mascot: "1", page: null })} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${onlyMascot ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-border text-slate-400 hover:text-slate-200"}`}>
              Meus mascotes ({totalMascotSpecies})
            </Link>
            {(searchText || selectedType || selectedRarity || selectedGen || onlyOwned || onlyMascot) && (
              <Link href="/album" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200">
                Limpar filtros
              </Link>
            )}
          </div>
        </div>
      )}

      {genStats.length > 0 && player && (
        <div>
          <h2 className="mb-3 font-semibold text-slate-200">Progresso por Geracao</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {genStats.map((gs) => {
              const total = gs._count.id;
              const owned = ownedPerGen[gs.generation] ?? 0;
              const mascotOwned = mascotPerGen[gs.generation] ?? 0;
              const stickerPct = total > 0 ? Math.round((owned / total) * 100) : 0;
              const mascotPct = total > 0 ? Math.round((mascotOwned / total) * 100) : 0;
              return (
                <Link
                  key={gs.generation}
                  href={albumUrl({ ...baseParams, gen: gs.generation, page: null })}
                  className={`rounded-xl border bg-slate-950/60 p-4 transition-colors hover:border-[#FFCB05]/30 ${
                    selectedGen === gs.generation ? "border-[#FFCB05]/50 bg-[#FFCB05]/5" : "border-border"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Geracao {gs.generation}</p>
                    <p className="text-xs text-slate-400">{owned}/{total}</p>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-1.5 rounded-full bg-[#FFCB05]" style={{ width: `${stickerPct}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">Figurinhas: {stickerPct}%</p>
                    </div>
                    <div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-1.5 rounded-full bg-cyan-400" style={{ width: `${mascotPct}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">Mascotes: {mascotOwned}/{total}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {selectedGen && (
            <Link href={albumUrl({ ...baseParams, gen: null, page: null })} className="mt-2 inline-block text-xs text-slate-500 hover:text-slate-300">
              Ver todas as geracoes
            </Link>
          )}
        </div>
      )}

      {packs.length > 0 && (
        <PackShelf
          packs={packs.map((p) => ({ ...p, description: p.description ?? null, imageUrl: p.imageUrl ?? null }))}
          balance={wallet?.balance ?? 0}
          isLoggedIn={!!player}
        />
      )}

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">
            {admin ? "Nenhum Pokemon importado ou encontrado com esses filtros." : "Nenhuma figurinha encontrada com esses filtros."}
          </p>
          {admin && (
            <Link href="/album/admin" className="mt-2 inline-block text-sm text-[#FFCB05] hover:underline">
              Ir para o admin
            </Link>
          )}
        </div>
      ) : (
        <>
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {currentPage > 1 && (
                <Link href={albumUrl({ ...baseParams, page: currentPage - 1 })} className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Anterior</Link>
              )}
              <span className="text-xs text-slate-500">Pagina {currentPage}/{totalPages} · {totalCardsInFilter} Pokemon</span>
              {currentPage < totalPages && (
                <Link href={albumUrl({ ...baseParams, page: currentPage + 1 })} className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Proxima</Link>
              )}
            </div>
          )}
          <AlbumCollection
            cards={cards.map((card) => ({
              id: card.id,
              nationalId: card.nationalId,
              displayName: card.displayName,
              imageUrl: card.imageUrl,
              rarity: card.rarity,
              generation: card.generation,
              types: card.types,
              hasMascot: discoveredNationalIds.has(card.nationalId),
            }))}
            ownedMap={Object.fromEntries(ownedMap)}
            generations={cards.map((card) => card.generation)}
            selectedGen={selectedGen}
            approvedPlayers={otherPlayers}
          />
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {currentPage > 1 && (
                <Link href={albumUrl({ ...baseParams, page: currentPage - 1 })} className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Anterior</Link>
              )}
              <span className="text-xs text-slate-500">Pagina {currentPage}/{totalPages}</span>
              {currentPage < totalPages && (
                <Link href={albumUrl({ ...baseParams, page: currentPage + 1 })} className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Proxima</Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
