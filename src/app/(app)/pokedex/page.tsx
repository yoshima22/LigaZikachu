import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Search, Sparkles } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  type PokedexPokemon,
  generationOptions,
  pokemonTypeClasses,
  pokemonTypeLabels,
  pokemonTypeOptions,
  searchPokedexPokemon
} from "@/lib/pokedex";

type PokedexPageProps = {
  searchParams: Promise<{ q?: string; type?: string; generation?: string }>;
};

export const metadata = {
  title: "Pokedex | Liga Zikachu"
};

export default async function PokedexPage({ searchParams }: PokedexPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const selectedType = params.type?.trim() ?? "";
  const selectedGeneration = params.generation?.trim() ?? "";
  let pokemon: PokedexPokemon[] = [];
  let error: string | null = null;

  try {
    pokemon = await searchPokedexPokemon({
      query,
      type: selectedType,
      generation: selectedGeneration
    });
  } catch {
    error = "Nao foi possivel carregar a Pokedex agora. Tente novamente em instantes.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-3 text-xs text-slate-500">
            <Link href="/dashboard" className="hover:text-slate-300">
              Dashboard
            </Link>
            <span className="mx-2">/</span>
            <span className="text-slate-300">Pokedex</span>
          </nav>
          <h1 className="font-pixel text-lg text-[#FFCB05] leading-snug">Pokedex</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Consulte dados basicos de Pokemon e abra as referencias oficiais para a Pokedex e cartas do TCG.
          </p>
        </div>
        <Link href="https://www.pokemon.com/br/pokedex" target="_blank" rel="noreferrer">
          <Button variant="outline" className="gap-2">
            Pokedex oficial <ExternalLink size={14} />
          </Button>
        </Link>
      </div>

      <Card>
        <form className="grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto_auto]" action="/pokedex">
          <label className="space-y-1 text-xs text-slate-400">
            <span>Nome ou numero</span>
            <span className="relative block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Ex.: pikachu ou 25"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-3 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
              />
            </span>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Tipo</span>
            <select
              name="type"
              defaultValue={selectedType}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
            >
              <option value="">Todos</option>
              {pokemonTypeOptions.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            <span>Geracao</span>
            <select
              name="generation"
              defaultValue={selectedGeneration}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
            >
              <option value="">Todas</option>
              {generationOptions.map((generation) => (
                <option key={generation.value} value={generation.value}>
                  {generation.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" className="w-full gap-2">
              <Search size={16} /> Buscar
            </Button>
          </div>
          <div className="flex items-end">
            <Link href="/pokedex" className="w-full">
              <Button type="button" variant="outline" className="w-full">
                Limpar
              </Button>
            </Link>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Dados e imagens remotas via PokeAPI. Links de cartas abrem a base oficial do Pokemon TCG em uma nova aba.
        </p>
      </Card>

      {error ? (
        <Card>
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      ) : pokemon.length === 0 ? (
        <Card className="text-center">
          <Sparkles className="mx-auto text-[#FFCB05]" size={28} />
          <p className="mt-3 text-sm text-slate-300">Nenhum Pokemon encontrado para essa busca.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pokemon.map((entry) => (
            <Card key={entry.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    #{String(entry.id).padStart(4, "0")}
                  </p>
                  <CardTitle className="mt-1">{entry.displayName}</CardTitle>
                  {entry.genus && <p className="mt-1 text-xs text-slate-500">{entry.genus}</p>}
                </div>
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-[#FFCB05]/20 bg-[#FFCB05]/10">
                  {entry.imageUrl ? (
                    <Image
                      src={entry.imageUrl}
                      alt={entry.displayName}
                      width={96}
                      height={96}
                      className="h-24 w-24 object-contain drop-shadow-[0_0_14px_rgba(255,203,5,0.25)]"
                    />
                  ) : (
                    <span className="font-pixel text-sm text-[#FFCB05]">
                      {String(entry.id).padStart(3, "0")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {entry.types.map((type) => (
                  <span
                    key={type}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      pokemonTypeClasses[type] ?? "border-slate-500/30 bg-slate-500/15 text-slate-200"
                    }`}
                  >
                    {pokemonTypeLabels[type] ?? type}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-border bg-slate-900/60 p-3">
                  <p className="text-slate-500">Altura</p>
                  <p className="mt-1 font-semibold text-white">{entry.heightMeters.toFixed(1)} m</p>
                </div>
                <div className="rounded-xl border border-border bg-slate-900/60 p-3">
                  <p className="text-slate-500">Peso</p>
                  <p className="mt-1 font-semibold text-white">{entry.weightKg.toFixed(1)} kg</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Habilidades
                </p>
                <div className="flex flex-wrap gap-2">
                  {entry.abilities.map((ability) => (
                    <span
                      key={`${entry.id}-${ability.name}`}
                      className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-300"
                    >
                      {ability.name}
                      {ability.hidden && <span className="text-slate-500"> oculta</span>}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Stats base
                </p>
                <div className="space-y-2">
                  {entry.stats.map((stat) => (
                    <div key={`${entry.id}-${stat.name}`} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-2 text-xs">
                      <span className="text-slate-400">{stat.name}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <span
                          className="block h-full rounded-full bg-[#FFCB05]"
                          style={{ width: `${Math.min(100, Math.round((stat.value / 180) * 100))}%` }}
                        />
                      </span>
                      <span className="text-right font-semibold text-white">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto grid gap-2 sm:grid-cols-2">
                <Link href={entry.officialPokedexUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    Pokedex <ExternalLink size={13} />
                  </Button>
                </Link>
                <Link href={entry.officialTcgCardsUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    Cartas TCG <ExternalLink size={13} />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
