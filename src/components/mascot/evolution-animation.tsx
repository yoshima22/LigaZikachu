"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getPokemonName, getStaticSpriteUrl } from "@/lib/mascot-data";
import { getMascotImageRendering } from "@/lib/sprite-preferences";

type Phase = "intro" | "morph" | "flash" | "reveal";

const INTRO_MS = 2200;
const MORPH_MS = 4200;
const FLASH_MS = 900;

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  angle: (i / 28) * 360 + (i % 3) * 7,
  dist: 140 + ((i * 37) % 120),
  size: 4 + ((i * 13) % 8),
  delay: (i % 7) * 0.12,
}));

/** Janela cinematográfica de evolução: silhueta brilha, alterna entre as formas cada vez mais rápido, clarão e revelação. */
export function EvolutionAnimation({ fromId, toId, onClose }: { fromId: number; toId: number; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [showTo, setShowTo] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [mounted, setMounted] = useState(false);
  const fromName = getPokemonName(fromId);
  const toName = getPokemonName(toId);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setPhase("intro");
    setShowTo(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase("morph"), INTRO_MS));
    // Alternância acelerando: intervalo vai de 520ms até ~70ms.
    let t = INTRO_MS;
    let interval = 520;
    let toggle = false;
    while (t < INTRO_MS + MORPH_MS) {
      toggle = !toggle;
      const next = toggle;
      timers.push(setTimeout(() => setShowTo(next), t));
      t += interval;
      interval = Math.max(70, interval * 0.82);
    }
    timers.push(setTimeout(() => setPhase("flash"), INTRO_MS + MORPH_MS));
    timers.push(setTimeout(() => setPhase("reveal"), INTRO_MS + MORPH_MS + FLASH_MS));
    return () => timers.forEach(clearTimeout);
  }, [runKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const silhouette = phase === "morph" || phase === "flash";
  const current = phase === "reveal" ? toId : phase === "morph" && showTo ? toId : fromId;
  const imgStyle = {
    imageRendering: getMascotImageRendering(current),
    filter: silhouette ? "brightness(0) invert(1) drop-shadow(0 0 18px #fff)" : "drop-shadow(0 6px 10px rgba(0,0,0,.6))",
  } as const;

  const caption =
    phase === "intro" ? `O que? ${fromName} está evoluindo!`
    : phase === "reveal" ? `Parabéns! ${fromName} evoluiu para ${toName}!`
    : "";

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-label="Evolução" onClick={onClose}>
    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#FFCB05]/30 bg-[#05030f] shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <style>{`
        @keyframes evo-rays { to { transform: rotate(360deg); } }
        @keyframes evo-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        @keyframes evo-glow { 0%,100% { opacity:.35; transform: scale(.9);} 50% { opacity:.9; transform: scale(1.15);} }
        @keyframes evo-flash { 0% { opacity:0; } 40% { opacity:1; } 100% { opacity:1; } }
        @keyframes evo-fade { from { opacity:1; } to { opacity:0; } }
        @keyframes evo-pop { 0% { transform: scale(.4); opacity:0; } 60% { transform: scale(1.25); opacity:1; } 100% { transform: scale(1); } }
        @keyframes evo-burst { 0% { transform: translate(0,0) scale(1); opacity:1; } 100% { transform: translate(var(--dx),var(--dy)) scale(0); opacity:0; } }
        @keyframes evo-rise { from { transform: translateY(14px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes evo-converge { 0% { transform: translate(var(--dx),var(--dy)) scale(.2); opacity:0; } 60% { opacity:1; } 100% { transform: translate(0,0) scale(1); opacity:0; } }
      `}</style>

      <div className="relative flex h-72 items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#1e1b4b_0%,#05030f_70%)]" />
      <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="h-[700px] w-[700px] shrink-0 opacity-40"
        style={{
          background: "repeating-conic-gradient(from 0deg, rgba(125,211,252,.55) 0deg 6deg, transparent 6deg 20deg)",
          maskImage: "radial-gradient(circle, #000 0%, transparent 60%)",
          WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 60%)",
          animation: `evo-rays 90s linear infinite`,
        }}
      />
      </div>

      {/* palco */}
      <div className="relative flex h-64 w-64 items-center justify-center">
        {(phase === "morph" || phase === "flash") && (
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.9)_0%,rgba(125,211,252,.4)_45%,transparent_70%)]"
            style={{ animation: "evo-glow 0.7s ease-in-out infinite" }} />
        )}
        {phase === "reveal" && (
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,203,5,.55)_0%,transparent_65%)]" style={{ animation: "evo-glow 2.4s ease-in-out infinite" }} />
        )}

        {/* partículas convergindo (morph) ou explodindo (reveal) */}
        {(phase === "morph" || phase === "reveal") && PARTICLES.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const dx = Math.cos(rad) * p.dist;
          const dy = Math.sin(rad) * p.dist;
          const converge = phase === "morph";
          return (
            <span key={`${phase}-${i}`} className="absolute left-1/2 top-1/2 rounded-full bg-white shadow-[0_0_10px_#7dd3fc]"
              style={{
                width: p.size, height: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2,
                ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`,
                animation: converge
                  ? `evo-converge 1.4s ease-in ${p.delay}s infinite`
                  : `evo-burst 1.6s ease-out ${p.delay / 3}s forwards`,
              }} />
          );
        })}

        <img
          key={current}
          src={getStaticSpriteUrl(current)}
          alt={current === toId ? toName : fromName}
          className="relative h-44 w-44 object-contain"
          style={{
            ...imgStyle,
            animation: phase === "reveal" ? "evo-pop .8s ease-out" : silhouette ? "evo-pulse .5s ease-in-out infinite" : "evo-pulse 2.4s ease-in-out infinite",
          }}
        />
      </div>

      </div>

      <p key={phase} className="relative mt-4 min-h-[3rem] px-6 text-center font-pixel text-sm leading-relaxed text-[#FFCB05]"
        style={{ animation: "evo-rise .6s ease-out" }}>
        {caption}
      </p>

      {phase === "reveal" && (
        <div className="relative mb-5 mt-3 flex justify-center gap-2" style={{ animation: "evo-rise .6s ease-out .4s both" }}>
          <button type="button" onClick={() => setRunKey((k) => k + 1)}
            className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10">
            ↻ Rever
          </button>
          <button type="button" onClick={onClose}
            className="rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700]">
            Fechar
          </button>
        </div>
      )}

      {/* clarão branco entre a transformação e a revelação */}
      {phase === "flash" && <div className="absolute inset-0 bg-white" style={{ animation: `evo-flash ${FLASH_MS}ms ease-in forwards` }} />}
      {phase === "reveal" && <div className="pointer-events-none absolute inset-0 bg-white" style={{ animation: "evo-fade 1.1s ease-out forwards" }} />}

      <button type="button" onClick={onClose} aria-label="Pular"
        className="absolute right-4 top-4 rounded-lg border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10">
        {phase === "reveal" ? "Fechar ✕" : "Pular ✕"}
      </button>
    </div>
    </div>,
    document.body,
  );
}
