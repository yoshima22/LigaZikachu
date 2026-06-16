"use client";

import { useState, useTransition, useCallback } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { getPokemonElement, getPokemonTypes, getPokemonName, getStaticSpriteUrl, MOOD_EMOJI } from "@/lib/mascot-data";
import { getMascotDetailAction, interactAction } from "../actions";
import { MascotCard } from "./mascot-card";

export type BankMascot = {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  mood: string;
  isShiny: boolean;
  arenaState: string;
  bazarListed: boolean;
  injuredAt: Date | null;
  restingUntil: Date | null;
  expeditions: { id: string; finishAt: Date; status: string }[];
  buffs: { id: string }[];
  lastInteractedAt: Date | null;
  socialCooldownUntil: Date | null;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
};

type FullMascotData = NonNullable<Awaited<ReturnType<typeof getMascotDetailAction>>["data"]>;

const PAGE_SIZE = 9;

// Baseline: 5 stats × 10 = 50. Cap: 5 × 250 = 1250. Cor baseada no total acima do baseline.
function statNameColor(m: Pick<BankMascot, "statForce"|"statAgility"|"statCharisma"|"statInstinct"|"statVitality">): string {
  const total = m.statForce + m.statAgility + m.statCharisma + m.statInstinct + m.statVitality;
  const gain  = total - 50; // acima do baseline (máx ~1200)
  if (gain >= 750) return "text-yellow-300";  // 🟡 Lendário  (≥150/stat médio)
  if (gain >= 350) return "text-purple-300";  // 🟣 Bastante  (≥70/stat médio)
  if (gain >= 100) return "text-blue-300";    // 🔵 Médio     (≥20/stat médio)
  if (gain >= 1)   return "text-green-300";   // 🟢 Pouco
  return "text-slate-200";                    // sem melhoria
}

// ── Tipo → cor de badge ─────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  normal:   "bg-slate-500/25 text-slate-300 border-slate-500/30",
  fire:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  water:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  grass:    "bg-green-500/20 text-green-300 border-green-500/30",
  electric: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30",
  psychic:  "bg-pink-500/20 text-pink-300 border-pink-500/30",
  fighting: "bg-red-600/20 text-red-300 border-red-600/30",
  dark:     "bg-slate-700/40 text-slate-400 border-slate-600/30",
  steel:    "bg-slate-400/20 text-slate-300 border-slate-400/30",
  dragon:   "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  fairy:    "bg-pink-400/20 text-pink-200 border-pink-400/30",
  ghost:    "bg-purple-600/20 text-purple-300 border-purple-600/30",
  poison:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  ground:   "bg-amber-600/20 text-amber-300 border-amber-600/30",
  rock:     "bg-stone-500/20 text-stone-300 border-stone-500/30",
  flying:   "bg-sky-500/20 text-sky-300 border-sky-500/30",
  bug:      "bg-lime-500/20 text-lime-300 border-lime-500/30",
  ice:      "bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
};

const TYPE_LABELS: Record<string, string> = {
  normal:"Normal", fire:"Fogo", water:"Água", grass:"Grama", electric:"Elétrico",
  psychic:"Psíquico", fighting:"Lutador", dark:"Noturno", steel:"Metal",
  dragon:"Dragão", fairy:"Fada", ghost:"Fantasma", poison:"Venenoso",
  ground:"Terra", rock:"Pedra", flying:"Voador", bug:"Inseto", ice:"Gelo",
};

// ── Ocupação ────────────────────────────────────────────────────────────────
type OcupFilter = "all" | "free" | "busy" | "expedition" | "bazar" | "arena" | "resting" | "injured" | "buff";

const OCUP_OPTIONS: { value: OcupFilter; label: string }[] = [
  { value: "all",        label: "Todas situações" },
  { value: "free",       label: "🟢 Livre" },
  { value: "busy",       label: "🔴 Ocupado" },
  { value: "expedition", label: "🗺 Expedição" },
  { value: "bazar",      label: "🏪 No Bazar" },
  { value: "arena",      label: "⚔️ Na Arena" },
  { value: "resting",    label: "💤 Repouso" },
  { value: "injured",    label: "🩹 Ferido" },
  { value: "buff",       label: "✨ Com Bônus" },
];

