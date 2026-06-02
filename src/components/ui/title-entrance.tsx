"use client";

/**
 * TitleEntrance — portal de tela inteira que exibe o efeito de entrada
 * de um título lendário/mítico/relíquia ao abrir o perfil do jogador.
 *
 * Renderiza em document.body via createPortal.
 * Auto-destrói após totalDuration ms, chamando onComplete.
 * Só dispara uma vez por montagem (ref hasPlayed).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TitleEntranceEffect =
  | "NONE" | "LIGHTNING_STRIKE" | "BOSS_ALERT" | "CHAMPION_ARENA"
  | "COIN_RAIN" | "DIMENSIONAL_RIFT" | "ULTRA_RARE_REVEAL"
  | "GLITCH_HACK" | "SLOT_MACHINE" | "ELEMENTAL_AURA" | "MIAUVADAO_SEAL";

export interface TitleEntranceProps {
  name: string;
  rarity: string;
  theme?: string;
  effect: TitleEntranceEffect | string;
  color: string;
  glowColor: string;
  onComplete: () => void;
}

// ── Durations (ms) ────────────────────────────────────────────────────────────
const DURATION: Record<string, number> = {
  LIGHTNING_STRIKE:  1600,
  BOSS_ALERT:        2200,
  CHAMPION_ARENA:    2200,
  COIN_RAIN:         2000,
  DIMENSIONAL_RIFT:  2200,
  ULTRA_RARE_REVEAL: 2200,
  GLITCH_HACK:       1800,
  SLOT_MACHINE:      2400,
  ELEMENTAL_AURA:    1800,
  MIAUVADAO_SEAL:    2200,
};

// Fade-out starts 400ms before total duration
const FADE_OFFSET = 400;

// ── Helpers ───────────────────────────────────────────────────────────────────

const COINS = ["🪙","🪙","⭐","🪙","✨","🪙"];
const CONFETTI_COLORS = ["#FFCB05","#f97316","#c084fc","#60a5fa","#4ade80","#fb923c","#fff"];

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// ── Sub-effects ───────────────────────────────────────────────────────────────

function LightningStrikeEffect({ name, color, glowColor }: Pick<TitleEntranceProps,"name"|"color"|"glowColor">) {
  const sparks = Array.from({ length: 8 }, (_, i) => ({
    left: `${15 + i * 10}%`,
    top:  `${30 + (i % 3) * 20}%`,
    sx: `${rnd(-20,20)}px`, sy: `${rnd(-30,-8)}px`,
    delay: rnd(0.2, 0.7),
    size: rnd(3, 7),
  }));

  return (
    <>
      {/* Dark overlay with blue tint */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, #0a0a1a 0%, #000510 100%)",
        animation: "entrance-in 0.15s ease forwards",
      }} />

      {/* SVG lightning bolt crossing screen diagonally */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <filter id="lx-glow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* Main bolt */}
        <polyline
          points="20,5 45,38 35,38 65,72 55,72 80,95"
          stroke={color}
          strokeWidth="4"
          fill="none"
          filter="url(#lx-glow)"
          strokeLinecap="round"
          style={{
            strokeDasharray: 1200,
            strokeDashoffset: 1200,
            animation: "lightning-bolt-draw 0.35s ease forwards",
            animationDelay: "0.05s",
          }}
          vectorEffect="non-scaling-stroke"
        />
        {/* Branch 1 */}
        <polyline
          points="45,38 55,50 50,50 60,62"
          stroke={color}
          strokeWidth="2"
          fill="none"
          opacity="0.7"
          style={{
            strokeDasharray: 300,
            strokeDashoffset: 300,
            animation: "lightning-bolt-draw 0.25s ease forwards",
            animationDelay: "0.15s",
          }}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Screen flash */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: color,
        opacity: 0,
        animation: "entrance-in 0.08s ease 0.05s forwards, entrance-out 0.3s ease 0.25s forwards",
        zIndex: 2,
      }} />

      {/* Sparks */}
      {sparks.map((s, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{
          left: s.left, top: s.top,
          width: s.size, height: s.size,
          background: color,
          boxShadow: `0 0 6px ${color}`,
          // @ts-expect-error CSS custom properties
          "--sx": s.sx, "--sy": s.sy,
          animation: "lightning-spark 0.6s ease forwards",
          animationDelay: `${s.delay}s`,
          opacity: 0,
          zIndex: 3,
        }} />
      ))}

      {/* Title */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <p className="font-bold text-3xl tracking-widest text-center px-8" style={{
          color,
          textShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}, 0 0 80px ${glowColor}`,
          animation: "lightning-flash 0.8s ease 0.3s forwards",
          opacity: 0,
        }}>
          {name}
        </p>
      </div>
    </>
  );
}

function BossAlertEffect({ name, color, glowColor }: Pick<TitleEntranceProps,"name"|"color"|"glowColor">) {
  const [phase, setPhase] = useState<"in"|"hold"|"out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 400);
    const t2 = setTimeout(() => setPhase("out"), 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const barStyle = (dir: "top"|"bottom") => ({
    position: "absolute" as const,
    left: 0, right: 0,
    height: "18%",
    background: "linear-gradient(135deg, #1a0000 0%, #2d0000 50%, #1a0000 100%)",
    borderBottom: dir === "top" ? "2px solid #ff000088" : undefined,
    borderTop:    dir === "bottom" ? "2px solid #ff000088" : undefined,
    [dir]: 0,
    zIndex: 5,
    animation: phase === "out"
      ? `boss-bar-out-${dir} 0.35s ease forwards`
      : `boss-bar-in-${dir} 0.3s cubic-bezier(.2,1.5,.5,1) 0.1s both`,
  });

  return (
    <>
      {/* Red overlay */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, #1a0000 0%, #000 70%)",
        animation: "entrance-in 0.15s ease forwards",
      }} />

      {/* Red vignette pulse */}
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: "inset 0 0 120px #ff000066",
        zIndex: 1,
      }} />

      {/* Bars */}
      <div style={barStyle("top")} />
      <div style={barStyle("bottom")} />

      {/* Title */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ textAlign: "center" }}>
          <p className="text-[10px] uppercase tracking-[0.4em] mb-3" style={{ color: "#ff4444", opacity: phase === "in" ? 0 : 1, transition: "opacity 0.3s" }}>
            AMEAÇA DETECTADA
          </p>
          <p className="font-black text-4xl tracking-wider" style={{
            color,
            textShadow: `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
            animation: phase === "hold" ? "boss-title-shake 0.6s ease 0.1s 2" : undefined,
            opacity: phase === "in" ? 0 : 1,
            transition: "opacity 0.2s 0.2s",
          }}>
            {name}
          </p>
        </div>
      </div>
    </>
  );
}

