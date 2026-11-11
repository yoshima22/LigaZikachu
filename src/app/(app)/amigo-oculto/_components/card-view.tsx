"use client";

import { useEffect, useState } from "react";
import { BACKGROUNDS, CLOSINGS, GREETINGS, IMAGES, LINES, textOf, type CardData } from "@/lib/amigo-oculto/cards";

const FLAKES = Array.from({ length: 22 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 0.45) % 6, dur: 6 + ((i * 7) % 5), size: 6 + ((i * 5) % 9) }));

export const CARD_CSS = `
@keyframes ss-fall{0%{transform:translateY(-10%);opacity:0}10%{opacity:.9}100%{transform:translateY(115%);opacity:.2}}
@keyframes ss-rise{0%{transform:translateY(70px) scale(.92);opacity:0}100%{transform:none;opacity:1}}
@keyframes ss-pop{0%{transform:scale(0) rotate(-30deg)}70%{transform:scale(1.25) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
@keyframes ss-in{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:none}}
@keyframes ss-shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-3deg)}40%{transform:rotate(3deg)}60%{transform:rotate(-2deg)}80%{transform:rotate(2deg)}}
@keyframes ss-flap{0%{transform:rotateX(0)}100%{transform:rotateX(180deg)}}
@keyframes ss-glow{0%,100%{box-shadow:0 0 18px 2px rgba(243,185,31,.35)}50%{box-shadow:0 0 34px 8px rgba(243,185,31,.6)}}
@media (prefers-reduced-motion:reduce){.ss-anim,.ss-anim *{animation:none!important}}
`;

export function Snow({ color = "#fff" }: { color?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {FLAKES.map((f, i) => (
        <span key={i} className="ss-anim absolute rounded-full" style={{ left: `${f.left}%`, top: 0, width: f.size, height: f.size, background: color, opacity: 0, animation: `ss-fall ${f.dur}s linear ${f.delay}s infinite` }} />
      ))}
    </div>
  );
}

// `animate`: linhas aparecem em sequência (entrega). Sem animate, o cartão é estático (prévia do montador).
export function CardView({ card, animate = false }: { card: CardData; animate?: boolean }) {
  const bg = BACKGROUNDS.find((b) => b.key === card.background) ?? BACKGROUNDS[0];
  const step = (n: number) => (animate ? { opacity: 0, animation: `ss-in .8s ease ${0.5 + n * 0.9}s forwards` } : undefined);
  return (
    <div className="ss-anim relative mx-auto flex aspect-[4/5] w-full max-w-sm flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl p-7 text-center shadow-2xl" style={{ background: bg.css, color: bg.ink, border: `2px solid ${bg.accent}` }}>
      <Snow color={bg.ink} />
      <div aria-hidden className="absolute inset-2 rounded-xl" style={{ border: `1px dashed ${bg.accent}`, opacity: 0.6 }} />
      {(() => {
        const img = IMAGES.find((i) => i.key === card.image);
        return img ? (
          <div className="relative z-10 text-center drop-shadow" style={animate ? { animation: "ss-pop .8s ease .2s both" } : undefined}>
            {img.url ? <img src={img.url} alt={img.label} className="mx-auto h-28 w-28 object-contain" /> : <div className="text-6xl leading-none">{img.scene}</div>}
            <div className="mt-1 text-[11px] uppercase tracking-wider opacity-80">{img.label}</div>
          </div>
        ) : null;
      })()}
      <div className={card.image ? "absolute right-3 top-3 text-2xl" : "text-5xl drop-shadow"} style={animate ? { animation: "ss-pop .8s ease .2s both" } : undefined}>{card.sticker}</div>
      <h3 className="font-serif text-2xl font-bold leading-tight" style={{ color: bg.accent, ...step(0) }}>{textOf(GREETINGS, card.greeting)}</h3>
      <div className="space-y-2 text-[15px] leading-snug">
        {card.lines.map((k, i) => <p key={k} style={step(i + 1)}>{textOf(LINES, k)}</p>)}
      </div>
      <p className="mt-2 text-sm italic opacity-90" style={step(card.lines.length + 1)}>{textOf(CLOSINGS, card.closing)}</p>
    </div>
  );
}

// Envelope → abre → cartão sobe → onDone (mostra o presente). Clique em qualquer lugar do envelope.
export function EnvelopeReveal({ card, onOpen, children }: { card: CardData; onOpen?: () => void; children?: React.ReactNode }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    if (stage !== 1) return;
    const t = setTimeout(() => setStage(2), 1400);
    return () => clearTimeout(t);
  }, [stage]);
  return (
    <div className="relative overflow-hidden rounded-3xl p-6" style={{ background: "radial-gradient(ellipse at top,#1b2f5e,#0b1d3a 70%)" }}>
      <style>{CARD_CSS}</style>
      <Snow />
      {stage < 2 ? (
        <button type="button" onClick={() => { if (stage === 0) { setStage(1); onOpen?.(); } }} className="ss-anim relative mx-auto my-8 block h-48 w-72 max-w-full cursor-pointer" style={stage === 0 ? { animation: "ss-shake 2.2s ease-in-out infinite" } : undefined} aria-label="Abrir o cartão">
          <div className="absolute inset-0 rounded-lg" style={{ background: "linear-gradient(135deg,#d62839,#a31d2b)", boxShadow: "0 12px 40px rgba(0,0,0,.5)", ...(stage === 0 ? { animation: "ss-glow 2.4s ease-in-out infinite" } : {}) }} />
          <div className="absolute inset-x-0 top-0 h-24 origin-top rounded-t-lg" style={{ background: "linear-gradient(180deg,#e8394a,#c22a3a)", clipPath: "polygon(0 0,100% 0,50% 100%)", ...(stage === 1 ? { animation: "ss-flap .9s ease forwards" } : {}) }} />
          <div className="absolute left-1/2 top-[88px] -translate-x-1/2 -translate-y-1/2 text-3xl" style={{ opacity: stage === 1 ? 0 : 1, transition: "opacity .3s" }}>⭐</div>
          <span className="absolute -bottom-7 left-0 right-0 text-center text-sm text-white/80">{stage === 0 ? "Toque para abrir" : "Abrindo…"}</span>
        </button>
      ) : (
        <div className="ss-anim relative py-2" style={{ animation: "ss-rise .9s ease both" }}>
          <CardView card={card} animate />
          <div className="mt-5" style={{ opacity: 0, animation: `ss-in .8s ease ${1.2 + (card.lines.length + 2) * 0.9}s forwards` }}>{children}</div>
        </div>
      )}
    </div>
  );
}
