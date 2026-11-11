"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BACKGROUNDS, CLOSINGS, GREETINGS, LINES, STICKERS, type CardData } from "@/lib/amigo-oculto/cards";
import { GIFT_CATALOG } from "@/lib/amigo-oculto/catalog";
import { addBotsAction, checkinAction, createEditionAction, deliverAction, drawAction, openCardAction, registerMeAction, resetEditionAction, saveBuildAction } from "../actions";
import { CARD_CSS, CardView, EnvelopeReveal } from "./card-view";

type P = { id: string; name: string; isBot: boolean; recipient: string | null; checkins: number; checkedToday: boolean; giftKey: string | null; built: boolean; opened: boolean };
type Ed = { id: string; name: string; phase: string; isTest: boolean; startsOn: string; deliverAt: string; seedHash: string | null; seed: string | null; totalDays: number; elapsedDays: number; goal: number; bonds: number; level: number; participants: P[] };
type View = { editions: { id: string; name: string; phase: string }[]; edition: Ed | null };

const PHASE: Record<string, string> = { REGISTRATION: "Inscrições", COLLECTING: "Juntando laços", DELIVERED: "Entregue", CANCELED: "Cancelada" };
const LEVELS = ["Sem nível", "Nível 1 · Comum", "Nível 2 · Incomum", "Nível 3 · Raro", "Nível 4 · Especial"];
const btn = "rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40";
const btnPrimary = "rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-40";

const EMPTY: CardData = { greeting: "g1", lines: ["l1"], closing: "c1", background: "noite", sticker: "🎄" };

