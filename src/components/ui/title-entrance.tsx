"use client";

/**
 * TitleEntrance v3 — portal de tela inteira com:
 *  - Fase "ambient" para Lendário+ (efeitos contínuos após entrada)
 *  - Frase de efeito exibida em todos
 *  - Gradient text para Lendário+
 *  - Miauvadão: stamp no topo, título na base (sem sobreposição)
 *  - +2s de duração em todos os efeitos
 *  - Tamanhos responsivos (clamp / min())
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  flavorText?: string | null;
  onComplete: () => void;
}

// ── Durações totais (ms) ──────────────────────────────────────────────────────
const DURATION: Record<string, number> = {
  LIGHTNING_STRIKE:  3800,
  BOSS_ALERT:        4600,
  CHAMPION_ARENA:    4600,
  COIN_RAIN:         4200,
  DIMENSIONAL_RIFT:  4600,
  ULTRA_RARE_REVEAL: 4600,
  GLITCH_HACK:       3800,
  SLOT_MACHINE:      4800,
  ELEMENTAL_AURA:    4000,
  MIAUVADAO_SEAL:    4600,
};

// Tempo até a fase "ambient" começar (ms)
const AMBIENT_AT: Record<string, number> = {
  LIGHTNING_STRIKE:  900,
  BOSS_ALERT:        1000,
  CHAMPION_ARENA:    1100,
  COIN_RAIN:         1200,
  DIMENSIONAL_RIFT:  1300,
  ULTRA_RARE_REVEAL: 1500,
  GLITCH_HACK:       1200,
  SLOT_MACHINE:      1700,
  ELEMENTAL_AURA:    900,
  MIAUVADAO_SEAL:    1100,
};

const FADE_MS = 700;

// ── Helpers ───────────────────────────────────────────────────────────────────
const COINS           = ["🪙","🪙","⭐","🪙","✨","🪙","💰","🪙"];
const CONFETTI_COLORS = ["#FFCB05","#f97316","#c084fc","#60a5fa","#4ade80","#fb923c","#fff","#fbbf24"];

function rnd(min: number, max: number) { return Math.random() * (max - min) + min; }

// Gradientes por raridade para o texto no portal
const RARITY_GRADIENT: Record<string, string | null> = {
  LEGENDARY: "linear-gradient(90deg,#f97316,#fbbf24,#ffffff,#fbbf24,#f97316)",
  MYTHIC:    "linear-gradient(90deg,#fbbf24,#ffffff,#fef08a,#ffffff,#fbbf24)",
  RELIC:     "linear-gradient(90deg,#ef4444,#fbbf24,#ffffff,#fbbf24,#ef4444)",
};

// ── Bloco de título+frase ─────────────────────────────────────────────────────
function TitleBlock({
  name, color, glowColor, flavorText, rarity, ambient,
  style, nameStyle,
}: {
  name: string; color: string; glowColor: string; flavorText?: string | null;
  rarity?: string; ambient?: boolean;
  style?: React.CSSProperties; nameStyle?: React.CSSProperties;
}) {
  const gradient   = rarity ? RARITY_GRADIENT[rarity] : null;
  const isGradient = !!gradient;

  const textShadow = !isGradient
    ? `0 0 20px ${glowColor}, 0 0 50px ${glowColor}`
    : undefined;
  const filterGlow = isGradient
    ? `drop-shadow(0 0 12px ${glowColor}) drop-shadow(0 0 28px ${glowColor})`
    : undefined;

  return (
    <div style={{ textAlign: "center", ...style }}>
      <p style={{
        margin: 0,
        fontWeight: 900,
        fontSize: "clamp(22px, 5.5vw, 36px)",
        letterSpacing: "0.06em",
        lineHeight: 1.2,
        padding: "0 20px",
        color: isGradient ? "transparent" : color,
        textShadow,
        ...(isGradient ? {
          backgroundImage: gradient!,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundSize: ambient ? "200% auto" : "150% auto",
          animation: ambient ? "title-shimmer-loop 2.5s linear infinite" : undefined,
          filter: filterGlow,
        } : {}),
        ...nameStyle,
      }}>
        {name}
      </p>

      {flavorText && (
        <p style={{
          margin: "12px 20px 0",
          fontSize: "clamp(12px, 2.8vw, 15px)",
          fontStyle: "italic",
          lineHeight: 1.6,
          color: isGradient ? `${color}dd` : `${color}cc`,
          animation: "title-flavor-in 0.6s ease 0.4s both",
        }}>
          &ldquo;{flavorText}&rdquo;
        </p>
      )}
    </div>
  );
}

// Faíscas elétricas flutuantes (usadas em LIGHTNING e ELEMENTAL_ELECTRIC no ambient)
function FloatingSparks({ color, count = 12 }: { color: string; count?: number }) {
  const sparks = Array.from({ length: count }, (_, i) => ({
    left: `${rnd(5, 95)}%`,
    top:  `${rnd(10, 90)}%`,
    size: rnd(2, 6),
    dur:  rnd(1.5, 3.5),
    delay: rnd(0, 2),
    tx: `${rnd(-30, 30)}px`, ty: `${rnd(-40, -10)}px`,
  }));
  return (
    <>
      {sparks.map((s, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{
          left: s.left, top: s.top,
          width: s.size, height: s.size,
          background: color, boxShadow: `0 0 6px ${color}`,
          // @ts-expect-error CSS vars
          "--ex": s.tx, "--ey": s.ty, "--er": "0deg",
          animation: `ember-float ${s.dur}s ease ${s.delay}s infinite`,
          zIndex: 4,
        }} />
      ))}
    </>
  );
}

type EffectProps = Pick<TitleEntranceProps, "name"|"color"|"glowColor"|"flavorText"|"theme"|"rarity">;

// ── LIGHTNING STRIKE ──────────────────────────────────────────────────────────
function LightningStrikeEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAmbient(true), AMBIENT_AT.LIGHTNING_STRIKE);
    return () => clearTimeout(t);
  }, []);

  const sparks = Array.from({ length: 10 }, (_, i) => ({
    left: `${10 + i * 9}%`, top: `${25 + (i % 4) * 16}%`,
    sx: `${rnd(-25,25)}px`, sy: `${rnd(-35,-8)}px`,
    delay: rnd(0.1, 0.8), size: rnd(3, 8),
  }));

  return (
    <>
      {/* Background */}
      <div className="absolute inset-0" style={{
        background: ambient
          ? "radial-gradient(ellipse at 50% 50%,#0d1428 0%,#020510 100%)"
          : "radial-gradient(ellipse at center,#0a0a1a,#000510)",
        animation: "entrance-in 0.15s ease forwards",
        transition: "background 1s ease",
      }} />

      {/* Lightning SVG — 3 bolts */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          <filter id="lx-glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="lx-glow2"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {/* Main bolt */}
        <polyline points="15,2 42,36 32,36 62,70 52,70 82,98" stroke={color} strokeWidth="4" fill="none" filter="url(#lx-glow)" strokeLinecap="round"
          style={{ strokeDasharray: 1400, strokeDashoffset: 1400, animation: "lightning-bolt-draw 0.4s ease 0.05s forwards" }} vectorEffect="non-scaling-stroke"/>
        {/* Branch 1 */}
        <polyline points="42,36 55,52 48,52 62,66" stroke={color} strokeWidth="2.5" fill="none" opacity="0.8" filter="url(#lx-glow2)"
          style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: "lightning-bolt-draw 0.3s ease 0.18s forwards" }} vectorEffect="non-scaling-stroke"/>
        {/* Branch 2 */}
        <polyline points="62,70 72,82 68,82 78,92" stroke={color} strokeWidth="2" fill="none" opacity="0.6"
          style={{ strokeDasharray: 300, strokeDashoffset: 300, animation: "lightning-bolt-draw 0.25s ease 0.28s forwards" }} vectorEffect="non-scaling-stroke"/>
        {/* Ambient glow line */}
        {ambient && <line x1="15" y1="2" x2="82" y2="98" stroke={color} strokeWidth="1" opacity="0.15" strokeDasharray="4 6"/>}
      </svg>

      {/* Screen flash */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 50% 45%, ${color}88, transparent 70%)`,
        opacity: 0, animation: "entrance-in 0.08s ease 0.05s forwards, entrance-out 0.4s ease 0.28s forwards", zIndex: 2,
      }} />

      {/* Entry sparks */}
      {sparks.map((s, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{
          left: s.left, top: s.top, width: s.size, height: s.size,
          background: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${color}88`,
          // @ts-expect-error CSS vars
          "--sx": s.sx, "--sy": s.sy,
          animation: "lightning-spark 0.7s ease forwards", animationDelay: `${s.delay}s`, opacity: 0, zIndex: 3,
        }} />
      ))}

      {/* Ambient: continuous floating sparks */}
      {ambient && <FloatingSparks color={color} count={14} />}

      {/* Ambient: electric halo behind title */}
      {ambient && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
          <div style={{
            width: "min(320px,80vw)", height: "min(120px,25vh)",
            borderRadius: 16,
            background: `radial-gradient(ellipse, ${glowColor}22, transparent 70%)`,
            animation: "aura-expand 2s ease infinite",
          }} />
        </div>
      )}

      {/* Title */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ animation: "lightning-flash 0.8s ease 0.3s both" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={ambient} />
        </div>
      </div>
    </>
  );
}

