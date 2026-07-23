"use client";

import { useState, useTransition, useMemo } from "react";
import { Search, Loader2, FlaskConical, ShoppingBag, X, ChevronDown, ChevronUp, Plus, Microscope } from "lucide-react";
import { recycleMascotsAction, tradeDustForCoinsAction, tradeDustForEggAction, tradeDustForMonthlyItemAction } from "../actions";
import type { MascotRarity } from "../rarity";
import { calculateLabDust, getLabDustBase, getLabDustMultiplier } from "../dust";
import { MascotAnalyzer, RatingBadge } from "./mascot-analyzer";
import { PERFORMANCE_META, normalizePerformanceTag } from "@/lib/mascot-performance";

type LabMascot = {
  id: string;
  pokemonId: number;
  name: string;
  nickname: string | null;
  level: number;
  isShiny: boolean;
  spriteUrl: string;
  rarity: MascotRarity;
  dust: number;
  recyclable: boolean;
  isFavorite: boolean;
  bazarListed: boolean;
  operationsLocked: boolean;
  analyzed: boolean;
  ivRating: string | null;
  ivScore: number | null;
  performanceTag?: string | null;
};

type WeeklyUsage = { coinsTraded: number; commonEggs: number; rareEggs: number; specialEggs: number };
type Limits = { coinsTraded: number; commonEggs: number; rareEggs: number; specialEggs: number };
type Costs = { coins: number; commonEgg: number; rareEgg: number; specialEgg: number };
type MonthlyUsage = { labEggs: number; evolutionStones: number };
type MonthlyCosts = { labEgg: number; evolutionStone: number };

const RARITY_LABEL: Record<MascotRarity, string> = { COMMON: "Comum", RARE: "Raro", SPECIAL: "Especial" };
const RARITY_COLOR: Record<MascotRarity, string> = {
  COMMON: "text-slate-400 border-slate-600",
  RARE: "text-blue-400 border-blue-600/40",
  SPECIAL: "text-[#FFCB05] border-[#FFCB05]/40",
};
const MAX_SLOTS = 6;
const PAGE_SIZE = 12;

interface Props {
  initialDust: number;
  initialMascots: LabMascot[];
  initialWeeklyUsage: WeeklyUsage;
  initialMonthlyUsage: MonthlyUsage;
  weeklyEvolutionStone: { type: string; name: string };
  limits: Limits;
  costs: Costs;
  monthlyCosts: MonthlyCosts;
  initialCoinBalance: number;
  analysisCost: number;
}

// ── Guide section ─────────────────────────────────────────────────────────────
function GuideSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/60 bg-slate-900/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <span className="text-base">{icon}</span>
          {title}
        </span>
        {open ? <ChevronUp size={14} className="shrink-0 text-slate-500" /> : <ChevronDown size={14} className="shrink-0 text-slate-500" />}
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3 text-xs text-slate-400 leading-relaxed space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Dust preview calculation ──────────────────────────────────────────────────
function calcSlotDust(slots: LabMascot[]): { total: number; breakdown: { mascot: LabMascot; base: number; mult: number; dust: number }[] } {
  const breakdown = slots.map((m) => {
    const base = getLabDustBase(m.rarity);
    // Count copies of this pokémon among selected slots
    const copies = slots.filter((s) => s.pokemonId === m.pokemonId).length;
    const mult = getLabDustMultiplier(copies);
    return { mascot: m, base, mult, dust: calculateLabDust(m.rarity, copies) };
  });
  return { total: breakdown.reduce((s, b) => s + b.dust, 0), breakdown };
}