function ChampionArenaEffect({ name, color, glowColor }: Pick<TitleEntranceProps,"name"|"color"|"glowColor">) {
  const confetti = Array.from({ length: 14 }, (_, i) => ({
    left: `${rnd(5, 95)}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: rnd(0, 0.6),
    duration: rnd(1.2, 1.8),
    cr: `${rnd(-360, 360)}deg`,
    cs: rnd(0.6, 1.4),
    width: rnd(6, 12),
    height: rnd(4, 8),
  }));

  return (
    <>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center bottom, #1a1200 0%, #0a0800 100%)",
        animation: "entrance-in 0.2s ease forwards",
      }} />

      {/* Spotlights */}
      <div className="absolute pointer-events-none" style={{
        left: "15%", top: "-40%",
        width: 120, height: "200%",
        background: "linear-gradient(to bottom, transparent, #FFCB0522, #FFCB0533, #FFCB0511, transparent)",
        transformOrigin: "top center",
        animation: "spotlight-l 1.5s ease 0.1s both",
        opacity: 0, zIndex: 1,
      }} />
      <div className="absolute pointer-events-none" style={{
        right: "15%", top: "-40%",
        width: 120, height: "200%",
        background: "linear-gradient(to bottom, transparent, #FFCB0522, #FFCB0533, #FFCB0511, transparent)",
        transformOrigin: "top center",
        animation: "spotlight-r 1.5s ease 0.1s both",
        opacity: 0, zIndex: 1,
      }} />

      {/* Confetti */}
      {confetti.map((c, i) => (
        <div key={i} className="absolute pointer-events-none" style={{
          left: c.left, top: -16,
          width: c.width, height: c.height,
          background: c.color,
          borderRadius: 2,
          // @ts-expect-error CSS custom properties
          "--cr": c.cr, "--cs": c.cs,
          animation: `confetti-drop ${c.duration}s ease ${c.delay}s both`,
          zIndex: 2,
        }} />
      ))}

      {/* Golden band */}
      <div className="absolute inset-x-0 flex items-center justify-center z-10" style={{ top: "50%", transform: "translateY(-50%)" }}>
        <div className="w-full py-6" style={{
          background: "linear-gradient(90deg, transparent, #1a120088, #1a1200cc, #1a120088, transparent)",
          borderTop: `1px solid ${color}44`,
          borderBottom: `1px solid ${color}44`,
        }}>
          <p className="font-black text-center text-3xl tracking-[0.1em]" style={{
            color,
            textShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
            animation: "arena-title-in 0.7s ease 0.4s both",
          }}>
            {name}
          </p>
        </div>
      </div>
    </>
  );
}

function CoinRainEffect({ name, color, glowColor }: Pick<TitleEntranceProps,"name"|"color"|"glowColor">) {
  const coins = Array.from({ length: 10 }, (_, i) => ({
    left: `${8 + i * 9}%`,
    delay: rnd(0, 0.8),
    emoji: COINS[i % COINS.length],
    ch: `${rnd(75, 90)}vh`,
  }));

  return (
    <>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, #1a1000 0%, #080500 100%)",
        animation: "entrance-in 0.2s ease forwards",
      }} />

      {coins.map((c, i) => (
        <div key={i} className="absolute text-2xl pointer-events-none select-none" style={{
          left: c.left, top: 0,
          // @ts-expect-error CSS custom properties
          "--ch": c.ch,
          animation: `coin-fall 1.4s cubic-bezier(.25,.46,.45,.94) ${c.delay}s both`,
          zIndex: 2,
          filter: `drop-shadow(0 0 6px ${color})`,
        }}>
          {c.emoji}
        </div>
      ))}

      <div className="absolute inset-0 flex items-center justify-center z-10">
        <p className="font-black text-3xl tracking-wide text-center px-8" style={{
          color,
          textShadow: `0 0 20px ${glowColor}, 0 0 50px ${glowColor}`,
          animation: "title-rise-fade 0.6s ease 0.5s both",
        }}>
          {name}
        </p>
      </div>
    </>
  );
}

function DimensionalRiftEffect({ name, color, glowColor }: Pick<TitleEntranceProps,"name"|"color"|"glowColor">) {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 2 * Math.PI;
    const r = rnd(60, 130);
    return {
      px: `${Math.cos(angle) * r}px`,
      py: `${Math.sin(angle) * r}px`,
      size: rnd(3, 8),
      delay: rnd(0.4, 1.0),
    };
  });

  return (
    <>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, #0d0020 0%, #04000e 100%)",
        backdropFilter: "blur(2px)",
        animation: "entrance-in 0.2s ease forwards",
      }} />

      {/* Portal circle */}
      <div className="absolute inset-0 flex items-center justify-center z-2">
        <div style={{
          width: 260, height: 260,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, #4a00e0cc 0%, #8b00ffaa 40%, #4a00e033 70%, transparent 100%)`,
          boxShadow: `0 0 60px #8b00ff88, inset 0 0 40px #4a00e066`,
          animation: "portal-expand 0.8s cubic-bezier(.2,1,.5,1) 0.1s both",
        }} />
      </div>

      {/* Particles radiating out from portal */}
      <div className="absolute inset-0 flex items-center justify-center z-3 pointer-events-none">
        {particles.map((p, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: p.size, height: p.size,
            background: "#c084fc",
            boxShadow: "0 0 6px #c084fc",
            // @ts-expect-error CSS custom properties
            "--px": p.px, "--py": p.py,
            animation: "portal-particle 1.2s ease forwards",
            animationDelay: `${p.delay}s`,
            opacity: 0,
          }} />
        ))}
      </div>

      {/* Title emerging from portal */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <p className="font-black text-3xl tracking-wide text-center px-8" style={{
          color,
          textShadow: `0 0 20px ${glowColor}, 0 0 50px #8b00ffaa`,
          animation: "rift-title-emerge 0.7s cubic-bezier(.2,1,.5,1) 0.7s both",
        }}>
          {name}
        </p>
      </div>
    </>
  );
}

