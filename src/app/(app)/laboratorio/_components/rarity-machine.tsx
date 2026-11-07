"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, Sparkles, X } from "lucide-react";
import { fuseMascotsInLabAction, grantCreationDustAction, searchLabPlayersAction } from "../actions";
import { CodeChip, StatStrip, TagChip, statsTotal, type MascotStats } from "./mascot-chips";
import { PERSONALITY_LABEL } from "@/lib/mascot-data";
import { getOriginFusionRecipe, validateLabStarFusion } from "@/lib/lab-rarity-machine";

export type MachineMascot = {
  id: string;
  pokemonId: number;
  name: string;
  nickname: string | null;
  level: number;
  isShiny: boolean;
  spriteUrl: string;
  recyclable: boolean;
  performanceTag?: string | null;
  stats?: MascotStats;
  personality?: string;
  eggOrigin?: string | null;
  eggType?: string | null;
  labStars?: number;
};

const ORIGIN_LABEL: Record<string, string> = { COMMON: "Comum", RARE: "Raro", EVENT: "Evento", SPECIAL: "Especial", LAB: "Laboratório" };
const ORIGIN_COLOR: Record<string, string> = {
  COMMON: "border-slate-500/60 text-slate-300",
  RARE: "border-sky-400/60 text-sky-300",
  EVENT: "border-emerald-400/60 text-emerald-300",
  SPECIAL: "border-amber-400/70 text-amber-300",
  LAB: "border-fuchsia-400/70 text-fuchsia-300",
};
const PAGE_SIZE = 12;
export type FusedSnapshot = {
  pokemonId: number; name: string; nickname: string | null; spriteUrl: string; level: number;
  eggType: string | null; eggOrigin: string | null; labStars: number; personality: string;
  stats: MascotStats; eventBonusStat: string | null; eventBonusValue: number | null;
};
const SORTS = { level: "Maior nível", total: "Maior status total", name: "Nome (A–Z)" } as const;
const label = (m: MachineMascot) => m.nickname || m.name;

type Plan = { ok: true; mode: "ORIGIN" | "STAR"; summary: string; cost: number } | { ok: false; reason: string };

function planFusion(sel: MachineMascot[]): Plan {
  if (sel.length < 2) return { ok: false, reason: "Escolha o mascote mantido e os que serão consumidos." };
  const [keep, ...rest] = sel;
  if (rest.some((m) => m.pokemonId !== keep.pokemonId || m.eggType !== keep.eggType)) return { ok: false, reason: "Todos precisam ser o mesmo Pokémon e da mesma origem." };
  if (keep.eggType === "LAB") {
    try {
      let next = 0;
      for (const c of rest) next = validateLabStarFusion({
        survivorOrigin: keep.eggType, survivorLevel: keep.level, survivorStars: keep.labStars ?? 0,
        consumedOrigin: c.eggType, consumedLevel: c.level, consumedStars: c.labStars ?? 0,
      });
      return { ok: true, mode: "STAR", summary: `${keep.labStars ?? 0}★ → ${next}★ (+5 em todos os atributos) · sem custo`, cost: 0 };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Fusão inválida." };
    }
  }
  const recipe = getOriginFusionRecipe(keep.eggType);
  if (sel.length !== 3) return { ok: false, reason: "A fusão de origem usa 3 mascotes (1 mantido + 2 consumidos)." };
  if (!recipe) return { ok: false, reason: "A origem do mascote mantido não evolui mais." };
  if (rest.some((m) => m.eggType !== recipe.sourceOrigin)) return { ok: false, reason: `Os três precisam ter origem ${ORIGIN_LABEL[recipe.sourceOrigin]}.` };
  return { ok: true, mode: "ORIGIN", summary: `${ORIGIN_LABEL[recipe.sourceOrigin]} → ${ORIGIN_LABEL[recipe.resultOrigin]} · custa ${recipe.mutationCost} Pó de Criação`, cost: recipe.mutationCost };
}

