"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { getPokemonName, getPokemonTypes, getStaticSpriteUrl, MOOD_EMOJI } from "@/lib/mascot-data";
import { getBankMascotsPageAction, getMascotDetailAction, interactAction } from "../actions";
import { MascotCard } from "./mascot-card";
import type { BankMascot } from "./mascot-bank-list";

type FullMascotData = NonNullable<Awaited<ReturnType<typeof getMascotDetailAction>>["data"]>;
type OcupFilter = "all" | "free" | "busy" | "expedition" | "bazar" | "arena" | "resting" | "injured" | "buff";

const PAGE_SIZE = 9;

const TYPE_LABELS: Record<string, string> = {
  normal: "Normal", fire: "Fogo", water: "Agua", grass: "Grama", electric: "Eletrico",
  psychic: "Psiquico", fighting: "Lutador", dark: "Noturno", steel: "Metal",
  dragon: "Dragao", fairy: "Fada", ghost: "Fantasma", poison: "Venenoso",
  ground: "Terra", rock: "Pedra", flying: "Voador", bug: "Inseto", ice: "Gelo",
};

const TYPE_COLORS: Record<string, string> = {
  normal: "bg-slate-500/25 text-slate-300 border-slate-500/30",
  fire: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  water: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  grass: "bg-green-500/20 text-green-300 border-green-500/30",
  electric: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30",
  psychic: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  fighting: "bg-red-600/20 text-red-300 border-red-600/30",
  dark: "bg-slate-700/40 text-slate-400 border-slate-600/30",
  steel: "bg-slate-400/20 text-slate-300 border-slate-400/30",
  dragon: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  fairy: "bg-pink-400/20 text-pink-200 border-pink-400/30",
  ghost: "bg-purple-600/20 text-purple-300 border-purple-600/30",
  poison: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  ground: "bg-amber-600/20 text-amber-300 border-amber-600/30",
  rock: "bg-stone-500/20 text-stone-300 border-stone-500/30",
  flying: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  bug: "bg-lime-500/20 text-lime-300 border-lime-500/30",
  ice: "bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
};

const BANK_TYPE_OPTIONS = [
  "normal", "fire", "water", "grass", "electric", "psychic", "fighting",
  "dark", "steel", "dragon", "fairy", "ghost", "poison", "ground", "rock", "flying", "bug", "ice",
];

const OCUP_OPTIONS: { value: OcupFilter; label: string }[] = [
  { value: "all", label: "Todas situacoes" },
  { value: "free", label: "Livre" },
  { value: "busy", label: "Ocupado" },
  { value: "expedition", label: "Expedicao" },
  { value: "bazar", label: "No Bazar" },
  { value: "arena", label: "Na Arena" },
  { value: "resting", label: "Repouso" },
  { value: "injured", label: "Ferido" },
  { value: "buff", label: "Com bonus" },
];

function statNameColor(m: Pick<BankMascot, "statForce" | "statAgility" | "statCharisma" | "statInstinct" | "statVitality">) {
  const total = m.statForce + m.statAgility + m.statCharisma + m.statInstinct + m.statVitality;
  const gain = total - 50;
  if (gain >= 750) return "text-yellow-300";
  if (gain >= 350) return "text-purple-300";
  if (gain >= 100) return "text-blue-300";
  if (gain >= 1) return "text-green-300";
  return "text-slate-200";
}

function isBusy(mascot: BankMascot) {
  return (
    mascot.expeditions.length > 0 ||
    mascot.bazarListed ||
    mascot.arenaState !== "FREE" ||
    Boolean(mascot.restingUntil && new Date(mascot.restingUntil) > new Date()) ||
    mascot.buffs.length > 0
  );
}