function UltraRareRevealEffect({ name, color, glowColor }: Pick<TitleEntranceProps,"name"|"color"|"glowColor">) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 700);
    return () => clearTimeout(t);
  }, []);

  const particles = Array.from({ length: 10 }, (_, i) => ({
    cx: `${rnd(-100,100)}px`, cy: `${rnd(-80,-20)}px`,
    cr: `${rnd(-180,180)}deg`,
    delay: rnd(0.8, 1.4),
    size: rnd(4, 10),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));

  return (
    <>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, #0a0a16 0%, #030308 100%)",
        animation: "entrance-in 0.2s ease forwards",
      }} />

      {/* Card */}
      <div className="absolute inset-0 flex items-center justify-center z-5" style={{ perspective: 800 }}>
        <div style={{
          width: 220, height: 300,
          borderRadius: 16,
          transformStyle: "preserve-3d",
          animation: flipped ? "card-flip-in 0.6s cubic-bezier(.2,1,.5,1) forwards" : undefined,
          transform: flipped ? undefined : "perspective(700px) rotateY(180deg) scale(0.8)",
          transition: undefined,
        }}>
          {/* Front face (title) */}
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2 overflow-hidden" style={{
            backfaceVisibility: "hidden",
            background: `linear-gradient(135deg, #0d0d1a 0%, #1a0d2e 50%, #0d0d1a 100%)`,
            border: `2px solid ${color}88`,
            boxShadow: `0 0 30px ${glowColor}, inset 0 0 20px ${color}11`,
          }}>
            {/* Holographic shimmer overlay */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              backgroundImage: `linear-gradient(105deg, transparent 30%, ${color}44 45%, #fff6 50%, ${color}44 55%, transparent 70%)`,
              backgroundSize: "200% 100%",
              animation: "holo-sweep 1s ease 1.1s 2",
            }} />
            <p className="text-[10px] uppercase tracking-[0.3em] mb-1" style={{ color: `${color}88` }}>Ultra Raro</p>
            <p className="font-black text-xl text-center px-4 leading-tight" style={{
              color,
              textShadow: `0 0 20px ${glowColor}`,
            }}>
              {name}
            </p>
            <p className="text-lg mt-1">✦</p>
          </div>
          {/* Back face */}
          <div className="absolute inset-0 rounded-2xl" style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "linear-gradient(135deg, #0d1a2e, #1a0d2e)",
            border: "2px solid #333",
          }} />
        </div>
      </div>

      {/* Particles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        {particles.map((p, i) => (
          <div key={i} className="absolute rounded-sm" style={{
            width: p.size, height: p.size / 2,
            background: p.color,
            // @ts-expect-error CSS custom properties
            "--cx": p.cx, "--cy": p.cy, "--cr": p.cr,
            animation: "card-particle 1s ease forwards",
            animationDelay: `${p.delay}s`,
            opacity: 0,
          }} />
        ))}
      </div>
    </>
  );
}

function GlitchHackEffect({ name, color, glowColor }: Pick<TitleEntranceProps,"name"|"color"|"glowColor">) {
  const CHARS = "アイウエオカキクケコ!@#$%^&*01ABCXYZ?!<>";
  const [displayed, setDisplayed] = useState(() => name.split("").map(() => CHARS[Math.floor(Math.random() * CHARS.length)]).join(""));
  const iterRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      iterRef.current++;
      const progress = iterRef.current / 16; // 16 iterations to stabilize
      setDisplayed(
        name.split("").map((ch, i) =>
          Math.random() < progress || ch === " " ? ch : CHARS[Math.floor(Math.random() * CHARS.length)]
        ).join("")
      );
      if (iterRef.current >= 16) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, [name]);

  return (
    <>
      <div className="absolute inset-0" style={{
        background: "#000408",
        animation: "entrance-in 0.1s ease forwards",
      }} />

      {/* Grid lines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(transparent 97%, #00ff4422 97%), linear-gradient(90deg, transparent 97%, #00ff4411 97%)`,
        backgroundSize: "40px 40px",
        zIndex: 1,
      }} />

      {/* Scanlines */}
      {[0,1,2].map(i => (
        <div key={i} className="absolute inset-x-0 pointer-events-none" style={{
          height: 2, background: "#0ff6",
          animation: "scanline-sweep 1.2s ease forwards",
          animationDelay: `${i * 0.25}s`,
          zIndex: 2,
        }} />
      ))}

      {/* Glitching title */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <p className="font-mono font-black text-3xl tracking-widest text-center px-8" style={{
          color: "#0ff",
          animation: "glitch-color-shift 0.12s linear 0s 10",
          textShadow: `0 0 10px #0ff, 0 0 20px ${glowColor}`,
        }}>
          {displayed}
        </p>
      </div>

      {/* Stabilized title overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-11" style={{
        animation: "entrance-in 0.4s ease 0.9s both",
      }}>
        <p className="font-mono font-black text-3xl tracking-widest text-center px-8" style={{
          color,
          textShadow: `0 0 16px ${glowColor}`,
        }}>
          {name}
        </p>
      </div>
    </>
  );
}

const SLOT_SYMBOLS = ["⚡","🔥","💎","⭐","🏆","🎴","🌊","✦"];
const JACKPOT = ["⚡","⚡","⚡"];

function SlotMachineEffect({ name, color, glowColor }: Pick<TitleEntranceProps,"name"|"color"|"glowColor">) {
  const [slots, setSlots] = useState(["?","?","?"]);
  const [stopped, setStopped] = useState([false,false,false]);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    // Spin slots
    const interval = setInterval(() => {
      setSlots(s => s.map((_, i) => stopped[i] ? JACKPOT[i] : SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]));
    }, 80);

    // Stop one by one
    const t1 = setTimeout(() => setStopped([true,false,false]), 800);
    const t2 = setTimeout(() => setStopped([true,true,false]), 1100);
    const t3 = setTimeout(() => { setStopped([true,true,true]); setShaking(true); }, 1400);
    const t4 = setTimeout(() => setShaking(false), 1800);

    return () => { clearInterval(interval); [t1,t2,t3,t4].forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, #0d0818 0%, #05030c 100%)",
        animation: "entrance-in 0.2s ease forwards",
      }}>
        {/* Neon border */}
        <div className="absolute inset-4 rounded-2xl pointer-events-none" style={{
          border: `2px solid ${color}44`,
          boxShadow: `inset 0 0 40px ${color}11, 0 0 20px ${color}22`,
        }} />
      </div>

      {/* Slot reels */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-5 gap-6">
        <div className="flex gap-4">
          {slots.map((sym, i) => (
            <div key={i} className="flex items-center justify-center rounded-xl" style={{
              width: 64, height: 64,
              background: "#0a0820",
              border: `2px solid ${stopped[i] ? color : "#333"}`,
              boxShadow: stopped[i] ? `0 0 16px ${glowColor}` : undefined,
              fontSize: 28,
              transition: "border-color 0.2s, box-shadow 0.2s",
              animation: shaking ? "slot-shake 0.3s ease" : undefined,
            }}>
              {sym}
            </div>
          ))}
        </div>

        {/* Flash on jackpot */}
        {stopped[2] && (
          <div className="absolute inset-0 pointer-events-none rounded" style={{
            background: color,
            animation: "entrance-out 0.3s ease 0.1s both",
            zIndex: 20,
          }} />
        )}

        {/* Title */}
        <p className="font-black text-2xl tracking-wide text-center px-8" style={{
          color,
          textShadow: `0 0 16px ${glowColor}`,
          animation: stopped[2] ? "title-rise-fade 0.5s ease 0.2s both" : undefined,
          opacity: stopped[2] ? undefined : 0,
        }}>
          {name}
        </p>
      </div>
    </>
  );
}

