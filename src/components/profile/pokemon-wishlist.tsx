"use client";

import { useMemo, useState, useTransition } from "react";
import { Heart, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updatePokemonWishlist } from "@/app/(app)/perfil/actions";

type WishlistPokemon = {
  pokemonId: number;
  name: string;
};

type PokemonOption = {
  id: number;
  name: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function spriteUrl(pokemonId: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

function PokemonPill({
  pokemon,
  canRemove,
  onRemove,
}: {
  pokemon: WishlistPokemon;
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={spriteUrl(pokemon.pokemonId)}
        alt={pokemon.name}
        className="h-10 w-10 shrink-0 object-contain"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">{pokemon.name}</p>
        <p className="text-[10px] text-slate-500">#{String(pokemon.pokemonId).padStart(4, "0")}</p>
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg border border-red-500/20 p-1.5 text-red-300 opacity-80 transition hover:bg-red-500/10 hover:opacity-100"
          aria-label={`Remover ${pokemon.name} da wishlist`}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

export function PokemonWishlist({
  initialWishlist,
  pokemonOptions,
  editable = false,
  ownerName,
}: {
  initialWishlist: WishlistPokemon[];
  pokemonOptions: PokemonOption[];
  editable?: boolean;
  ownerName: string;
}) {
  const [open, setOpen] = useState(initialWishlist.length > 0 || editable);
  const [query, setQuery] = useState("");
  const [wishlist, setWishlist] = useState(initialWishlist);
  const [isPending, startTransition] = useTransition();

  const selectedIds = useMemo(() => new Set(wishlist.map((pokemon) => pokemon.pokemonId)), [wishlist]);
  const normalizedQuery = normalizeSearch(query);

  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return pokemonOptions
      .filter((pokemon) => {
        const idText = String(pokemon.id);
        return idText === normalizedQuery || idText.padStart(4, "0") === normalizedQuery || normalizeSearch(pokemon.name).includes(normalizedQuery);
      })
      .filter((pokemon) => !selectedIds.has(pokemon.id))
      .slice(0, 12);
  }, [normalizedQuery, pokemonOptions, selectedIds]);

  function persist(nextWishlist: WishlistPokemon[]) {
    setWishlist(nextWishlist);
    startTransition(async () => {
      const result = await updatePokemonWishlist({ pokemonIds: nextWishlist.map((pokemon) => pokemon.pokemonId) });
      if (result?.error) {
        toast.error(result.error);
        setWishlist(wishlist);
        return;
      }
      toast.success("Wishlist atualizada.");
    });
  }

  function addPokemon(option: PokemonOption) {
    if (wishlist.length >= 30) {
      toast.error("A wishlist aceita ate 30 Pokemon.");
      return;
    }
    persist([...wishlist, { pokemonId: option.id, name: option.name }]);
    setQuery("");
  }

  function removePokemon(pokemonId: number) {
    persist(wishlist.filter((pokemon) => pokemon.pokemonId !== pokemonId));
  }

  return (
    <section className="rounded-2xl border border-border bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Heart size={16} className="text-[#FFCB05]" fill="currentColor" /> Wishlist
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Pokemon que {editable ? "voce esta buscando" : `${ownerName} esta buscando`} para trocas, presentes ou futuras combinacoes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-2 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20"
        >
          {open ? "Fechar wishlist" : `Wishlist (${wishlist.length})`}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {editable && (
            <div className="rounded-xl border border-border bg-slate-900/50 p-3">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Buscar Pokemon
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Digite nome ou numero. Ex.: Pikachu ou 25"
                  className="w-full rounded-xl border border-border bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-[#FFCB05]/60"
                />
              </div>
              {normalizedQuery && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {results.length > 0 ? results.map((pokemon) => (
                    <button
                      key={pokemon.id}
                      type="button"
                      onClick={() => addPokemon(pokemon)}
                      disabled={isPending}
                      className="flex items-center gap-2 rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-left transition hover:border-[#FFCB05]/40 hover:bg-[#FFCB05]/5 disabled:opacity-60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={spriteUrl(pokemon.id)} alt={pokemon.name} className="h-8 w-8 object-contain" style={{ imageRendering: "pixelated" }} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-100">{pokemon.name}</span>
                        <span className="text-[10px] text-slate-500">#{String(pokemon.id).padStart(4, "0")}</span>
                      </span>
                    </button>
                  )) : (
                    <p className="text-xs text-slate-500">Nenhum Pokemon encontrado para essa busca.</p>
                  )}
                </div>
              )}
              <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                {isPending && <Loader2 size={11} className="animate-spin" />} {wishlist.length}/30 Pokemon na wishlist.
              </p>
            </div>
          )}

          {wishlist.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {wishlist.map((pokemon) => (
                <PokemonPill
                  key={pokemon.pokemonId}
                  pokemon={pokemon}
                  canRemove={editable}
                  onRemove={() => removePokemon(pokemon.pokemonId)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500">
              {editable
                ? "Sua wishlist ainda esta vazia. Busque Pokemon pelo nome ou numero para mostrar aos outros jogadores."
                : "Este jogador ainda nao publicou uma wishlist."}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
