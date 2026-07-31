"use client";

import { useMemo, useState, useTransition } from "react";
import { Heart, Loader2, Package, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updatePokemonWishlist } from "@/app/(app)/perfil/actions";
import { getShopItemEmoji } from "@/lib/shop-config";

type WishlistPokemon = { pokemonId: number; name: string };
type PokemonOption = { id: number; name: string };
export type WishlistItem = {
  itemId: string;
  name: string;
  type: string;
  rarity: string;
  imageUrl: string | null;
  description: string | null;
};
type ItemOption = WishlistItem;

const MAX_POKEMON = 9;
const MAX_ITEMS = 12;

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function spriteUrl(pokemonId: number) {
  return `/sprites/pokemon/${pokemonId}.png`;
}

function PokemonPill({ pokemon, canRemove, onRemove }: { pokemon: WishlistPokemon; canRemove?: boolean; onRemove?: () => void }) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spriteUrl(pokemon.pokemonId)} alt={pokemon.name} className="h-10 w-10 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">{pokemon.name}</p>
        <p className="text-[10px] text-slate-500">#{String(pokemon.pokemonId).padStart(4, "0")}</p>
      </div>
      {canRemove && (
        <button type="button" onClick={onRemove} className="rounded-lg border border-red-500/20 p-1.5 text-red-300 opacity-80 transition hover:bg-red-500/10 hover:opacity-100" aria-label={`Remover ${pokemon.name} da wishlist`}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

function ItemPill({ item, canRemove, onRemove }: { item: WishlistItem; canRemove?: boolean; onRemove?: () => void }) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-950/70 text-xl">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" />
        ) : getShopItemEmoji(item.type)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">{item.name}</p>
        <p className="truncate text-[10px] uppercase tracking-wide text-cyan-300/70">{item.rarity}</p>
        {item.description && <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-500">{item.description}</p>}
      </div>
      {canRemove && (
        <button type="button" onClick={onRemove} className="rounded-lg border border-red-500/20 p-1.5 text-red-300 opacity-80 transition hover:bg-red-500/10 hover:opacity-100" aria-label={`Remover ${item.name} da wishlist`}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

export function PokemonWishlist({
  initialWishlist,
  pokemonOptions,
  initialItemWishlist = [],
  itemOptions = [],
  editable = false,
  ownerName,
}: {
  initialWishlist: WishlistPokemon[];
  pokemonOptions: PokemonOption[];
  initialItemWishlist?: WishlistItem[];
  itemOptions?: ItemOption[];
  editable?: boolean;
  ownerName: string;
}) {
  const [open, setOpen] = useState(initialWishlist.length + initialItemWishlist.length > 0 || editable);
  const [pokemonQuery, setPokemonQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [wishlist, setWishlist] = useState(initialWishlist);
  const [itemWishlist, setItemWishlist] = useState(initialItemWishlist);
  const [isPending, startTransition] = useTransition();

  const selectedPokemonIds = useMemo(() => new Set(wishlist.map((pokemon) => pokemon.pokemonId)), [wishlist]);
  const selectedItemIds = useMemo(() => new Set(itemWishlist.map((item) => item.itemId)), [itemWishlist]);
  const normalizedPokemonQuery = normalizeSearch(pokemonQuery);
  const normalizedItemQuery = normalizeSearch(itemQuery);

  const pokemonResults = useMemo(() => {
    if (!normalizedPokemonQuery) return [];
    return pokemonOptions
      .filter((pokemon) => {
        const idText = String(pokemon.id);
        return idText === normalizedPokemonQuery || idText.padStart(4, "0") === normalizedPokemonQuery || normalizeSearch(pokemon.name).includes(normalizedPokemonQuery);
      })
      .filter((pokemon) => !selectedPokemonIds.has(pokemon.id))
      .slice(0, 12);
  }, [normalizedPokemonQuery, pokemonOptions, selectedPokemonIds]);

  const itemResults = useMemo(() => {
    if (!normalizedItemQuery) return [];
    return itemOptions
      .filter((item) => normalizeSearch(item.name).includes(normalizedItemQuery) || normalizeSearch(item.type).includes(normalizedItemQuery))
      .filter((item) => !selectedItemIds.has(item.itemId))
      .slice(0, 12);
  }, [normalizedItemQuery, itemOptions, selectedItemIds]);

  function persist(nextPokemon: WishlistPokemon[], nextItems: WishlistItem[]) {
    const previousPokemon = wishlist;
    const previousItems = itemWishlist;
    setWishlist(nextPokemon);
    setItemWishlist(nextItems);
    startTransition(async () => {
      const result = await updatePokemonWishlist({
        pokemonIds: nextPokemon.map((pokemon) => pokemon.pokemonId),
        itemIds: nextItems.map((item) => item.itemId),
      });
      if (result?.error) {
        toast.error(result.error);
        setWishlist(previousPokemon);
        setItemWishlist(previousItems);
        return;
      }
      toast.success("Wishlist atualizada.");
    });
  }

  function addPokemon(option: PokemonOption) {
    if (wishlist.length >= MAX_POKEMON) return toast.error(`A wishlist aceita ate ${MAX_POKEMON} Pokemon.`);
    persist([...wishlist, { pokemonId: option.id, name: option.name }], itemWishlist);
    setPokemonQuery("");
  }

  function addItem(option: ItemOption) {
    if (itemWishlist.length >= MAX_ITEMS) return toast.error(`A wishlist aceita ate ${MAX_ITEMS} itens.`);
    persist(wishlist, [...itemWishlist, option]);
    setItemQuery("");
  }

  const total = wishlist.length + itemWishlist.length;

  return (
    <section className="rounded-2xl border border-border bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Heart size={16} className="text-[#FFCB05]" fill="currentColor" /> Wishlist</h2>
          <p className="mt-1 text-xs text-slate-500">
            Pokemon e itens que {editable ? "voce esta buscando" : `${ownerName} esta buscando`} para trocas e presentes.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-2 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20">
          {open ? "Fechar wishlist" : `Wishlist (${total})`}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-5">
          {editable && (
            <div className="grid gap-3 lg:grid-cols-2">
              <WishlistSearch label="Buscar Pokemon" value={pokemonQuery} onChange={setPokemonQuery} placeholder="Pikachu ou 25" count={`${wishlist.length}/${MAX_POKEMON}`} pending={isPending}>
                {normalizedPokemonQuery && (pokemonResults.length > 0 ? pokemonResults.map((pokemon) => (
                  <button key={pokemon.id} type="button" onClick={() => addPokemon(pokemon)} disabled={isPending} className="flex items-center gap-2 rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-left hover:border-[#FFCB05]/40 disabled:opacity-60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={spriteUrl(pokemon.id)} alt={pokemon.name} className="h-8 w-8 object-contain" style={{ imageRendering: "pixelated" }} />
                    <span className="truncate text-xs font-semibold text-slate-100">{pokemon.name} <span className="text-slate-500">#{pokemon.id}</span></span>
                  </button>
                )) : <p className="text-xs text-slate-500">Nenhum Pokemon encontrado.</p>)}
              </WishlistSearch>

              <WishlistSearch label="Buscar item" value={itemQuery} onChange={setItemQuery} placeholder="Pedra, ovo, vitamina..." count={`${itemWishlist.length}/${MAX_ITEMS}`} pending={isPending}>
                {normalizedItemQuery && (itemResults.length > 0 ? itemResults.map((item) => (
                  <button key={item.itemId} type="button" onClick={() => addItem(item)} disabled={isPending} className="flex items-center gap-2 rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-left hover:border-cyan-400/40 disabled:opacity-60">
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden text-lg">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-contain" /> : getShopItemEmoji(item.type)}</span>
                    <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-100">{item.name}</span><span className="text-[10px] uppercase text-cyan-300/70">{item.rarity}</span></span>
                  </button>
                )) : <p className="text-xs text-slate-500">Nenhum item encontrado.</p>)}
              </WishlistSearch>
            </div>
          )}

          {wishlist.length > 0 && <WishlistGroup icon={<Heart size={13} />} title={`Pokemon (${wishlist.length})`}><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{wishlist.map((pokemon) => <PokemonPill key={pokemon.pokemonId} pokemon={pokemon} canRemove={editable} onRemove={() => persist(wishlist.filter((entry) => entry.pokemonId !== pokemon.pokemonId), itemWishlist)} />)}</div></WishlistGroup>}
          {itemWishlist.length > 0 && <WishlistGroup icon={<Package size={13} />} title={`Itens (${itemWishlist.length})`}><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{itemWishlist.map((item) => <ItemPill key={item.itemId} item={item} canRemove={editable} onRemove={() => persist(wishlist, itemWishlist.filter((entry) => entry.itemId !== item.itemId))} />)}</div></WishlistGroup>}

          {total === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500">{editable ? "Sua wishlist ainda esta vazia. Busque Pokemon ou itens para mostrar aos outros jogadores." : "Este jogador ainda nao publicou uma wishlist."}</div>}
        </div>
      )}
    </section>
  );
}

function WishlistSearch({ label, value, onChange, placeholder, count, pending, children }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; count: string; pending: boolean; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-slate-900/50 p-3"><label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-border bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-[#FFCB05]/60" /></div>{value.trim() && <div className="mt-3 grid gap-2 sm:grid-cols-2">{children}</div>}<p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">{pending && <Loader2 size={11} className="animate-spin" />} {count} selecionados.</p></div>;
}

function WishlistGroup({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <div><h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{icon}{title}</h3>{children}</div>;
}
