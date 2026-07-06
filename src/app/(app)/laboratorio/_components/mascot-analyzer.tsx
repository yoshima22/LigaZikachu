"use client";

import { useState, useTransition, useMemo } from "react";
import { Search, Sparkles, Loader2, ArrowRight, TrendingUp } from "lucide-react";
import { analyzeMascotAction } from "../actions";
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

function StatBar({ label, current, projected, delta }: { label: string; current: number; projected: number; delta: number }) {
  const max = Math.max(projected, 1);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-slate-400">{label}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className="absolute inset-y-0 left-0 rounded-full bg-slate-600" style={{ width: `${(current / max) * 100}%` }} />
        <div className="absolute inset-y-0 rounded-full bg-cyan-500/70" style={{ left: `${(current / max) * 100}%`, width: `${(delta / max) * 100}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-slate-300">{projected}</span>
      {delta > 0 && <span className="w-8 shrink-0 text-right text-emerald-400">+{delta}</span>}
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
  const [targetLevel, setTargetLevel] = useState(50);
  const [analysis, setAnalysis] = useState<MascotAnalysis | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
    setTargetLevel(Math.max(m.level, Math.min(100, 50)));
  };

  const runAnalysis = () => {
    if (!selected) return;
    setError(null);
    start(async () => {
      const res = await analyzeMascotAction(selected.id, targetLevel);
      if (!res.ok) { setError(res.error); return; }
      setAnalysis(res.analysis);
      onBalanceChange(res.coinBalance);
      onAnalyzed(selected.id, res.analysis.ivRating, res.analysis.ivScore);
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-purple-500/20 bg-purple-950/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-xl">🔬</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-100">Análise de Mascote</p>
            <p className="text-xs text-slate-400">
              Descubra o <strong className="text-purple-300">potencial (IV)</strong>, a prévia de evolução e a projeção de atributos.
              Cada análise custa <strong className="text-[#FFCB05]">{analysisCost} ZC</strong> e atribui um ranking de <strong>SSS</strong> a <strong>E</strong>.
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
              className={`relative flex flex-col items-center rounded-xl border p-2 transition-colors ${
                selected?.id === m.id ? "border-purple-400/60 bg-purple-500/10" : "border-border bg-slate-800/30 hover:border-purple-400/40"
              }`}>
              <img src={m.spriteUrl} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
              <p className="mt-0.5 line-clamp-1 w-full text-center text-[9px] font-semibold text-white">{m.nickname || m.name}</p>
              <p className="text-[9px] text-slate-500">Lv.{m.level}</p>
              {m.analyzed && m.ivRating && (
                <span className="absolute -top-1 -right-1"><RatingBadge rating={m.ivRating} score={m.ivScore} size="sm" /></span>
              )}
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
            <button onClick={runAnalysis} disabled={pending || coinBalance < analysisCost}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50">
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {pending ? "Analisando..." : `Analisar (${analysisCost} ZC)`}
            </button>
          </div>

          {coinBalance < analysisCost && !analysis && (
            <p className="text-xs text-red-400">Saldo insuficiente para analisar ({analysisCost} ZC).</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {analysis && <AnalysisResult analysis={analysis} spriteUrl={selected.spriteUrl} />}
        </div>
      )}
    </div>
  );
}

function AnalysisResult({ analysis, spriteUrl }: { analysis: MascotAnalysis; spriteUrl: string }) {
  const a = analysis;
  const style = RATING_STYLE[a.ivRating];
  return (
    <div className="space-y-4 border-t border-border/50 pt-4">
      {/* Rating + potencial */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className={`flex items-center gap-4 rounded-2xl border p-4 ${style.border} ${style.bg}`}>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Ranking</p>
            <p className={`font-pixel text-3xl ${style.text}`}>{a.ivRating}</p>
          </div>
          <div className="h-10 w-px bg-slate-700" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Potencial (IV)</p>
            <p className={`text-2xl font-bold ${style.text}`}>{a.ivScore}%</p>
          </div>
          <p className="ml-auto max-w-[52%] text-xs text-slate-300">{a.verdict}</p>
        </div>
      </div>

      {/* Detalhamento do potencial */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-border bg-slate-950/40 p-2">
          <p className="text-slate-500">Roll inicial</p>
          <p className="font-bold text-slate-200">{a.rollQualityPct}%</p>
        </div>
        <div className="rounded-xl border border-border bg-slate-950/40 p-2">
          <p className="text-slate-500">Espécie</p>
          <p className="font-bold text-slate-200">{a.speciesPotentialPct}%</p>
        </div>
        <div className="rounded-xl border border-border bg-slate-950/40 p-2">
          <p className="text-slate-500">Evoluções</p>
          <p className="font-bold text-slate-200">{a.evoPotentialPct}%</p>
        </div>
      </div>

      {/* Projeção de atributos */}
      <div className="rounded-2xl border border-border bg-slate-950/40 p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
          <TrendingUp size={13} className="text-cyan-400" />
          Projeção Nv.{a.currentLevel} → Nv.{a.targetLevel}
          <span className="ml-auto text-slate-500">Total {a.currentTotal} → <span className="text-cyan-300">{a.projectedTotal}</span></span>
        </p>
        <div className="space-y-1.5">
          {a.perStat.map(s => <StatBar key={s.key} label={s.label} current={s.current} projected={s.projected} delta={s.delta} />)}
        </div>
      </div>

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
          <img src={spriteUrl} alt="" className="hidden" />
        </div>
        {a.evolutionNote && <p className="mt-3 text-xs text-purple-300">{a.evolutionNote}</p>}
      </div>
    </div>
  );
}