const AURA_THEMES: Record<string, { bg: string; particle: string; label: string }> = {
  ELECTRIC: { bg: "radial-gradient(ellipse, #0a0f20 0%, #020510 100%)", particle: "#FFCB05", label: "⚡" },
  FIRE:     { bg: "radial-gradient(ellipse, #1a0600 0%, #080200 100%)", particle: "#f97316", label: "🔥" },
  WATER:    { bg: "radial-gradient(ellipse, #001a20 0%, #000810 100%)", particle: "#38bdf8", label: "🌊" },
  GRASS:    { bg: "radial-gradient(ellipse, #001a06 0%, #000802 100%)", particle: "#4ade80", label: "🌿" },
  ZIKABET:  { bg: "radial-gradient(ellipse, #14001a 0%, #060008 100%)", particle: "#c084fc", label: "🎰" },
  NEUTRAL:  { bg: "radial-gradient(ellipse, #0a0820 0%, #030310 100%)", particle: "#FFCB05", label: "✦" },
};

function ElementalAuraEffect({ name, color, glowColor, theme }: Pick<TitleEntranceProps,"name"|"color"|"glowColor"|"theme">) {
  const aura = AURA_THEMES[theme ?? "NEUTRAL"] ?? AURA_THEMES.NEUTRAL;
  const embers = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * 2 * Math.PI;
    const r = rnd(40, 120);
    return {
      ex: `${Math.cos(angle) * r + rnd(-20,20)}px`,
      ey: `${-Math.abs(Math.sin(angle)) * r - 20}px`,
      er: `${rnd(-180,180)}deg`,
      size: rnd(4, 10),
      delay: rnd(0, 0.8),
    };
  });

  return (
    <>
      <div className="absolute inset-0" style={{
        background: aura.bg,
        animation: "entrance-in 0.2s ease forwards",
      }} />

      {/* Aura rings */}
      {[0,1,2].map(i => (
        <div key={i} className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
          <div style={{
            width: 200 + i * 100, height: 200 + i * 100,
            borderRadius: "50%",
            border: `${2 - i * 0.5}px solid ${aura.particle}${["66","44","22"][i]}`,
            boxShadow: `0 0 ${20 + i*10}px ${aura.particle}${["44","22","11"][i]}`,
            animation: "aura-expand 1.5s ease forwards",
            animationDelay: `${i * 0.2}s`,
            opacity: 0,
          }} />
        </div>
      ))}

      {/* Floating particles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-2">
        {embers.map((e, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: e.size, height: e.size,
            background: aura.particle,
            boxShadow: `0 0 8px ${aura.particle}`,
            // @ts-expect-error CSS custom properties
            "--ex": e.ex, "--ey": e.ey, "--er": e.er,
            animation: "ember-float 1.2s ease forwards",
            animationDelay: `${e.delay}s`,
            opacity: 0,
          }} />
        ))}
      </div>

      {/* Theme emoji large */}
      <div className="absolute inset-0 flex items-center justify-center z-3" style={{
        fontSize: 80,
        animation: "aura-expand 1.8s ease 0.1s both",
        opacity: 0,
        filter: `blur(2px) drop-shadow(0 0 20px ${aura.particle})`,
      }}>
        {aura.label}
      </div>

      {/* Title */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <p className="font-black text-3xl tracking-wide text-center px-8" style={{
          color,
          textShadow: `0 0 20px ${glowColor}, 0 0 50px ${aura.particle}88`,
          animation: "title-rise-fade 0.6s ease 0.5s both",
        }}>
          {name}
        </p>
      </div>
    </>
  );
}

