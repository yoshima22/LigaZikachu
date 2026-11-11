"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BACKGROUNDS, IMAGES, type CardData } from "@/lib/amigo-oculto/cards";
import type { ResolvedPackage } from "@/lib/amigo-oculto/catalog-db";
import { checkinSelfAction, leaveSelfAction, openMyCardAction, registerSelfAction, saveBuildSelfAction } from "../player-actions";
import { CARD_CSS, CardView, EnvelopeReveal, Snow } from "./card-view";
import { CardEditor } from "./card-editor";
import { PackageCard, PackagePicker, ReceivedGift } from "./package-ui";

type Person = { id: string; name: string; avatarUrl: string | null; checkins: number };
type View = {
  edition: { id: string; name: string; phase: string; startsOn: string; deliverAt: string; today: string; level: number; goal: number; bonds: number; totalDays: number; elapsedDays: number; minParticipants: number };
  participants: Person[];
  packages: ResolvedPackage[];
  me: { id: string; checkins: number; checkedToday: boolean; built: boolean; options: string[]; card: CardData | null; opened: boolean; recipient: { name: string; avatarUrl: string | null } | null } | null;
  gallery: { to: string; card: CardData; packageKey: string | null; packageName: string }[];
};

const LEVELS = ["Nenhum nível ainda", "Nível 1", "Nível 2", "Nível 3", "Nível 4"];
const btn = "rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40";
const btnPrimary = "rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-40";
const panel = "space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4";
const EMPTY: CardData = { greeting: "g1", lines: ["l1"], closing: "c1", background: "noite", sticker: "🎄" };

export function Avatar({ p, size = 40 }: { p: { name: string; avatarUrl: string | null }; size?: number }) {
  return p.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.avatarUrl} alt={p.name} width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-amber-300/60" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-amber-300/20 font-bold text-amber-200 ring-2 ring-amber-300/40" style={{ width: size, height: size, fontSize: size * 0.4 }}>{p.name.slice(0, 1).toUpperCase()}</span>
  );
}

function useCountdown(iso: string) {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const ms = new Date(iso).getTime() - Date.now();
      if (ms <= 0) return setLeft("");
      const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
      setLeft(`${d}d ${h}h ${m}min`);
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [iso]);
  return left;
}

