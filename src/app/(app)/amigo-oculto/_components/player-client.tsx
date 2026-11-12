"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BACKGROUNDS, IMAGES, isDarkBg, type CardData } from "@/lib/amigo-oculto/cards";
import type { ResolvedItem, ResolvedPackage } from "@/lib/amigo-oculto/catalog-db";
import { checkinSelfAction, leaveSelfAction, openMyCardAction, registerSelfAction, saveBuildSelfAction } from "../player-actions";
import { CARD_CSS, CardView, EnvelopeReveal, Snow } from "./card-view";
import { CardEditor } from "./card-editor";
import { PackageCard, PackagePicker, ReceivedGift } from "./package-ui";
import { CaneProgress, HowItWorks, MyDays, panel } from "./info-panels";
import { GuideModal } from "./guide-modal";
import { Cane } from "./candy-cane";

type Person = { id: string; name: string; avatarUrl: string | null; checkins: number };
type View = {
  edition: { id: string; name: string; phase: string; startsOn: string; deliverAt: string; today: string; level: number; levels: number[]; mimoMinPct: number; goal: number; bonds: number; totalDays: number; elapsedDays: number; minParticipants: number };
  participants: Person[];
  packages: ResolvedPackage[];
  me: { id: string; checkins: number; days: string[]; checkedToday: boolean; built: boolean; options: string[]; card: CardData | null; opened: boolean; recipient: { name: string; avatarUrl: string | null } | null } | null;
  gallery: { from: string; to: string; card: CardData; packageKey: string | null; packageName: string }[];
};

const PHASE_LABEL: Record<string, string> = { REGISTRATION: "Inscrições abertas", COLLECTING: "Juntando bengalas", DELIVERED: "Entregue" };
const btn = "rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40";
const btnPrimary = "rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-40";
const EMPTY: CardData = { greeting: "g1", lines: ["l1"], closing: "c1", background: "noite", sticker: "🎄" };
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

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

const Chip = ({ children }: { children: React.ReactNode }) => <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs">{children}</span>;

