"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import { Search, Sparkles, Loader2, ArrowRight, TrendingUp, Eye, Swords, Shield, History, GitCompareArrows, CalendarClock, DatabaseZap } from "lucide-react";
import { analyzeMascotAction, getStoredAnalysisAction, getMascotGrowthHistoryAction } from "../actions";
import type { MascotGrowthHistory } from "../actions";
import { RATING_STYLE, type MascotAnalysis, type MascotRating } from "@/lib/mascot-analysis";
import { getStaticSpriteUrl } from "@/lib/mascot-data";

type AnalyzerMascot = {
  id: string;
  pokemonId: number;
  name: string;
  nickname: string | null;
  level: number;
  isShiny: boolean;
  spriteUrl: string;
  analyzed: boolean;
  ivRating: string | null;
  ivScore: number | null;
};

const PAGE = 12;

export function RatingBadge({ rating, score, size = "md" }: { rating: string; score?: number | null; size?: "sm" | "md" }) {
  const style = RATING_STYLE[rating as MascotRating] ?? RATING_STYLE.C;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-bold ${style.text} ${style.border} ${style.bg} ${size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-xs"}`}>
      {rating}{typeof score === "number" ? <span className="opacity-80">· {score}%</span> : null}
    </span>
  );
}

// Bolha de explicação no hover. Coloque em qualquer elemento com "group/tip relative".
function TipBubble({ text, align = "center" }: { text: string; align?: "left" | "center" | "right" }) {
  const pos = align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  const arrow = align === "left" ? "left-4" : align === "right" ? "right-4" : "left-1/2 -translate-x-1/2";
  return (
    <span className={`pointer-events-none absolute bottom-full z-50 mb-1.5 w-56 rounded-lg border border-border bg-slate-900 px-2.5 py-1.5 text-left text-[10px] font-normal normal-case leading-relaxed text-slate-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100 ${pos}`}>
      {text}
      <span className={`absolute top-full border-4 border-transparent border-t-slate-900 ${arrow}`} />
    </span>
  );
}

// Explicação de cada atributo (o que faz em combate)
const STAT_TIPS: Record<string, string> = {
  "Força": "Poder de ataque bruto. É a base do papel Atacante e aumenta o dano causado.",
  "Agilidade": "Velocidade e evasão. Base do Flanco: ajuda a furar defesas e a agir primeiro.",
  "Carisma": "Presença e liderança. Base do Encorajador: fortalece buffs de equipe e curas.",
  "Instinto": "Percepção e reflexos. Base do Oportunista: melhora precisão, crítico e sabotagem.",
  "Vitalidade": "Resistência e vida. Base do Defensor: reduz o dano recebido e aumenta o HP.",
};