// ── BOSS ALERT ────────────────────────────────────────────────────────────────
function BossAlertEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const [phase, setPhase] = useState<"in"|"hold"|"ambient"|"out">("in");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 400);
    const t2 = setTimeout(() => setPhase("ambient"), AMBIENT_AT.BOSS_ALERT);
    const t3 = setTimeout(() => setPhase("out"), DURATION.BOSS_ALERT - FADE_MS - 200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const barBase: React.CSSProperties = {
    position: "absolute", left: 0, right: 0, height: "16%", zIndex: 5,
    background: "linear-gradient(135deg,#1a0000 0%,#2d0000 40%,#3a0000 60%,#1a0000 100%)",
  };

  return (
    <>
      <div className="absolute inset-0" style={{
        background: phase === "ambient"
          ? "radial-gradient(ellipse at center,#220000 0%,#000 100%)"
          : "radial-gradient(ellipse at center,#1a0000,#000)",
        animation: "entrance-in 0.15s ease forwards",
        transition: "background 0.8s ease",
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: `inset 0 0 160px ${phase === "ambient" ? "#ff000099" : "#ff000066"}`,
        zIndex: 1, transition: "box-shadow 0.8s ease",
      }} />

      {/* Cinematic bars */}
      <div style={{
        ...barBase, top: 0,
        borderBottom: "2px solid #ff000099",
        animation: phase === "out"
          ? "boss-bar-out-top 0.35s ease forwards"
          : "boss-bar-in-top 0.3s cubic-bezier(.2,1.5,.5,1) 0.1s both",
      }} />
      <div style={{
        ...barBase, bottom: 0,
        borderTop: "2px solid #ff000099",
        animation: phase === "out"
          ? "boss-bar-out-bottom 0.35s ease forwards"
          : "boss-bar-in-bottom 0.3s cubic-bezier(.2,1.5,.5,1) 0.1s both",
      }} />

      {/* Ambient scanline */}
      {phase === "ambient" && (
        <div className="absolute inset-x-0 pointer-events-none" style={{
          height: 3, background: "#ff000055",
          animation: "scanline-sweep 1.8s ease 0s infinite", zIndex: 2,
        }} />
      )}

      {/* "AMEAÇA DETECTADA" label */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div>
          <p style={{
            textAlign: "center", marginBottom: 12,
            fontSize: "clamp(9px,2vw,12px)",
            textTransform: "uppercase", letterSpacing: "0.45em",
            color: phase === "ambient" ? "#ff6666" : "#ff4444",
            opacity: phase === "in" ? 0 : 1, transition: "opacity 0.3s, color 0.5s",
            animation: phase === "ambient" ? "title-glow-breathe 1.5s ease infinite" : undefined,
          }}>
            ⚠ AMEAÇA DETECTADA ⚠
          </p>
          <div style={{
            animation: phase === "hold" ? "boss-title-shake 0.6s ease 0.1s 2" : undefined,
            opacity: phase === "in" ? 0 : 1, transition: "opacity 0.25s 0.2s",
          }}>
            <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={phase === "ambient"} />
          </div>
        </div>
      </div>
    </>
  );
}

// ── CHAMPION ARENA ────────────────────────────────────────────────────────────
function ChampionArenaEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAmbient(true), AMBIENT_AT.CHAMPION_ARENA);
    return () => clearTimeout(t);
  }, []);

  const confetti = Array.from({ length: 20 }, (_, i) => ({
    left: `${rnd(2, 98)}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: rnd(0, ambient ? 0.3 : 0.7),
    duration: rnd(ambient ? 2 : 1.2, ambient ? 3.5 : 2),
    cr: `${rnd(-360,360)}deg`, cs: rnd(0.5, 1.5),
    width: rnd(6, 14), height: rnd(4, 9),
  }));

  return (
    <>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center bottom,#1a1200,#0a0800)",
        animation: "entrance-in 0.2s ease forwards",
      }} />

      {/* Two spotlights */}
      {[
        { side: "left", style: { left:"10%",top:"-50%",width:"clamp(80px,15vw,130px)",height:"220%",transformOrigin:"top center",animation:"spotlight-l 2s ease 0.1s both" } },
        { side: "right", style: { right:"10%",top:"-50%",width:"clamp(80px,15vw,130px)",height:"220%",transformOrigin:"top center",animation:"spotlight-r 2s ease 0.1s both" } },
      ].map(({ side, style }) => (
        <div key={side} className="absolute pointer-events-none" style={{
          ...style,
          background:"linear-gradient(to bottom,transparent,#FFCB0518,#FFCB0530,#FFCB0518,transparent)",
          opacity:0, zIndex:1,
        }} />
      ))}

      {/* Ambient: extra spotlight sweep */}
      {ambient && (
        <div className="absolute pointer-events-none" style={{
          left:"40%",top:"-50%",width:"clamp(60px,10vw,90px)",height:"220%",
          background:"linear-gradient(to bottom,transparent,#FFCB0512,#FFCB0522,transparent)",
          transformOrigin:"top center",
          animation:"spotlight-l 3s ease 0s infinite",
          opacity:0.6, zIndex:1,
        }} />
      )}

      {/* Confetti */}
      {confetti.map((c, i) => (
        <div key={i} className="absolute pointer-events-none" style={{
          left:c.left, top:-16, width:c.width, height:c.height,
          background:c.color, borderRadius:3,
          // @ts-expect-error CSS vars
          "--cr":c.cr, "--cs":c.cs,
          animation: ambient
            ? `confetti-drop ${c.duration}s ease ${c.delay}s infinite`
            : `confetti-drop ${c.duration}s ease ${c.delay}s both`,
          zIndex:2,
        }} />
      ))}

      {/* Trophy emoji */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 3 }}>
        <div style={{
          fontSize: "clamp(50px,12vw,80px)",
          opacity: 0,
          animation: "title-rise-fade 0.5s ease 0.2s both",
          filter: `drop-shadow(0 0 20px ${color})`,
          marginBottom: "clamp(90px,20vh,140px)",
        }}>
          🏆
        </div>
      </div>

      {/* Golden band + title */}
      <div className="absolute inset-x-0 flex items-center justify-center z-10" style={{ top:"50%",transform:"translateY(-50%)" }}>
        <div className="w-full py-6" style={{
          background:`linear-gradient(90deg,transparent,#1a120099,#1a1200cc,#1a120099,transparent)`,
          borderTop:`1px solid ${color}55`,borderBottom:`1px solid ${color}55`,
          boxShadow: ambient ? `0 0 40px ${color}22` : undefined,
          transition: "box-shadow 0.8s ease",
        }}>
          <div style={{ animation:"arena-title-in 0.7s ease 0.4s both" }}>
            <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={ambient} />
          </div>
        </div>
      </div>
    </>
  );
}

