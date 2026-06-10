"use client";

import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, X, ArrowUpDown, ChevronDown } from "lucide-react";
import { getSpriteUrl, getPokemonName, getPokemonElement, TYPE_ADVANTAGE } from "@/lib/mascot-data";
import { addMascotToArenaTeamAction, createArenaTeamAction } from "../actions";

export interface ValidMascot {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  statForce: number;
  statAgility: number;
  statVitality: number;
  statInstinct: number;
  arenaState: string;
  restingUntil: string | null;
  arenaEntryCooldownUntil: string | null;
}

const MAX_MASCOTS = 6;

const ARENA_ROOM_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
type ArenaRoomLevel = typeof ARENA_ROOM_OPTIONS[number];

type SortKey = "level_desc" | "level_asc" | "stats_desc" | "name_asc";
type FilterKey = "available" | "cooldown" | "all";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "level_desc", label: "Nível ↓" },
  { value: "level_asc",  label: "Nível ↑" },
  { value: "stats_desc", label: "Stats ↓" },
  { value: "name_asc",   label: "Nome A→Z" },
];

// Cores por tipo
const TYPE_COLORS: Record<string, string> = {
  fire:     "bg-orange-500/20 text-orange-300 border-orange-500/40",
  water:    "bg-blue-500/20 text-blue-300 border-blue-500/40",
  grass:    "bg-green-500/20 text-green-300 border-green-500/40",
  electric: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40",
  psychic:  "bg-pink-500/20 text-pink-300 border-pink-500/40",
  ghost:    "bg-purple-600/20 text-purple-300 border-purple-600/40",
  dragon:   "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  fighting: "bg-red-600/20 text-red-300 border-red-600/40",
  ground:   "bg-amber-600/20 text-amber-300 border-amber-600/40",
  rock:     "bg-stone-500/20 text-stone-300 border-stone-500/40",
  ice:      "bg-cyan-400/20 text-cyan-300 border-cyan-400/40",
  poison:   "bg-violet-500/20 text-violet-300 border-violet-500/40",
  bug:      "bg-lime-500/20 text-lime-300 border-lime-500/40",
  flying:   "bg-sky-400/20 text-sky-300 border-sky-400/40",
  dark:     "bg-slate-600/30 text-slate-300 border-slate-600/50",
  steel:    "bg-slate-400/20 text-slate-200 border-slate-400/40",
  fairy:    "bg-rose-400/20 text-rose-300 border-rose-400/40",
  normal:   "bg-slate-700/30 text-slate-400 border-slate-700/40",
};

const TYPE_LABELS: Record<string, string> = {
  fire: "Fogo", water: "Água", grass: "Planta", electric: "Elétrico",
  psychic: "Psíquico", ghost: "Fantasma", dragon: "Dragão", fighting: "Lutador",
  ground: "Terra", rock: "Pedra", ice: "Gelo", poison: "Veneno",
  bug: "Inseto", flying: "Voador", dark: "Sombrio", steel: "Aço",
  fairy: "Fada", normal: "Normal",
};