function getOccupationChips(mascot: BankMascot): { label: string; cls: string }[] {
  const chips: { label: string; cls: string }[] = [];
  if (mascot.expeditions.length > 0)
    chips.push({ label: "🗺 Expedição", cls: "bg-blue-500/15 text-blue-300 border-blue-500/20" });
  if (mascot.bazarListed)
    chips.push({ label: "🏪 Bazar", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20" });
  if (mascot.arenaState === "ARENA")
    chips.push({ label: "⚔️ Arena", cls: "bg-red-500/15 text-red-300 border-red-500/20" });
  if (mascot.arenaState === "RESTING")
    chips.push({ label: "💤 Repouso", cls: "bg-sky-500/15 text-sky-300 border-sky-500/20" });
  if (mascot.arenaState === "INJURED")
    chips.push({ label: "🩹 Ferido", cls: "bg-orange-500/15 text-orange-300 border-orange-500/20" });
  // FREE + restingUntil = cooldown de re-entrada na arena
  if (mascot.arenaState === "FREE" && mascot.restingUntil && new Date(mascot.restingUntil) > new Date()) {
    const remMin = Math.ceil((new Date(mascot.restingUntil).getTime() - Date.now()) / 60_000);
    chips.push({ label: `⏳ Cooldown Arena (${remMin}min)`, cls: "bg-amber-500/15 text-amber-300 border-amber-500/20" });
  }
  if (mascot.buffs.length > 0)
    chips.push({ label: "✨ Bônus", cls: "bg-purple-500/15 text-purple-300 border-purple-500/20" });
  return chips;
}

function isBusy(mascot: BankMascot) {
  return (
    mascot.expeditions.length > 0 ||
    mascot.bazarListed ||
    mascot.arenaState !== "FREE" ||
    mascot.buffs.length > 0
  );
}

function matchOcup(mascot: BankMascot, filter: OcupFilter): boolean {
  switch (filter) {
    case "all":        return true;
    case "free":       return !isBusy(mascot);
    case "busy":       return isBusy(mascot);
    case "expedition": return mascot.expeditions.length > 0;
    case "bazar":      return mascot.bazarListed;
    case "arena":      return mascot.arenaState === "ARENA";
    case "resting":    return mascot.arenaState === "RESTING";
    case "injured":    return mascot.arenaState === "INJURED";
    case "buff":       return mascot.buffs.length > 0;
    default:           return true;
  }
}

// ── BankRow ─────────────────────────────────────────────────────────────────
function QuickInteractButton({
  mascotId,
  type,
  label,
}: {
  mascotId: string;
  type: "PET" | "PLAY";
  label: string;
}) {
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
      title={label}
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
    startLoading(async () => {
      const res = await getMascotDetailAction(mascot.id);
      if (res.error || !res.data) { setLoadError(res.error ?? "Erro ao carregar."); return; }
      setFullData(res.data);
    });
  }, [mascot.id]);

  const handleExpand = useCallback(() => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (fullData) return;
    fetchFull();
  }, [open, fullData, fetchFull]);

  const name  = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const types = getPokemonTypes(mascot.pokemonId);
  const chips     = getOccupationChips(mascot);
  const nameColor = statNameColor(mascot);

  return (
    <div className="rounded-xl border border-border/50 bg-slate-950/40 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/40 transition-colors">
        {/* Área clicável para expandir */}
        <button type="button" onClick={handleExpand} className="flex-1 min-w-0 flex items-center gap-3 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getStaticSpriteUrl(mascot.pokemonId)}
            alt=""
            className={`h-9 w-9 object-contain shrink-0 ${mascot.isShiny ? "drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]" : "opacity-80"}`}
            style={{ imageRendering: "pixelated" }}
            loading="lazy"
          />
          <span className="flex-1 min-w-0 space-y-0.5">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className={`truncate text-sm font-semibold ${nameColor}`}>{name}</span>
              {mascot.isShiny && <span className="text-[10px] text-yellow-300" title="Shiny">✦</span>}
            </span>
            <span className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500">Nv.{mascot.level}</span>
              {types.map(t => (
                <span key={t} className={`rounded border px-1.5 py-px text-[9px] font-bold ${TYPE_COLORS[t] ?? "bg-slate-500/20 text-slate-400 border-slate-500/20"}`}>
                  {TYPE_LABELS[t] ?? t}
                </span>
              ))}
              <span className="text-[10px] text-slate-600">
                {MOOD_EMOJI[mascot.mood] ?? "•"} {mascot.mood}
              </span>
            </span>
          </span>
        </button>

        {/* Quick actions + occupation chips + chevron */}
        <span className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <QuickInteractButton mascotId={mascot.id} type="PET" label="🤗 Carinho" />
          <QuickInteractButton mascotId={mascot.id} type="PLAY" label="🎮 Brincar" />
          <span className="flex items-center gap-1 flex-wrap justify-end max-w-[120px]">
            {chips.map(c => (
              <span key={c.label} className={`rounded border px-1.5 py-px text-[9px] font-semibold ${c.cls}`}>
                {c.label}
              </span>
            ))}
            {chips.length === 0 && (
              <span className="rounded border px-1.5 py-px text-[9px] font-semibold bg-green-500/10 text-green-400 border-green-500/20">
                🟢 Livre
              </span>
            )}
          </span>
          <button type="button" onClick={handleExpand} className="ml-0.5">
            {loading ? (
              <Loader2 size={13} className="animate-spin text-slate-500 shrink-0" />
            ) : open ? (
              <ChevronUp size={13} className="text-slate-500 shrink-0" />
            ) : (
              <ChevronDown size={13} className="text-slate-500 shrink-0" />
            )}
          </button>
        </span>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-border/40 bg-slate-900/30">
          {loadError && (
            <p className="px-4 py-3 text-xs text-red-400">{loadError}</p>
          )}
          {!fullData && !loadError && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Carregando dados do mascote...
            </div>
          )}
          {fullData && (
            <>
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <button
                  type="button"
                  onClick={() => setView("basic")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    view === "basic"
                      ? "bg-[#FFCB05]/15 text-[#FFCB05] border border-[#FFCB05]/30"
                      : "text-slate-500 hover:text-slate-300 border border-transparent"
                  }`}
                >
                  Básico
                </button>
                <button
                  type="button"
                  onClick={() => setView("full")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    view === "full"
                      ? "bg-slate-700 text-slate-200 border border-slate-600"
                      : "text-slate-500 hover:text-slate-300 border border-transparent"
                  }`}
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

// ── MascotBankList ───────────────────────────────────────────────────────────
const BANK_TYPE_OPTIONS = [
  "normal","fire","water","grass","electric","psychic","fighting",
  "dark","steel","dragon","fairy","ghost","poison","ground","rock","flying","bug","ice",
];

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
  const [search, setSearch]     = useState("");
  const [ocup, setOcup]         = useState<OcupFilter>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage]         = useState(1);

  // Filtragem
  const filtered = mascots.filter(m => {
    const name = (m.nickname ?? getPokemonName(m.pokemonId)).toLowerCase();
    const q    = search.toLowerCase();
    const matchSearch = !q || name.includes(q) || String(m.pokemonId).includes(q);
    const matchType   = !typeFilter || getPokemonElement(m.pokemonId) === typeFilter;
    return matchSearch && matchType && matchOcup(m, ocup);
  });

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Volta para página 1 quando filtros mudam
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleOcup   = (v: OcupFilter) => { setOcup(v); setPage(1); };
  const handleType   = (v: string) => { setTypeFilter(v); setPage(1); };

  // Contadores para cada situação (para exibir no select)
  const busyCount = mascots.filter(m => isBusy(m)).length;
  const freeCount = mascots.length - busyCount;
  const knownTotal = Math.max(totalCount ?? mascots.length, mascots.length);
  const isPartial = knownTotal > mascots.length;

  if (mascots.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-300">
          Banco de mascotes
          <span className="ml-2 text-[10px] text-slate-500 font-normal">
            ({isPartial ? `${mascots.length} de ${knownTotal}` : mascots.length})
          </span>
          {freeCount > 0 && (
            <span className="ml-1.5 text-[10px] text-green-500/70 font-normal">{freeCount} livres</span>
          )}
          {busyCount > 0 && (
            <span className="ml-1 text-[10px] text-slate-600 font-normal">· {busyCount} ocupados</span>
          )}
        </h2>
      </div>
      {isPartial && (
        <p className="rounded-xl border border-slate-700/50 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-500">
          Para economizar dados, esta tela carrega primeiro os {mascots.length} mascotes de maior nivel do banco.
          Favoritos e companheiro continuam sempre completos.
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {/* Busca */}
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar..."
            className="rounded-xl border border-border bg-slate-900 pl-7 pr-3 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600 w-36"
          />
        </div>
        {/* Tipo de Pokémon */}
        <select
          value={typeFilter}
          onChange={e => handleType(e.target.value)}
          className="rounded-xl border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-[#FFCB05]"
        >
          <option value="">Todos os tipos</option>
          {BANK_TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        {/* Situação / ocupação */}
        <select
          value={ocup}
          onChange={e => handleOcup(e.target.value as OcupFilter)}
          className="rounded-xl border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-[#FFCB05]"
        >
          {OCUP_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Lista paginada */}
      {pageItems.length === 0 ? (
        <p className="text-center text-xs text-slate-600 py-4">Nenhum mascote encontrado.</p>
      ) : (
        <div className="space-y-1">
          {pageItems.map(m => (
            <BankRow
              key={m.id}
              mascot={m}
              hasFood={hasFood}
              hasSweet={hasSweet}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage(p => p - 1)}
            className="flex items-center gap-1 rounded-xl border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={12} /> Anterior
          </button>

          <span className="text-xs text-slate-500">
            Página <span className="font-semibold text-slate-300">{safePage}</span> de{" "}
            <span className="font-semibold text-slate-300">{totalPages}</span>
            <span className="ml-1 text-slate-600">({filtered.length} mascotes)</span>
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="flex items-center gap-1 rounded-xl border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Próxima <ChevronRight size={12} />
          </button>
        </div>
      )}
    </section>
  );
}