// ── COIN RAIN ─────────────────────────────────────────────────────────────────
function CoinRainEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAmbient(true), AMBIENT_AT.COIN_RAIN);
    return () => clearTimeout(t);
  }, []);

  const coins = Array.from({ length: 14 }, (_, i) => ({
    left: `${5 + i * 7}%`, delay: rnd(0, 1),
    emoji: COINS[i % COINS.length], ch: `${rnd(70, 90)}vh`,
    dur: rnd(1.3, 2.2),
  }));

  return (
    <>
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at center,${ambient?"#221400":"#1a1000"},${ambient?"#0f0800":"#080500"})`,
        animation: "entrance-in 0.2s ease forwards", transition: "background 1s ease",
      }} />

      {coins.map((c, i) => (
        <div key={i} className="absolute pointer-events-none select-none" style={{
          left:c.left, top:0, fontSize:"clamp(18px,5vw,28px)",
          // @ts-expect-error CSS vars
          "--ch":c.ch,
          animation: ambient
            ? `coin-fall ${c.dur}s cubic-bezier(.25,.46,.45,.94) ${c.delay * 0.3}s infinite`
            : `coin-fall ${c.dur}s cubic-bezier(.25,.46,.45,.94) ${c.delay}s both`,
          zIndex:2, filter:`drop-shadow(0 0 8px ${color})`,
        }}>{c.emoji}</div>
      ))}

      {/* Golden glow behind title when ambient */}
      {ambient && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
          <div style={{
            width:"min(300px,75vw)",height:"min(100px,20vh)",
            borderRadius:20,
            background:`radial-gradient(ellipse,${color}22,transparent 70%)`,
            animation:"aura-expand 2.5s ease infinite",
          }}/>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ animation:"title-rise-fade 0.6s ease 0.5s both" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={ambient} />
        </div>
      </div>
    </>
  );
}

// ── DIMENSIONAL RIFT ──────────────────────────────────────────────────────────
function DimensionalRiftEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAmbient(true), AMBIENT_AT.DIMENSIONAL_RIFT);
    return () => clearTimeout(t);
  }, []);

  const particles = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * 2 * Math.PI;
    const r = rnd(55, 140);
    return { px:`${Math.cos(angle)*r}px`, py:`${Math.sin(angle)*r}px`, size:rnd(3,9), delay:rnd(0.3,1.2) };
  });

  // Ambient orbital particles
  const orbits = Array.from({ length: 8 }, (_, i) => ({
    size: rnd(2, 5), delay: rnd(0, 2), dur: rnd(2, 4),
    r: rnd(80, 160),
    left: `${rnd(5, 95)}%`, top: `${rnd(5, 95)}%`,
  }));

  return (
    <>
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at center,${ambient?"#160030":"#0d0020"},${ambient?"#060018":"#04000e"})`,
        backdropFilter:"blur(2px)", animation:"entrance-in 0.2s ease forwards", transition:"background 1s ease",
      }} />

      {/* Portal */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex:2 }}>
        <div style={{
          width:"min(280px,68vw)",height:"min(280px,68vw)",
          borderRadius:"50%",
          background:`radial-gradient(ellipse at center,#5500ff99 0%,#8b00ffbb 35%,#4a00e066 60%,transparent 80%)`,
          boxShadow:`0 0 80px #8b00ffaa,0 0 160px #4a00e044,inset 0 0 60px #5500ff44`,
          animation: ambient
            ? "title-glow-breathe 2s ease infinite"
            : "portal-expand 0.8s cubic-bezier(.2,1,.5,1) 0.1s both",
        }}/>
      </div>

      {/* Entry particles */}
      <div className="absolute inset-0 flex items-center justify-center z-3 pointer-events-none">
        {particles.map((p,i) => (
          <div key={i} className="absolute rounded-full" style={{
            width:p.size,height:p.size,background:"#c084fc",boxShadow:"0 0 8px #c084fc, 0 0 16px #c084fc55",
            // @ts-expect-error CSS vars
            "--px":p.px,"--py":p.py,
            animation:"portal-particle 1.4s ease forwards",animationDelay:`${p.delay}s`,opacity:0,
          }}/>
        ))}
      </div>

      {/* Ambient: floating particles */}
      {ambient && orbits.map((o, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{
          left:o.left, top:o.top, width:o.size, height:o.size,
          background:"#c084fc", boxShadow:"0 0 6px #c084fc",
          // @ts-expect-error CSS vars
          "--ex":`${rnd(-60,60)}px`,"--ey":`${rnd(-60,60)}px`,"--er":"0deg",
          animation:`ember-float ${o.dur}s ease ${o.delay}s infinite`, opacity:0,
          zIndex:4,
        }}/>
      ))}

      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ animation:"rift-title-emerge 0.7s cubic-bezier(.2,1,.5,1) 0.8s both" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={ambient}
            nameStyle={{ textShadow:`0 0 30px ${glowColor},0 0 60px #8b00ff99` }} />
        </div>
      </div>
    </>
  );
}