function TypeBadge({ type, small = false }: { type: string; small?: boolean }) {
  const cls = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
  return (
    <span className={`inline-block rounded border px-1 font-bold uppercase tracking-widest ${small ? "text-[8px] py-0" : "text-[9px] py-0.5"} ${cls}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 > 0 ? ` ${m % 60}m` : ""}`;
}

function totalStats(m: ValidMascot) {
  return m.statForce + m.statAgility + m.statVitality + m.statInstinct;
}

function displayName(m: ValidMascot) {
  return m.nickname ?? getPokemonName(m.pokemonId);
}

type BlockInfo = { type: "arena" | "injured" | "resting" | "cooldown"; until?: number };

function getBlock(m: ValidMascot, now: number): BlockInfo | null {
  if (m.arenaState === "ARENA")   return { type: "arena" };
  if (m.arenaState === "INJURED") return { type: "injured" };
  const t = m.restingUntil ? new Date(m.restingUntil).getTime() : 0;
  if (m.arenaState === "RESTING" && t > now) return { type: "resting", until: t };
  if (m.arenaState === "FREE"    && t > now) return { type: "cooldown", until: t };
  return null;
}

const BLOCK_STYLE: Record<string, { icon: string; label: string; cls: string }> = {
  arena:    { icon: "⚔️", label: "Na arena",        cls: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20" },
  injured:  { icon: "🩹", label: "Ferido",           cls: "bg-red-500/10 text-red-300 border-red-500/20" },
  resting:  { icon: "💤", label: "Recuperando",      cls: "bg-blue-500/10 text-blue-300 border-blue-500/20" },
  cooldown: { icon: "⏳", label: "Cooldown Arena",   cls: "bg-orange-500/10 text-orange-300 border-orange-500/20" },
};

// ── LiveCountdown ────────────────────────────────────────────────────────

function LiveCountdown({ until, className = "" }: { until: number; className?: string }) {
  const [rem, setRem] = useState(() => until - Date.now());
  useEffect(() => {
    const id = setInterval(() => setRem(until - Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (rem <= 0) return <span className={`text-green-400 ${className}`}>Pronto!</span>;
  return <span className={className}>{fmtCountdown(rem)}</span>;
}

// ── MascotCard ─────────────────────────────────────────────────────────────

function MascotPick({
  m, selected, maxReached, onToggle, now, compact, roomLevel,
}: {
  m: ValidMascot; selected: boolean; maxReached: boolean; onToggle: () => void;
  now: number; compact: boolean; roomLevel: ArenaRoomLevel;
}) {
  const block = getBlock(m, now);
  const blocked = block !== null;
  const overLevel = m.level > roomLevel;
  const clickable = !blocked && (!maxReached || selected);
  const bs = block ? BLOCK_STYLE[block.type] : null;
  const pokemonType = getPokemonElement(m.pokemonId);
  const beats = (TYPE_ADVANTAGE[pokemonType] ?? []).slice(0, 2);

  let borderCls: string;
  if (selected && overLevel) {
    borderCls = "border-red-500/70 bg-red-500/10 ring-1 ring-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.2)]";
  } else if (selected) {
    borderCls = "border-[#FFCB05]/60 bg-[#FFCB05]/8 ring-1 ring-[#FFCB05]/30 shadow-[0_0_14px_rgba(255,203,5,0.18)]";
  } else if (blocked) {
    borderCls = "border-slate-700/40 bg-slate-900/30 opacity-55 cursor-not-allowed";
  } else if (maxReached) {
    borderCls = "border-slate-700/40 bg-slate-900/30 opacity-40 cursor-not-allowed";
  } else if (overLevel) {
    borderCls = "border-red-900/40 bg-slate-900/50 opacity-70 hover:border-red-700/50 cursor-pointer";
  } else {
    borderCls = "border-slate-700/60 bg-slate-900/50 hover:border-[#FFCB05]/30 hover:bg-slate-900/80 cursor-pointer";
  }

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onToggle : undefined}
      title={blocked ? (bs?.label ?? "") : displayName(m)}
      className={`relative flex flex-col rounded-xl border transition-all duration-150 text-left overflow-hidden ${borderCls}`}
    >
      {/* Check / over-level indicator */}
      {selected && !overLevel && (
        <span className="absolute right-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFCB05] text-[8px] font-black text-[#1A1A2E]">✓</span>
      )}
      {selected && overLevel && (
        <span className="absolute right-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white">!</span>
      )}
      {/* Over-level ribbon (not selected) */}
      {!selected && overLevel && (
        <div className="absolute top-0 left-0 right-0 bg-red-900/60 text-center text-[8px] font-bold text-red-300 py-0.5 z-10">
          Nv.{m.level} &gt; sala
        </div>
      )}

      <div className={`flex flex-col items-center ${compact ? "p-1.5 gap-0.5" : "p-2 gap-1"}`}>
        <div className={`flex justify-center ${compact ? "pb-0" : "pb-1"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getSpriteUrl(m.pokemonId, true)}
            alt=""
            className={`object-contain ${compact ? "h-10 w-10" : "h-14 w-14"} ${blocked ? "grayscale" : ""}`}
            style={{ imageRendering: "pixelated" }}
            onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(m.pokemonId); }}
          />
        </div>
        <div className="text-center leading-tight">
          <p className="truncate text-[10px] font-semibold text-slate-100">{displayName(m)}</p>
          <p className="text-[9px] text-slate-500">
            Nv.{m.level}{!compact && <span className="ml-1 text-slate-600">Σ{totalStats(m)}</span>}
          </p>
          {!compact && (
            <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
              <TypeBadge type={pokemonType} small />
              {beats.map(b => (
                <span key={b} className="text-[8px] text-slate-600">▶{TYPE_LABELS[b] ?? b}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {!compact && (
        <div className="px-2 pb-2 grid grid-cols-4 gap-0.5 text-center text-[9px]">
          {[
            { k: "For", v: m.statForce,    c: "text-red-400" },
            { k: "Vel", v: m.statAgility,  c: "text-yellow-400" },
            { k: "Ins", v: m.statInstinct, c: "text-blue-400" },
            { k: "Vit", v: m.statVitality, c: "text-green-400" },
          ].map(s => (
            <div key={s.k} className="rounded bg-slate-800/60 py-0.5">
              <div className="text-slate-600">{s.k}</div>
              <div className={`font-bold ${s.c}`}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {block && bs && (
        <div className={`flex items-center justify-between gap-1 border-t px-2 py-1 text-[9px] font-medium ${bs.cls}`}>
          <span>{bs.icon} {bs.label}</span>
          {block.until && <LiveCountdown until={block.until} className="font-mono tabular-nums" />}
        </div>
      )}
    </button>
  );
}

// ── SelectedBar ────────────────────────────────────────────────────────────

function SelectedBar({
  mascots, selected, onRemove, roomLevel,
}: {
  mascots: ValidMascot[]; selected: Set<string>; onRemove: (id: string) => void; roomLevel: ArenaRoomLevel;
}) {
  const selList = mascots.filter(m => selected.has(m.id));

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-2">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#FFCB05]/70 shrink-0">Time</span>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: MAX_MASCOTS }).map((_, i) => {
          const m = selList[i];
          const overLevel = m && m.level > roomLevel;
          return m ? (
            <button
              key={m.id}
              type="button"
              onClick={() => onRemove(m.id)}
              title={overLevel ? `Nível ${m.level} acima do máximo da sala` : `Remover ${displayName(m)}`}
              className="relative group shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getSpriteUrl(m.pokemonId, true)}
                alt={displayName(m)}
                className={`h-9 w-9 object-contain rounded-lg bg-slate-800/60 transition-all ${
                  overLevel
                    ? "ring-2 ring-red-500/70 group-hover:ring-red-400"
                    : "ring-1 ring-[#FFCB05]/30 group-hover:ring-red-400/60"
                }`}
                style={{ imageRendering: "pixelated" }}
                onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(m.pokemonId); }}
              />
              {overLevel && (
                <span className="absolute -left-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[7px] font-black text-white">!</span>
              )}
              <span className="absolute -right-1 -top-1 hidden group-hover:flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[7px] font-black text-white">×</span>
            </button>
          ) : (
            <div key={i} className="h-9 w-9 shrink-0 rounded-lg border border-dashed border-slate-700/50 bg-slate-900/30" />
          );
        })}
      </div>
      <span className={`text-[10px] font-bold shrink-0 ${selected.size >= MAX_MASCOTS ? "text-[#FFCB05]" : "text-slate-500"}`}>
        {selected.size}/{MAX_MASCOTS}
      </span>
    </div>
  );
}

// ── CreateTeamForm ─────────────────────────────────────────────────────────

export function CreateTeamForm({ mascots }: { mascots: ValidMascot[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [roomLevel, setRoomLevel] = useState<ArenaRoomLevel>(100);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("level_desc");
  const [filter, setFilter] = useState<FilterKey>("available");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [levelError, setLevelError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(id);
  }, []);

  // Clear level error when room changes
  useEffect(() => { setLevelError(null); }, [roomLevel]);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      if (next.size >= MAX_MASCOTS) { toast.error(`Máximo ${MAX_MASCOTS} mascotes.`); return prev; }
      next.add(id);
      return next;
    });
    setLevelError(null);
  }, []);

  // All unique types present in the mascot pool
  const availableTypes = useMemo(() => {
    const types = new Set(mascots.filter(m => getBlock(m, now) === null).map(m => getPokemonElement(m.pokemonId)));
    return [...types].sort();
  }, [mascots, now]);

  const counts = useMemo(() => ({
    available: mascots.filter(m => getBlock(m, now) === null).length,
    cooldown:  mascots.filter(m => { const b = getBlock(m, now); return b?.type === "cooldown" || b?.type === "resting"; }).length,
    all: mascots.length,
  }), [mascots, now]);

  const displayed = useMemo(() => {
    let list = mascots.filter(m => {
      if (filter === "available") return getBlock(m, now) === null;
      if (filter === "cooldown")  { const b = getBlock(m, now); return b?.type === "cooldown" || b?.type === "resting"; }
      return true;
    });
    if (typeFilter) {
      list = list.filter(m => getPokemonElement(m.pokemonId) === typeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(m => displayName(m).toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (sort === "level_desc") return b.level - a.level;
      if (sort === "level_asc")  return a.level - b.level;
      if (sort === "stats_desc") return totalStats(b) - totalStats(a);
      return displayName(a).localeCompare(displayName(b));
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascots, filter, search, sort, typeFilter, now]);

  const overLevelSelected = useMemo(
    () => mascots.filter(m => selected.has(m.id) && m.level > roomLevel),
    [mascots, selected, roomLevel]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) { toast.error("Selecione ao menos 1 mascote."); return; }
    if (overLevelSelected.length > 0) {
      setLevelError(
        `Seu time tem ${overLevelSelected.length === 1 ? "um integrante que não atende" : `${overLevelSelected.length} integrantes que não atendem`} ao nível máximo da sala (Nv.${roomLevel}).`
      );
      return;
    }
    setLevelError(null);
    startTransition(async () => {
      const r = await createArenaTeamAction([...selected], name.trim(), roomLevel);
      if (r.error) toast.error(r.error);
      else { toast.success("Equipe criada!"); router.refresh(); setSelected(new Set()); setName(""); }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">

      {/* ── Barra de seleção ── */}
      {selected.size > 0 && (
        <SelectedBar mascots={mascots} selected={selected} onRemove={toggle} roomLevel={roomLevel} />
      )}

      {/* ── Configurações fixas (nome + sala) ── */}
      <div className="rounded-xl border border-border bg-slate-900/40 px-3 py-3 space-y-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome da equipe (vazio = automático)"
          className="w-full rounded-lg border border-border bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/60"
        />
        <div>
          <p className="mb-1.5 text-[10px] text-slate-500 font-semibold">Sala (nível máximo dos mascotes):</p>
          <div className="flex flex-wrap gap-1.5">
            {ARENA_ROOM_OPTIONS.map(lvl => (
              <button key={lvl} type="button" onClick={() => setRoomLevel(lvl)}
                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                  roomLevel === lvl
                    ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]"
                    : "border-border text-slate-500 hover:border-slate-600 hover:text-slate-300"
                }`}>
                Nv.{lvl}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[9px] text-slate-600">Apenas mascotes com nível ≤ {roomLevel} podem entrar nesta sala.</p>
        </div>
      </div>

      {/* ── Erro de nível ── */}
      {levelError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 font-semibold flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{levelError}</span>
        </div>
      )}

      {/* ── Controles de busca/filtro ── */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
            className="w-full rounded-lg border border-border bg-slate-900 pl-7 pr-8 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(["available","cooldown","all"] as FilterKey[]).map(f => {
            const labels = {
              available: `✅ Livres (${counts.available})`,
              cooldown:  `⏳ Cooldown (${counts.cooldown})`,
              all:       `Todos (${counts.all})`,
            };
            return (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  filter === f
                    ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]"
                    : "border-border text-slate-500 hover:text-slate-300"
                }`}>
                {labels[f]}
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative flex items-center gap-1 rounded-lg border border-border bg-slate-900 px-2 py-1">
              <ArrowUpDown size={10} className="text-slate-500 shrink-0" />
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="bg-transparent text-[10px] text-slate-400 outline-none cursor-pointer appearance-none pr-0.5"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setCompact(v => !v)}
              className={`rounded-lg border px-2 py-1 text-[10px] transition-colors ${compact ? "border-[#FFCB05]/40 text-[#FFCB05]" : "border-border text-slate-500"}`}
              title={compact ? "Modo detalhado" : "Modo compacto"}
            >
              {compact ? "⊞" : "⊟"}
            </button>
          </div>
        </div>

        {/* Filtro por tipo */}
        {availableTypes.length > 1 && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest shrink-0">Tipo:</span>
            <button
              type="button"
              onClick={() => setTypeFilter(null)}
              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-colors ${
                !typeFilter ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-border text-slate-500 hover:text-slate-300"
              }`}
            >
              Todos
            </button>
            {availableTypes.map(type => {
              const active = typeFilter === type;
              const cls = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(active ? null : type)}
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-bold transition-all ${
                    active ? cls : "border-border text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {TYPE_LABELS[type] ?? type}
                  {/* Show what this type beats */}
                  {active && (TYPE_ADVANTAGE[type] ?? []).length > 0 && (
                    <span className="ml-1 text-[8px] opacity-70">
                      ▶{(TYPE_ADVANTAGE[type] ?? []).map(t => TYPE_LABELS[t] ?? t).join(", ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Grade de mascotes ── */}
      <div className="max-h-[440px] overflow-y-auto rounded-xl">
        {displayed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-slate-500">
            {search ? `Nenhum resultado para "${search}"` :
              typeFilter ? `Nenhum mascote do tipo ${TYPE_LABELS[typeFilter] ?? typeFilter} disponível.` :
              filter === "available" ? "Nenhum mascote livre agora — veja \"Cooldown\" ou \"Todos\"." :
              filter === "cooldown"  ? "Nenhum mascote em cooldown." :
              "Nenhum mascote disponível."}
          </div>
        ) : (
          <div className={`grid gap-1.5 ${compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
            {displayed.map(m => (
              <MascotPick
                key={m.id}
                m={m}
                selected={selected.has(m.id)}
                maxReached={!selected.has(m.id) && selected.size >= MAX_MASCOTS}
                onToggle={() => toggle(m.id)}
                now={now}
                compact={compact}
                roomLevel={roomLevel}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={pending || selected.size === 0}
        className="w-full rounded-xl bg-[#FFCB05] py-3 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {pending
          ? "Criando equipe…"
          : selected.size === 0
            ? "Selecione ao menos 1 mascote"
            : overLevelSelected.length > 0
              ? `⚠️ ${overLevelSelected.length} mascote(s) fora do nível da sala`
              : `✅ Criar equipe com ${selected.size} mascote${selected.size !== 1 ? "s" : ""}`}
      </button>
    </form>
  );
}

// ── AddMascotToTeamForm ────────────────────────────────────────────────────

export function AddMascotToTeamForm({ teamId, mascots, slotsUsed }: { teamId: string; mascots: ValidMascot[]; slotsUsed: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mascotId, setMascotId] = useState("");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const slotsLeft = Math.max(0, MAX_MASCOTS - slotsUsed);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(id);
  }, []);

  if (slotsLeft === 0) return null;

  const available = mascots.filter(m => getBlock(m, now) === null);
  const cooling   = mascots.filter(m => { const b = getBlock(m, now); return !!b && b.type !== "arena" && b.type !== "injured"; });
  const selected  = mascots.find(m => m.id === mascotId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return available.filter(m => !q || displayName(m).toLowerCase().includes(q))
      .sort((a, b) => b.level - a.level);
  }, [available, search]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!mascotId) { toast.error("Escolha um mascote."); return; }
    startTransition(async () => {
      const result = await addMascotToArenaTeamAction(teamId, mascotId);
      if (result.error) toast.error(result.error);
      else { toast.success("Mascote adicionado!"); setMascotId(""); setOpen(false); router.refresh(); }
    });
  };

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-slate-700/50 bg-slate-950/60">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-xs"
      >
        <span className="font-semibold text-slate-300">
          ➕ Repor equipe
          <span className="ml-1.5 text-slate-500">({slotsLeft} slot{slotsLeft > 1 ? "s" : ""} livre{slotsLeft > 1 ? "s" : ""})</span>
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          {available.length > 0
            ? <span className="text-green-400 font-semibold">{available.length} disponíve{available.length !== 1 ? "is" : "l"}</span>
            : <span className="text-orange-400">Nenhum livre agora</span>}
          <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-700/50 p-3 space-y-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar mascote…"
              className="w-full rounded-lg border border-border bg-slate-900 pl-7 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60"
            />
          </div>

          {filtered.length === 0 && available.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 p-3 text-center text-[11px] text-slate-500">
              Nenhum mascote livre agora.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[11px] text-slate-500 py-2">Nenhum resultado.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto">
              {filtered.map(m => {
                const sel = mascotId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMascotId(sel ? "" : m.id)}
                    className={[
                      "relative flex items-center gap-2 rounded-lg border p-2 text-left transition-all",
                      sel
                        ? "border-[#FFCB05]/50 bg-[#FFCB05]/8 ring-1 ring-[#FFCB05]/30"
                        : "border-slate-700/50 bg-slate-900/40 hover:border-[#FFCB05]/25",
                    ].join(" ")}
                  >
                    {sel && (
                      <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FFCB05] text-[7px] font-black text-[#1A1A2E]">✓</span>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getSpriteUrl(m.pokemonId, true)}
                      alt=""
                      className="h-9 w-9 object-contain shrink-0"
                      style={{ imageRendering: "pixelated" }}
                      onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(m.pokemonId); }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-slate-200">{displayName(m)}</p>
                      <p className="text-[9px] text-slate-500">Nv.{m.level} · Σ{totalStats(m)}</p>
                      <TypeBadge type={getPokemonElement(m.pokemonId)} small />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {cooling.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-[9px] text-slate-600 hover:text-slate-400 flex items-center gap-1">
                <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
                {cooling.length} mascote{cooling.length > 1 ? "s" : ""} em cooldown/repouso
              </summary>
              <div className="mt-1.5 space-y-1">
                {cooling.map(m => {
                  const blk = getBlock(m, now)!;
                  const bs = BLOCK_STYLE[blk.type];
                  return (
                    <div key={m.id} className={`flex items-center justify-between rounded-lg border px-2 py-1.5 ${bs.cls}`}>
                      <div className="flex items-center gap-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getSpriteUrl(m.pokemonId, true)} alt="" className="h-6 w-6 object-contain grayscale" style={{ imageRendering: "pixelated" }} onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(m.pokemonId); }} />
                        <span className="text-[10px] font-medium">{displayName(m)} Nv.{m.level}</span>
                      </div>
                      <div className="text-right text-[9px] font-mono">
                        {bs.icon} {blk.until ? <LiveCountdown until={blk.until} /> : bs.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {selected && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getSpriteUrl(selected.pokemonId, true)} alt="" className="h-8 w-8 object-contain" style={{ imageRendering: "pixelated" }} onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(selected.pokemonId); }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#FFCB05] truncate">{displayName(selected)}</p>
                <p className="text-[9px] text-slate-400">Nv.{selected.level} · For {selected.statForce} Vel {selected.statAgility} Vit {selected.statVitality}</p>
              </div>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40 shrink-0"
              >
                {pending ? "…" : "Adicionar"}
              </button>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