function StatBar({ label, current, projected, delta, max }: { label: string; current: number; projected: number; delta: number; max: number }) {
  const scale = Math.max(max, 1);
  const basePct = (current / scale) * 100;
  const gainPct = (Math.max(0, delta) / scale) * 100;
  const growthRatio = current > 0 ? Math.round((delta / current) * 100) : 0;
  return (
    <div className="space-y-1">
      {/* Linha superior: nome + atual → projetado + ganho */}
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="group/tip relative cursor-help font-medium text-slate-300 underline decoration-dotted decoration-slate-600">
          {label}
          {STAT_TIPS[label] && <TipBubble text={STAT_TIPS[label]} align="left" />}
        </span>
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-slate-500">{current}</span>
          <span className="text-slate-600">→</span>
          <span className="font-bold text-slate-100">{projected}</span>
          {delta > 0 && (
            <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-semibold text-emerald-400">
              +{delta}{growthRatio > 0 ? ` · +${growthRatio}%` : ""}
            </span>
          )}
        </span>
      </div>
      {/* Barra: parte cinza = atual, parte verde = ganho estimado */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div className="absolute inset-y-0 left-0 bg-slate-500" style={{ width: `${basePct}%` }} />
        <div className="absolute inset-y-0 bg-emerald-500" style={{ left: `${basePct}%`, width: `${gainPct}%` }} />
      </div>
    </div>
  );
}

export function MascotAnalyzer({
  mascots, coinBalance, analysisCost, onBalanceChange, onAnalyzed,
}: {
  mascots: AnalyzerMascot[];
  coinBalance: number;
  analysisCost: number;
  onBalanceChange: (balance: number) => void;
  onAnalyzed: (mascotId: string, rating: string, score: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AnalyzerMascot | null>(null);
  const [targetLevel, setTargetLevel] = useState(100);
  const [analysis, setAnalysis] = useState<MascotAnalysis | null>(null);
  const [pending, start] = useTransition();
  const [viewPending, startView] = useTransition();
  const [historyPending, startHistory] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [compareId, setCompareId] = useState("");
  const [histories, setHistories] = useState<MascotGrowthHistory[]>([]);
  const historyCache = useRef(new Map<string, MascotGrowthHistory[]>());
  // Reaparece toda vez que a aba de análise é aberta (o componente remonta ao
  // trocar de aba), até o jogador dispensar naquela visita.
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? mascots.filter(m => m.name.toLowerCase().includes(q) || (m.nickname ?? "").toLowerCase().includes(q)) : mascots;
    return base;
  }, [mascots, search]);

  const totalPages = Math.ceil(filtered.length / PAGE);
  const paged = filtered.slice(page * PAGE, (page + 1) * PAGE);

  const pick = (m: AnalyzerMascot) => {
    setSelected(m);
    setAnalysis(null);
    setError(null);
    setFromCache(false);
    setTargetLevel(100);
    setHistoryOpen(false);
    setCompareId("");
    setHistories([]);
  };

  const loadHistory = (secondaryId = compareId) => {
    if (!selected) return;
    const ids = [selected.id, secondaryId].filter(Boolean);
    const key = [...ids].sort().join(":");
    setHistoryOpen(true);
    const cached = historyCache.current.get(key);
    if (cached) { setHistories(cached); return; }
    startHistory(async () => {
      const result = await getMascotGrowthHistoryAction(ids);
      if (!result.ok) { setError(result.error); return; }
      historyCache.current.set(key, result.histories);
      setHistories(result.histories);
    });
  };

  const runAnalysis = () => {
    if (!selected) return;
    setError(null);
    start(async () => {
      const res = await analyzeMascotAction(selected.id, targetLevel);
      if (!res.ok) { setError(res.error); return; }
      setAnalysis(res.analysis);
      setFromCache(false);
      setSelected((current) => current ? { ...current, analyzed: true, ivRating: res.analysis.ivRating, ivScore: res.analysis.ivScore } : current);
      onBalanceChange(res.coinBalance);
      onAnalyzed(selected.id, res.analysis.ivRating, res.analysis.ivScore);
    });
  };

  const viewStored = () => {
    if (!selected) return;
    setError(null);
    startView(async () => {
      const res = await getStoredAnalysisAction(selected.id);
      if (!res.ok) { setError(res.error); return; }
      setAnalysis(res.analysis);
      setFromCache(true);
      if (res.analysis.targetLevel) setTargetLevel(res.analysis.targetLevel);
    });
  };

  return (
    <div className="space-y-5">
      {showDisclaimer && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-lg">⚠️</div>
            <div className="flex-1 text-xs leading-relaxed text-amber-100/90">
              <p className="text-sm font-bold text-amber-200">Aviso sobre a análise</p>
              <p className="mt-1">
                Mais de <strong>50% dos jogadores questionam a eficácia</strong> da análise do Laboratório.
                Ela é uma <strong>estimativa</strong> do potencial e da projeção de atributos — <strong>não é uma garantia</strong>.
                O crescimento real é procedural e influenciado pela personalidade, então o <strong>total de status</strong> e o
                <strong> foco em qualquer atributo</strong> podem sair diferentes do projetado.
              </p>
              <p className="mt-1 text-amber-200/80">Use por sua conta e risco, como referência aproximada — teste você mesmo antes de tomar decisões definitivas.</p>
            </div>
            <button
              onClick={() => setShowDisclaimer(false)}
              className="shrink-0 rounded-lg border border-amber-500/40 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/10"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-950/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-xl">🔬</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-100">Análise de Mascote</p>
            <p className="text-xs text-slate-400">
              Descubra o <strong className="text-purple-300">potencial (IV)</strong>, a prévia de evolução e a projeção de atributos.
              A primeira análise custa <strong className="text-[#FFCB05]">{analysisCost} ZC</strong> e atribui um ranking de <strong>SSS</strong> a <strong>E</strong>.
              Depois disso, você pode simular gratuitamente qualquer nível-alvo neste mascote.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 px-3 py-1.5 text-center">
            <p className="text-[10px] text-slate-400">Seu saldo</p>
            <p className="text-sm font-bold text-[#FFCB05]">{coinBalance.toLocaleString("pt-BR")} ZC</p>
          </div>
        </div>
      </div>

      {/* Seletor de mascote */}
      <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar mascote..."
            className="w-full rounded-xl border border-border bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {paged.map(m => (
            <button key={m.id} onClick={() => pick(m)}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl border p-2 pt-2.5 transition-colors ${
                selected?.id === m.id ? "border-purple-400/60 bg-purple-500/10" : "border-border bg-slate-800/30 hover:border-purple-400/40"
              }`}>
              {m.analyzed && m.ivRating && (
                <span className="absolute right-1 top-1"><RatingBadge rating={m.ivRating} size="sm" /></span>
              )}
              <img src={m.spriteUrl} alt="" className="mt-1 h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
              <p className="line-clamp-1 w-full text-center text-[9px] font-semibold text-white">{m.nickname || m.name}</p>
              <p className="text-[9px] text-slate-500">Lv.{m.level}</p>
            </button>
          ))}
          {paged.length === 0 && <p className="col-span-full py-6 text-center text-xs text-slate-500">Nenhum mascote encontrado.</p>}
        </div>
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="rounded-lg border border-border px-3 py-1 text-slate-400 disabled:opacity-40">Anterior</button>
            <span className="text-slate-500">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="rounded-lg border border-border px-3 py-1 text-slate-400 disabled:opacity-40">Próxima</button>
          </div>
        )}
      </div>

      {/* Controles + análise */}
      {selected && (
        <div className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <img src={selected.spriteUrl} alt="" className="h-12 w-12 object-contain" style={{ imageRendering: "pixelated" }} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{selected.nickname || selected.name}</p>
              <p className="text-xs text-slate-500">Nv.{selected.level} · #{selected.pokemonId}{selected.isShiny ? " · ✨" : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Nível-alvo:</label>
              <input type="number" min={selected.level} max={100} value={targetLevel}
                onChange={e => setTargetLevel(Math.max(selected.level, Math.min(100, Number(e.target.value) || selected.level)))}
                className="w-16 rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-purple-400/50" />
            </div>
            <div className="flex items-center gap-2">
              {selected.analyzed && (
                <button onClick={viewStored} disabled={viewPending || pending}
                  className="flex items-center gap-1.5 rounded-xl border border-purple-500/40 px-3 py-2 text-sm font-semibold text-purple-300 hover:bg-purple-500/10 disabled:opacity-50"
                  title="Revisitar a última análise deste mascote (grátis)">
                  {viewPending ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                  Ver análise salva
                </button>
              )}
              <button onClick={runAnalysis} disabled={pending || (!selected.analyzed && coinBalance < analysisCost)}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50">
                {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {pending ? "Analisando..." : selected.analyzed ? "Simular grátis" : `Analisar (${analysisCost} ZC)`}
              </button>
              <button onClick={() => historyOpen ? setHistoryOpen(false) : loadHistory()} disabled={historyPending}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 px-3 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50">
                {historyPending ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
                Crescimento
              </button>
            </div>
          </div>

          {coinBalance < analysisCost && !analysis && !selected.analyzed && (
            <p className="text-xs text-red-400">Saldo insuficiente para desbloquear a análise ({analysisCost} ZC).</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {historyOpen && (
            <GrowthHistoryPanel
              primaryId={selected.id}
              histories={histories}
              mascots={mascots}
              compareId={compareId}
              pending={historyPending}
              onCompare={(id) => { setCompareId(id); loadHistory(id); }}
              onRefresh={() => {
                const ids = [selected.id, compareId].filter(Boolean);
                historyCache.current.delete([...ids].sort().join(":"));
                loadHistory(compareId);
              }}
            />
          )}

          {analysis && (
            <>
              {fromCache && (
                <p className="text-[11px] text-slate-500">
                  📄 Mostrando a análise salva{analysis.analyzedAtIso ? ` de ${new Date(analysis.analyzedAtIso).toLocaleDateString("pt-BR")}` : ""} (Nv.{analysis.currentLevel} → Nv.{analysis.targetLevel}). Faça uma nova simulação gratuitamente para atualizar.
                </p>
              )}
              <AnalysisResult analysis={analysis} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

const GROWTH_STATS = [
  ["force", "Força", "text-red-300"],
  ["agility", "Agilidade", "text-yellow-300"],
  ["charisma", "Carisma", "text-pink-300"],
  ["instinct", "Instinto", "text-cyan-300"],
  ["vitality", "Vitalidade", "text-emerald-300"],
] as const;

function GrowthHistoryPanel({
  primaryId, histories, mascots, compareId, pending, onCompare, onRefresh,
}: {
  primaryId: string;
  histories: MascotGrowthHistory[];
  mascots: AnalyzerMascot[];
  compareId: string;
  pending: boolean;
  onCompare: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-[linear-gradient(145deg,rgba(8,47,73,.24),rgba(2,6,23,.72)_45%)] shadow-[0_18px_55px_rgba(8,145,178,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/15 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300 shadow-inner">
            <History size={19} />
          </span>
          <div>
            <p className="font-bold text-white">Linha de crescimento</p>
            <p className="text-[11px] text-slate-400">Acompanhe e compare cada evolução registrada</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          <DatabaseZap size={11} /> Sob demanda
        </span>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex gap-3 rounded-xl border border-amber-400/25 bg-gradient-to-r from-amber-400/10 to-orange-400/[.04] p-3 text-xs leading-relaxed text-amber-50">
          <CalendarClock size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <p className="font-bold text-amber-200">Histórico em implantação desde 28/08/2026</p>
            <p className="mt-0.5 text-amber-100/75">Somente mudanças reais posteriores à implantação são exibidas. O sistema não inventa nem reconstrói níveis anteriores.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/[.06] bg-slate-950/35 p-3">
          <label className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">
            Comparar com outro mascote
            <select value={compareId} onChange={(event) => onCompare(event.target.value)} disabled={pending}
              className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10">
              <option value="">Visualizar apenas este mascote</option>
              {mascots.filter((mascot) => mascot.id !== primaryId).map((mascot) => (
                <option key={mascot.id} value={mascot.id}>{mascot.nickname || mascot.name} · Nv.{mascot.level}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onRefresh} disabled={pending}
            className="flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-400/5 hover:text-cyan-200 disabled:opacity-50">
            {pending ? <Loader2 size={13} className="animate-spin" /> : <GitCompareArrows size={13} />} Atualizar dados
          </button>
        </div>
        {pending && histories.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-cyan-400/20 bg-slate-950/30 text-sm text-slate-400">
            <Loader2 size={24} className="animate-spin text-cyan-300" />
            Carregando somente os mascotes escolhidos...
          </div>
        ) : (
          <div className={`grid gap-3 ${histories.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {histories.map((history, index) => (
              <GrowthHistoryCard
                key={history.mascot.id}
                history={history}
                mascot={mascots.find((item) => item.id === history.mascot.id)}
                comparison={index > 0}
                compact={histories.length > 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GrowthHistoryCard({
  history, mascot, comparison = false, compact = false,
}: {
  history: MascotGrowthHistory;
  mascot?: AnalyzerMascot;
  comparison?: boolean;
  compact?: boolean;
}) {
  const totals = history.entries.reduce((sum, entry) => ({
    force: sum.force + entry.gained.force,
    agility: sum.agility + entry.gained.agility,
    charisma: sum.charisma + entry.gained.charisma,
    instinct: sum.instinct + entry.gained.instinct,
    vitality: sum.vitality + entry.gained.vitality,
  }), { force: 0, agility: 0, charisma: 0, instinct: 0, vitality: 0 });
  const maxCurrent = Math.max(...Object.values(history.mascot.current), 1);
  const totalGained = Object.values(totals).reduce((a, b) => a + b, 0);
  return (
    <div className={`min-w-0 overflow-hidden rounded-2xl border bg-slate-950/60 shadow-lg ${comparison ? "border-violet-400/25 shadow-violet-950/10" : "border-cyan-400/25 shadow-cyan-950/10"}`}>
      <div className={`h-1 w-full ${comparison ? "bg-gradient-to-r from-violet-500 to-fuchsia-400" : "bg-gradient-to-r from-cyan-500 to-emerald-400"}`} />
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-14 shrink-0 place-items-center rounded-2xl border ${comparison ? "border-violet-400/20 bg-violet-400/10" : "border-cyan-400/20 bg-cyan-400/10"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mascot?.spriteUrl || getStaticSpriteUrl(history.mascot.pokemonId)} alt="" className="size-11 object-contain [image-rendering:auto]" />
            </span>
            <div className="min-w-0">
              <span className={`text-[9px] font-bold uppercase tracking-[.15em] ${comparison ? "text-violet-300" : "text-cyan-300"}`}>{comparison ? "Comparativo" : "Mascote analisado"}</span>
              <p className="truncate text-base font-bold text-white">{history.mascot.name}</p>
              <p className="text-[10px] text-slate-500">Nível {history.mascot.level} · {history.mascot.personality} · {history.entries.length} registro(s)</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-lg font-black tabular-nums ${totalGained > 0 ? "text-emerald-300" : "text-slate-400"}`}>+{totalGained}</p>
            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-600">pontos registrados</p>
          </div>
        </div>
        <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-5"}`}>
          {GROWTH_STATS.map(([key, label, color], index) => (
            <div key={key} className={`min-w-0 rounded-xl border border-white/[.06] bg-slate-900/70 px-2.5 py-2.5 ${compact && index === GROWTH_STATS.length - 1 ? "sm:col-span-2" : ""}`}>
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-[9px] font-bold uppercase tracking-wide text-slate-500" title={label}>{label}</p>
                <p className={`shrink-0 text-base font-black tabular-nums ${color}`}>{history.mascot.current[key]}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${comparison ? "bg-violet-400" : "bg-cyan-400"}`} style={{ width: `${history.mascot.current[key] / maxCurrent * 100}%` }} /></div>
              <p className={`mt-1.5 text-right text-[9px] font-semibold ${totals[key] > 0 ? "text-emerald-400" : "text-slate-600"}`}>+{totals[key]} desde 28/08</p>
            </div>
          ))}
        </div>
        {history.entries.length === 0 ? (
          <div className="mt-3 flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/70 bg-slate-900/25 px-4 text-center">
            <TrendingUp size={18} className="mb-2 text-slate-600" />
            <p className="text-xs font-semibold text-slate-400">Aguardando a primeira subida registrada</p>
            <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-slate-600">Quando este mascote subir de nível, os ganhos aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-slate-900 text-slate-500"><tr><th className="px-2 py-2 text-left">Nível</th>{GROWTH_STATS.map(([key, label]) => <th key={key} className="px-1 py-2 text-center">{label.slice(0, 3)}</th>)}<th className="px-2 py-2 text-right">Origem</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {history.entries.map((entry) => (
                <tr key={entry.id} className="text-slate-300">
                  <td className="whitespace-nowrap px-2 py-2 font-semibold">{entry.fromLevel} → {entry.toLevel}</td>
                  {GROWTH_STATS.map(([key]) => <td key={key} className="px-1 py-2 text-center text-emerald-300">+{entry.gained[key]}</td>)}
                  <td className="max-w-24 truncate px-2 py-2 text-right text-slate-500" title={entry.source}>{entry.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {history.trackedFrom && <p className="mt-2 text-[9px] text-slate-600">Primeiro registro real: {new Date(history.trackedFrom).toLocaleString("pt-BR")}</p>}
      </div>
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: MascotAnalysis }) {
  const a = analysis;
  const style = RATING_STYLE[a.ivRating];
  const roleSuggestions = a.roleSuggestions ?? [];
  return (
    <div className="space-y-4 border-t border-border/50 pt-4">
      {/* Rating + potencial + veredito */}
      <div className={`rounded-2xl border p-4 ${style.border} ${style.bg}`}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="group/tip relative cursor-help text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Ranking</p>
            <p className={`font-pixel text-3xl leading-tight ${style.text}`}>{a.ivRating}</p>
            <TipBubble align="left" text="Nota permanente de SSS (elite) a E (fraco). É definida na primeira análise pelo roll inicial, espécie e linha evolutiva; simulações de nível não alteram esse ranking." />
          </div>
          <div className="hidden h-10 w-px bg-slate-700 sm:block" />
          <div className="group/tip relative cursor-help text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Potencial (IV)</p>
            <p className={`text-2xl font-bold ${style.text}`}>{a.ivScore}%</p>
            <TipBubble text="Pontuação de 0 a 100 do potencial futuro. É a base que define o ranking: quanto maior, melhor o teto do mascote." />
          </div>
          {typeof a.projectedPower === "number" && (
            <>
              <div className="hidden h-10 w-px bg-slate-700 sm:block" />
              <div className="group/tip relative cursor-help text-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Poder Nv.{a.targetLevel}</p>
                <p className="text-2xl font-bold text-slate-100">{a.projectedPower}</p>
                <TipBubble text="Estimativa do poder de combate no nível-alvo. NÃO é a soma dos status: cada atributo entra com um peso (Força e Vitalidade pesam mais). Veja o cálculo detalhado abaixo." />
              </div>
            </>
          )}
        </div>
        <p className="mt-3 border-t border-white/5 pt-3 text-sm text-slate-200">{a.verdict}</p>
      </div>

      {/* Como a Pontuação de Poder é calculada */}
      {a.powerBreakdown && a.powerBreakdown.length > 0 && (
        <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-100">Pontuação de Poder Nv.{a.targetLevel}</p>
            <p className="text-xl font-bold text-slate-100">{a.projectedPower}</p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            <strong className="text-amber-300">Não é a soma dos status.</strong> Cada atributo entra com um
            <strong> peso</strong> diferente, conforme o impacto em combate: <strong>Força</strong> pesa mais e
            <strong> Carisma</strong>, menos. A pontuação é a soma de <em>(status × peso)</em> de cada atributo.
          </p>
          <div className="mt-3 space-y-1">
            {a.powerBreakdown.map((part) => (
              <div key={part.key} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-slate-300">{part.label}</span>
                <span className="tabular-nums text-slate-400">{part.value}</span>
                <span className="text-slate-600">×</span>
                <span className="tabular-nums text-slate-400">{part.weight.toFixed(2)}</span>
                <span className="text-slate-600">=</span>
                <span className="ml-auto tabular-nums font-semibold text-slate-100">{part.contribution.toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs">
            <span className="text-slate-400">
              Soma das contribuições
              <span className="ml-1 text-slate-600">
                (para referência, a soma simples dos status é {a.perStat.reduce((s, p) => s + p.projected, 0).toLocaleString("pt-BR")})
              </span>
            </span>
            <span className="text-base font-bold text-[#FFCB05]">{a.projectedPower.toLocaleString("pt-BR")}</span>
          </div>
        </div>
      )}

      {/* Detalhamento do potencial */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="group/tip relative cursor-help rounded-xl border border-border bg-slate-950/40 p-2">
          <p className="text-slate-500">Roll inicial</p>
          <p className="font-bold text-slate-200">{a.rollQualityPct}%</p>
          <TipBubble align="left" text="Qualidade dos atributos sorteados ao nascer, comparada ao máximo possível. Alto = o mascote teve 'sorte' na criação. É o fator individual — o único que varia entre mascotes da mesma espécie." />
        </div>
        <div className="group/tip relative cursor-help rounded-xl border border-border bg-slate-950/40 p-2">
          <p className="text-slate-500">Espécie</p>
          <p className="font-bold text-slate-200">{a.speciesPotentialPct}%</p>
          <TipBubble text="Bônus de crescimento da espécie. Lendários crescem 30% mais rápido; pseudo-lendários e paradoxos 10%. Espécies comuns não têm bônus (0%)." />
        </div>
        <div className="group/tip relative cursor-help rounded-xl border border-border bg-slate-950/40 p-2">
          <p className="text-slate-500">Evoluções</p>
          <p className="font-bold text-slate-200">{a.evoPotentialPct}%</p>
          <TipBubble align="right" text="Potencial da linha evolutiva completa, independentemente da forma atual. Cada evolução concede marcos de atributos; uma linha de 3 estágios representa 100%." />
        </div>
      </div>

      {/* Perfil: stat dominante, equilíbrio, personalidade */}
      {(a.dominantStatLabel || a.balanceLabel || a.personalityNote) && (
        <div className="rounded-2xl border border-border bg-slate-950/40 p-4 space-y-1.5 text-xs">
          {a.dominantStatLabel && (
            <p className="text-slate-300"><span className="text-slate-500">Atributo dominante:</span> <strong className="text-cyan-300">{a.dominantStatLabel}</strong> · {a.balanceLabel}</p>
          )}
          {a.personalityNote && <p className="text-slate-400">{a.personalityNote}</p>}
        </div>
      )}

      {(a.projectionMethod || typeof a.estimatedBaseTotal === "number") && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs text-slate-300">
          <p className="mb-1 font-semibold text-cyan-300">Leitura realista do Lab</p>
          {a.projectionMethod && <p className="leading-relaxed text-slate-400">{a.projectionMethod}</p>}
          {typeof a.estimatedBaseTotal === "number" && typeof a.estimatedGrowthTotal === "number" && (
            <p className="mt-2 leading-relaxed">
              <span className="text-slate-500">Estimativa atual:</span>{" "}
              <strong className="text-slate-100">{a.estimatedBaseTotal}</strong> pts de nascimento +{" "}
              <strong className="text-slate-100">{a.estimatedGrowthTotal}</strong> pts de crescimento/marcos ={" "}
              <strong className="text-cyan-300">{a.currentTotal}</strong> pts atuais.
            </p>
          )}
        </div>
      )}

      {/* Projeção de atributos */}
      <div className="rounded-2xl border border-border bg-slate-950/40 p-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-300">
          <TrendingUp size={13} className="text-cyan-400" />
          <span className="group/tip relative cursor-help underline decoration-dotted decoration-slate-600">
            Projeção Nv.{a.currentLevel} → Nv.{a.targetLevel}
            <TipBubble align="left" text="Como os atributos devem crescer do nível atual até o nível-alvo. Em cada barra, a parte cinza é o valor atual e a parte verde é o ganho estimado. Passe o mouse no nome de cada atributo para ver o que ele faz." />
          </span>
          <span className="ml-auto text-slate-400">Total <span className="text-slate-300">{a.currentTotal}</span> → <span className="font-bold text-cyan-300">{a.projectedTotal}</span></span>
        </div>
        {/* Legenda */}
        <div className="mb-3 flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-500" /> Atual</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Ganho estimado</span>
        </div>
        <div className="space-y-2.5">
          {(() => {
            const maxProj = Math.max(...a.perStat.map(s => s.projected), 1);
            return a.perStat.map(s => (
              <StatBar key={s.key} label={s.label} current={s.current} projected={s.projected} delta={s.delta} max={maxProj} />
            ));
          })()}
        </div>
      </div>

      {a.progressMilestones && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Sparkles size={13} />
                Marcos de atributos até o Nv.{a.targetLevel}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Pontos extras distribuídos entre os atributos quando o mascote amadurece ou evolui.
              </p>
            </div>
            <div className="flex gap-2 text-[10px]">
              <span className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-300">
                Maturidade: +{a.maturityPoints ?? 0}
              </span>
              <span className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-purple-300">
                Evolução: +{a.evolutionPoints ?? 0}
              </span>
            </div>
          </div>
          {a.progressMilestones.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {a.progressMilestones.map((milestone) => (
                <div
                  key={`${milestone.kind}-${milestone.level}-${milestone.label}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-slate-950/50 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{milestone.label}</p>
                    <p className="text-[10px] text-slate-500">
                      Nv.{milestone.level} · {milestone.kind === "MATURITY" ? "Maturidade" : "Evolução"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-amber-300">+{milestone.points} pts</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-slate-500">
              Não há novos marcos de maturidade ou evolução dentro desta projeção.
            </p>
          )}
        </div>
      )}

      {a.statAnalysis?.length ? (
        <div className="rounded-2xl border border-border bg-slate-950/40 p-4">
          <p className="mb-3 text-xs font-semibold text-slate-300">Análise por atributo</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {a.statAnalysis.map(stat => (
              <div key={stat.key} className="rounded-xl border border-border bg-slate-900/45 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-100">
                      #{stat.rank} {stat.label}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {stat.current} → {stat.projected} · {stat.projectedSharePct}% do total projetado
                    </p>
                  </div>
                  {stat.delta > 0 && (
                    <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      +{stat.delta}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{stat.assessment}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Sugestões de função de combate */}
      {roleSuggestions.length > 0 && (
        <div className="rounded-2xl border border-border bg-slate-950/40 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Swords size={13} className="text-red-400" />
            <span className="group/tip relative cursor-help underline decoration-dotted decoration-slate-600">
              Funções de combate recomendadas
              <TipBubble align="left" text="Papéis da Arena que melhor aproveitam os atributos projetados deste mascote, do mais indicado ao menos. Passe o mouse em cada um para ver o efeito completo." />
            </span>
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {roleSuggestions.map((r, i) => (
              <div key={r.role} className={`group/tip relative cursor-help rounded-xl border p-3 ${i === 0 ? "border-purple-400/40 bg-purple-500/10" : "border-border bg-slate-900/40"}`}>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
                    {i === 0 && <Shield size={12} className="text-purple-300" />}{r.label}
                  </p>
                  <span className="text-xs font-bold text-cyan-300">{r.value}</span>
                </div>
                <p className="text-[10px] text-slate-500">{r.statLabel} é o atributo principal.</p>
                {r.description && <TipBubble align={i === 0 ? "left" : i === roleSuggestions.length - 1 ? "right" : "center"} text={r.description} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cadeia de evolução */}
      <div className="rounded-2xl border border-border bg-slate-950/40 p-4">
        <p className="mb-3 text-xs font-semibold text-slate-300">Cadeia de evolução</p>
        <div className="flex flex-wrap items-center gap-2">
          {a.evolutionChain.map((form, i) => (
            <div key={form.pokemonId} className="flex items-center gap-2">
              {i > 0 && <ArrowRight size={14} className="text-slate-600" />}
              <div className={`flex flex-col items-center rounded-xl border p-2 ${form.pokemonId === a.finalPokemonId ? "border-purple-400/50 bg-purple-500/10" : "border-border bg-slate-900/40"}`}>
                <img src={getStaticSpriteUrl(form.pokemonId)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                <p className="text-[10px] font-semibold text-slate-200">{form.name}</p>
                <p className="text-[9px] text-slate-500">{form.level === 1 ? "Base" : `Nv.${form.level}`}</p>
              </div>
            </div>
          ))}
        </div>
        {a.evolutionNote && <p className="mt-3 text-xs text-purple-300">{a.evolutionNote}</p>}
      </div>
    </div>
  );
}
