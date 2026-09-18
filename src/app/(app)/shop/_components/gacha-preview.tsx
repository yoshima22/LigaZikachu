"use client";

// ponytail: mockup estatico (state local, sem DB nem server actions).
// E so a visualizacao admin-only do sistema de Invocacoes pedida antes da implementacao.

import { useState } from "react";
import { Sparkles, Image as ImageIcon, Target, Wallet, Plus, Trash2, Clock, Info, History, Percent, X } from "lucide-react";

/* ─────────────────────────── dados de exemplo ─────────────────────────── */

const RARITIES = [
  { key: "COMMON",    label: "Comum",          color: "#cbd5e1", range: "8~14" },
  { key: "RARE",      label: "Raro",           color: "#60a5fa", range: "11~17" },
  { key: "EVENT",     label: "Evento",         color: "#f87171", range: "12~19" },
  { key: "SPECIAL",   label: "Especial",       color: "#fbbf24", range: "13~20" },
  { key: "LAB",       label: "De Laboratório", color: "#c084fc", range: "17~26" },
  { key: "CELESTIAL", label: "Celestial",      color: "#5eead4", range: "23~30" },
] as const;

const OBJECTIVE_SOURCES = [
  { key: "ARENA_Z",         label: "Arena-Z",               metric: "vitórias" },
  { key: "LIGA_RUSH",       label: "Liga Rush",             metric: "corridas concluídas" },
  { key: "LIGA_SEMANAL",    label: "Liga Semanal",          metric: "partidas jogadas" },
  { key: "BATALHA_TERRENO", label: "Batalha de Terreno",    metric: "vitórias" },
  { key: "ARENA_DRAFT",     label: "Arena Draft",           metric: "drafts finalizados" },
  { key: "FIGURINHAS",      label: "Coleção de Figurinhas", metric: "figurinhas novas" },
  { key: "BAZAR_VENDA",     label: "Venda no Bazar",        metric: "vendas concluídas" },
  { key: "BAZAR_GASTO_ZC",  label: "Gasto de ZC no Bazar",  metric: "ZC gastos" },
  { key: "BAZAR_GASTO_LC",  label: "Gasto de LC no Bazar",  metric: "LC gastos" },
  { key: "OVOS_ABERTOS",    label: "Aberturas de ovos",     metric: "ovos chocados" },
];

type Mission = { id: number; source: string; label: string; goal: number; reward: "POKEBOLA" | "ULTRABOLA"; amount: number };

const SEED_MISSIONS: Mission[] = [
  { id: 1, source: "ARENA_Z",        label: "Vença 5 combates na Arena-Z",         goal: 5,    reward: "POKEBOLA",  amount: 3 },
  { id: 2, source: "LIGA_RUSH",      label: "Conclua 3 corridas da Liga Rush",     goal: 3,    reward: "POKEBOLA",  amount: 2 },
  { id: 3, source: "OVOS_ABERTOS",   label: "Choque 2 ovos Especiais ou melhores", goal: 2,    reward: "ULTRABOLA", amount: 1 },
  { id: 4, source: "BAZAR_GASTO_ZC", label: "Gaste 5.000 ZC no Bazar",             goal: 5000, reward: "POKEBOLA",  amount: 4 },
];

type PoolEntry = { id: number; name: string; kind: "Mascote" | "Item"; rarity: string; weight: number; rateUp: boolean };

const SEED_POOL: PoolEntry[] = [
  { id: 1, name: "Lugia",                 kind: "Mascote", rarity: "CELESTIAL", weight: 0.6, rateUp: true },
  { id: 2, name: "Ovo Celestial",         kind: "Item",    rarity: "CELESTIAL", weight: 0.4, rateUp: true },
  { id: 3, name: "Pena Arco-Íris de Lab", kind: "Item",    rarity: "LAB",       weight: 4,   rateUp: false },
  { id: 4, name: "Ovo Especial",          kind: "Item",    rarity: "SPECIAL",   weight: 10,  rateUp: false },
  { id: 5, name: "Ovo de Evento",         kind: "Item",    rarity: "EVENT",     weight: 15,  rateUp: false },
  { id: 6, name: "Ovo Raro",              kind: "Item",    rarity: "RARE",      weight: 30,  rateUp: false },
  { id: 7, name: "Ovo Comum",             kind: "Item",    rarity: "COMMON",    weight: 40,  rateUp: false },
];