function MiauvadaoSealEffect({ name, color, glowColor }: Pick<TitleEntranceProps,"name"|"color"|"glowColor">) {
  const tickets = Array.from({ length: 8 }, (_, i) => ({
    tx: `${rnd(-150,150)}px`, ty: `${rnd(-40,40)}px`, tr: `${rnd(-45,45)}deg`,
    delay: rnd(0.5, 1.0),
    emoji: i % 2 === 0 ? "🎟️" : "🪙",
    size: rnd(18, 28),
  }));

  return (
    <>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, #12001a 0%, #060008 100%)",
        animation: "entrance-in 0.15s ease forwards",
      }} />

      {/* APROVADO stamp */}
      <div className="absolute inset-0 flex items-center justify-center z-5" style={{ pointerEvents: "none" }}>
        <div style={{
          fontSize: 72, fontWeight: 900,
          color: "#22c55e",
          border: "6px solid #22c55e",
          padding: "8px 24px",
          borderRadius: 8,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          opacity: 0.9,
          animation: "seal-stamp 0.6s cubic-bezier(.36,.07,.19,.97) 0.1s both",
          textShadow: "0 0 30px #22c55e88",
          boxShadow: "0 0 30px #22c55e44, inset 0 0 20px #22c55e11",
        }}>
          Aprovado
        </div>
      </div>

      {/* Flying tickets/coins */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-6">
        {tickets.map((t, i) => (
          <div key={i} className="absolute select-none" style={{
            fontSize: t.size,
            // @ts-expect-error CSS custom properties
            "--tx": t.tx, "--ty": t.ty, "--tr": t.tr,
            animation: "ticket-fly 0.8s ease forwards",
            animationDelay: `${t.delay}s`,
            opacity: 0,
          }}>
            {t.emoji}
          </div>
        ))}
      </div>

      {/* Title with neon */}
      <div className="absolute inset-0 flex items-center justify-center z-10" style={{
        marginTop: 80,
      }}>
        <p className="font-black text-3xl tracking-wide text-center px-8" style={{
          color,
          textShadow: `0 0 20px ${glowColor}, 0 0 50px ${glowColor}`,
          animation: "title-rise-fade 0.6s ease 0.8s both",
        }}>
          {name}
        </p>
      </div>
    </>
  );
}