// ── Main component ────────────────────────────────────────────────────────────
export function LabClient({ initialDust, initialMascots, initialWeeklyUsage, initialMonthlyUsage, weeklyEvolutionStone, limits, costs, monthlyCosts, initialCoinBalance, analysisCost }: Props) {
  const [tab, setTab] = useState<"recycle" | "shop" | "analyze">("recycle");
  const [dust, setDust] = useState(initialDust);
  const [coinBalance, setCoinBalance] = useState(initialCoinBalance);
  const [mascots, setMascots] = useState(initialMascots);
  const [weeklyUsage, setWeeklyUsage] = useState(initialWeeklyUsage);
  const [monthlyUsage, setMonthlyUsage] = useState(initialMonthlyUsage);
  const [search, setSearch] = useState("");
  const [perfFilter, setPerfFilter] = useState("");
  const [page, setPage] = useState(0);
  const [isPending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [slots, setSlots] = useState<(LabMascot | null)[]>(Array(MAX_SLOTS).fill(null));
  const [confirming, setConfirming] = useState(false);

  const filledSlots = slots.filter((s): s is LabMascot => s !== null);
  const { total: previewTotal, breakdown } = useMemo(() => calcSlotDust(filledSlots), [filledSlots]);

  const filtered = useMemo(() => {
    const inSlots = new Set(filledSlots.map((m) => m.id));
    let base = mascots.filter((m) => m.recyclable && !inSlots.has(m.id));
    if (perfFilter) base = base.filter((m) => (m.performanceTag ?? "NEUTRO") === perfFilter);
    const q = search.trim().toLowerCase();
    if (q) base = base.filter((m) => m.name.toLowerCase().includes(q) || (m.nickname ?? "").toLowerCase().includes(q));
    return base;
  }, [mascots, filledSlots, search, perfFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const showFeedback = (ok: boolean, message: string) => {
    setFeedback({ ok, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const addToSlot = (m: LabMascot) => {
    setSlots((prev) => {
      const idx = prev.findIndex((s) => s === null);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = m;
      return next;
    });
    // Mantém a página atual — não volta pra primeira ao selecionar um mascote.
  };

  const removeSlot = (idx: number) => {
    setSlots((prev) => { const n = [...prev]; n[idx] = null; return n; });
  };

  const handleConfirmRecycle = () => {
    const ids = filledSlots.map((m) => m.id);
    if (ids.length === 0) return;
    start(async () => {
      const res = await recycleMascotsAction(ids);
      if (!res.ok) {
        showFeedback(false, res.error);
        return;
      }
      setDust((d) => d + res.dust);
      const recycledIds = new Set(res.recycledIds);
      setMascots((prev) => prev.filter((m) => !recycledIds.has(m.id)));
      setSlots(Array(MAX_SLOTS).fill(null));
      setConfirming(false);
      showFeedback(true, `+${res.dust} Po de Criacao obtido!`);
    });
  };

  const handleTradeCoins = () => {
    start(async () => {
      const res = await tradeDustForCoinsAction();
      if (!res.ok) { showFeedback(false, res.error); return; }
      setDust((d) => d - costs.coins);
      setWeeklyUsage((w) => ({ ...w, coinsTraded: w.coinsTraded + 1 }));
      showFeedback(true, "+400 ZikaCoins adicionados à sua carteira!");
    });
  };

  const handleTradeEgg = (tier: "COMMON" | "RARE" | "SPECIAL") => {
    start(async () => {
      const res = await tradeDustForEggAction(tier);
      if (!res.ok) { showFeedback(false, res.error); return; }
      const costMap = { COMMON: costs.commonEgg, RARE: costs.rareEgg, SPECIAL: costs.specialEgg };
      const fieldMap = { COMMON: "commonEggs" as const, RARE: "rareEggs" as const, SPECIAL: "specialEggs" as const };
      setDust((d) => d - costMap[tier]);
      setWeeklyUsage((w) => ({ ...w, [fieldMap[tier]]: w[fieldMap[tier]] + 1 }));
      const labels = { COMMON: "Ovo Comum", RARE: "Ovo Raro", SPECIAL: "Ovo Especial" };
      showFeedback(true, `${labels[tier]} adicionado à sua incubadora!`);
    });
  };

  const handleMonthlyTrade = (kind: "LAB_EGG" | "EVOLUTION_STONE") => {
    start(async () => {
      const res = await tradeDustForMonthlyItemAction(kind);
      if (!res.ok) { showFeedback(false, res.error); return; }
      const cost = kind === "LAB_EGG" ? monthlyCosts.labEgg : monthlyCosts.evolutionStone;
      setDust((value) => value - cost);
      setMonthlyUsage((usage) => kind === "LAB_EGG"
        ? { ...usage, labEggs: usage.labEggs + 1 }
        : { ...usage, evolutionStones: usage.evolutionStones + 1 });
      showFeedback(true, `${res.rewardLabel} adicionado ao seu inventário!`);
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCB05]/10 text-2xl">🧪</div>
        <div>
          <h1 className="text-xl font-bold text-white">Laboratório do Prof. Enguiça</h1>
          <p className="text-sm text-slate-400">Recicle mascotes e troque Pó de Criação por recompensas.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-2xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 px-4 py-2">
          <span className="text-lg">🧫</span>
          <span className="text-base font-bold text-[#FFCB05]">{dust}</span>
          <span className="text-xs text-slate-400">Pó de Criação</span>
        </div>
      </div>

      {/* Guide sections */}
      <div className="mb-5 space-y-2">
        <GuideSection icon="🧫" title="Como funciona o Pó de Criação?">
          <p>
            Ao reciclar um mascote, você recebe <strong className="text-slate-200">Pó de Criação</strong> — uma moeda secundária usada para trocar por ZikaCoins ou ovos na Loja de Pó.
          </p>
          <div className="rounded-lg border border-border/40 bg-slate-900/60 p-3 space-y-1">
            <p className="font-semibold text-slate-300">Pó de Criação base por raridade:</p>
            <p>⚪ <strong className="text-slate-300">Comum</strong> — 1 Pó de Criação por mascote</p>
            <p>🔵 <strong className="text-blue-300">Raro</strong> — 2 Pó de Criação por mascote</p>
            <p>⭐ <strong className="text-[#FFCB05]">Especial</strong> — 3 Pó de Criação por mascote</p>
          </div>
          <p>Mascotes favoritos ou em batalha/expedição não podem ser reciclados.</p>
        </GuideSection>

        <GuideSection icon="✨" title="Combo de duplicatas (multiplicador)">
          <p>
            Quando você recicla <strong className="text-slate-200">múltiplas cópias do mesmo pokémon</strong> no mesmo lote (até 6 slots), o sistema aplica um bônus progressivo:
          </p>
          <div className="rounded-lg border border-border/40 bg-slate-900/60 p-3 space-y-1">
            <p>1 cópia → <strong className="text-slate-200">×1,0</strong> (sem bônus)</p>
            <p>2 cópias → <strong className="text-yellow-300">×1,5</strong> em cada uma</p>
            <p>3+ cópias → <strong className="text-[#FFCB05]">×3,0</strong> em cada uma</p>
          </div>
          <p>Exemplo: 3× Pikachu (Raro) = 3 × (2 Pó de Criação × 3,0) = <strong className="text-[#FFCB05]">18 Pó de Criação</strong> no total.</p>
          <p>Use os <strong className="text-slate-200">6 slots</strong> para montar seu combo antes de confirmar — o preview mostra o cálculo em tempo real.</p>
        </GuideSection>

        <GuideSection icon="🛒" title="O que posso comprar com Pó de Criação?">
          <div className="rounded-lg border border-border/40 bg-slate-900/60 p-3 space-y-1">
            <p>🪙 <strong className="text-slate-200">400 ZikaCoins</strong> — 10 Pó de Criação · limite 5×/semana</p>
            <p>🥚 <strong className="text-slate-200">Ovo Comum</strong> — 15 Pó de Criação · limite 10×/semana</p>
            <p>💙 <strong className="text-blue-300">Ovo Raro</strong> — 25 Pó de Criação · limite 4×/semana</p>
            <p>⭐ <strong className="text-[#FFCB05]">Ovo Especial</strong> — 40 Pó de Criação · limite 1×/semana</p>
            <p>🧪 <strong className="text-purple-300">Ovo de Laboratório</strong> — 250 Pó de Criação · limite 1×/mês</p>
            <p>💎 <strong className="text-cyan-300">Pedra de Evolução semanal</strong> — 300 Pó de Criação · limite 1×/mês</p>
          </div>
          <p>Os limites reiniciam toda segunda-feira.</p>
        </GuideSection>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
          feedback.ok ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-red-500/40 bg-red-500/10 text-red-400"
        }`}>
          {feedback.ok ? "✓" : "✗"} {feedback.message}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(["recycle", "shop", "analyze"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t ? "bg-[#FFCB05] text-[#1A1A2E]" : "border border-border text-slate-400 hover:text-white"
            }`}
          >
            {t === "recycle" ? <><FlaskConical size={15} /> Reciclar Mascotes</>
              : t === "shop" ? <><ShoppingBag size={15} /> Loja de Pó de Criação</>
              : <><Microscope size={15} /> Análise de Mascote</>}
          </button>
        ))}
      </div>

      {/* ── ANALYZE TAB ── */}
      {tab === "analyze" && (
        <MascotAnalyzer
          mascots={mascots}
          coinBalance={coinBalance}
          analysisCost={analysisCost}
          onBalanceChange={setCoinBalance}
          onAnalyzed={(mascotId, rating, score) =>
            setMascots(prev => prev.map(m => m.id === mascotId ? { ...m, analyzed: true, ivRating: rating, ivScore: score } : m))
          }
        />
      )}

      {/* ── RECYCLE TAB ── */}
      {tab === "recycle" && (
        <div className="space-y-5">

          {/* Sacrifice slots */}
          <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200">Slots de sacrifício</p>
              <p className="text-xs text-slate-500">{filledSlots.length}/{MAX_SLOTS} selecionados</p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {slots.map((slot, idx) => (
                <div key={idx} className={`relative flex flex-col items-center justify-center rounded-xl border text-center transition-colors ${
                  slot
                    ? "border-[#FFCB05]/40 bg-[#FFCB05]/5"
                    : "border-dashed border-slate-700 bg-slate-800/30"
                }`} style={{ minHeight: 90 }}>
                  {slot ? (
                    <>
                      <button
                        onClick={() => removeSlot(idx)}
                        className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-slate-400 hover:bg-red-600 hover:text-white transition-colors"
                      >
                        <X size={9} />
                      </button>
                      <img src={slot.spriteUrl} alt="" className="h-10 w-10 object-contain" />
                      <p className="mt-0.5 line-clamp-1 w-full px-1 text-[9px] font-semibold text-white">
                        {slot.nickname || slot.name}
                      </p>
                      <p className="text-[9px] text-slate-500">Lv.{slot.level}</p>
                      {/* Show dust for this slot */}
                      {(() => {
                        const b = breakdown.find((b) => b.mascot.id === slot.id);
                        return b ? (
                          <span className="mt-0.5 text-[9px] font-bold text-[#FFCB05]">🧫 {b.dust}</span>
                        ) : null;
                      })()}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-700">
                      <Plus size={18} />
                      <span className="text-[9px]">Slot {idx + 1}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Dust preview */}
            {filledSlots.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-300">Preview do cálculo:</p>
                <div className="space-y-1">
                  {breakdown.map((b, i) => {
                    const sameGroup = filledSlots.filter((s) => s.pokemonId === b.mascot.pokemonId).length > 1;
                    return (
                      <div key={b.mascot.id + i} className="flex items-center gap-2 text-xs">
                        <img src={b.mascot.spriteUrl} alt="" className="h-5 w-5 object-contain shrink-0" />
                        <span className="text-slate-300 truncate min-w-0 flex-1">
                          {b.mascot.nickname || b.mascot.name}
                        </span>
                        <span className="shrink-0 text-slate-500">{b.base} Pó de Criação base</span>
                        {b.mult > 1 && (
                          <span className="shrink-0 font-bold text-yellow-400">×{b.mult.toFixed(1)}</span>
                        )}
                        {sameGroup && b.mult === 1 && (
                          <span className="shrink-0 text-slate-600">×1,0</span>
                        )}
                        <span className="shrink-0 font-bold text-[#FFCB05]">= {b.dust} Pó de Criação</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#FFCB05]/20 pt-2">
                  <span className="text-xs font-semibold text-slate-300">Total:</span>
                  <span className="text-sm font-bold text-[#FFCB05]">🧫 {previewTotal} Pó de Criação</span>
                </div>
              </div>
            )}

            {/* Confirm / Clear buttons */}
            {filledSlots.length > 0 && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setSlots(Array(MAX_SLOTS).fill(null))}
                  disabled={isPending}
                  className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors disabled:opacity-40"
                >
                  Limpar slots
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-[#FFCB05] py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors disabled:opacity-40"
                >
                  Reciclar {filledSlots.length} mascote{filledSlots.length > 1 ? "s" : ""} → +{previewTotal} Pó de Criação
                </button>
              </div>
            )}
          </div>

          {/* Mascot picker */}
          <div>
            <p className="mb-2 text-xs text-slate-500">
              Clique em um mascote para adicioná-lo aos slots. Apenas mascotes recicláveis são mostrados.
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-1 min-w-48 items-center gap-2 rounded-xl border border-border bg-slate-900 px-3 py-2">
                <Search size={14} className="shrink-0 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Buscar mascote por nome ou apelido…"
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
                />
                {search && (
                  <button onClick={() => { setSearch(""); setPage(0); }} className="text-slate-500 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>
              <select
                value={perfFilter}
                onChange={(e) => { setPerfFilter(e.target.value); setPage(0); }}
                className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-[#FFCB05]"
              >
                <option value="">Desempenho: todos</option>
                <option value="FORTE">💪 Forte</option>
                <option value="NEUTRO">⚖️ Neutro</option>
                <option value="RUIM">👎 Ruim</option>
                <option value="PESSIMO">🗑️ Péssimo</option>
              </select>
            </div>

            {mascots.filter((m) => m.recyclable).length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">Nenhum mascote reciclável disponível.</p>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Nenhum resultado.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {paged.map((m) => {
                  const slotsLeft = slots.some((s) => s === null);
                  const projectedCopies = filledSlots.filter((slot) => slot.pokemonId === m.pokemonId).length + 1;
                  const projectedDust = calculateLabDust(m.rarity, projectedCopies);
                  return (
                    <button
                      key={m.id}
                      onClick={() => slotsLeft && addToSlot(m)}
                      disabled={!slotsLeft || isPending}
                      className="relative flex flex-col items-center gap-1 rounded-2xl border border-border bg-slate-900 p-3 text-center transition-colors hover:border-[#FFCB05]/40 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {m.analyzed && m.ivRating && (
                        <span className="absolute right-1.5 top-1.5"><RatingBadge rating={m.ivRating} size="sm" /></span>
                      )}
                      {(() => {
                        const meta = PERFORMANCE_META[normalizePerformanceTag(m.performanceTag)];
                        return (
                          <span className={`absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded border px-1 py-px text-[8px] font-bold ${meta.badge}`}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
                          </span>
                        );
                      })()}
                      <img src={m.spriteUrl} alt="" className="h-12 w-12 object-contain" />
                      <p className="line-clamp-1 text-xs font-bold text-white">{m.nickname || m.name}</p>
                      <p className="text-[10px] text-slate-500">Lv.{m.level}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${RARITY_COLOR[m.rarity]}`}>
                        {RARITY_LABEL[m.rarity]}
                      </span>
                      <span className="text-[9px] text-slate-500">🧫 {projectedDust} Pó de Criação</span>
                    </button>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                  className="rounded-lg px-3 py-1.5 hover:bg-slate-800 disabled:opacity-30">← Anterior</button>
                <span>{page + 1} / {totalPages} · {filtered.length} mascotes</span>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="rounded-lg px-3 py-1.5 hover:bg-slate-800 disabled:opacity-30">Próximo →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SHOP TAB ── */}
      {tab === "shop" && (
        <div className="space-y-3">
          <p className="mb-4 text-xs text-slate-500">
            Troque Pó de Criação por recompensas. Os limites semanais reiniciam na segunda-feira; os mensais, no dia 01.
          </p>
          <ShopItem title="400 ZikaCoins" description="Adicionados diretamente à sua carteira."
            cost={costs.coins} dust={dust} used={weeklyUsage.coinsTraded} limit={limits.coinsTraded}
            isPending={isPending} onBuy={handleTradeCoins} />
          <ShopItem title="Ovo Comum" description="Mascote do pool geral de pokémons."
            cost={costs.commonEgg} dust={dust} used={weeklyUsage.commonEggs} limit={limits.commonEggs}
            isPending={isPending} onBuy={() => handleTradeEgg("COMMON")} />
          <ShopItem title="Ovo Raro" description="Starters, fan-favorites e pokémons especiais."
            cost={costs.rareEgg} dust={dust} used={weeklyUsage.rareEggs} limit={limits.rareEggs}
            isPending={isPending} onBuy={() => handleTradeEgg("RARE")} />
          <ShopItem title="Ovo Especial" description="Pool exclusivo dos pokémons mais raros e cobiçados."
            cost={costs.specialEgg} dust={dust} used={weeklyUsage.specialEggs} limit={limits.specialEggs}
            isPending={isPending} onBuy={() => handleTradeEgg("SPECIAL")} />
          <div className="pt-2">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-purple-300">Trocas mensais</p>
          </div>
          <ShopItem title="Ovo de Laboratório" description="Ovo com atributos superiores. Uma compra é liberada novamente todo dia 01."
            cost={monthlyCosts.labEgg} dust={dust} used={monthlyUsage.labEggs} limit={1}
            periodLabel="neste mês" isPending={isPending} onBuy={() => handleMonthlyTrade("LAB_EGG")} />
          <ShopItem title={`Pedra de Evolução — ${weeklyEvolutionStone.name}`}
            description="A pedra disponível muda semanalmente. O limite de compra reinicia no dia 01."
            cost={monthlyCosts.evolutionStone} dust={dust} used={monthlyUsage.evolutionStones} limit={1}
            periodLabel="neste mês" isPending={isPending} onBuy={() => handleMonthlyTrade("EVOLUTION_STONE")} />
        </div>
      )}

      {/* ── Confirm modal ── */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-slate-900 p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-white">Confirmar Reciclagem?</h2>
            <p className="mb-4 text-xs text-slate-400">Essa ação é irreversível. Os mascotes abaixo serão permanentemente removidos.</p>

            <div className="mb-4 max-h-48 overflow-y-auto space-y-1.5">
              {breakdown.map((b, i) => (
                <div key={b.mascot.id + i} className="flex items-center gap-3 rounded-xl border border-border bg-slate-800/60 px-3 py-2">
                  <img src={b.mascot.spriteUrl} alt="" className="h-9 w-9 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{b.mascot.nickname || b.mascot.name}</p>
                    <p className="text-[10px] text-slate-400">Lv.{b.mascot.level} · {RARITY_LABEL[b.mascot.rarity]}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-[#FFCB05]">🧫 {b.dust}</p>
                    {b.mult > 1 && <p className="text-[9px] text-yellow-400">×{b.mult.toFixed(1)} combo</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-5 flex items-center justify-between rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 px-4 py-3">
              <span className="text-sm font-semibold text-slate-300">Total que você receberá:</span>
              <span className="text-lg font-bold text-[#FFCB05]">🧫 {previewTotal} Pó de Criação</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setConfirming(false)} disabled={isPending}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={handleConfirmRecycle} disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                {isPending ? <Loader2 size={15} className="mx-auto animate-spin" /> : "Reciclar tudo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopItem({ title, description, cost, dust, used, limit, periodLabel = "esta semana", isPending, onBuy }: {
  title: string; description: string; cost: number;
  dust: number; used: number; limit: number; periodLabel?: string; isPending: boolean; onBuy: () => void;
}) {
  const atLimit = used >= limit;
  const canAfford = dust >= cost;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-slate-900 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-xs font-bold text-[#FFCB05]">🧫 {cost} Pó de Criação</span>
          <span className={`text-[10px] ${atLimit ? "text-red-400" : "text-slate-500"}`}>{used}/{limit} {periodLabel}</span>
        </div>
      </div>
      <button onClick={onBuy} disabled={atLimit || !canAfford || isPending}
        className="shrink-0 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:cursor-not-allowed disabled:opacity-40">
        {isPending ? <Loader2 size={14} className="animate-spin" /> : "Trocar"}
      </button>
    </div>
  );
}