// ── ULTRA RARE REVEAL ─────────────────────────────────────────────────────────
function UltraRareRevealEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const [flipped, setFlipped] = useState(false);
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 700);
    const t2 = setTimeout(() => setAmbient(true), AMBIENT_AT.ULTRA_RARE_REVEAL);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const particles = Array.from({ length: 14 }, (_, i) => ({
    cx:`${rnd(-120,120)}px`,cy:`${rnd(-100,-20)}px`,cr:`${rnd(-220,220)}deg`,
    delay:rnd(0.8,1.6),size:rnd(4,12),col:CONFETTI_COLORS[i%CONFETTI_COLORS.length],
  }));
  const ambientStars = Array.from({ length: 10 }, (_, i) => ({
    left:`${rnd(5,95)}%`,top:`${rnd(5,95)}%`,
    size:rnd(2,6),delay:rnd(0,3),dur:rnd(1.5,3),
  }));

  const cardW = "min(230px,72vw)";
  const cardH = "min(310px,56vh)";

  return (
    <>
      <div className="absolute inset-0" style={{
        background:`radial-gradient(ellipse at center,${ambient?"#0e0e2a":"#0a0a16"},#030308)`,
        animation:"entrance-in 0.2s ease forwards",transition:"background 1.2s ease",
      }}/>

      {/* Ambient star sparkles */}
      {ambient && ambientStars.map((s, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{
          left:s.left,top:s.top,width:s.size,height:s.size,
          background:color,boxShadow:`0 0 8px ${color}`,
          // @ts-expect-error CSS vars
          "--ex":`${rnd(-40,40)}px`,"--ey":`${rnd(-40,40)}px`,"--er":"0deg",
          animation:`ember-float ${s.dur}s ease ${s.delay}s infinite`,opacity:0,zIndex:3,
        }}/>
      ))}

      {/* Card */}
      <div className="absolute inset-0 flex items-center justify-center z-5" style={{ perspective:900 }}>
        <div style={{
          width:cardW,height:cardH,borderRadius:18,transformStyle:"preserve-3d",
          animation:flipped?"card-flip-in 0.6s cubic-bezier(.2,1,.5,1) forwards":undefined,
          transform:flipped?undefined:"perspective(700px) rotateY(185deg) scale(0.8)",
          boxShadow: ambient ? `0 0 60px ${glowColor}, 0 0 120px ${color}44` : undefined,
          transition:"box-shadow 1s ease",
        }}>
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2 overflow-hidden" style={{
            backfaceVisibility:"hidden",
            background:`linear-gradient(135deg,#0d0d2a,#1a0d3e,#0d0d2a)`,
            border:`2px solid ${color}99`,
            boxShadow:`0 0 40px ${glowColor},inset 0 0 30px ${color}15`,
          }}>
            {/* Holo shimmer */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              backgroundImage:`linear-gradient(105deg,transparent 20%,${color}55 38%,#fff8 50%,${color}55 62%,transparent 80%)`,
              backgroundSize:"200% 100%",
              animation: ambient ? "holo-sweep 1.8s ease infinite" : "holo-sweep 1s ease 1.1s 2",
            }}/>
            {/* Stars corner decoration */}
            {["2%","95%"].map((l, i) => (
              <div key={i} className="absolute pointer-events-none" style={{
                left:l,top:"3%",fontSize:"clamp(10px,2vw,14px)",color,
                opacity:0.7,filter:`drop-shadow(0 0 4px ${color})`,
              }}>✦</div>
            ))}
            <p style={{ margin:0,fontSize:"clamp(9px,2vw,12px)",textTransform:"uppercase",letterSpacing:"0.35em",color:`${color}88`,marginBottom:4 }}>
              Ultra Raro
            </p>
            <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={ambient}
              nameStyle={{ fontSize:"clamp(16px,4vw,24px)" }} />
            <p style={{ fontSize:"clamp(14px,3vw,20px)",marginTop:6,filter:`drop-shadow(0 0 8px ${color})` }}>✦ ✦ ✦</p>
          </div>
          <div className="absolute inset-0 rounded-2xl" style={{
            backfaceVisibility:"hidden",transform:"rotateY(180deg)",
            background:"linear-gradient(135deg,#0d1a2e,#1a0d2e)",border:"2px solid #333",
          }}/>
        </div>
      </div>

      {/* Burst particles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        {particles.map((p,i) => (
          <div key={i} className="absolute rounded-sm" style={{
            width:p.size,height:p.size/2,background:p.col,
            // @ts-expect-error CSS vars
            "--cx":p.cx,"--cy":p.cy,"--cr":p.cr,
            animation:"card-particle 1.1s ease forwards",animationDelay:`${p.delay}s`,opacity:0,
          }}/>
        ))}
      </div>
    </>
  );
}

// ── GLITCH HACK ───────────────────────────────────────────────────────────────
function GlitchHackEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const CHARS = "アイウエオカキクケコサシスセソ!@#$%^&*01234ABCXYZ?><[]{}";
  const [displayed, setDisplayed] = useState(() =>
    name.split("").map(() => CHARS[Math.floor(Math.random()*CHARS.length)]).join("")
  );
  const [ambient, setAmbient] = useState(false);
  const iterRef = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      iterRef.current++;
      const progress = iterRef.current / 18;
      setDisplayed(name.split("").map((ch, i) =>
        Math.random() < progress || ch === " " ? ch : CHARS[Math.floor(Math.random()*CHARS.length)]
      ).join(""));
      if (iterRef.current >= 18) clearInterval(interval);
    }, 55);
    const t = setTimeout(() => setAmbient(true), AMBIENT_AT.GLITCH_HACK);
    return () => { clearInterval(interval); clearTimeout(t); };
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="absolute inset-0" style={{ background:ambient?"#01060e":"#000408",animation:"entrance-in 0.1s ease forwards",transition:"background 1s ease" }}/>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:`linear-gradient(transparent 97%,#00ff4418 97%),linear-gradient(90deg,transparent 97%,#00ff4411 97%)`,
        backgroundSize:"clamp(30px,6vw,44px) clamp(30px,6vw,44px)",zIndex:1,
      }}/>
      {/* Scanlines */}
      {[0,1,2].map(i => (
        <div key={i} className="absolute inset-x-0 pointer-events-none" style={{
          height:2,background:"#0ff5",
          animation: ambient ? "scanline-sweep 2.5s ease infinite" : "scanline-sweep 1.2s ease forwards",
          animationDelay:`${i*0.28}s`,zIndex:2,
        }}/>
      ))}
      {/* Glitching text */}
      <div className="absolute inset-0 flex items-center justify-center z-8">
        <p style={{
          fontFamily:"monospace",fontWeight:900,
          fontSize:"clamp(18px,5vw,32px)",
          letterSpacing:"0.12em",textAlign:"center",
          color:"#0ff",
          animation: ambient ? undefined : "glitch-color-shift 0.12s linear 0s 12",
          textShadow:`2px 0 #f0f, -2px 0 #0ff, 0 0 20px ${glowColor}`,
          padding:"0 16px",
          opacity: ambient ? 0 : 1, transition:"opacity 0.4s",
        }}>
          {displayed}
        </p>
      </div>
      {/* Stabilized title */}
      <div className="absolute inset-0 flex items-center justify-center z-10" style={{ opacity:ambient?1:0,transition:"opacity 0.4s" }}>
        <div>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={ambient}
            nameStyle={{ fontFamily:"monospace" }} />
        </div>
      </div>
    </>
  );
}