// ── Main portal component ─────────────────────────────────────────────────────

export function TitleEntrance({
  name, rarity, theme, effect, color, glowColor, onComplete
}: TitleEntranceProps) {
  const [mounted, setMounted]   = useState(false);
  const [visible, setVisible]   = useState(true);
  const hasPlayed = useRef(false);

  useEffect(() => {
    if (hasPlayed.current || effect === "NONE") return;
    hasPlayed.current = true;
    setMounted(true);

    const total = DURATION[effect] ?? 1800;
    const fadeAt = total - FADE_OFFSET;

    const tFade = setTimeout(() => setVisible(false), fadeAt);
    const tDone = setTimeout(() => onComplete(), total);

    return () => { clearTimeout(tFade); clearTimeout(tDone); };
  }, [effect, onComplete]);

  if (!mounted || typeof document === "undefined") return null;

  const content = (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        zIndex: 99999,
        pointerEvents: "none",
        animation: !visible ? `entrance-out ${FADE_OFFSET}ms ease forwards` : undefined,
      }}
    >
      {effect === "LIGHTNING_STRIKE"  && <LightningStrikeEffect  name={name} color={color} glowColor={glowColor} />}
      {effect === "BOSS_ALERT"        && <BossAlertEffect        name={name} color={color} glowColor={glowColor} />}
      {effect === "CHAMPION_ARENA"    && <ChampionArenaEffect    name={name} color={color} glowColor={glowColor} />}
      {effect === "COIN_RAIN"         && <CoinRainEffect         name={name} color={color} glowColor={glowColor} />}
      {effect === "DIMENSIONAL_RIFT"  && <DimensionalRiftEffect  name={name} color={color} glowColor={glowColor} />}
      {effect === "ULTRA_RARE_REVEAL" && <UltraRareRevealEffect  name={name} color={color} glowColor={glowColor} />}
      {effect === "GLITCH_HACK"       && <GlitchHackEffect       name={name} color={color} glowColor={glowColor} />}
      {effect === "SLOT_MACHINE"      && <SlotMachineEffect      name={name} color={color} glowColor={glowColor} />}
      {effect === "ELEMENTAL_AURA"    && <ElementalAuraEffect    name={name} color={color} glowColor={glowColor} theme={theme} />}
      {effect === "MIAUVADAO_SEAL"    && <MiauvadaoSealEffect    name={name} color={color} glowColor={glowColor} />}
    </div>
  );

  return createPortal(content, document.body);
}