export function AmigoClient({ view, myPlayerName }: { view: View; myPlayerName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const e = view.edition;

  // Executa uma action, mostra o erro (se houver) e recarrega os dados do servidor.
  const run = (fn: () => Promise<unknown>) => start(async () => {
    const r = (await fn()) as { error?: string } | undefined;
    setMsg(r?.error ?? null);
    router.refresh();
  });

  return (
    <div className="space-y-4 text-slate-100">
      <style>{CARD_CSS}</style>
      <header className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b1d3a] to-[#3a0f2a] p-5">
        <p className="text-xs uppercase tracking-widest text-amber-300">Admin · não visível aos jogadores</p>
        <h1 className="text-2xl font-bold">🎁 Amigo Oculto</h1>
        <p className="text-sm text-slate-300">Inscrição → sorteio → laços da comunidade → cartão + presente → entrega.</p>
      </header>
      {msg && <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{msg}</p>}

      <NewEdition run={run} pending={pending} editions={view.editions} />
      {e && <Edition e={e} run={run} pending={pending} myPlayerName={myPlayerName} />}
    </div>
  );
}

function NewEdition({ run, pending, editions }: { run: (f: () => Promise<unknown>) => void; pending: boolean; editions: View["editions"] }) {
  const router = useRouter();
  const [name, setName] = useState("Amigo Oculto de Natal");
  const [startsOn, setStartsOn] = useState("");
  const [deliverAt, setDeliverAt] = useState("");
  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <h2 className="font-semibold">Edições</h2>
      {editions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {editions.map((x) => <button key={x.id} className={btn} onClick={() => router.push(`/amigo-oculto?e=${x.id}`)}>{x.name} · {PHASE[x.phase]}</button>)}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <input className="rounded-lg bg-black/30 p-2 text-sm" value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Nome" />
        <label className="text-xs text-slate-300">Laços começam em<input type="date" className="mt-1 w-full rounded-lg bg-black/30 p-2 text-sm" value={startsOn} onChange={(ev) => setStartsOn(ev.target.value)} /></label>
        <label className="text-xs text-slate-300">Entrega em<input type="datetime-local" className="mt-1 w-full rounded-lg bg-black/30 p-2 text-sm" value={deliverAt} onChange={(ev) => setDeliverAt(ev.target.value)} /></label>
        <button className={btnPrimary} disabled={pending || !startsOn || !deliverAt} onClick={() => run(() => createEditionAction({ name, startsOn, deliverAt: new Date(deliverAt).toISOString() }))}>Criar edição (teste)</button>
      </div>
    </section>
  );
}

function Edition({ e, run, pending, myPlayerName }: { e: Ed; run: (f: () => Promise<unknown>) => void; pending: boolean; myPlayerName: string }) {
  const pct = Math.min(100, Math.round((e.bonds / e.goal) * 100));
  const [as, setAs] = useState<string>(e.participants[0]?.id ?? "");
  const me = e.participants.find((p) => p.id === as);
  return (
    <>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{e.name} <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-200">{PHASE[e.phase]}</span></h2>
          <div className="flex flex-wrap gap-2">
            {e.phase === "REGISTRATION" && <>
              <button className={btn} disabled={pending} onClick={() => run(() => registerMeAction(e.id))}>Inscrever {myPlayerName}</button>
              <button className={btn} disabled={pending} onClick={() => run(() => addBotsAction(e.id, 6))}>+6 testadores</button>
              <button className={btnPrimary} disabled={pending} onClick={() => run(() => drawAction(e.id))}>Sortear</button>
            </>}
            {e.phase === "COLLECTING" && <button className={btnPrimary} disabled={pending} onClick={() => confirm("Entregar agora? Fecha a montagem.") && run(() => deliverAction(e.id))}>Entregar agora</button>}
            {e.isTest && <button className={btn} disabled={pending} onClick={() => confirm("Apagar esta edição de teste?") && run(() => resetEditionAction(e.id))}>Apagar teste</button>}
          </div>
        </div>
        <p className="text-xs text-slate-300">Laços de {e.startsOn} até {new Date(e.deliverAt).toLocaleString("pt-BR")} · {e.participants.length} inscritos · dia {e.elapsedDays}/{e.totalDays}</p>

        <div>
          <div className="mb-1 flex justify-between text-sm"><span>🤝 {e.bonds} laços de {e.goal}</span><span className="text-amber-300">{LEVELS[e.level]}</span></div>
          <div className="relative h-4 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-all" style={{ width: `${pct}%` }} />
            {[25, 50, 75].map((m) => <span key={m} className="absolute top-0 h-full w-px bg-white/40" style={{ left: `${m}%` }} />)}
          </div>
        </div>
        {e.seedHash && <p className="break-all text-[11px] text-slate-400">Compromisso do sorteio (sha256): {e.seedHash}{e.seed ? ` · seed: ${e.seed}` : ""}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-2 font-semibold">Participantes</h2>
        <div className="divide-y divide-white/10">
          {e.participants.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-32 font-medium">{p.name}{p.isBot && <span className="ml-1 text-xs text-slate-400">(teste)</span>}</span>
              <span className="text-slate-300">🤝 {p.checkins}</span>
              {p.recipient && <span className="text-slate-400">→ {p.recipient}</span>}
              <span className="ml-auto flex items-center gap-2">
                {p.built && <span className="text-emerald-300">montado</span>}
                {p.opened && <span className="text-sky-300">aberto</span>}
                {e.phase === "COLLECTING" && <button className={btn} disabled={pending || p.checkedToday} onClick={() => run(() => checkinAction(p.id))}>{p.checkedToday ? "✔ check-in" : "Check-in"}</button>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {e.phase !== "REGISTRATION" && e.participants.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Ver como</h2>
            <select className="rounded-lg bg-black/30 p-2 text-sm" value={as} onChange={(ev) => setAs(ev.target.value)}>
              {e.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {me && e.phase === "COLLECTING" && <Builder key={me.id} e={e} p={me} run={run} pending={pending} />}
          {me && e.phase === "DELIVERED" && <Delivery key={me.id} participantId={me.id} />}
        </section>
      )}
    </>
  );
}

function Builder({ e, p, run, pending }: { e: Ed; p: P; run: (f: () => Promise<unknown>) => void; pending: boolean }) {
  const [gift, setGift] = useState(p.giftKey ?? "");
  const [card, setCard] = useState<CardData>(EMPTY);
  const toggleLine = (k: string) => setCard((c) => ({ ...c, lines: c.lines.includes(k) ? c.lines.filter((x) => x !== k) : c.lines.length < 3 ? [...c.lines, k] : c.lines }));
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-amber-300 bg-amber-300/20 text-amber-100" : "border-white/15 bg-white/5 hover:bg-white/10"}`;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">Presente para <b>{p.recipient}</b> {p.built && <span className="text-emerald-300">(já montado — salvar de novo substitui)</span>}</p>
        <div>
          <h3 className="mb-1 text-sm font-semibold">1. Presente (sem custo — o nível vem dos laços{e.level === 0 ? "; ainda bloqueado, monte só o cartão por enquanto" : ""})</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {GIFT_CATALOG.map((g) => {
              const locked = g.tier > e.level;
              return (
                <button key={g.key} disabled={locked} onClick={() => setGift(g.key)} className={`rounded-xl border p-2 text-left text-sm ${gift === g.key ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5"} ${locked ? "opacity-40" : "hover:bg-white/10"}`}>
                  <span className="mr-1">{locked ? "🔒" : g.emoji}</span>{g.name} <span className="text-xs text-slate-400">· nível {g.tier}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">2. Saudação</h3>
          <div className="flex flex-wrap gap-1.5">{GREETINGS.map((g) => <button key={g.key} className={chip(card.greeting === g.key)} onClick={() => setCard({ ...card, greeting: g.key })}>{g.text}</button>)}</div>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">3. Frases (até 3) — {card.lines.length}/3</h3>
          <div className="flex flex-wrap gap-1.5">{LINES.map((l) => <button key={l.key} className={chip(card.lines.includes(l.key))} onClick={() => toggleLine(l.key)}>{l.text}</button>)}</div>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">4. Fecho</h3>
          <div className="flex flex-wrap gap-1.5">{CLOSINGS.map((c) => <button key={c.key} className={chip(card.closing === c.key)} onClick={() => setCard({ ...card, closing: c.key })}>{c.text}</button>)}</div>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">5. Fundo e adorno</h3>
          <div className="flex flex-wrap gap-2">{BACKGROUNDS.map((b) => <button key={b.key} title={b.label} onClick={() => setCard({ ...card, background: b.key })} className={`h-9 w-9 rounded-full border-2 ${card.background === b.key ? "border-amber-300" : "border-white/20"}`} style={{ background: b.css }} />)}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{STICKERS.map((s) => <button key={s} className={`${chip(card.sticker === s)} text-base`} onClick={() => setCard({ ...card, sticker: s })}>{s}</button>)}</div>
        </div>
        <button className={btnPrimary} disabled={pending || card.lines.length === 0} onClick={() => run(() => saveBuildAction(p.id, gift, card))}>Salvar presente e cartão</button>
        <p className="text-xs text-slate-400">Quem não montar até a entrega envia o presente padrão do nível com um cartão simples.</p>
      </div>
      <div><h3 className="mb-2 text-sm font-semibold">Prévia</h3><CardView card={card} /></div>
    </div>
  );
}

// Abre o cartão recebido: envelope animado → cartão → presente (vai para a Caixa de Presentes).
function Delivery({ participantId }: { participantId: string }) {
  const [res, setRes] = useState<{ card?: CardData; gift?: { name: string; emoji: string }; mimo?: boolean; delivered?: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  if (!res?.card) {
    return (
      <div className="space-y-2">
        <button className={btnPrimary} disabled={loading} onClick={async () => { setLoading(true); setRes((await openCardAction(participantId)) as typeof res); setLoading(false); }}>Receber o cartão deste participante</button>
        {res?.error && <p className="text-sm text-red-300">{res.error}</p>}
      </div>
    );
  }
  return (
    <EnvelopeReveal card={res.card}>
      <div className="rounded-xl border border-amber-300/50 bg-black/30 p-4 text-center">
        <div className="text-4xl">{res.gift?.emoji}</div>
        <p className="font-semibold">{res.gift?.name}{res.mimo ? " + mimo de constância" : ""}</p>
        <p className="text-sm text-slate-300">{res.delivered ? "O presente já está na sua Caixa de Presentes." : "(Testador: sem Caixa de Presentes.)"}</p>
      </div>
    </EnvelopeReveal>
  );
}