// ── SLOT MACHINE ──────────────────────────────────────────────────────────────
const SLOT_SYMBOLS = ["⚡","🔥","💎","⭐","🏆","🎴","🌊","✦","🎰","👑"];
const JACKPOT      = ["⚡","⚡","⚡"];

function SlotMachineEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const [slots, setSlots]     = useState(["?","?","?"]);
  const [stopped, setStopped] = useState([false,false,false]);
  const [shaking, setShaking] = useState(false);
  const [ambient, setAmbient] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setSlots(s => s.map((_, i) => stopped[i] ? JACKPOT[i] : SLOT_SYMBOLS[Math.floor(Math.random()*SLOT_SYMBOLS.length)]));
    }, 75);
    const t1 = setTimeout(() => setStopped([true,false,false]), 900);
    const t2 = setTimeout(() => setStopped([true,true,false]), 1200);
    const t3 = setTimeout(() => { setStopped([true,true,true]); setShaking(true); }, 1500);
    const t4 = setTimeout(() => setShaking(false), 1900);
    const t5 = setTimeout(() => setAmbient(true), AMBIENT_AT.SLOT_MACHINE);
    return () => { clearInterval(iv); [t1,t2,t3,t4,t5].forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const slotSize = "min(64px,17vw)";

  return (
    <>
      <div className="absolute inset-0" style={{
        background:`radial-gradient(ellipse at center,${ambient?"#14082a":"#0d0818"},#05030c)`,
        animation:"entrance-in 0.2s ease forwards",transition:"background 1s ease",
      }}>
        <div className="absolute inset-4 rounded-2xl pointer-events-none" style={{
          border:`2px solid ${color}${ambient?"66":"44"}`,
          boxShadow:`inset 0 0 50px ${color}${ambient?"18":"11"},0 0 30px ${color}${ambient?"33":"22"}`,
          transition:"all 0.8s ease",
        }}/>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center z-5 gap-6">
        {/* Slots */}
        <div className="flex gap-3">
          {slots.map((sym, i) => (
            <div key={i} className="flex items-center justify-center rounded-xl" style={{
              width:slotSize,height:slotSize,background:"#0a0820",
              border:`2px solid ${stopped[i]?color:"#444"}`,
              boxShadow: stopped[i] ? `0 0 20px ${glowColor},inset 0 0 10px ${color}22` : undefined,
              fontSize:"clamp(22px,5.5vw,30px)",
              transition:"border-color 0.25s,box-shadow 0.25s",
              animation:shaking?"slot-shake 0.35s ease":undefined,
            }}>{sym}</div>
          ))}
        </div>

        {/* Jackpot flash */}
        {stopped[2] && <div className="absolute inset-0 pointer-events-none rounded" style={{ background:color,animation:"entrance-out 0.35s ease 0.05s both",zIndex:20 }}/>}

        {/* Title + flavor */}
        <div style={{ opacity:stopped[2]?undefined:0,animation:stopped[2]?"title-rise-fade 0.5s ease 0.2s both":undefined,textAlign:"center" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={ambient} />
        </div>
      </div>

      {/* Ambient: floating sparks */}
      {ambient && <FloatingSparks color={color} count={10} />}
    </>
  );
}

// ── ELEMENTAL AURA ────────────────────────────────────────────────────────────
const AURA_THEMES: Record<string,{bg:string;particle:string;label:string;ambientBg:string}> = {
  ELECTRIC:{ bg:"radial-gradient(ellipse,#0a0f20,#020510)",     ambientBg:"radial-gradient(ellipse,#0d1530,#030814)", particle:"#FFCB05", label:"⚡" },
  FIRE:    { bg:"radial-gradient(ellipse,#1a0600,#080200)",     ambientBg:"radial-gradient(ellipse,#250800,#0c0300)", particle:"#f97316", label:"🔥" },
  WATER:   { bg:"radial-gradient(ellipse,#001a20,#000810)",     ambientBg:"radial-gradient(ellipse,#002030,#001018)", particle:"#38bdf8", label:"🌊" },
  GRASS:   { bg:"radial-gradient(ellipse,#001a06,#000802)",     ambientBg:"radial-gradient(ellipse,#002008,#000d03)", particle:"#4ade80", label:"🌿" },
  ZIKABET: { bg:"radial-gradient(ellipse,#14001a,#060008)",     ambientBg:"radial-gradient(ellipse,#1e0028,#0a000e)", particle:"#c084fc", label:"🎰" },
  NEUTRAL: { bg:"radial-gradient(ellipse,#0a0820,#030310)",     ambientBg:"radial-gradient(ellipse,#10102a,#060618)", particle:"#FFCB05", label:"✦" },
};

function ElementalAuraEffect({ name, color, glowColor, flavorText, rarity, theme }: EffectProps) {
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAmbient(true), AMBIENT_AT.ELEMENTAL_AURA);
    return () => clearTimeout(t);
  }, []);

  const aura = AURA_THEMES[theme ?? "NEUTRAL"] ?? AURA_THEMES.NEUTRAL;
  const embers = Array.from({ length: 18 }, (_, i) => {
    const angle = (i/18)*2*Math.PI;
    const r = rnd(40, 130);
    return { ex:`${Math.cos(angle)*r+rnd(-15,15)}px`,ey:`${-Math.abs(Math.sin(angle))*r-20}px`,er:`${rnd(-180,180)}deg`,size:rnd(4,11),delay:rnd(0,0.9) };
  });
  const ambientEmbers = Array.from({ length: 14 }, (_, i) => ({
    left:`${rnd(5,95)}%`,top:`${rnd(5,95)}%`,
    size:rnd(3,8),delay:rnd(0,3),dur:rnd(1.8,4),
  }));

  return (
    <>
      <div className="absolute inset-0" style={{
        background: ambient ? aura.ambientBg : aura.bg,
        animation:"entrance-in 0.2s ease forwards",transition:"background 1.5s ease",
      }}/>

      {/* Aura rings */}
      {[0,1,2].map(i => (
        <div key={i} className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex:1 }}>
          <div style={{
            width:`min(${180+i*110}px,${45+i*20}vw)`,height:`min(${180+i*110}px,${45+i*20}vw)`,
            borderRadius:"50%",
            border:`${2-i*0.5}px solid ${aura.particle}${["77","44","22"][i]}`,
            boxShadow:`0 0 ${25+i*15}px ${aura.particle}${["44","22","11"][i]}`,
            animation: ambient
              ? `title-glow-breathe ${2+i*0.5}s ease ${i*0.3}s infinite`
              : "aura-expand 1.5s ease forwards",
            animationDelay: ambient ? `${i*0.3}s` : `${i*0.2}s`,
            opacity: ambient ? 0.6 : 0,
          }}/>
        </div>
      ))}

      {/* Entry embers */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-2">
        {embers.map((e,i) => (
          <div key={i} className="absolute rounded-full" style={{
            width:e.size,height:e.size,background:aura.particle,boxShadow:`0 0 10px ${aura.particle}`,
            // @ts-expect-error CSS vars
            "--ex":e.ex,"--ey":e.ey,"--er":e.er,
            animation:"ember-float 1.3s ease forwards",animationDelay:`${e.delay}s`,opacity:0,
          }}/>
        ))}
      </div>

      {/* Ambient embers */}
      {ambient && ambientEmbers.map((e, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{
          left:e.left,top:e.top,width:e.size,height:e.size,
          background:aura.particle,boxShadow:`0 0 8px ${aura.particle}`,
          // @ts-expect-error CSS vars
          "--ex":`${rnd(-50,50)}px`,"--ey":`${rnd(-60,-10)}px`,"--er":0,
          animation:`ember-float ${e.dur}s ease ${e.delay}s infinite`,opacity:0,zIndex:4,
        }}/>
      ))}

      {/* Theme emoji */}
      <div className="absolute inset-0 flex items-center justify-center z-3 pointer-events-none" style={{
        fontSize:"clamp(50px,15vw,90px)",
        animation: ambient ? "title-glow-breathe 3s ease infinite" : "aura-expand 1.8s ease 0.1s both",
        opacity:0,
        filter:`blur(${ambient?1:2}px) drop-shadow(0 0 25px ${aura.particle})`,
        marginBottom:"clamp(100px,22vh,150px)",
      }}>
        {aura.label}
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ animation:"title-rise-fade 0.6s ease 0.5s both" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={ambient}
            nameStyle={{ textShadow:`0 0 25px ${glowColor},0 0 55px ${aura.particle}88` }} />
        </div>
      </div>
    </>
  );
}

