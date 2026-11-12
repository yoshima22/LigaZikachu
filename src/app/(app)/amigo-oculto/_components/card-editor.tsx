"use client";

import { useState } from "react";
import { BACKGROUNDS, CLOSINGS, GREETINGS, IMAGES, LINES, STICKERS, textOf, type CardData } from "@/lib/amigo-oculto/cards";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const MAX_MID = 3;

// Cartinha aleatória (botão "Surpreenda-me"): início + 2–3 do meio engraçadas + fim.
export function randomCard(funnyOnly = true): CardData {
  const pool = LINES.filter((l) => !funnyOnly || l.funny);
  const lines = [...pool].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2)).map((l) => l.key);
  return { greeting: pick(GREETINGS.slice(2)).key, lines, closing: pick(CLOSINGS).key, background: pick(BACKGROUNDS).key, sticker: pick(STICKERS), image: pick(IMAGES).key };
}

type Tab = "start" | "mid" | "end";
const TAB_LABEL: Record<Tab, string> = { start: "Início", mid: "Meio", end: "Fim" };

const box = "rounded-xl border border-white/10 bg-black/20 p-3";
const mini = "rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20 disabled:opacity-30";

// Os botões de subir/descer/remover só aparecem depois que a pessoa personaliza (ou se o cartão já foi salvo).
export function CardEditor({ card, setCard: setCardRaw, saved = false }: { card: CardData; setCard: (c: CardData) => void; saved?: boolean }) {
  const [touched, setTouched] = useState(false);
  const setCard = (c: CardData) => { setTouched(true); setCardRaw(c); };
  const custom = touched || saved;
  const [tab, setTab] = useState<Tab>("mid");
  const [q, setQ] = useState("");
  const total = 2 + card.lines.length;

  const move = (i: number, d: -1 | 1) => {
    const l = [...card.lines];
    const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    setCard({ ...card, lines: l });
  };
  const rm = (k: string) => setCard({ ...card, lines: card.lines.filter((x) => x !== k) });

  const list = (tab === "start" ? GREETINGS : tab === "end" ? CLOSINGS : LINES).filter((x) => x.text.toLowerCase().includes(q.toLowerCase()));
  const chosen = (k: string) => (tab === "start" ? card.greeting === k : tab === "end" ? card.closing === k : card.lines.includes(k));
  const full = tab === "mid" && card.lines.length >= MAX_MID;
  const choose = (k: string) => {
    if (tab === "start") setCard({ ...card, greeting: k });
    else if (tab === "end") setCard({ ...card, closing: k });
    else if (card.lines.includes(k)) rm(k);
    else if (card.lines.length < MAX_MID) setCard({ ...card, lines: [...card.lines, k] });
  };

  const Slot = ({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) => (
    <div className="flex gap-3">
      <div className="w-14 shrink-0 pt-1 text-right"><div className="text-xs font-bold uppercase tracking-wide text-amber-300">{label}</div><div className="text-[10px] text-slate-400">{hint}</div></div>
      <div className="min-w-0 flex-1 space-y-1.5 border-l border-amber-300/30 pl-3">{children}</div>
    </div>
  );
  const Line = ({ text, children }: { text: string; children?: React.ReactNode }) => (
    <div className="flex items-start gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm"><span className="flex-1 leading-snug">{text}</span>{children}</div>
  );

  return (
    <div className="space-y-4">
      <div className={box}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">✉️ Sua mensagem</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs ${total >= 5 ? "bg-amber-300/20 text-amber-200" : "bg-white/10 text-slate-300"}`}>{total}/5 frases</span>
        </div>
        <div className="space-y-3">
          <Slot label="Início" hint="1 frase"><Line text={textOf(GREETINGS, card.greeting)} /></Slot>
          <Slot label="Meio" hint={`até ${MAX_MID}`}>
            {card.lines.length === 0 && <p className="rounded-lg border border-dashed border-white/20 px-2.5 py-1.5 text-xs text-slate-400">Escolha de 1 a 3 frases na biblioteca abaixo.</p>}
            {card.lines.map((k, i) => (
              <Line key={k} text={textOf(LINES, k)}>
                {custom && <span className="flex shrink-0 gap-1">
                  <button className={mini} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
                  <button className={mini} disabled={i === card.lines.length - 1} onClick={() => move(i, 1)} aria-label="Descer">↓</button>
                  <button className={mini} onClick={() => rm(k)} aria-label="Remover">✕</button>
                </span>}
              </Line>
            ))}
          </Slot>
          <Slot label="Fim" hint="1 frase"><Line text={textOf(CLOSINGS, card.closing)} /></Slot>
        </div>
      </div>

      <div className={box}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-sm font-semibold">📚 Biblioteca de frases</h3>
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1 text-xs ${tab === t ? "bg-amber-400 font-semibold text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>{TAB_LABEL[t]}</button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Buscar frase…" className="min-w-0 flex-1 rounded-lg bg-black/30 px-2.5 py-1.5 text-sm" />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {list.length === 0 && <p className="py-3 text-center text-xs text-slate-400">Nenhuma frase encontrada.</p>}
          {list.map((x) => {
            const on = chosen(x.key);
            const blocked = !on && full;
            return (
              <button key={x.key} disabled={blocked} onClick={() => choose(x.key)} className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm ${on ? "border-amber-300 bg-amber-300/15" : "border-white/10 bg-white/5 hover:bg-white/10"} ${blocked ? "opacity-40" : ""}`}>
                <span className="flex-1 leading-snug">{"funny" in x && x.funny ? "😂 " : ""}{x.text}</span>
                <span className="shrink-0 text-xs text-amber-200">{on ? (tab === "mid" ? "✓ remover" : "✓ em uso") : tab === "mid" ? "+ adicionar" : "usar"}</span>
              </button>
            );
          })}
        </div>
        {full && <p className="mt-2 text-xs text-amber-200">Meio completo (3). Remova uma frase para trocar.</p>}
      </div>

      <div className={box}>
        <h3 className="mb-2 text-sm font-semibold">🖼️ Ilustração</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <button onClick={() => setCard({ ...card, image: undefined })} className={`flex aspect-square items-center justify-center rounded-lg border text-xs ${!card.image ? "border-amber-300 bg-amber-300/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>Sem imagem</button>
          {IMAGES.map((i) => (
            <button key={i.key} title={i.label} onClick={() => setCard({ ...card, image: i.key })} className={`overflow-hidden rounded-lg border bg-white/90 p-1 ${card.image === i.key ? "border-amber-300 ring-2 ring-amber-300" : "border-white/10 hover:border-white/40"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt={i.label} loading="lazy" className="aspect-square w-full object-contain" />
            </button>
          ))}
        </div>
        {card.image && <p className="mt-1 text-xs text-slate-300">{IMAGES.find((i) => i.key === card.image)?.label}</p>}
      </div>

      <div className={box}>
        <h3 className="mb-2 text-sm font-semibold">🎨 Fundo e adorno</h3>
        <div className="flex flex-wrap gap-2">{BACKGROUNDS.map((b) => <button key={b.key} title={b.label} onClick={() => setCard({ ...card, background: b.key })} className={`h-9 w-9 rounded-full border-2 ${card.background === b.key ? "border-amber-300" : "border-white/20"}`} style={{ background: b.css }} />)}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">{STICKERS.map((s) => <button key={s} onClick={() => setCard({ ...card, sticker: s })} className={`rounded-full border px-2.5 py-0.5 text-base ${card.sticker === s ? "border-amber-300 bg-amber-300/20" : "border-white/15 bg-white/5 hover:bg-white/10"}`}>{s}</button>)}</div>
      </div>
    </div>
  );
}
