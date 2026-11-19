"use client";

import { useEffect, useState } from "react";
import { getMascotImageRendering, getPreferredSpriteUrl } from "@/lib/sprite-preferences";
import { fetchStanceCompleteNoticesAction, type StanceCompleteNotice } from "./stance-complete-actions";

const POLL_MS = 60_000;
const KEY = "stance-complete-seen";
const SPARKS = Array.from({ length: 18 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 6) * 0.35, dur: 2.4 + (i % 5) * 0.4, size: 4 + (i % 3) * 2 }));

function readSeen(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function markSeen(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify([...readSeen(), id].slice(-50))); } catch { /* sem storage: aparece de novo na próxima visita */ }
}

/** Animação de tela cheia quando uma jornada de postura é concluída (todas as missões feitas). */
export function StanceCompleteGate() {
  const [queue, setQueue] = useState<StanceCompleteNotice[]>([]);

  useEffect(() => {
    let lastAt = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - lastAt < POLL_MS - 1_000) return;
      lastAt = Date.now();
      const fresh = await fetchStanceCompleteNoticesAction().catch(() => []);
      const seen = new Set(readSeen());
      setQueue((prev) => {
        const known = new Set(prev.map((n) => n.id));
        const added = fresh.filter((n) => !seen.has(n.id) && !known.has(n.id));
        return added.length ? [...prev, ...added] : prev;
      });
    };
    check();
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);

  const n = queue[0];
  if (!n) return null;
  const close = () => { markSeen(n.id); setQueue((prev) => prev.slice(1)); };

  return <StanceCompleteCard n={n} onClose={close} more={queue.length - 1} />;
}

/** Cartão da animação; exportado para o preview do admin. */
export function StanceCompleteCard({ n, onClose, more = 0 }: { n: StanceCompleteNotice; onClose: () => void; more?: number }) {
  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center overflow-hidden bg-black/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <style>{`
        @keyframes scIn{0%{opacity:0;transform:scale(.7) translateY(20px)}60%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
        @keyframes scRise{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(-110vh);opacity:0}}
        @keyframes scSpin{to{transform:rotate(360deg)}}
        @keyframes scPulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.15);opacity:1}}
        @keyframes scFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes scShine{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @media (prefers-reduced-motion:reduce){.sc-anim{animation:none!important}}
      `}</style>
      {SPARKS.map((s, i) => (
        <span key={i} className="sc-anim pointer-events-none absolute bottom-0 rounded-full bg-amber-300" style={{ left: `${s.left}%`, width: s.size, height: s.size, boxShadow: "0 0 10px #fcd34d", animation: `scRise ${s.dur}s ${s.delay}s ease-in infinite` }} />
      ))}
      <div className="sc-anim relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/50 bg-gradient-to-b from-[#1b1330] via-[#14183a] to-[#0b1026] p-6 text-center shadow-[0_0_80px_rgba(251,191,36,0.3)]" style={{ animation: "scIn .7s cubic-bezier(.2,.9,.3,1.2)" }}>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Jornada de postura concluída</p>
        <h2 className="sc-anim mt-2 bg-clip-text font-pixel text-sm leading-relaxed text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#fde68a,#fff,#fde68a)", backgroundSize: "200% 100%", animation: "scShine 3s linear infinite" }}>
          Postura {n.stanceLabel} desbloqueada!
        </h2>
        <div className="relative mx-auto my-4 grid h-44 w-44 place-items-center">
          <div className="sc-anim absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg,transparent,rgba(251,191,36,.45),transparent 40%,rgba(167,139,250,.4),transparent 80%)", animation: "scSpin 6s linear infinite" }} />
          <div className="sc-anim absolute inset-3 rounded-full bg-[#10132c]" />
          <div className="sc-anim absolute inset-4 rounded-full" style={{ background: "radial-gradient(circle,rgba(251,191,36,.35),transparent 70%)", animation: "scPulse 2.2s ease-in-out infinite" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getPreferredSpriteUrl(n.pokemonId, null, {})} alt={n.mascotName} className="sc-anim relative h-32 w-32 object-contain drop-shadow-[0_0_14px_rgba(255,255,255,0.3)]" style={{ imageRendering: getMascotImageRendering(n.pokemonId), animation: "scFloat 3s ease-in-out infinite" }} />
        </div>
        <p className="font-semibold text-slate-100">{n.mascotName}</p>
        <p className="mt-1 text-sm text-slate-300">Todas as missões foram cumpridas. A postura já pode ser equipada.</p>
        {n.effect && <p className="mx-auto mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">{n.effect}</p>}
        <button onClick={onClose} className="mt-5 w-full rounded-xl bg-amber-300 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-amber-200">Incrível!</button>
        {more > 0 && <p className="mt-2 text-[10px] text-slate-500">+{more} conclusão(ões) a seguir</p>}
      </div>
    </div>
  );
}
