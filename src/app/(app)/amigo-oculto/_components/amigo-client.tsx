"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BACKGROUNDS, CLOSINGS, GREETINGS, LINES, STICKERS, type CardData } from "@/lib/amigo-oculto/cards";
import type { ResolvedPackage } from "@/lib/amigo-oculto/catalog-db";
import { PackagePicker, ReceivedGift } from "./package-ui";
import { setPublishedAction, addBotsAction, checkinAction, createEditionAction, deliverAction, drawAction, openCardAction, registerMeAction, resetEditionAction, saveBuildAction } from "../actions";
import { CARD_CSS, CardView, EnvelopeReveal } from "./card-view";
import { CardEditor } from "./card-editor";
import { DebugPanel } from "./debug-panel";

type P = { days: string[]; id: string; name: string; isBot: boolean; recipient: string | null; checkins: number; checkedToday: boolean; options: string[]; giftKey: string | null; built: boolean; opened: boolean };
type Ed = { published: boolean; today: string; cfg: { levels: number[]; mimoMinPct: number }; id: string; name: string; phase: string; isTest: boolean; startsOn: string; deliverAt: string; seedHash: string | null; seed: string | null; totalDays: number; elapsedDays: number; goal: number; bonds: number; level: number; participants: P[] };
type View = { editions: { id: string; name: string; phase: string }[]; edition: Ed | null };

const PHASE: Record<string, string> = { REGISTRATION: "Inscrições", COLLECTING: "Juntando bengalas", DELIVERED: "Entregue", CANCELED: "Cancelada" };
const LEVELS = ["Nenhuma categoria", "Nem ligo pro Natal", "Natal é Legal", "Eu Amo o Natal", "Papa Coração"];
const btn = "rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40";
const btnPrimary = "rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-40";

const EMPTY: CardData = { greeting: "g1", lines: ["l1"], closing: "c1", background: "noite", sticker: "🎄" };

export function AmigoClient({ view, myPlayerName, packages }: { view: View; myPlayerName: string; packages: ResolvedPackage[] }) {
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
        <p className="text-sm text-slate-300">Inscrição → sorteio → bengalas de açúcar → kits + cartão → entrega.</p>
      </header>
      {msg && <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{msg}</p>}

      <NewEdition run={run} pending={pending} editions={view.editions} />
      {e && <Edition e={e} run={run} pending={pending} myPlayerName={myPlayerName} packages={packages} />}
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
          {editions.map((x) => <button key={x.id} className={btn} onClick={() => router.push(`/amigo-oculto/admin?e=${x.id}`)}>{x.name} · {PHASE[x.phase]}</button>)}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <input className="rounded-lg bg-black/30 p-2 text-sm" value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Nome" />
        <label className="text-xs text-slate-300">Bengalas começam em<input type="date" className="mt-1 w-full rounded-lg bg-black/30 p-2 text-sm" value={startsOn} onChange={(ev) => setStartsOn(ev.target.value)} /></label>
        <label className="text-xs text-slate-300">Entrega em<input type="datetime-local" className="mt-1 w-full rounded-lg bg-black/30 p-2 text-sm" value={deliverAt} onChange={(ev) => setDeliverAt(ev.target.value)} /></label>
        <button className={btnPrimary} disabled={pending || !startsOn || !deliverAt} onClick={() => run(() => createEditionAction({ name, startsOn, deliverAt: new Date(deliverAt).toISOString() }))}>Criar edição (teste)</button>
      </div>
    </section>
  );
}

