"use client";

import { useState, useTransition, useMemo } from "react";
import { Search, Sparkles, Loader2, ArrowRight, TrendingUp, Eye, Swords, Shield } from "lucide-react";
import { analyzeMascotAction, getStoredAnalysisAction } from "../actions";
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

function StatBar({ label, current, projected, delta }: { label: string; current: number; projected: number; delta: number }) {
  const max = Math.max(projected, 1);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="group/tip relative w-16 shrink-0 cursor-help text-slate-400 underline decoration-dotted decoration-slate-600">
        {label}
        {STAT_TIPS[label] && <TipBubble text={STAT_TIPS[label]} align="left" />}
      </span>
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
  const [targetLevel, setTargetLevel] = useState(100);
  const [analysis, setAnalysis] = useState<MascotAnalysis | null>(null);
  const [pending, start] = useTransition();
  const [viewPending, startView] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

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
  };

  const runAnalysis = () => {
    if (!selected) return;
    setError(null);
    start(async () => {
      const res = await analyzeMascotAction(selected.id, targetLevel);
      if (!res.ok) { setError(res.error); return; }
      setAnalysis(res.analysis);
      setFromCache(false);
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
              <button onClick={runAnalysis} disabled={pending || coinBalance < analysisCost}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50">
                {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {pending ? "Analisando..." : selected.analyzed ? `Reanalisar (${analysisCost} ZC)` : `Analisar (${analysisCost} ZC)`}
              </button>
            </div>
          </div>

          {coinBalance < analysisCost && !analysis && (
            <p className="text-xs text-red-400">Saldo insuficiente para uma nova análise ({analysisCost} ZC){selected.analyzed ? " — mas você pode ver a análise salva de graça." : "."}</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {analysis && (
            <>
              {fromCache && (
                <p className="text-[11px] text-slate-500">
                  📄 Mostrando a análise salva{analysis.analyzedAtIso ? ` de ${new Date(analysis.analyzedAtIso).toLocaleDateString("pt-BR")}` : ""} (Nv.{analysis.currentLevel} → Nv.{analysis.targetLevel}). Reanalise para atualizar com o nível atual.
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
            <TipBubble align="left" text="Nota geral de SSS (elite) a E (fraco). Resume o potencial do mascote combinando roll inicial, bônus da espécie e evoluções." />
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
                <TipBubble text="Estimativa do poder de combate no nível-alvo, ponderando todos os atributos projetados (Força e Vitalidade pesam mais)." />
              </div>
            </>
          )}
        </div>
        <p className="mt-3 border-t border-white/5 pt-3 text-sm text-slate-200">{a.verdict}</p>
      </div>

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
          <TipBubble align="right" text="Evoluções ainda restantes na linha. Cada evolução concede marcos de atributos, elevando o teto de poder. Linha completa de 3 estágios = 100%." />
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

      {/* Projeção de atributos */}
      <div className="rounded-2xl border border-border bg-slate-950/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
          <TrendingUp size={13} className="text-cyan-400" />
          <span className="group/tip relative cursor-help underline decoration-dotted decoration-slate-600">
            Projeção Nv.{a.currentLevel} → Nv.{a.targetLevel}
            <TipBubble align="left" text="Como os atributos devem crescer do nível atual até o nível-alvo. A barra cinza é o valor atual; a parte ciano é o ganho estimado. Passe o mouse em cada atributo para ver o que ele faz." />
          </span>
          <span className="ml-auto text-slate-500">Total {a.currentTotal} → <span className="text-cyan-300">{a.projectedTotal}</span></span>
        </div>
        <div className="space-y-1.5">
          {a.perStat.map(s => <StatBar key={s.key} label={s.label} current={s.current} projected={s.projected} delta={s.delta} />)}
        </div>
      </div>

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