function getOccupationChips(mascot: BankMascot) {
  const chips: { label: string; cls: string }[] = [];
  if (mascot.expeditions.length > 0) chips.push({ label: "Expedicao", cls: "bg-blue-500/15 text-blue-300 border-blue-500/20" });
  if (mascot.bazarListed) chips.push({ label: "Bazar", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20" });
  if (mascot.arenaState === "ARENA") chips.push({ label: "Arena", cls: "bg-red-500/15 text-red-300 border-red-500/20" });
  if (mascot.arenaState === "RESTING") chips.push({ label: "Repouso", cls: "bg-sky-500/15 text-sky-300 border-sky-500/20" });
  if (mascot.arenaState === "INJURED") chips.push({ label: "Ferido", cls: "bg-orange-500/15 text-orange-300 border-orange-500/20" });
  if (mascot.arenaState === "FREE" && mascot.restingUntil && new Date(mascot.restingUntil) > new Date()) {
    const remMin = Math.ceil((new Date(mascot.restingUntil).getTime() - Date.now()) / 60_000);
    chips.push({ label: `Cooldown ${remMin}min`, cls: "bg-amber-500/15 text-amber-300 border-amber-500/20" });
  }
  if (mascot.buffs.length > 0) chips.push({ label: "Bonus", cls: "bg-purple-500/15 text-purple-300 border-purple-500/20" });
  return chips;
}

function QuickInteractButton({ mascotId, type, label }: { mascotId: string; type: "PET" | "PLAY"; label: string }) {
  const [pending, startTransition] = useTransition();
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await interactAction(mascotId, type);
      if (res.error) { toast.error(res.error); return; }
      if (res.result?.message) {
        if (res.result.success) toast.success(res.result.message);
        else toast.error(res.result.message);
      }
    });
  };
  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="rounded-lg border border-slate-700/60 bg-slate-800/60 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
    >
      {pending ? <Loader2 size={10} className="animate-spin inline" /> : label}
    </button>
  );
}

