"use client";

import { useState } from "react";
import { BACKGROUNDS, CLOSINGS, GREETINGS, IMAGES, LINES, STICKERS, type CardData } from "@/lib/amigo-oculto/cards";

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-amber-300 bg-amber-300/20 text-amber-100" : "border-white/15 bg-white/5 hover:bg-white/10"}`;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// Cartinha aleatória (para o botão "Surpreenda-me").
export function randomCard(funnyOnly = true): CardData {
  const pool = LINES.filter((l) => !funnyOnly || l.funny);
  const lines = [...pool].sort(() => Math.random() - 0.5).slice(0, 2).map((l) => l.key);
  return { greeting: pick(GREETINGS).key, lines, closing: pick(CLOSINGS).key, background: pick(BACKGROUNDS).key, sticker: pick(STICKERS), image: pick(IMAGES).key };
}

export function CardEditor({ card, setCard }: { card: CardData; setCard: (c: CardData) => void }) {
  const [funnyOnly, setFunnyOnly] = useState(false);
  const toggleLine = (k: string) => setCard({ ...card, lines: card.lines.includes(k) ? card.lines.filter((x) => x !== k) : card.lines.length < 3 ? [...card.lines, k] : card.lines });
  const h = "mb-1 text-sm font-semibold";
  return (
    <div className="space-y-4">
      <div>
        <h3 className={h}>2. Ilustração</h3>
        <div className="flex flex-wrap gap-1.5">
          <button className={chip(!card.image)} onClick={() => setCard({ ...card, image: undefined })}>Sem imagem</button>
          {IMAGES.map((i) => <button key={i.key} className={chip(card.image === i.key)} onClick={() => setCard({ ...card, image: i.key })}>{i.scene} {i.label}</button>)}
        </div>
      </div>
      <div>
        <h3 className={h}>3. Saudação</h3>
        <div className="flex flex-wrap gap-1.5">{GREETINGS.map((g) => <button key={g.key} className={chip(card.greeting === g.key)} onClick={() => setCard({ ...card, greeting: g.key })}>{g.text}</button>)}</div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold">4. Frases (até 3) — {card.lines.length}/3</h3>
          <label className="flex items-center gap-1 text-xs text-slate-300"><input type="checkbox" checked={funnyOnly} onChange={(ev) => setFunnyOnly(ev.target.checked)} /> só as engraçadas 😂</label>
        </div>
        <div className="flex flex-wrap gap-1.5">{LINES.filter((l) => !funnyOnly || l.funny).map((l) => <button key={l.key} className={chip(card.lines.includes(l.key))} onClick={() => toggleLine(l.key)}>{l.funny ? "😂 " : ""}{l.text}</button>)}</div>
      </div>
      <div>
        <h3 className={h}>5. Fecho</h3>
        <div className="flex flex-wrap gap-1.5">{CLOSINGS.map((c) => <button key={c.key} className={chip(card.closing === c.key)} onClick={() => setCard({ ...card, closing: c.key })}>{c.text}</button>)}</div>
      </div>
      <div>
        <h3 className={h}>6. Fundo e adorno</h3>
        <div className="flex flex-wrap gap-2">{BACKGROUNDS.map((b) => <button key={b.key} title={b.label} onClick={() => setCard({ ...card, background: b.key })} className={`h-9 w-9 rounded-full border-2 ${card.background === b.key ? "border-amber-300" : "border-white/20"}`} style={{ background: b.css }} />)}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">{STICKERS.map((s) => <button key={s} className={`${chip(card.sticker === s)} text-base`} onClick={() => setCard({ ...card, sticker: s })}>{s}</button>)}</div>
      </div>
    </div>
  );
}