function DustGrantPanel({ onSelfGrant }: { onSelfGrant: (n: number) => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: string; displayName: string; creationDust: number }[]>([]);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null); // null = minha conta
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => { searchLabPlayersAction(q).then(setFound).catch(() => setFound([])); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function grant() {
    setBusy(true); setMsg(null);
    try {
      const res = await grantCreationDustAction(target?.id ?? "", Number(amount));
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      if (res.isSelf) onSelfGrant(res.added);
      setMsg({ ok: true, text: `+${res.added} Pó de Criação para ${res.name} (saldo: ${res.balance}).` });
    } finally { setBusy(false); }
  }

  return (
    <details className="rounded-3xl border border-amber-400/25 bg-slate-900/50 p-4">
      <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-amber-300">Admin · Adicionar Pó de Criação</summary>
      <div className="mt-3 space-y-2">
        <p className="text-xs text-slate-400">Destino: <b className="text-white">{target ? target.name : "Minha conta"}</b>{target && <button type="button" onClick={() => setTarget(null)} className="ml-2 text-fuchsia-300 underline">usar minha conta</button>}</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar outro jogador (mín. 2 letras)…" className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-white outline-none focus:border-amber-300" />
        {found.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {found.map((p) => <button key={p.id} type="button" onClick={() => { setTarget({ id: p.id, name: p.displayName }); setQ(""); setFound([]); }} className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-amber-300">{p.displayName} · 🧫 {p.creationDust}</button>)}
          </div>
        )}
        <div className="flex gap-2">
          <input type="number" min={1} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-white" />
          <button type="button" disabled={busy} onClick={grant} className="rounded-lg bg-amber-300 px-4 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-40">{busy ? "Adicionando…" : "Adicionar"}</button>
        </div>
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
      </div>
    </details>
  );
}

export function RarityMachine({
  mascots, dust, onFused, onSelfGrant,
}: {
  mascots: MachineMascot[];
  dust: number;
  onSelfGrant: (amount: number) => void;
  onFused: (r: { survivorId: string; consumedIds: string[]; mode: "ORIGIN" | "STAR"; survivor: FusedSnapshot; cost: number }) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState("");
  const [only100, setOnly100] = useState(false);
  const [tag, setTag] = useState("");
  const [personality, setPersonality] = useState("");
  const [starsF, setStarsF] = useState("");
  const [sort, setSort] = useState<keyof typeof SORTS>("level");
  const [rolling, setRolling] = useState<MascotStats | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [anim, setAnim] = useState<null | { phase: "charge" | "reveal"; keep: MachineMascot; eaten: MachineMascot[]; summary: string; mode: "ORIGIN" | "STAR"; result?: FusedSnapshot }>(null);

  const pool = useMemo(() => mascots.filter((m) => m.recyclable), [mascots]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = pool.filter((m) =>
      (!q || label(m).toLowerCase().includes(q) || m.name.toLowerCase().includes(q)) &&
      (!origin || m.eggType === origin) && (!only100 || m.level === 100) &&
      (!tag || (m.performanceTag ?? "NEUTRO") === tag) && (!personality || m.personality === personality) &&
      (!starsF || (m.eggType === "LAB" && (m.labStars ?? 0) === Number(starsF))));
    const total = (m: MachineMascot) => (m.stats ? statsTotal(m.stats) : 0);
    return list.sort((a, b) => sort === "name" ? label(a).localeCompare(label(b)) : sort === "total" ? total(b) - total(a) : b.level - a.level);
  }, [pool, search, origin, only100, tag, personality, starsF, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, pages - 1);
  const visible = filtered.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE);

  const selected = ids.map((id) => pool.find((m) => m.id === id)).filter(Boolean) as MachineMascot[];
  const plan = planFusion(selected);

  const toggle = (id: string) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  const makeKeeper = (id: string) => setIds((p) => [id, ...p.filter((x) => x !== id)]);

  async function run() {
    if (!plan.ok || anim) return;
    const [keep, ...eaten] = selected;
    if (dust < plan.cost) return setError(`Pó de Criação insuficiente: a fusão custa ${plan.cost} e você tem ${dust}.`);
    setError(null);
    setAnim({ phase: "charge", keep, eaten, summary: plan.summary, mode: plan.mode });
    const [res] = await Promise.all([
      fuseMascotsInLabAction({ mode: plan.mode, survivorId: keep.id, consumedIds: eaten.map((m) => m.id) }),
      new Promise((r) => setTimeout(r, 3000)), // dá tempo da animação de carga
    ]);
    if (!res.ok) { setAnim(null); setError(res.error); return; }
    setAnim({ phase: "reveal", keep, eaten, summary: plan.summary, mode: plan.mode, result: res.survivor });
    onFused({ survivorId: keep.id, consumedIds: eaten.map((m) => m.id), mode: plan.mode, survivor: res.survivor, cost: res.cost });
    setIds([]);
  }

  // números sorteando enquanto a máquina refaz os status (só na fusão de origem)
  const charging = anim?.phase === "charge" && anim.mode === "ORIGIN";
  useEffect(() => {
    if (!charging) { setRolling(null); return; }
    const r = () => 20 + Math.floor(Math.random() * 60);
    const t = setInterval(() => setRolling({ force: r(), agility: r(), charisma: r(), instinct: r(), vitality: r() }), 80);
    return () => clearInterval(t);
  }, [charging]);

  useEffect(() => { setPage(0); }, [search, origin, only100, tag, personality, starsF, sort]);

  return (
    <div className="space-y-4">
      <style>{CSS}</style>

      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-3xl border border-fuchsia-400/35 bg-[radial-gradient(circle_at_20%_0%,rgba(217,70,239,0.25),transparent_45%),radial-gradient(circle_at_90%_100%,rgba(250,204,21,0.12),transparent_40%),rgba(15,23,42,0.92)] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-300">Teste administrativo</p>
        <h2 className="mt-1 font-pixel text-xl text-white">Máquina de Raridade</h2>
        <p className="mt-1 text-xs font-bold text-fuchsia-200">🧫 Seu Pó de Criação: {dust}</p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">
          O 1º escolhido é o <b className="text-fuchsia-200">mantido</b>; os outros são <b className="text-rose-300">consumidos</b>.
          Três da mesma origem sobem de origem. Dois LAB Lv.100 com a mesma estrela ganham ★.
        </p>
      </div>

      <DustGrantPanel onSelfGrant={onSelfGrant} />

      {/* Câmara */}
      <div className="rounded-3xl border border-fuchsia-400/25 bg-slate-950/70 p-4">
        <div className="grid grid-cols-3 items-stretch gap-2 sm:gap-4">
          {[0, 1, 2].map((i) => {
            const m = selected[i];
            const keeper = i === 0;
            return (
              <div key={i} className={`relative flex min-h-[148px] flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition ${m ? (keeper ? "border-fuchsia-300 bg-fuchsia-500/10 shadow-[0_0_24px_rgba(217,70,239,0.3)]" : "border-rose-400/60 bg-rose-500/5") : "border-dashed border-slate-700 bg-slate-900/40"}`}>
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${keeper ? "bg-fuchsia-400 text-slate-950" : "bg-rose-400/90 text-slate-950"}`}>{keeper ? "Mantido" : "Consumido"}</span>
                {m ? (
                  <>
                    <button type="button" onClick={() => toggle(m.id)} aria-label="Remover" className="absolute right-1.5 top-1.5 rounded-full bg-slate-800 p-1 text-slate-400 hover:text-white"><X size={11} /></button>
                    <img src={m.spriteUrl} alt="" className="rm-bob mt-3 h-16 w-16 object-contain [image-rendering:pixelated]" />
                    <p className="mt-1 max-w-full truncate text-xs font-bold text-white">{label(m)}</p>
                    <TagChip tag={m.performanceTag} />
                    <p className="text-[10px] text-slate-400">{ORIGIN_LABEL[m.eggType ?? ""] ?? "Sem origem"} · Lv.{m.level}{m.eggType === "LAB" && (m.labStars ?? 0) > 0 ? ` · ${m.labStars}★` : ""}</p>
                    {!keeper && <button type="button" onClick={() => makeKeeper(m.id)} className="mt-1 text-[10px] text-fuchsia-300 underline">tornar mantido</button>}
                  </>
                ) : <p className="text-2xl text-slate-700">＋</p>}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          <p className={`text-center text-xs ${plan.ok ? (dust < plan.cost ? "text-red-300" : "text-fuchsia-200") : "text-slate-500"}`}>{plan.ok ? plan.summary : plan.reason}</p>
          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">✗ {error}</p>}
          <button type="button" disabled={!plan.ok || !!anim} onClick={run}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-400 to-amber-300 px-6 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(217,70,239,0.35)] transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none">
            {anim ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Iniciar fusão
          </button>
        </div>
      </div>

      {/* Seletor */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <div className="relative col-span-2 sm:col-span-3 lg:col-span-4">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar mascote…"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 py-1.5 pl-8 pr-3 text-xs text-white outline-none focus:border-fuchsia-400" />
          </div>
          <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-200">
            <option value="">Origem: todas</option>
            {Object.entries(ORIGIN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {[
            [tag, setTag, "Desempenho: todos", [["FORTE", "💪 Forte"], ["NEUTRO", "⚖️ Neutro"], ["RUIM", "👎 Ruim"], ["PESSIMO", "🗑️ Péssimo"]]],
            [personality, setPersonality, "Personalidade: todas", Object.entries(PERSONALITY_LABEL)],
            [starsF, setStarsF, "Estrelas: todas", [["0", "LAB sem estrelas"], ...[1, 2, 3, 4, 5].map((n) => [String(n), n + "★ (LAB)"])]],
          ].map(([val, set, ph, opts], i) => (
            <select key={i} value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-200">
              <option value="">{ph as string}</option>
              {(opts as string[][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          ))}
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-200">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" onClick={() => setOnly100((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${only100 ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-slate-700 text-slate-400"}`}>Somente Lv.100</button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((m) => {
            const idx = ids.indexOf(m.id);
            const first = selected[0];
            const blocked = idx < 0 && !!first && (m.pokemonId !== first.pokemonId || m.eggType !== first.eggType);
            return (
              <button key={m.id} type="button" disabled={blocked} onClick={() => toggle(m.id)}
                className={`relative ${blocked ? "opacity-25" : ""} flex flex-col items-center rounded-xl border p-2 text-center transition hover:-translate-y-0.5 ${idx >= 0 ? "border-fuchsia-300 bg-fuchsia-500/15 shadow-[0_0_14px_rgba(217,70,239,0.3)]" : "border-slate-700/70 bg-slate-950/40 hover:border-slate-500"}`}>
                {idx >= 0 && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-400 text-[10px] font-black text-slate-950">{idx + 1}</span>}
                <img src={m.spriteUrl} alt="" loading="lazy" className="h-12 w-12 object-contain [image-rendering:pixelated]" />
                <div className="mt-1 flex w-full items-center justify-center gap-1">
                  <p className="truncate text-[11px] font-semibold text-white">{m.isShiny ? "✨ " : ""}{label(m)}</p>
                  <CodeChip id={m.id} />
                </div>
                <TagChip tag={m.performanceTag} />
                <span className={`mt-0.5 rounded-full border px-1.5 py-px text-[9px] font-bold ${ORIGIN_COLOR[m.eggType ?? ""] ?? "border-slate-700 text-slate-500"}`}>
                  {ORIGIN_LABEL[m.eggType ?? ""] ?? "—"}{m.eggType === "LAB" && (m.labStars ?? 0) > 0 ? ` ${m.labStars}★` : ""}
                </span>
                <span className="text-[10px] text-slate-500">Lv.{m.level}</span>
                {m.personality && <span className="text-[9px] text-slate-500">{PERSONALITY_LABEL[m.personality] ?? m.personality}</span>}
                <StatStrip stats={m.stats} />
              </button>
            );
          })}
          {visible.length === 0 && <p className="col-span-full py-8 text-center text-xs text-slate-500">Nenhum mascote encontrado.</p>}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>{filtered.length} mascote{filtered.length === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={curPage === 0} onClick={() => setPage(curPage - 1)} className="rounded-lg border border-slate-700 p-1.5 disabled:opacity-30"><ChevronLeft size={14} /></button>
            <span>{curPage + 1} / {pages}</span>
            <button type="button" disabled={curPage >= pages - 1} onClick={() => setPage(curPage + 1)} className="rounded-lg border border-slate-700 p-1.5 disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {/* Animação de fusão */}
      {anim && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-slate-950/95">
          <div className={`rm-aura absolute h-[480px] w-[480px] rounded-full ${anim.phase === "reveal" ? "rm-aura-final" : ""}`} />
          {anim.phase === "charge" ? (
            <div className="relative h-72 w-72">
              <div className="rm-core absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full" />
              {[0, 1, 2].map((i) => <div key={i} className="rm-ring absolute left-1/2 top-1/2 rounded-full border-2 border-fuchsia-300/60" style={{ animationDelay: `${i * 0.7}s` }} />)}
              <img src={anim.keep.spriteUrl} alt="" className="rm-keep absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 object-contain [image-rendering:pixelated]" />
              {anim.eaten.map((m, i) => (
                <img key={m.id} src={m.spriteUrl} alt="" className="rm-eaten absolute left-1/2 top-1/2 h-16 w-16 object-contain [image-rendering:pixelated]"
                  style={{ ["--a" as string]: `${i * 180 + 90}deg`, animationDelay: `${i * 0.25}s` }} />
              ))}
              <div className="absolute -bottom-28 left-1/2 w-72 -translate-x-1/2">
                <p className="text-center text-sm font-bold tracking-widest text-fuchsia-200 animate-pulse">{anim.mode === "ORIGIN" ? "SUBINDO DE ORIGEM…" : "FUNDINDO ESTRELAS…"}</p>
                {anim.mode === "ORIGIN" && <>
                  <p className="mt-1 text-center text-[11px] text-slate-400">Mudando personalidade e sorteando status</p>
                  <div className="mt-2 opacity-80"><StatStrip stats={rolling ?? anim.keep.stats} size="md" /></div>
                </>}
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col items-center">
              <div className="rm-flash pointer-events-none fixed inset-0 bg-white" />
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className="rm-spark absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-amber-200"
                  style={{ ["--a" as string]: `${i * 22.5}deg`, ["--d" as string]: `${110 + (i % 3) * 40}px` }} />
              ))}
              <img src={anim.keep.spriteUrl} alt="" className="rm-pop h-40 w-40 object-contain drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] [image-rendering:pixelated]" />
              <p className="rm-rise mt-4 font-pixel text-2xl text-[#FFCB05]">Fusão concluída!</p>
              <p className="rm-rise mt-1 text-sm font-semibold text-white">{label(anim.keep)}</p>
              <p className="rm-rise mt-1 text-xs text-fuchsia-200" style={{ animationDelay: "0.5s" }}>{anim.summary}</p>
              {anim.mode === "ORIGIN" && anim.result && (
                <div className="rm-rise mt-3 w-72 rounded-2xl border border-fuchsia-400/30 bg-slate-900/80 p-3 text-center" style={{ animationDelay: "0.7s" }}>
                  <p className="text-[11px] text-slate-300">
                    <b className="text-amber-300">{ORIGIN_LABEL[anim.result.eggType ?? ""] ?? "—"}</b> · Lv.{anim.result.level} · Nova personalidade: <b className="text-fuchsia-200">{PERSONALITY_LABEL[anim.result.personality] ?? anim.result.personality}</b>
                  </p>
                  <div className="mt-2"><StatStrip stats={anim.result.stats} size="md" /></div>
                  {anim.result.eventBonusStat && anim.result.eventBonusValue ? <p className="mt-2 text-[10px] text-emerald-300">Bônus de evento preservado (+{anim.result.eventBonusValue})</p> : null}
                </div>
              )}
              <button type="button" onClick={() => setAnim(null)} className="rm-rise mt-6 rounded-xl bg-fuchsia-400 px-6 py-2 text-sm font-bold text-slate-950" style={{ animationDelay: "0.9s" }}>Fechar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
@keyframes rm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.rm-bob{animation:rm-bob 2s ease-in-out infinite}
@keyframes rm-aura{0%,100%{opacity:.35;transform:scale(.9)}50%{opacity:.7;transform:scale(1.1)}}
.rm-aura{background:radial-gradient(circle,rgba(217,70,239,.45),transparent 65%);animation:rm-aura 1.6s ease-in-out infinite}
.rm-aura-final{background:radial-gradient(circle,rgba(250,204,21,.6),rgba(217,70,239,.2) 45%,transparent 70%)}
@keyframes rm-core{0%{box-shadow:0 0 10px 2px #e879f9;transform:translate(-50%,-50%) scale(.6)}100%{box-shadow:0 0 70px 30px #fff;transform:translate(-50%,-50%) scale(1.5)}}
.rm-core{background:radial-gradient(circle,#fff,#e879f9);animation:rm-core 3s ease-in forwards}
@keyframes rm-ring{0%{width:20px;height:20px;opacity:1;transform:translate(-50%,-50%)}100%{width:300px;height:300px;opacity:0;transform:translate(-50%,-50%)}}
.rm-ring{animation:rm-ring 2.1s ease-out infinite}
@keyframes rm-keep{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.15)}}
.rm-keep{animation:rm-keep .6s ease-in-out infinite;filter:drop-shadow(0 0 12px #e879f9)}
@keyframes rm-eaten{0%{transform:translate(-50%,-50%) rotate(var(--a)) translateX(130px) rotate(calc(var(--a) * -1)) scale(1);opacity:1}
  70%{transform:translate(-50%,-50%) rotate(calc(var(--a) + 540deg)) translateX(40px) rotate(calc(var(--a) * -1 - 540deg)) scale(.6);opacity:1}
  100%{transform:translate(-50%,-50%) rotate(calc(var(--a) + 720deg)) translateX(0) rotate(calc(var(--a) * -1 - 720deg)) scale(0);opacity:0}}
.rm-eaten{animation:rm-eaten 2.8s cubic-bezier(.5,0,.8,.6) forwards;filter:brightness(1.4) drop-shadow(0 0 8px #fb7185)}
@keyframes rm-flash{0%{opacity:1}100%{opacity:0}}
.rm-flash{animation:rm-flash .9s ease-out forwards}
@keyframes rm-pop{0%{transform:scale(.2);filter:brightness(3)}60%{transform:scale(1.25)}100%{transform:scale(1);filter:brightness(1)}}
.rm-pop{animation:rm-pop .8s cubic-bezier(.2,1.4,.4,1) both}
@keyframes rm-spark{0%{transform:translate(-50%,-50%) rotate(var(--a)) translateX(0);opacity:1}100%{transform:translate(-50%,-50%) rotate(var(--a)) translateX(var(--d));opacity:0}}
.rm-spark{animation:rm-spark 1.2s ease-out .15s both}
@keyframes rm-rise{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
.rm-rise{animation:rm-rise .5s ease-out .3s both}
@media (prefers-reduced-motion:reduce){.rm-bob,.rm-aura,.rm-ring,.rm-keep{animation:none}}
`;