function BankRow({
  mascot,
  hasFood,
  hasSweet,
  isAdmin,
}: {
  mascot: BankMascot;
  hasFood: boolean;
  hasSweet: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"basic" | "full">("basic");
  const [loading, startLoading] = useTransition();
  const [fullData, setFullData] = useState<FullMascotData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchFull = useCallback(() => {
    startLoading(() => {
      void (async () => {
        const res = await getMascotDetailAction(mascot.id);
        if (res.error || !res.data) {
          setLoadError(res.error ?? "Erro ao carregar.");
          return;
        }
        setFullData(res.data);
      })();
    });
  }, [mascot.id]);

  const handleExpand = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!fullData) fetchFull();
  }, [fetchFull, fullData, open]);

  const name = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const types = getPokemonTypes(mascot.pokemonId);
  const chips = getOccupationChips(mascot);

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-slate-950/40">
      <button
        type="button"
        onClick={handleExpand}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/40"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getStaticSpriteUrl(mascot.pokemonId)}
          alt=""
          className={`h-9 w-9 shrink-0 object-contain ${mascot.isShiny ? "drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]" : "opacity-80"}`}
          style={{ imageRendering: "pixelated" }}
          loading="lazy"
        />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`truncate text-sm font-semibold ${statNameColor(mascot)}`}>{name}</span>
            {mascot.isShiny && <span className="text-[10px] text-yellow-300" title="Shiny">*</span>}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Nv.{mascot.level}</span>
            {types.map((type) => (
              <span key={type} className={`rounded border px-1.5 py-px text-[9px] font-bold ${TYPE_COLORS[type] ?? "bg-slate-500/20 text-slate-400 border-slate-500/20"}`}>
                {TYPE_LABELS[type] ?? type}
              </span>
            ))}
            <span className="text-[10px] text-slate-600">{MOOD_EMOJI[mascot.mood] ?? "-"} {mascot.mood}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <QuickInteractButton mascotId={mascot.id} type="PET" label="🤗 Carinho" />
          <QuickInteractButton mascotId={mascot.id} type="PLAY" label="🎮 Brincar" />
          <span className="flex max-w-[120px] flex-wrap items-center justify-end gap-1">
            {chips.length === 0 ? (
              <span className="rounded border border-green-500/20 bg-green-500/10 px-1.5 py-px text-[9px] font-semibold text-green-400">Livre</span>
            ) : chips.map((chip) => (
              <span key={chip.label} className={`rounded border px-1.5 py-px text-[9px] font-semibold ${chip.cls}`}>{chip.label}</span>
            ))}
          </span>
          {loading ? <Loader2 size={13} className="shrink-0 animate-spin text-slate-500" /> : open ? <ChevronUp size={13} className="shrink-0 text-slate-500" /> : <ChevronDown size={13} className="shrink-0 text-slate-500" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/40 bg-slate-900/30">
          {loadError && <p className="px-4 py-3 text-xs text-red-400">{loadError}</p>}
          {!fullData && !loadError && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Carregando dados do mascote...
            </div>
          )}
          {fullData && (
            <>
              <div className="flex items-center gap-2 px-3 pb-1 pt-3">
                <button
                  type="button"
                  onClick={() => setView("basic")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${view === "basic" ? "border border-[#FFCB05]/30 bg-[#FFCB05]/15 text-[#FFCB05]" : "border border-transparent text-slate-500 hover:text-slate-300"}`}
                >
                  Basico
                </button>
                <button
                  type="button"
                  onClick={() => setView("full")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${view === "full" ? "border border-slate-600 bg-slate-700 text-slate-200" : "border border-transparent text-slate-500 hover:text-slate-300"}`}
                >
                  Completo
                </button>
              </div>
              <div className="px-2 pb-2">
                <MascotCard
                  mascot={{ ...fullData, hasFood, hasSweet }}
                  isAdmin={isAdmin}
                  compactView={view === "basic"}
                  onRefresh={fetchFull}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MascotBankList({
  mascots,
  totalCount,
  hasFood,
  hasSweet,
  isAdmin,
}: {
  mascots: BankMascot[];
  totalCount?: number;
  hasFood: boolean;
  hasSweet: boolean;
  isAdmin: boolean;
}) {
  const [rows, setRows] = useState<BankMascot[]>(mascots);
  const [knownTotal, setKnownTotal] = useState(totalCount ?? mascots.length);
  const [search, setSearch] = useState("");
  const [ocup, setOcup] = useState<OcupFilter>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPage, startPageLoad] = useTransition();
  const didInitialLoad = useRef(false);

  const loadPage = useCallback((nextPage: number) => {
    const safeNextPage = Math.max(1, nextPage);
    setLoadError(null);
    startPageLoad(() => {
      void (async () => {
        const res = await getBankMascotsPageAction({
          page: safeNextPage,
          search,
          type: typeFilter,
          ocup,
        });
        if (res.error || !res.data) {
          setLoadError(res.error ?? "Erro ao carregar banco de mascotes.");
          return;
        }
        setRows(res.data.mascots);
        setKnownTotal(res.data.total);
        setPage(res.data.page);
      })();
    });
  }, [ocup, search, typeFilter]);

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    if ((totalCount ?? mascots.length) > 0) loadPage(1);
  }, [loadPage, mascots.length, totalCount]);

  const totalPages = Math.max(1, Math.ceil(knownTotal / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const busyCount = rows.filter((mascot) => isBusy(mascot)).length;
  const freeCount = rows.length - busyCount;
  const isInitialLoading = loadingPage && rows.length === 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-300">
          Banco de mascotes
          <span className="ml-2 text-[10px] font-normal text-slate-500">
            ({rows.length > 0 ? `${rows.length} de ${knownTotal}` : knownTotal})
          </span>
          {freeCount > 0 && <span className="ml-1.5 text-[10px] font-normal text-green-500/70">{freeCount} livres nesta pagina</span>}
          {busyCount > 0 && <span className="ml-1 text-[10px] font-normal text-slate-600">- {busyCount} ocupados nesta pagina</span>}
        </h2>
        {loadingPage && (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Loader2 size={11} className="animate-spin" /> carregando
          </span>
        )}
      </div>

      <p className="rounded-xl border border-slate-700/50 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-500">
        Para economizar dados, o banco carrega sob demanda em paginas pequenas. Favoritos e companheiro continuam completos.
      </p>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={11} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") loadPage(1); }}
            placeholder="Buscar..."
            className="w-36 rounded-xl border border-border bg-slate-900 py-1.5 pl-7 pr-3 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#FFCB05]"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="rounded-xl border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-[#FFCB05]"
        >
          <option value="">Todos os tipos</option>
          {BANK_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{TYPE_LABELS[type] ?? type}</option>)}
        </select>
        <select
          value={ocup}
          onChange={(event) => setOcup(event.target.value as OcupFilter)}
          className="rounded-xl border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-[#FFCB05]"
        >
          {OCUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => loadPage(1)}
          disabled={loadingPage}
          className="rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-1.5 text-xs font-semibold text-[#FFCB05] transition-colors hover:bg-[#FFCB05]/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Aplicar filtros
        </button>
      </div>

      {loadError && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-300">{loadError}</p>
      )}

      {isInitialLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Carregando banco de mascotes...
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-600">Nenhum mascote encontrado.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((mascot) => (
            <BankRow
              key={mascot.id}
              mascot={mascot}
              hasFood={hasFood}
              hasSweet={hasSweet}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={safePage <= 1 || loadingPage}
            onClick={() => loadPage(safePage - 1)}
            className="flex items-center gap-1 rounded-xl border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={12} /> Anterior
          </button>
          <span className="text-xs text-slate-500">
            Pagina <span className="font-semibold text-slate-300">{safePage}</span> de{" "}
            <span className="font-semibold text-slate-300">{totalPages}</span>
            <span className="ml-1 text-slate-600">({knownTotal} mascotes)</span>
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages || loadingPage}
            onClick={() => loadPage(safePage + 1)}
            className="flex items-center gap-1 rounded-xl border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Proxima <ChevronRight size={12} />
          </button>
        </div>
      )}
    </section>
  );
}
