"use client";

import { useState } from "react";
import { GIFT_CATALOG, MIMO_PAYLOAD } from "@/lib/amigo-oculto/catalog";
import { type CardData } from "@/lib/amigo-oculto/cards";
import { checkinAction, debugCheckinsAction, updateConfigAction } from "../actions";
import { CardEditor, randomCard } from "./card-editor";
import { CardView, EnvelopeReveal } from "./card-view";

type Cfg = { goalPct: number; levels: number[]; mimoMinPct: number };
export type DebugEd = { id: string; phase: string; isTest: boolean; startsOn: string; deliverAt: string; today: string; level: number; goal: number; bonds: number; cfg: Cfg; participants: { id: string; name: string; days: string[]; checkins: number }[] };
type Run = (f: () => Promise<unknown>) => void;

const btn = "rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40";
const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm ${on ? "bg-amber-400 font-semibold text-slate-900" : "bg-white/10 hover:bg-white/20"}`;
const TABS = [["checkin", "📅 Check-in diário"], ["loja", "🛍️ Loja de presentes"], ["carta", "✉️ Cartinha"], ["anim", "🎬 Animação"], ["regras", "⚙️ Regras"]] as const;

const fmtPayload = (p: (typeof GIFT_CATALOG)[number]["payload"]) =>
  [p.coins && `${p.coins} moedas`, p.food && `${p.food} comida`, p.sweet && `${p.sweet} doces`, ...(p.eggs ?? []).map((x) => `${x.quantity ?? 1}× ovo ${x.type}`), ...(p.shopItems ?? []).map((x) => `${x.quantity ?? 1}× ${x.type}`)].filter(Boolean).join(" · ");

export function DebugPanel({ e, run, pending }: { e: DebugEd; run: Run; pending: boolean }) {
  const [t, setT] = useState<(typeof TABS)[number][0]>("checkin");
  const [card, setCard] = useState<CardData>({ greeting: "g3", lines: ["f1", "f4"], closing: "c1", background: "noite", sticker: "🎄", image: "noel-chamine" });
  return (
    <section className="space-y-4 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4">
      <div className="flex flex-wrap gap-2">{TABS.map(([k, l]) => <button key={k} className={tab(t === k)} onClick={() => setT(k)}>{l}</button>)}</div>
      {t === "checkin" && <CheckinDebug e={e} run={run} pending={pending} />}
      {t === "loja" && <ShopDebug realLevel={e.level} />}
      {t === "carta" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <button className={btn} onClick={() => setCard(randomCard())}>🎲 Surpreenda-me (cartinha engraçada)</button>
            <CardEditor card={card} setCard={setCard} />
          </div>
          <CardView card={card} />
        </div>
      )}
      {t === "anim" && <AnimDebug card={card} />}
      {t === "regras" && <RulesDebug e={e} run={run} pending={pending} />}
    </section>
  );
}

function CheckinDebug({ e, run, pending }: { e: DebugEd; run: Run; pending: boolean }) {
  const days: string[] = [];
  const last = new Date(e.deliverAt).getTime() - 3 * 3_600_000;
  for (let t = Date.parse(`${e.startsOn}T00:00:00Z`); t <= last && days.length < 45; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  const live = e.phase === "COLLECTING" && e.isTest;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">🤝 {e.bonds} de {e.goal} laços · {e.phase === "COLLECTING" ? "clique numa célula para marcar o check-in daquele dia (só em edição de teste)" : "o check-in abre depois do sorteio"}.</p>
      {live && (
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={pending} onClick={() => run(() => debugCheckinsAction(e.id, "random", 0.7))}>Sortear 70% dos dias</button>
          <button className={btn} disabled={pending} onClick={() => run(() => debugCheckinsAction(e.id, "fill"))}>Todos fizeram todos os dias</button>
          <button className={btn} disabled={pending} onClick={() => run(() => debugCheckinsAction(e.id, "clear"))}>Zerar</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-xs">
          <thead><tr><th className="text-left">Jogador</th>{days.map((d) => <th key={d} className={`px-1 font-normal ${d === e.today ? "text-amber-300" : "text-slate-400"}`}>{d.slice(8)}/{d.slice(5, 7)}</th>)}<th>🤝</th></tr></thead>
          <tbody>
            {e.participants.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap pr-2">{p.name}</td>
                {days.map((d) => {
                  const on = p.days.includes(d);
                  return <td key={d}><button disabled={!live || pending || on} onClick={() => run(() => checkinAction(p.id, d))} className={`h-6 w-6 rounded ${on ? "bg-emerald-400/80" : "bg-white/10 hover:bg-white/25"} ${d === e.today ? "ring-1 ring-amber-300" : ""}`}>{on ? "✔" : ""}</button></td>;
                })}
                <td className="pl-1 font-semibold">{p.checkins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShopDebug({ realLevel }: { realLevel: number }) {
  const [lv, setLv] = useState(realLevel);
  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-3 text-sm">Nível simulado: <b>{lv}</b>
        <input type="range" min={0} max={4} value={lv} onChange={(ev) => setLv(Number(ev.target.value))} />
        <span className="text-xs text-slate-400">(nível real da comunidade agora: {realLevel})</span>
      </label>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {GIFT_CATALOG.map((g) => {
          const locked = g.tier > lv;
          return (
            <div key={g.key} className={`rounded-xl border p-3 text-sm ${locked ? "border-white/10 bg-white/5 opacity-50" : "border-amber-300/40 bg-amber-300/10"}`}>
              <div className="text-2xl">{locked ? "🔒" : g.emoji}</div>
              <div className="font-semibold">{g.name}</div>
              <div className="text-xs text-slate-300">Nível {g.tier}</div>
              <div className="mt-1 text-xs text-slate-400">{fmtPayload(g.payload)}</div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">Mimo de constância: {fmtPayload(MIMO_PAYLOAD)}.</p>
    </div>
  );
}

function AnimDebug({ card }: { card: CardData }) {
  const [n, setN] = useState(0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">Reproduz a abertura com a cartinha montada na aba “Cartinha”.</p>
      <button className={btn} onClick={() => setN(n + 1)}>▶ Reproduzir de novo</button>
      <div className="mx-auto max-w-md">
        <EnvelopeReveal key={n} card={card}>
          <div className="rounded-xl border border-amber-300/50 bg-black/30 p-4 text-center">
            <div className="text-4xl">🧺</div>
            <p className="font-semibold">Cesta de guloseimas + mimo de constância</p>
            <p className="text-sm text-slate-300">O presente já está na sua Caixa de Presentes.</p>
          </div>
        </EnvelopeReveal>
      </div>
    </div>
  );
}

function RulesDebug({ e, run, pending }: { e: DebugEd; run: Run; pending: boolean }) {
  const [goal, setGoal] = useState(Math.round(e.cfg.goalPct * 100));
  const [lv, setLv] = useState(e.cfg.levels.map((x) => Math.round(x * 100)));
  const [mimo, setMimo] = useState(Math.round(e.cfg.mimoMinPct * 100));
  const num = "w-20 rounded-lg bg-black/30 p-2 text-sm";
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2">Meta = inscritos × dias ×<input className={num} type="number" value={goal} onChange={(ev) => setGoal(Number(ev.target.value))} />%</label>
      <div className="flex flex-wrap items-center gap-2">Níveis 1–4 abrem em (% da meta):{lv.map((x, i) => <input key={i} className={num} type="number" value={x} onChange={(ev) => setLv(lv.map((y, j) => (j === i ? Number(ev.target.value) : y)))} />)}</div>
      <label className="flex items-center gap-2">Mimo de constância a partir de<input className={num} type="number" value={mimo} onChange={(ev) => setMimo(Number(ev.target.value))} />% dos dias</label>
      <button className={btn} disabled={pending || e.phase === "DELIVERED"} onClick={() => run(() => updateConfigAction(e.id, { goalPct: goal / 100, levels: lv.map((x) => x / 100), mimoMinPct: mimo / 100 }))}>Salvar regras</button>
      <p className="text-xs text-slate-400">Meta atual: {e.goal} laços. Mudar as regras recalcula níveis e meta na hora (valem até a entrega).</p>
    </div>
  );
}