export function PlayerClient({ view, isAdmin }: { view: View; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const { edition: e, me } = view;
  const left = useCountdown(e.deliverAt);
  const run = (fn: () => Promise<unknown>) => start(async () => {
    const r = (await fn()) as { error?: string } | undefined;
    setMsg(r?.error ?? null);
    router.refresh();
  });
  const when = new Date(e.deliverAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" });
  const pct = Math.min(100, Math.round((e.bonds / e.goal) * 100));

  return (
    <div className="space-y-4 text-slate-100">
      <style>{CARD_CSS}</style>
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b1d3a] via-[#2a1747] to-[#5a1a2a] p-5">
        <Snow />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-amber-300">Natal da Liga</p>
              <h1 className="text-2xl font-bold">🎁 {e.name}</h1>
            </div>
            {isAdmin && <Link href="/amigo-oculto/admin" className={btn}>🛠 Painel admin</Link>}
          </div>
          <p className="mt-2 text-sm text-slate-200">🎄 Entrega dos cartões e presentes: <b>{when} (Brasília)</b></p>
          {e.phase !== "DELIVERED" && left ? <p className="text-xs text-amber-200">Faltam {left}</p> : null}
        </div>
      </header>
      {msg && <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{msg}</p>}

      {/* Inscrição */}
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">📝 Inscrições ({view.participants.length})</h2>
          {e.phase === "REGISTRATION" && (me
            ? <button className={btn} disabled={pending} onClick={() => run(() => leaveSelfAction(e.id))}>Cancelar minha inscrição</button>
            : <button className={btnPrimary} disabled={pending} onClick={() => run(() => registerSelfAction(e.id))}>Quero participar!</button>)}
        </div>
        {e.phase === "REGISTRATION" && <p className="text-sm text-slate-300">{me ? "✔ Você está inscrito." : "Inscreva-se para entrar no sorteio."} Depois do sorteio você descobre quem tirou. São necessários pelo menos {e.minParticipants} inscritos.</p>}
        {e.phase !== "REGISTRATION" && !me && <p className="text-sm text-slate-300">As inscrições já foram encerradas. Você poderá ver os cartões da Liga depois da entrega.</p>}
        <div className="flex flex-wrap gap-2">
          {view.participants.map((p) => (
            <span key={p.id} className="flex items-center gap-2 rounded-full bg-black/25 py-1 pl-1 pr-3 text-sm"><Avatar p={p} size={28} />{p.name}</span>
          ))}
        </div>
      </section>

      {/* Quem eu tirei */}
      {me?.recipient && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 to-rose-400/10 p-5 text-center">
          <p className="text-xs uppercase tracking-widest text-amber-200">🤫 Você tirou</p>
          <div className="my-3 flex flex-col items-center gap-2">
            <Avatar p={me.recipient} size={84} />
            <p className="text-2xl font-bold">{me.recipient.name}</p>
          </div>
          <p className="text-xs text-slate-300">Guarde segredo! Você pode voltar aqui quando quiser para consultar.</p>
        </section>
      )}

      {/* Laços + check-in */}
      {me && e.phase === "COLLECTING" && (
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">🤝 Laços da comunidade</h2>
            <button className={btnPrimary} disabled={pending || me.checkedToday || e.today < e.startsOn} onClick={() => run(() => checkinSelfAction(e.id))}>{me.checkedToday ? "✔ Check-in de hoje feito" : e.today < e.startsOn ? "Começa em breve" : "Fazer check-in de hoje"}</button>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm"><span>{e.bonds} de {e.goal} laços</span><span className="text-amber-300">{LEVELS[e.level]}</span></div>
            <div className="relative h-4 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-all" style={{ width: `${pct}%` }} />
              {[25, 50, 75].map((m) => <span key={m} className="absolute top-0 h-full w-px bg-white/40" style={{ left: `${m}%` }} />)}
            </div>
          </div>
          <p className="text-xs text-slate-300">Cada check-in diário de cada inscrito vira 1 laço. Quanto mais laços, melhores os pacotes que dá para presentear. Seus check-ins: <b>{me.checkins}</b>.</p>
        </section>
      )}

      {/* Montagem */}
      {me && e.phase === "COLLECTING" && <Builder key={me.id} view={view} run={run} pending={pending} />}

      {/* Meu cartão */}
      {me && e.phase === "DELIVERED" && <MyCard editionId={e.id} />}

      {/* Cartões da Liga */}
      {e.phase === "DELIVERED" && view.gallery.length > 0 && <Gallery items={view.gallery} packages={view.packages} />}
    </div>
  );
}

function Builder({ view, run, pending }: { view: View; run: (f: () => Promise<unknown>) => void; pending: boolean }) {
  const { edition: e, me } = view;
  const [opts, setOpts] = useState<string[]>(me!.options);
  const [card, setCard] = useState<CardData>(me!.card ?? EMPTY);
  const canSave = card.lines.length > 0 && (opts.length === 0 || opts.length === 3);
  return (
    <section className={panel}>
      <h2 className="font-semibold">🎀 Monte seu presente e seu cartão{me!.built ? " ✔ (salvo — pode alterar)" : ""}</h2>
      {me!.recipient && <p className="text-sm text-slate-300">Para: <b>{me!.recipient.name}</b></p>}
      <h3 className="text-sm font-semibold">1. Pacotes de presente</h3>
      {e.level === 0
        ? <p className="rounded-lg border border-dashed border-white/20 p-3 text-sm text-slate-300">Os pacotes são liberados conforme a comunidade junta laços (check-in diário de todos). Enquanto isso, já dá para montar o cartão!</p>
        : <PackagePicker packages={view.packages} level={e.level} selected={opts} onChange={setOpts} />}
      <div className="grid gap-5 lg:grid-cols-2">
        <div><h3 className="mb-2 text-sm font-semibold">2. Cartão</h3><CardEditor card={card} setCard={setCard} /></div>
        <div className="lg:sticky lg:top-4 lg:self-start"><h3 className="mb-2 text-sm font-semibold">Prévia</h3><CardView card={card} /></div>
      </div>
      <button className={btnPrimary} disabled={pending || !canSave} onClick={() => run(() => saveBuildSelfAction(e.id, opts, card))}>Salvar presente e cartão</button>
      <p className="text-xs text-slate-400">Você pode editar até a entrega. Quem não montar envia 3 pacotes padrão do nível e um cartão simples.</p>
    </section>
  );
}

// Abre (ou revê) o cartão recebido; o presente cai na Caixa de Presentes na primeira abertura.
function MyCard({ editionId }: { editionId: string }) {
  const [res, setRes] = useState<{ card?: CardData; pkg?: ResolvedPackage; mimo?: boolean; delivered?: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <section className={panel}>
      <h2 className="font-semibold">💌 Seu cartão chegou!</h2>
      {!res?.card || !res.pkg ? (
        <div className="space-y-2">
          <button className={btnPrimary} disabled={loading} onClick={async () => { setLoading(true); setRes((await openMyCardAction(editionId)) as typeof res); setLoading(false); }}>Abrir meu cartão</button>
          {res?.error && <p className="text-sm text-red-300">{res.error}</p>}
        </div>
      ) : (
        <EnvelopeReveal card={res.card}><ReceivedGift pkg={res.pkg} mimo={Boolean(res.mimo)} delivered={Boolean(res.delivered)} /></EnvelopeReveal>
      )}
    </section>
  );
}

function Gallery({ items, packages }: { items: View["gallery"]; packages: ResolvedPackage[] }) {
  const [open, setOpen] = useState<View["gallery"][number] | null>(null);
  const pkg = open ? packages.find((p) => p.key === open.packageKey) : null;
  return (
    <section className={panel}>
      <h2 className="font-semibold">🖼️ Cartões da Liga</h2>
      <p className="text-xs text-slate-300">Todos os cartões e presentes sorteados. Quem enviou continua em segredo. 🤫</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((g, i) => {
          const bg = BACKGROUNDS.find((b) => b.key === g.card.background) ?? BACKGROUNDS[0];
          const img = IMAGES.find((x) => x.key === g.card.image);
          return (
            <button key={i} onClick={() => setOpen(g)} className="overflow-hidden rounded-xl border border-white/15 text-left transition hover:scale-[1.02]" style={{ background: bg.css, color: bg.ink }}>
              <div className="flex h-28 items-center justify-center p-2">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt={img.label} loading="lazy" className="h-full w-auto object-contain" />
                ) : <span className="text-5xl">{g.card.sticker}</span>}
              </div>
              <div className="bg-black/35 px-2.5 py-1.5 text-xs"><div className="font-semibold">Para: {g.to}</div><div className="opacity-80">{g.packageName}</div></div>
            </button>
          );
        })}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-sm space-y-3 py-6" onClick={(ev) => ev.stopPropagation()}>
            <p className="text-center text-sm text-white">Cartão para <b>{open.to}</b></p>
            <CardView card={open.card} />
            {pkg && <div className="space-y-1"><p className="text-center text-xs uppercase tracking-wider text-amber-200">🎲 Pacote sorteado</p><PackageCard pkg={pkg} /></div>}
            <button className={`${btn} w-full`} onClick={() => setOpen(null)}>Fechar</button>
          </div>
        </div>
      )}
    </section>
  );
}
