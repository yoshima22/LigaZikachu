"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

export const INVITE_IMAGE = "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/events/amigo-oculto/convite.webp";
const COLORS = ["#fbbf24", "#e11d48", "#a855f7", "#38bdf8", "#34d399", "#ffffff"];

const CSS = `
@keyframes ao-fade{from{opacity:0}to{opacity:1}}
@keyframes ao-pop{0%{opacity:0;transform:translateY(60px) scale(.55) rotate(-7deg)}55%{opacity:1;transform:translateY(-8px) scale(1.04) rotate(1.5deg)}100%{opacity:1;transform:none}}
@keyframes ao-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes ao-glow{0%,100%{box-shadow:0 0 25px 2px rgba(251,191,36,.45),0 20px 60px rgba(0,0,0,.6)}50%{box-shadow:0 0 55px 10px rgba(251,191,36,.8),0 20px 60px rgba(0,0,0,.6)}}
@keyframes ao-shine{0%{transform:translateX(-130%) skewX(-20deg)}60%,100%{transform:translateX(230%) skewX(-20deg)}}
@keyframes ao-burst{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--rot))}}
@keyframes ao-rise{0%{opacity:0;transform:translateY(20px) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translateY(-120px) scale(1.2)}}
@keyframes ao-snow{from{transform:translateY(-10vh)}to{transform:translateY(110vh)}}
.ao-back{animation:ao-fade .35s ease-out both}
.ao-card{animation:ao-pop .8s cubic-bezier(.2,.9,.3,1.2) both,ao-glow 2.4s ease-in-out .8s infinite}
.ao-card img{transition:transform .35s ease}
.ao-card:hover img{transform:scale(1.025)}
.ao-shine{animation:ao-shine 3.2s ease-in-out 1.2s infinite}
@media (prefers-reduced-motion:reduce){.ao-card,.ao-shine,.ao-back{animation:none!important}}
`;

// Convite do Amigo Oculto: aparece com efeito de entrada, confete e brilho; clicar na imagem leva à página.
export function InviteModal({ onClose, href = "/amigo-oculto" }: { onClose: () => void; href?: string }) {
  const router = useRouter();
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2 + Math.random() * 0.4, d = 140 + Math.random() * 260;
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 60, rot: (Math.random() - 0.5) * 720, c: COLORS[i % COLORS.length], delay: Math.random() * 0.25, w: 6 + Math.random() * 6 };
  }), []);
  const flakes = useMemo(() => Array.from({ length: 22 }, () => ({ left: Math.random() * 100, size: 8 + Math.random() * 10, dur: 6 + Math.random() * 6, delay: -Math.random() * 8, op: 0.4 + Math.random() * 0.5 })), []);
  const sparks = useMemo(() => ["✨", "🎁", "⭐", "❄️", "🎄", "✨"].map((s, i) => ({ s, left: 8 + i * 16, delay: i * 0.5 })), []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="ao-back fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" onClick={onClose} role="dialog" aria-label="Convite do Amigo Oculto">
      <style>{CSS}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {flakes.map((f, i) => <span key={i} className="absolute top-0 rounded-full bg-white" style={{ left: `${f.left}%`, width: f.size, height: f.size, opacity: f.op, animation: `ao-snow ${f.dur}s linear ${f.delay}s infinite` }} />)}
      </div>
      <div className="ao-wrap relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
          {bits.map((b, i) => <span key={i} className="absolute rounded-sm" style={{ width: b.w, height: b.w * 0.5, background: b.c, ["--dx" as string]: `${b.dx}px`, ["--dy" as string]: `${b.dy}px`, ["--rot" as string]: `${b.rot}deg`, animation: `ao-burst 1.6s ease-out ${0.35 + b.delay}s both` }} />)}
        </div>
        <div className="pointer-events-none absolute inset-x-0 -top-2 h-full" aria-hidden>
          {sparks.map((s, i) => <span key={i} className="absolute bottom-2 text-2xl" style={{ left: `${s.left}%`, animation: `ao-rise 3.5s ease-out ${1 + s.delay}s infinite` }}>{s.s}</span>)}
        </div>
        <button type="button" onClick={() => { onClose(); router.push(href); }} className="ao-card relative block w-full overflow-hidden rounded-2xl border-2 border-amber-300/70 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300" aria-label="Participar do Amigo Oculto da Liga">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={INVITE_IMAGE} alt="Convite: Amigo Oculto da Liga Zikachu — Participar Agora" className="block h-auto w-full" />
          <span className="ao-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden />
        </button>
        <button type="button" onClick={onClose} className="absolute -right-1 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-900 shadow-lg hover:bg-amber-300 sm:-right-3" aria-label="Fechar convite">✕</button>
        <p className="mt-3 text-center text-xs text-white/80">Toque no convite para participar · Esc para fechar</p>
      </div>
    </div>
  );
}