function Edition({ e, run, pending, myPlayerName, packages }: { e: Ed; run: (f: () => Promise<unknown>) => void; pending: boolean; myPlayerName: string; packages: ResolvedPackage[] }) {
  const pct = Math.min(100, Math.round((e.bonds / e.goal) * 100));
  const [as, setAs] = useState<string>(e.participants[0]?.id ?? "");
  const [debug, setDebug] = useState(false);
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
            <button className={btn} disabled={pending} onClick={() => run(() => setPublishedAction(e.id, !e.published))}>{e.published ? "👁 Publicada — ocultar" : "🔒 Só admin — publicar"}</button>
            {e.isTest && <button className={btn} disabled={pending} onClick={() => confirm("Apagar esta edição de teste?") && run(() => resetEditionAction(e.id))}>Apagar teste</button>}
          </div>
        </div>
        <p className="text-xs text-slate-300">Bengalas de {e.startsOn} até {new Date(e.deliverAt).toLocaleString("pt-BR")} · {e.participants.length} inscritos · dia {e.elapsedDays}/{e.totalDays}</p>

        <div>
          <div className="mb-1 flex justify-between text-sm"><span>🍭 {e.bonds} bengalas de {e.goal}</span><span className="text-amber-300">{LEVELS[e.level]}</span></div>
          <div className="relative h-4 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-all" style={{ width: `${pct}%` }} />
            {e.cfg.levels.slice(0, 3).map((m) => <span key={m} className="absolute top-0 h-full w-px bg-white/40" style={{ left: `${Math.min(100, (m / e.goal) * 100)}%` }} />)}
          </div>
        </div>
        {e.seedHash && <p className="break-all text-[11px] text-slate-400">Compromisso do sorteio (sha256): {e.seedHash}{e.seed ? ` · seed: ${e.seed}` : ""}</p>}
      </section>

      <div><button className={btn} onClick={() => setDebug(!debug)}>{debug ? "Fechar menu de debug" : "🛠 Menu de debug"}</button></div>
      {debug && <DebugPanel e={e} run={run} pending={pending} packages={packages} />}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-2 font-semibold">Participantes</h2>
        <div className="divide-y divide-white/10">
          {e.participants.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-32 font-medium">{p.name}{p.isBot && <span className="ml-1 text-xs text-slate-400">(teste)</span>}</span>
              <span className="text-slate-300">🍭 {p.checkins}</span>
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
          {me && e.phase === "COLLECTING" && <Builder key={me.id} e={e} p={me} run={run} pending={pending} packages={packages} />}
          {me && e.phase === "DELIVERED" && <Delivery key={me.id} participantId={me.id} />}
        </section>
      )}
    </>
  );
}

function Builder({ e, p, run, pending, packages }: { e: Ed; p: P; run: (f: () => Promise<unknown>) => void; pending: boolean; packages: ResolvedPackage[] }) {
  const [opts, setOpts] = useState<string[]>(p.options);
  const [card, setCard] = useState<CardData>(EMPTY);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">Presente para <b>{p.recipient}</b> {p.built && <span className="text-emerald-300">(já montado — salvar de novo substitui)</span>}</p>
        <div>
          <h3 className="mb-1 text-sm font-semibold">1. Kits de presente (sem custo — a categoria vem das bengalas{e.level === 0 ? "; ainda bloqueado, monte só o cartão por enquanto" : ""})</h3>
          <PackagePicker packages={packages} level={e.level} levels={e.cfg.levels} selected={opts} onChange={setOpts} />
        </div>
        <CardEditor card={card} setCard={setCard} />
        <button className={btnPrimary} disabled={pending || card.lines.length === 0 || opts.length > 3} onClick={() => run(() => saveBuildAction(p.id, opts, card))}>Salvar presente e cartão</button>
        <p className="text-xs text-slate-400">Quem não montar até a entrega envia 3 kits padrão da categoria mais alta com um cartão simples.</p>
      </div>
      <div><h3 className="mb-2 text-sm font-semibold">Prévia</h3><CardView card={card} /></div>
    </div>
  );
}

// Abre o cartão recebido: envelope animado → cartão → presente (vai para a Caixa de Presentes).
function Delivery({ participantId }: { participantId: string }) {
  const [res, setRes] = useState<{ card?: CardData; pkg?: ResolvedPackage; mimo?: boolean; delivered?: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  if (!res?.card || !res.pkg) {
    return (
      <div className="space-y-2">
        <button className={btnPrimary} disabled={loading} onClick={async () => { setLoading(true); setRes((await openCardAction(participantId)) as typeof res); setLoading(false); }}>Receber o cartão deste participante</button>
        {res?.error && <p className="text-sm text-red-300">{res.error}</p>}
      </div>
    );
  }
  return (
    <EnvelopeReveal card={res.card}>
      <ReceivedGift pkg={res.pkg} mimo={Boolean(res.mimo)} delivered={Boolean(res.delivered)} />
    </EnvelopeReveal>
  );
}