export function PlayerClient({ view, isAdmin }: { view: View; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { edition: e, me } = view;
  const delivered = e.phase === "DELIVERED";
  const [tab, setTab] = useState<"inicio" | "kits" | "cartao" | "galeria">("inicio");
  const [opts, setOpts] = useState<string[]>(me?.options ?? []);
  const [card, setCard] = useState<CardData>(me?.card ?? EMPTY);
  const [guide, setGuide] = useState(false);
  const left = useCountdown(e.deliverAt);
  const myName = view.participants.find((p) => p.id === me?.id)?.name;
  const checkinOpen = Boolean(me) && e.phase === "COLLECTING" && e.today >= e.startsOn;
  const run = (fn: () => Promise<unknown>, okText?: string) => start(async () => {
    const r = (await fn()) as { error?: string } | undefined;
    setMsg(r?.error ? { ok: false, text: r.error } : okText ? { ok: true, text: okText } : null);
    router.refresh();
  });
  const when = new Date(e.deliverAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" });
  const canSave = Boolean(me) && !delivered && card.lines.length > 0 && opts.length <= 3;
  const tabs = [
    ["inicio", "🏠 Início"], ["kits", "🎁 Kits"], ...(delivered ? [["galeria", "🖼️ Cartões da Liga"]] : [["cartao", "💌 Meu cartão"]]),
  ] as [typeof tab, string][];

  return (
    <div className="space-y-4 text-slate-100">
      <style>{CARD_CSS}</style>
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1d3a] via-[#2a1747] to-[#5a1a2a] p-5 sm:p-7">
        <Snow />
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-amber-300">Natal da Liga · Mercado</p>
              <h1 className="text-2xl font-extrabold sm:text-3xl">🎁 {e.name}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={() => setGuide(true)}>❓ Como funciona</button>
              {isAdmin && <Link href="/amigo-oculto/admin" className={btn}>🛠 Painel admin</Link>}
            </div>
          </div>
          <p className="text-sm text-slate-200">🎄 Entrega dos cartões e presentes: <b>{when} (Brasília)</b></p>
          <div className="flex flex-wrap gap-2">
            <Chip>📌 {PHASE_LABEL[e.phase] ?? e.phase}</Chip>
            <Chip>👥 {view.participants.length} inscritos</Chip>
            <Chip><Cane size={12} /> {e.bonds} bengalas</Chip>
            {!delivered && left ? <Chip>⏳ faltam {left}</Chip> : null}
          </div>
        </div>
      </header>

      <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-1.5">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === k ? "bg-amber-400 text-slate-900" : "text-slate-200 hover:bg-white/10"}`}>{label}</button>
        ))}
      </nav>

      {guide && <GuideModal onClose={() => setGuide(false)} info={{ startsOn: e.startsOn, deliverAt: e.deliverAt, levels: e.levels, totalDays: e.totalDays, mimoMinPct: e.mimoMinPct }} />}

      {checkinOpen && me && !me.checkedToday && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-300/15 p-3">
          <p className="text-sm text-amber-100">⏰ Você ainda não fez o <b>check-in de hoje</b>. Vale 1 bengala de açúcar para a Liga!</p>
          <button className={btnPrimary} disabled={pending} onClick={() => run(() => checkinSelfAction(e.id), "Check-in feito! +1 bengala para a comunidade.")}>Fazer check-in agora</button>
        </div>
      )}

      {msg && <p className={`rounded-lg border p-3 text-sm ${msg.ok ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-red-400/40 bg-red-500/10 text-red-200"}`}>{msg.text}</p>}

      {tab === "inicio" && (
        <>
          {/* Inscrição */}
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">📝 Inscrição</h2>
              {e.phase === "REGISTRATION" && !isAdmin && (me
                ? <button className={btn} disabled={pending} onClick={() => run(() => leaveSelfAction(e.id))}>Cancelar minha inscrição</button>
                : <button className={btnPrimary} disabled={pending} onClick={() => run(() => registerSelfAction(e.id))}>Quero participar!</button>)}
            </div>
            {e.phase === "REGISTRATION" && isAdmin && <p className="text-sm text-amber-200">Contas de administrador não participam do Amigo Oculto; você vê a página só para acompanhar.</p>}
            {e.phase === "REGISTRATION" && !isAdmin && <p className="text-sm text-slate-300">{me ? "✔ Você está inscrito." : "Inscreva-se para entrar no sorteio."} Inscrições até <b>{dm(e.startsOn)}</b>; nesse dia o sorteio é feito e você descobre quem tirou. Mínimo de {e.minParticipants} inscritos.</p>}
            {e.phase !== "REGISTRATION" && !me && <p className="text-sm text-slate-300">As inscrições já foram encerradas. Você poderá ver os cartões da Liga depois da entrega.</p>}
            <div className="flex flex-wrap gap-2">
              {view.participants.length === 0 && <p className="text-sm text-slate-400">Ninguém se inscreveu ainda. Seja o primeiro!</p>}
              {view.participants.map((p) => <span key={p.id} className="flex items-center gap-2 rounded-full bg-black/25 py-1 pl-1 pr-3 text-sm"><Avatar p={p} size={28} />{p.name}</span>)}
            </div>
          </section>

          {/* Quem eu tirei */}
          {me?.recipient && (
            <section className="relative overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 to-rose-400/10 p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-amber-200">🤫 Você tirou</p>
              <div className="my-3 flex flex-col items-center gap-2"><Avatar p={me.recipient} size={88} /><p className="text-2xl font-bold">{me.recipient.name}</p></div>
              <p className="text-xs text-slate-300">Guarde segredo! Você pode voltar aqui quando quiser para consultar.</p>
            </section>
          )}

          {/* Bengalas + check-in */}
          {!delivered && (
            <>
              {me && (
                <section className="space-y-3 rounded-2xl border-2 border-amber-300/50 bg-amber-300/5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">✅ Seu check-in diário</h2>
                      <p className="text-xs text-slate-300">É aqui que você faz o check-in: <b>1 clique por dia</b>, de {dm(e.startsOn)} em diante. Cada clique = 1 bengala para a Liga.</p>
                    </div>
                    <button className={`${btnPrimary} px-6 py-3 text-base`} disabled={pending || me.checkedToday || !checkinOpen} onClick={() => run(() => checkinSelfAction(e.id), "Check-in feito! +1 bengala para a comunidade.")}>{me.checkedToday ? "✔ Check-in de hoje feito" : !checkinOpen ? `Abre em ${dm(e.startsOn)}` : "Fazer check-in (+1 bengala)"}</button>
                  </div>
                  <MyDays startsOn={e.startsOn} deliverAt={e.deliverAt} today={e.today} days={me.days} />
                </section>
              )}
              <section className={panel}>
                <h2 className="text-lg font-bold"><Cane size={20} /> Bengalas juntas da comunidade</h2>
                <p className="text-sm text-slate-300">A Liga já juntou <b className="text-white">{e.bonds}</b> bengalas, somando o check-in de todos os {view.participants.length} inscritos.{me ? <> Você contribuiu com <b className="text-white">{me.checkins}</b>.</> : null}</p>
                <CaneProgress bonds={e.bonds} levels={e.levels} goal={e.goal} />
              </section>
            </>
          )}

          {delivered && me && <MyCard editionId={e.id} />}
          {!delivered && <HowItWorks startsOn={e.startsOn} deliverAt={e.deliverAt} minParticipants={e.minParticipants} />}
        </>
      )}

      {tab === "kits" && (
        <section className={panel}>
          <h2 className="text-lg font-bold">🎁 Kits de presente</h2>
          {!me && !delivered && <p className="text-sm text-slate-300">Veja o que cada categoria tem. Inscreva-se na aba Início para escolher os seus kits.</p>}
          {e.level === 0 && !delivered && <p className="rounded-lg border border-dashed border-white/20 p-3 text-sm text-slate-300">Ainda não dá para escolher: os kits são liberados conforme a comunidade junta bengalas de açúcar (check-in diário, a partir de {dm(e.startsOn)}).</p>}
          <PackagePicker packages={view.packages} level={e.level} levels={e.levels} selected={opts} onChange={setOpts} readOnly={!me || delivered} deliverLabel={`${dm(e.deliverAt.slice(0, 10))} à 00:00`} />
        </section>
      )}

      {tab === "cartao" && (
        <section className={panel}>
          <h2 className="text-lg font-bold">💌 Monte seu cartão de Natal</h2>
          <p className="text-sm text-slate-300">{me ? "Pode montar e salvar já; dá para mudar até a entrega." : "Teste à vontade para ver como fica. Inscreva-se na aba Início para poder salvar."}{me?.recipient ? <> Para: <b>{me.recipient.name}</b>.</> : null}</p>
          <div className="grid gap-5 lg:grid-cols-2">
            <CardEditor card={card} setCard={setCard} saved={Boolean(me?.built)} />
            <div className="lg:sticky lg:top-4 lg:self-start"><h3 className="mb-2 text-sm font-semibold">Prévia</h3><CardView card={card} from={myName} /></div>
          </div>
        </section>
      )}

      {tab === "galeria" && delivered && view.gallery.length > 0 && <Gallery items={view.gallery} packages={view.packages} />}
      {tab === "galeria" && delivered && view.gallery.length === 0 && <section className={panel}><p className="text-sm text-slate-300">Nenhum cartão para mostrar.</p></section>}

      {me && !delivered && (tab === "kits" || tab === "cartao") && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/40 bg-[#1b1233]/95 p-3 shadow-xl backdrop-blur">
          <p className="text-xs text-slate-200">🎁 {opts.length ? `${opts.length} kit(s) escolhido(s) — 1 será sorteado` : "Nenhum kit escolhido"} · 💌 cartão com {card.lines.length} frase(s){me.built ? " · ✔ já salvo" : ""}</p>
          <button className={btnPrimary} disabled={pending || !canSave} onClick={() => run(() => saveBuildSelfAction(e.id, opts, card), "Salvo! Você pode alterar até a entrega.")}>Salvar kits e cartão</button>
        </div>
      )}
    </div>
  );
}