const LC_PACKS = [
  { name: "Punhado de Pokébolas", currency: "Pokébola",   amount: 10,  bonus: 0,  lc: 50 },
  { name: "Caixa de Pokébolas",   currency: "Pokébola",   amount: 50,  bonus: 5,  lc: 220 },
  { name: "Carga de Pokébolas",   currency: "Pokébola",   amount: 120, bonus: 20, lc: 480 },
  { name: "Par de Ultra Bolas",   currency: "Ultra Bola", amount: 2,   bonus: 0,  lc: 150 },
  { name: "Cofre de Ultra Bolas", currency: "Ultra Bola", amount: 10,  bonus: 2,  lc: 650 },
];

const rarityOf = (key: string) => RARITIES.find((r) => r.key === key) ?? RARITIES[0];

const inputCls = "w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-300/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  );
}

/* ─────────────────────────────── componente ─────────────────────────────── */

const SUBTABS = [
  { id: "preview",  label: "Prévia do jogador", icon: <Sparkles size={14} /> },
  { id: "banner",   label: "Banner",            icon: <ImageIcon size={14} /> },
  { id: "pool",     label: "Pool & Rate-up",    icon: <Percent size={14} /> },
  { id: "missions", label: "Missões semanais",  icon: <Target size={14} /> },
  { id: "packs",    label: "Pacotes LC",        icon: <Wallet size={14} /> },
];

export function GachaPreview() {
  const [tab, setTab] = useState("preview");

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes gacha-shake { 0%,100%{transform:rotate(0) translateY(0)} 20%{transform:rotate(-14deg)} 40%{transform:rotate(14deg)} 60%{transform:rotate(-10deg) translateY(-6px)} 80%{transform:rotate(10deg)} }
        @keyframes gacha-burst { 0%{opacity:0;transform:scale(.2)} 40%{opacity:.9} 100%{opacity:0;transform:scale(3.2)} }
        @keyframes gacha-reveal { from{opacity:0;transform:translateY(18px) scale(.9)} to{opacity:1;transform:none} }
        @keyframes gacha-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      `}</style>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200">
        <strong>Prévia admin.</strong> Nada aqui grava no banco ainda — é a visualização do sistema de Invocações para validar o formato antes de implementar.
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {SUBTABS.map((s) => (
          <button key={s.id} type="button" onClick={() => setTab(s.id)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === s.id ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200" : "border-border text-slate-400 hover:text-slate-200"
            }`}>
            {s.icon}{s.label}
          </button>
        ))}
      </div>

      {tab === "preview"  && <PlayerPreview />}
      {tab === "banner"   && <BannerEditor />}
      {tab === "pool"     && <PoolEditor />}
      {tab === "missions" && <MissionEditor />}
      {tab === "packs"    && <PackEditor />}
    </div>
  );
}

/* ─────────────────────────── 1. prévia do jogador ─────────────────────────── */

