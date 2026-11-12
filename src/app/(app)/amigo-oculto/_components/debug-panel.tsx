"use client";

import { useState } from "react";
import type { ResolvedPackage } from "@/lib/amigo-oculto/catalog-db";
import { PackageCard } from "./package-ui";
import { type CardData } from "@/lib/amigo-oculto/cards";
import { checkinAction, debugCheckinsAction, updateConfigAction } from "../actions";
import { CardEditor, randomCard } from "./card-editor";
import { CardView, EnvelopeReveal } from "./card-view";
import { InviteModal } from "./invite-modal";
import { KitDrawReveal } from "./kit-reveal";

type Cfg = { levels: number[]; mimoMinPct: number };
export type DebugEd = { id: string; phase: string; isTest: boolean; startsOn: string; deliverAt: string; today: string; level: number; goal: number; bonds: number; cfg: Cfg; participants: { id: string; name: string; days: string[]; checkins: number }[] };
type Run = (f: () => Promise<unknown>) => void;

const btn = "rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40";
const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm ${on ? "bg-amber-400 font-semibold text-slate-900" : "bg-white/10 hover:bg-white/20"}`;
const TABS = [["checkin", "📅 Check-in diário"], ["loja", "🛍️ Loja de presentes"], ["carta", "✉️ Cartinha"], ["anim", "🎬 Animação"], ["convite", "📣 Convite"], ["sorteio", "🎲 Sorteio do kit"], ["regras", "⚙️ Regras"]] as const;

export function DebugPanel({ e, run, pending, packages }: { e: DebugEd; run: Run; pending: boolean; packages: ResolvedPackage[] }) {
  const [t, setT] = useState<(typeof TABS)[number][0]>("checkin");
  const [card, setCard] = useState<CardData>({ greeting: "g3", lines: ["f1", "f4"], closing: "c1", background: "noite", sticker: "🎄", image: "noel-chamine" });
  return (
    <section className="space-y-4 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4">
      <div className="flex flex-wrap gap-2">{TABS.map(([k, l]) => <button key={k} className={tab(t === k)} onClick={() => setT(k)}>{l}</button>)}</div>
      {t === "checkin" && <CheckinDebug e={e} run={run} pending={pending} />}
      {t === "sorteio" && <DrawDebug packages={packages} />}
      {t === "convite" && <InviteDebug />}
      {t === "loja" && <ShopDebug realLevel={e.level} packages={packages} />}
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
      <p className="text-sm text-slate-300">🍭 {e.bonds} de {e.goal} bengalas · {e.phase === "COLLECTING" ? "clique numa célula para marcar o check-in daquele dia (só em edição de teste)" : "o check-in abre depois do sorteio"}.</p>
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

function ShopDebug({ realLevel, packages }: { realLevel: number; packages: ResolvedPackage[] }) {
  const [lv, setLv] = useState(realLevel);
  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-3 text-sm">Categoria simulada: <b>{lv}</b>
        <input type="range" min={0} max={4} value={lv} onChange={(ev) => setLv(Number(ev.target.value))} />
        <span className="text-xs text-slate-400">(categoria real da comunidade agora: {realLevel})</span>
      </label>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((p) => <PackageCard key={p.key} pkg={p} locked={p.tier > lv} />)}
      </div>
      <p className="text-xs text-slate-400">Presente do Papai Noel (constância): ovo de laboratório, proteína Zika ou pena de laboratório potente, sorteado. Itens e imagens vêm da loja.</p>
    </div>
  );
}

// Simula a abertura do presente: sorteia 1 entre 3 kits aleatórios e toca a animação.
function DrawDebug({ packages }: { packages: ResolvedPackage[] }) {
  const [run, setRun] = useState<{ id: number; cands: ResolvedPackage[]; win: string } | null>(null);
  const start = () => {
    const cands = [...packages].sort(() => Math.random() - 0.5).slice(0, 3);
    setRun({ id: Date.now(), cands, win: cands[Math.floor(Math.random() * cands.length)].key });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">Sorteia 1 entre 3 kits aleatórios e mostra a abertura do presente, como será na entrega.</p>
      <button className={btn} onClick={start}>{run ? "▶ Sortear de novo" : "▶ Sortear e abrir presente"}</button>
      {run && <KitDrawReveal key={run.id} candidates={run.cands} winnerKey={run.win} />}
    </div>
  );
}

// Pré-visualiza o convite (popup com efeito) que depois aparecerá para os jogadores. Hoje só aqui, para admin.
function InviteDebug() {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">Convite do Amigo Oculto com efeito de entrada. Clicar na imagem leva para <code>/amigo-oculto</code>. Ainda não aparece para os jogadores.</p>
      <button className={btn} onClick={() => setShow(true)}>▶ Mostrar convite</button>
      {show && <InviteModal onClose={() => setShow(false)} />}
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
            <p className="font-semibold">Kit sorteado + presente do Papai Noel</p>
            <p className="text-sm text-slate-300">O presente já está na sua Caixa de Presentes.</p>
          </div>
        </EnvelopeReveal>
      </div>
    </div>
  );
}

function RulesDebug({ e, run, pending }: { e: DebugEd; run: Run; pending: boolean }) {
  const [lv, setLv] = useState(e.cfg.levels);
  const [mimo, setMimo] = useState(Math.round(e.cfg.mimoMinPct * 100));
  const num = "w-20 rounded-lg bg-black/30 p-2 text-sm";
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">Categorias 1–4 abrem com (bengalas da comunidade):{lv.map((x, i) => <input key={i} className={num} type="number" value={x} onChange={(ev) => setLv(lv.map((y, j) => (j === i ? Number(ev.target.value) : y)))} />)}</div>
      <label className="flex items-center gap-2">Presente do Papai Noel a partir de<input className={num} type="number" value={mimo} onChange={(ev) => setMimo(Number(ev.target.value))} />% dos dias</label>
      <button className={btn} disabled={pending || e.phase === "DELIVERED"} onClick={() => run(() => updateConfigAction(e.id, { levels: lv, mimoMinPct: mimo / 100 }))}>Salvar regras</button>
      <p className="text-xs text-slate-400">Bengalas atuais: {e.bonds}. Mudar as regras recalcula as categorias na hora (valem até a entrega).</p>
    </div>
  );
}