// Abre (ou revê) o cartão recebido; o presente cai na Caixa de Presentes na primeira abertura.
function MyCard({ editionId }: { editionId: string }) {
  const [res, setRes] = useState<{ card?: CardData; from?: string; pkg?: ResolvedPackage; mimo?: ResolvedItem | null; delivered?: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <section className={panel}>
      <h2 className="text-lg font-bold">💌 Seu cartão chegou!</h2>
      {!res?.card || !res.pkg ? (
        <div className="space-y-2">
          <button className={btnPrimary} disabled={loading} onClick={async () => { setLoading(true); setRes((await openMyCardAction(editionId)) as typeof res); setLoading(false); }}>Abrir meu cartão</button>
          {res?.error && <p className="text-sm text-red-300">{res.error}</p>}
        </div>
      ) : (
        <EnvelopeReveal card={res.card} from={res.from}><ReceivedGift pkg={res.pkg} mimo={res.mimo ?? null} delivered={Boolean(res.delivered)} /></EnvelopeReveal>
      )}
    </section>
  );
}

function Gallery({ items, packages }: { items: View["gallery"]; packages: ResolvedPackage[] }) {
  const [open, setOpen] = useState<View["gallery"][number] | null>(null);
  const pkg = open ? packages.find((p) => p.key === open.packageKey) : null;
  return (
    <section className={panel}>
      <h2 className="text-lg font-bold">🖼️ Cartões da Liga</h2>
      <p className="text-xs text-slate-300">Todos os cartões e presentes sorteados, com a assinatura de quem enviou. Clique para ler. 💌</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((g, i) => {
          const bg = BACKGROUNDS.find((b) => b.key === g.card.background) ?? BACKGROUNDS[0];
          const img = IMAGES.find((x) => x.key === g.card.image);
          return (
            <button key={i} onClick={() => setOpen(g)} className="overflow-hidden rounded-xl border border-white/15 text-left transition hover:scale-[1.02]" style={{ background: bg.css, color: bg.ink }}>
              <div className="flex h-28 items-center justify-center p-2">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.lightUrl && isDarkBg(bg.ink) ? img.lightUrl : img.url} alt={img.label} loading="lazy" className="h-full w-auto object-contain" />
                ) : <span className="text-5xl">{g.card.sticker}</span>}
              </div>
              <div className="bg-black/35 px-2.5 py-1.5 text-xs"><div className="font-semibold">De {g.from} → {g.to}</div><div className="opacity-80">{g.packageName}</div></div>
            </button>
          );
        })}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-sm space-y-3 py-6" onClick={(ev) => ev.stopPropagation()}>
            <p className="text-center text-sm text-white">Cartão de <b>{open.from}</b> para <b>{open.to}</b></p>
            <CardView card={open.card} from={open.from} />
            {pkg && <div className="space-y-1"><p className="text-center text-xs uppercase tracking-wider text-amber-200">🎲 Kit sorteado</p><PackageCard pkg={pkg} /></div>}
            <button className={`${btn} w-full`} onClick={() => setOpen(null)}>Fechar</button>
          </div>
        </div>
      )}
    </section>
  );
}