function PlayerPreview() {
  const [pull, setPull] = useState<{ currency: "POKEBOLA" | "ULTRABOLA"; count: number } | null>(null);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-br from-[#0b1027] via-[#131a3d] to-[#07142b]">
        {/* arte do banner (placeholder — a imagem real é enviada pelo admin) */}
        <div className="absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(circle at 25% 55%, rgba(94,234,212,.35), transparent 55%), radial-gradient(circle at 70% 20%, rgba(96,165,250,.3), transparent 60%)" }} />
        <div className="absolute left-8 top-1/2 hidden -translate-y-1/2 lg:block">
          <div className="flex h-72 w-72 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/5 text-center text-[11px] uppercase tracking-widest text-cyan-200/70"
            style={{ animation: "gacha-float 6s ease-in-out infinite" }}>
            arte do mascote<br />em destaque
          </div>
        </div>

        <div className="relative p-6">
          <div className="mb-8 flex justify-end gap-3 text-sm font-bold">
            <span className="rounded-full border border-slate-500/40 bg-slate-900/70 px-4 py-1.5 text-slate-200">🔴 24 Pokébolas</span>
            <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1.5 text-amber-200">🟡 3 Ultra Bolas</span>
          </div>

          <div className="ml-auto max-w-xl space-y-5 text-right">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 px-4 py-1 text-[10px] uppercase tracking-[0.3em] text-cyan-200">Evento de invocação</p>
            <div>
              <h2 className="font-pixel text-2xl text-white drop-shadow sm:text-4xl">LUGIA</h2>
              <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-300">Guardião dos Mares</p>
            </div>
            <p className="text-sm text-slate-300">O equilíbrio entre céus e oceanos pode renascer em suas mãos.</p>

            <div className="rounded-2xl border border-slate-600/50 bg-slate-950/60 p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">É possível obter ovos entre as seguintes raridades</p>
              <div className="mt-3 flex flex-wrap justify-end gap-3">
                {RARITIES.map((r) => (
                  <div key={r.key} className="flex flex-col items-center gap-1">
                    <span className="flex h-10 w-8 items-center justify-center rounded-[50%_50%_45%_45%/60%_60%_40%_40%] border" style={{ borderColor: r.color, background: `${r.color}22` }}>🥚</span>
                    <span className="text-[9px] uppercase tracking-wider" style={{ color: r.color }}>{r.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-teal-300">Celestial (23~30) só existe em banners de invocação.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <PullButton tone="blue"  title="Invocação"          sub="Usa 1 Pokébola"                      onClick={() => setPull({ currency: "POKEBOLA", count: 1 })} />
              <PullButton tone="gold"  title="Invocação x10"      sub="Garante ao menos 1 Raro ou superior" onClick={() => setPull({ currency: "POKEBOLA", count: 10 })} />
              <PullButton tone="ultra" title="Ultra Invocação"    sub="Usa 1 Ultra Bola"                    onClick={() => setPull({ currency: "ULTRABOLA", count: 1 })} />
              <PullButton tone="ultra" title="Ultra Invocação x10" sub="Garante 1 Especial ou superior"     onClick={() => setPull({ currency: "ULTRABOLA", count: 10 })} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 rounded-xl border border-slate-600/60 bg-slate-900/70 px-3 py-1.5"><Percent size={12} /> Probabilidades</span>
            <span className="flex items-center gap-1.5 rounded-xl border border-slate-600/60 bg-slate-900/70 px-3 py-1.5"><History size={12} /> Histórico</span>
            <span className="flex items-center gap-1.5 rounded-xl border border-slate-600/60 bg-slate-900/70 px-3 py-1.5"><Info size={12} /> Detalhes</span>
            <span className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-600/60 bg-slate-900/70 px-3 py-1.5"><Clock size={12} /> Termina em 12d 04h</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">Missões semanais deste banner, como o jogador vê:</p>
      <div className="grid gap-2 md:grid-cols-2">
        {SEED_MISSIONS.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-slate-950/60 p-3">
            <div>
              <p className="text-sm text-slate-200">{m.label}</p>
              <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(m.id * 23) % 100}%` }} />
              </div>
            </div>
            <span className="whitespace-nowrap text-xs font-bold text-amber-200">+{m.amount} {m.reward === "POKEBOLA" ? "🔴" : "🟡"}</span>
          </div>
        ))}
      </div>

      {pull && <PullAnimation pull={pull} onClose={() => setPull(null)} />}
    </div>
  );
}

function PullButton({ title, sub, tone, onClick }: { title: string; sub: string; tone: "blue" | "gold" | "ultra"; onClick: () => void }) {
  const styles = {
    blue:  "border-sky-300/50 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20",
    gold:  "border-amber-300/60 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25",
    ultra: "border-fuchsia-300/50 bg-fuchsia-400/10 text-fuchsia-100 hover:bg-fuchsia-400/20",
  }[tone];
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border px-4 py-3 text-center transition-colors ${styles}`}>
      <p className="font-pixel text-[11px]">{title}</p>
      <p className="mt-1 text-[10px] opacity-80">{sub}</p>
    </button>
  );
}

function PullAnimation({ pull, onClose }: { pull: { currency: "POKEBOLA" | "ULTRABOLA"; count: number }; onClose: () => void }) {
  const ultra = pull.currency === "ULTRABOLA";
  const results = Array.from({ length: pull.count }, (_, i) => {
    const guaranteed = i === pull.count - 1 && pull.count === 10;
    const pool = ultra ? ["RARE", "SPECIAL", "LAB", "CELESTIAL"] : ["COMMON", "RARE", "EVENT", "SPECIAL"];
    const key = guaranteed ? (ultra ? "CELESTIAL" : "SPECIAL") : pool[i % pool.length];
    return { key, guaranteed };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-700 bg-[#0b1027] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white"><X size={18} /></button>

        <div className="mx-auto mb-6 text-6xl" style={{ animation: "gacha-shake .7s ease-in-out 2" }}>{ultra ? "🟡" : "🔴"}</div>
        <div className="pointer-events-none absolute left-1/2 top-20 h-24 w-24 -translate-x-1/2 rounded-full blur-xl"
          style={{ background: ultra ? "#fbbf24" : "#38bdf8", animation: "gacha-burst 1.4s ease-out 1.2s both" }} />

        <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-slate-400">
          {ultra ? "Ultra Invocação" : "Invocação"} x{pull.count} · cada moeda tem animação própria
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {results.map((r, i) => {
            const rar = rarityOf(r.key);
            return (
              <div key={i} className="flex h-28 w-20 flex-col items-center justify-center rounded-xl border"
                style={{ borderColor: rar.color, background: `${rar.color}18`, animation: `gacha-reveal .45s ease-out ${1.5 + i * 0.12}s both` }}>
                <span className="text-2xl">🥚</span>
                <span className="mt-2 text-[9px] uppercase" style={{ color: rar.color }}>{rar.label}</span>
                <span className="text-[8px] text-slate-400">{rar.range}</span>
                {r.guaranteed && <span className="mt-1 text-[8px] text-amber-300">garantido</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── 2. editor do banner ─────────────────────────── */

function BannerEditor() {
  const [image, setImage] = useState("");
  const [days, setDays] = useState(14);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border border-border bg-slate-950/60 p-5">
        <Field label="Nome do banner"><input defaultValue="Lugia — Guardião dos Mares" className={inputCls} /></Field>
        <Field label="Subtítulo"><input defaultValue="Guardião dos Mares" className={inputCls} /></Field>
        <Field label="Frase de efeito"><textarea rows={2} defaultValue="O equilíbrio entre céus e oceanos pode renascer em suas mãos." className={inputCls} /></Field>
        <Field label="Imagem do banner (URL ou upload)">
          <div className="flex gap-2">
            <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="/events/lugia.webp" className={inputCls} />
            <button type="button" className="rounded-xl border border-border px-3 text-xs text-slate-300">Upload</button>
          </div>
        </Field>
        <Field label="Duração">
          <div className="flex gap-2">
            {[7, 14, 30].map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)}
                className={`rounded-xl border px-4 py-2 text-xs ${days === d ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-200" : "border-border text-slate-400"}`}>
                {d} dias
              </button>
            ))}
          </div>
        </Field>
        <Field label="Início"><input type="datetime-local" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Custo — invocação simples"><input defaultValue="1 Pokébola" className={inputCls} /></Field>
          <Field label="Custo — invocação x10"><input defaultValue="10 Pokébolas" className={inputCls} /></Field>
          <Field label="Custo — ultra simples"><input defaultValue="1 Ultra Bola" className={inputCls} /></Field>
          <Field label="Custo — ultra x10"><input defaultValue="10 Ultra Bolas" className={inputCls} /></Field>
        </div>
        <Field label="Garantia do x10">
          <select className={inputCls} defaultValue="RARE">
            {RARITIES.map((r) => <option key={r.key} value={r.key}>{r.label} ou superior</option>)}
          </select>
        </Field>
        <Field label="Animação">
          <select className={inputCls}>
            <option>Pokébola — abertura azul</option>
            <option>Ultra Bola — abertura dourada</option>
            <option>Celestial — vórtice</option>
          </select>
        </Field>
        <button type="button" className="w-full rounded-xl border border-cyan-300/50 bg-cyan-300/10 py-2 text-sm font-bold text-cyan-200">Salvar banner (mock)</button>
      </div>

      <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
        <p className="mb-3 text-xs uppercase tracking-widest text-slate-500">Prévia da arte</p>
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-700 bg-gradient-to-br from-[#0b1027] to-[#132248] text-xs text-slate-500">
          {image
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={image} alt="" className="h-full w-full object-cover" />
            : "a imagem enviada aparece aqui"}
        </div>
        <p className="mt-3 text-xs text-slate-500">Recomendado 1920×1080, com o mascote à esquerda — o texto do banner ocupa a direita.</p>
      </div>
    </div>
  );
}

/* ─────────────────────────── 3. pool e rate-up ─────────────────────────── */

function PoolEditor() {
  const [pool, setPool] = useState(SEED_POOL);
  const total = pool.reduce((sum, p) => sum + p.weight, 0);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-slate-950/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-200">Mascotes e itens que podem cair</p>
        <button type="button" onClick={() => setPool([...pool, { id: Date.now(), name: "Novo item", kind: "Item", rarity: "COMMON", weight: 1, rateUp: false }])}
          className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-slate-300"><Plus size={12} /> Adicionar</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr><th className="p-2">Conteúdo</th><th className="p-2">Tipo</th><th className="p-2">Raridade</th><th className="p-2">Peso</th><th className="p-2">Chance</th><th className="p-2">Rate-up</th><th /></tr>
          </thead>
          <tbody>
            {pool.map((p) => {
              const rar = rarityOf(p.rarity);
              return (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="p-2"><input defaultValue={p.name} className={`${inputCls} w-48`} /></td>
                  <td className="p-2"><select defaultValue={p.kind} className={inputCls}><option>Mascote</option><option>Item</option></select></td>
                  <td className="p-2">
                    <select defaultValue={p.rarity} className={inputCls} style={{ color: rar.color }}>
                      {RARITIES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><input type="number" step="0.1" value={p.weight}
                    onChange={(e) => setPool(pool.map((x) => x.id === p.id ? { ...x, weight: Number(e.target.value) } : x))}
                    className={`${inputCls} w-20`} /></td>
                  <td className="p-2 text-slate-400">{total > 0 ? ((p.weight / total) * 100).toFixed(2) : "0.00"}%</td>
                  <td className="p-2">
                    <button type="button" onClick={() => setPool(pool.map((x) => x.id === p.id ? { ...x, rateUp: !x.rateUp } : x))}
                      className={`rounded-lg border px-2 py-1 ${p.rateUp ? "border-amber-300/60 bg-amber-300/10 text-amber-200" : "border-border text-slate-500"}`}>
                      {p.rateUp ? "destaque" : "normal"}
                    </button>
                  </td>
                  <td className="p-2"><button type="button" onClick={() => setPool(pool.filter((x) => x.id !== p.id))} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Peso total {total.toFixed(1)}. Itens em destaque recebem o multiplicador de rate-up do banner e aparecem na arte.</p>
    </div>
  );
}

/* ─────────────────────────── 4. missões semanais ─────────────────────────── */

function MissionEditor() {
  const [missions, setMissions] = useState(SEED_MISSIONS);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-slate-950/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-200">Missões semanais do banner</p>
            <p className="text-xs text-slate-500">Reiniciam toda segunda 00:00 (BRT). O progresso é contado automaticamente quando o jogador cumpre o objetivo no jogo.</p>
          </div>
          <button type="button" onClick={() => setMissions([...missions, { id: Date.now(), source: "ARENA_Z", label: "Nova missão", goal: 1, reward: "POKEBOLA", amount: 1 }])}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-slate-300"><Plus size={12} /> Nova missão</button>
        </div>

        <div className="space-y-2">
          {missions.map((m) => {
            const src = OBJECTIVE_SOURCES.find((s) => s.key === m.source);
            return (
              <div key={m.id} className="grid items-end gap-3 rounded-xl border border-border/60 p-3 md:grid-cols-[1.4fr_1fr_.7fr_.8fr_.5fr_auto]">
                <Field label="Descrição"><input defaultValue={m.label} className={inputCls} /></Field>
                <Field label="Objetivo">
                  <select value={m.source} onChange={(e) => setMissions(missions.map((x) => x.id === m.id ? { ...x, source: e.target.value } : x))} className={inputCls}>
                    {OBJECTIVE_SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label={`Meta (${src?.metric ?? ""})`}><input type="number" defaultValue={m.goal} className={inputCls} /></Field>
                <Field label="Recompensa">
                  <select defaultValue={m.reward} className={inputCls}><option value="POKEBOLA">Pokébola</option><option value="ULTRABOLA">Ultra Bola</option></select>
                </Field>
                <Field label="Qtd."><input type="number" defaultValue={m.amount} className={inputCls} /></Field>
                <button type="button" onClick={() => setMissions(missions.filter((x) => x.id !== m.id))} className="pb-2 text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
        <p className="text-sm font-bold text-slate-200">Entrega manual</p>
        <p className="mb-3 text-xs text-slate-500">Para o que fica fora das missões automáticas: evento presencial, compensação, premiação.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Jogador"><input placeholder="buscar jogador…" className={inputCls} /></Field>
          <Field label="Moeda"><select className={inputCls}><option>Pokébola</option><option>Ultra Bola</option></select></Field>
          <Field label="Quantidade"><input type="number" defaultValue={1} className={`${inputCls} w-24`} /></Field>
          <Field label="Motivo"><input placeholder="fica registrado no ledger" className={inputCls} /></Field>
          <button type="button" className="rounded-xl border border-cyan-300/50 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-200">Entregar (mock)</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── 5. pacotes LC ─────────────────────────── */

function PackEditor() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-slate-950/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-200">Pacotes vendidos por LigaCash</p>
        <button type="button" className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-slate-300"><Plus size={12} /> Novo pacote</button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {LC_PACKS.map((p) => (
          <div key={p.name} className="rounded-2xl border border-border bg-slate-900/60 p-4">
            <p className="text-sm font-bold text-slate-100">{p.name}</p>
            <p className="mt-1 text-xs text-slate-400">{p.amount} {p.currency}{p.bonus > 0 && <span className="text-emerald-300"> +{p.bonus} bônus</span>}</p>
            <p className="mt-3 text-lg font-bold text-cyan-200">{p.lc} LC</p>
            <div className="mt-3 flex gap-2 text-[10px] text-slate-500">
              <button type="button" className="rounded-lg border border-border px-2 py-1">Editar</button>
              <button type="button" className="rounded-lg border border-border px-2 py-1">Desativar</button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Pokébola e Ultra Bola só compram conteúdo de banner — não substituem ZC nem LC em nenhuma outra tela.</p>
    </div>
  );
}