// ── MIAUVADÃO SEAL ────────────────────────────────────────────────────────────
function MiauvadaoSealEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAmbient(true), AMBIENT_AT.MIAUVADAO_SEAL);
    return () => clearTimeout(t);
  }, []);

  const tickets = Array.from({ length: 10 }, (_, i) => ({
    tx:`${rnd(-180,180)}px`,ty:`${rnd(-50,50)}px`,tr:`${rnd(-55,55)}deg`,
    delay:rnd(0.5,1.1),emoji:i%3===0?"🎟️":i%3===1?"🪙":"⭐",size:rnd(18,30),
  }));

  return (
    <>
      <div className="absolute inset-0" style={{
        background:`radial-gradient(ellipse at center,${ambient?"#180020":"#12001a"},#060008)`,
        animation:"entrance-in 0.15s ease forwards",transition:"background 1s ease",
      }}/>

      {/* Neon border ambient */}
      {ambient && (
        <div className="absolute inset-3 rounded-2xl pointer-events-none" style={{
          border:`2px solid ${color}44`,
          boxShadow:`0 0 30px ${color}22,inset 0 0 30px ${color}11`,
          animation:"title-glow-breathe 2s ease infinite",
          zIndex:1,
        }}/>
      )}

      {/* STAMP — upper third, never overlaps title */}
      <div className="absolute inset-x-0 flex justify-center pointer-events-none z-5" style={{ top:"18%" }}>
        <div style={{
          fontSize:"clamp(32px,9vw,68px)",fontWeight:900,
          color:"#22c55e",border:"clamp(4px,1vw,6px) solid #22c55e",
          padding:"4px clamp(14px,4vw,24px)",borderRadius:8,
          textTransform:"uppercase",letterSpacing:"0.12em",
          animation:"seal-stamp 0.6s cubic-bezier(.36,.07,.19,.97) 0.1s both",
          textShadow:"0 0 40px #22c55eaa",
          boxShadow:`0 0 40px #22c55e44,inset 0 0 20px #22c55e11`,
        }}>
          Aprovado
        </div>
      </div>

      {/* Flying tickets — mid screen */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-6">
        {tickets.map((t, i) => (
          <div key={i} className="absolute select-none" style={{
            fontSize:t.size,
            // @ts-expect-error CSS vars
            "--tx":t.tx,"--ty":t.ty,"--tr":t.tr,
            animation:"ticket-fly 0.9s ease forwards",animationDelay:`${t.delay}s`,opacity:0,
          }}>{t.emoji}</div>
        ))}
      </div>

      {/* TITLE — lower third, well separated from stamp */}
      <div className="absolute inset-x-0 flex justify-center z-10" style={{ bottom:"18%" }}>
        <div style={{ animation:"title-rise-fade 0.6s ease 0.8s both",textAlign:"center" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} rarity={rarity} ambient={ambient}
            nameStyle={{ textShadow:`0 0 25px ${glowColor},0 0 55px ${glowColor}` }} />
        </div>
      </div>

      {/* Ambient sparks */}
      {ambient && <FloatingSparks color={color} count={8} />}
    </>
  );
}

// ── Portal principal ──────────────────────────────────────────────────────────
export function TitleEntrance({ name, rarity, theme, effect, color, glowColor, flavorText, onComplete }: TitleEntranceProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const hasPlayed  = useRef(false);
  const stableDone = useCallback(onComplete, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasPlayed.current || effect === "NONE") return;
    hasPlayed.current = true;
    setMounted(true);

    const total  = DURATION[effect] ?? 2400;
    const fadeAt = total - FADE_MS;

    const tFade = setTimeout(() => setVisible(false), fadeAt);
    const tDone = setTimeout(() => stableDone(), total);
    return () => { clearTimeout(tFade); clearTimeout(tDone); };
  }, [effect, stableDone]);

  if (!mounted || typeof document === "undefined") return null;

  const props: EffectProps = { name, color, glowColor, flavorText, theme, rarity };

  const content = (
    <div className="fixed inset-0 overflow-hidden" style={{
      zIndex: 99999, pointerEvents: "none",
      opacity: visible ? 1 : 0,
      transition: `opacity ${FADE_MS}ms ease`,
    }}>
      {effect === "LIGHTNING_STRIKE"  && <LightningStrikeEffect  {...props}/>}
      {effect === "BOSS_ALERT"        && <BossAlertEffect        {...props}/>}
      {effect === "CHAMPION_ARENA"    && <ChampionArenaEffect    {...props}/>}
      {effect === "COIN_RAIN"         && <CoinRainEffect         {...props}/>}
      {effect === "DIMENSIONAL_RIFT"  && <DimensionalRiftEffect  {...props}/>}
      {effect === "ULTRA_RARE_REVEAL" && <UltraRareRevealEffect  {...props}/>}
      {effect === "GLITCH_HACK"       && <GlitchHackEffect       {...props}/>}
      {effect === "SLOT_MACHINE"      && <SlotMachineEffect      {...props}/>}
      {effect === "ELEMENTAL_AURA"    && <ElementalAuraEffect    {...props}/>}
      {effect === "MIAUVADAO_SEAL"    && <MiauvadaoSealEffect    {...props}/>}
    </div>
  );

  return createPortal(content, document.body);
}
