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
  | "GLITCH_HACK" | "SLOT_MACHINE" | "ELEMENTAL_AURA" | "MIAUVADAO_SEAL"
  | "PILAR_DA_COMUNIDADE"
  | "ORDER_SHADOW_MARK" | "ORDER_PURPLE_SMOKE" | "ORDER_GLITCH_HEIST" | "ORDER_CAPTAIN_SEAL"
  | "RAID_BOSS_FLARE" | "MEGA_AWAKENING" | "TREASURE_BURST" | "STARRY_CROWN";

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
  MIAUVADAO_SEAL:     4600,
  PILAR_DA_COMUNIDADE: 7200,
  ORDER_SHADOW_MARK:  5200,
  ORDER_PURPLE_SMOKE: 5200,
  ORDER_GLITCH_HEIST: 4800,
  ORDER_CAPTAIN_SEAL: 5400,
  RAID_BOSS_FLARE:    5200,
  MEGA_AWAKENING:     5600,
  TREASURE_BURST:     5000,
  STARRY_CROWN:       5200,
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
  MIAUVADAO_SEAL:     1100,
  PILAR_DA_COMUNIDADE: 2200,
  ORDER_SHADOW_MARK:  1200,
  ORDER_PURPLE_SMOKE: 1200,
  ORDER_GLITCH_HEIST: 1100,
  ORDER_CAPTAIN_SEAL: 1400,
  RAID_BOSS_FLARE:    1200,
  MEGA_AWAKENING:     1400,
  TREASURE_BURST:     1000,
  STARRY_CROWN:       1300,
};

const FADE_MS = 700;

// ── Helpers ───────────────────────────────────────────────────────────────────
const COINS           = ["🪙","🪙","⭐","🪙","✨","🪙","💰","🪙"];
const CONFETTI_COLORS = ["#FFCB05","#f97316","#c084fc","#60a5fa","#4ade80","#fb923c","#fff","#fbbf24"];

function rnd(min: number, max: number) { return Math.random() * (max - min) + min; }

const CINEMATIC_THEME_ACCENT: Record<string, { accent: string; overlay: string }> = {
  ELECTRIC: { accent: "#facc15", overlay: "linear-gradient(115deg, transparent 0 44%, #facc1533 45% 47%, transparent 48% 100%)" },
  FIRE: { accent: "#fb923c", overlay: "radial-gradient(circle at 20% 80%, #ef444455 0%, transparent 42%)" },
  WATER: { accent: "#38bdf8", overlay: "repeating-linear-gradient(135deg, transparent 0 22px, #38bdf822 23px 26px)" },
  GRASS: { accent: "#4ade80", overlay: "radial-gradient(circle at 80% 20%, #4ade8033 0%, transparent 38%)" },
  ZIKABET: { accent: "#fbbf24", overlay: "repeating-conic-gradient(from 0deg, #fbbf2422 0deg 12deg, transparent 13deg 40deg)" },
  SHADOW: { accent: "#a855f7", overlay: "radial-gradient(circle at 50% 50%, #02061700 0%, #02061766 58%, #000 100%)" },
  ROYAL: { accent: "#fde68a", overlay: "linear-gradient(90deg, transparent, #fde68a22, transparent)" },
  TOXIC: { accent: "#bef264", overlay: "radial-gradient(circle at 30% 40%, #84cc1644 0%, transparent 36%)" },
  COSMIC: { accent: "#c4b5fd", overlay: "radial-gradient(circle at 18% 25%, #fff 0 1px, transparent 2px), radial-gradient(circle at 75% 42%, #c4b5fd 0 2px, transparent 3px)" },
  STEEL: { accent: "#cbd5e1", overlay: "linear-gradient(135deg, #ffffff18 0 8%, transparent 9% 22%, #94a3b822 23% 30%, transparent 31%)" },
  FAIRY: { accent: "#f9a8d4", overlay: "radial-gradient(circle at 70% 28%, #f9a8d455 0%, transparent 34%)" },
  DRAGON: { accent: "#f97316", overlay: "repeating-linear-gradient(60deg, transparent 0 30px, #7c3aed33 31px 35px)" },
  GHOST: { accent: "#c084fc", overlay: "radial-gradient(ellipse at 50% 60%, #c084fc33 0%, transparent 48%)" },
};

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

// ── PILAR DA COMUNIDADE ───────────────────────────────────────────────────────
function PilarDaComunidadeEffect({ name, color, glowColor, flavorText, rarity }: EffectProps) {
  const [phase, setPhase] = useState<"entry"|"reveal"|"ambient">("entry");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 800);
    const t2 = setTimeout(() => setPhase("ambient"), AMBIENT_AT.PILAR_DA_COMUNIDADE);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const ambient = phase === "ambient";

  // 9 pilares de alturas variadas
  const pillars = [
    { x: 4,  h: 42, w: 2, gold: false, delay: 0.05 },
    { x: 13, h: 58, w: 2, gold: false, delay: 0.12 },
    { x: 24, h: 70, w: 3, gold: false, delay: 0.20 },
    { x: 35, h: 82, w: 3, gold: false, delay: 0.28 },
    { x: 50, h: 100,w: 7, gold: true,  delay: 0.10 },
    { x: 65, h: 82, w: 3, gold: false, delay: 0.28 },
    { x: 76, h: 70, w: 3, gold: false, delay: 0.20 },
    { x: 87, h: 58, w: 2, gold: false, delay: 0.12 },
    { x: 96, h: 42, w: 2, gold: false, delay: 0.05 },
  ];

  // 36 estrelas caindo — dois tipos de velocidade
  const stars = Array.from({ length: 36 }, (_, i) => ({
    x: rnd(1, 99),
    delay: rnd(0, 2.5),
    dur: rnd(1.6, 3.2),
    size: rnd(10, 24),
    char: ["⭐","✨","💫","🌟","⭐","✨"][i % 6],
    fast: i % 3 === 0,
  }));

  // Partículas orbitais que emergem do centro
  const orbParticles = Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * 2 * Math.PI;
    const r = rnd(80, 200);
    return {
      px: `${Math.cos(angle) * r}px`,
      py: `${Math.sin(angle) * r}px`,
      size: rnd(3, 8),
      delay: 0.3 + rnd(0, 0.7),
      gold: i % 3 === 0,
    };
  });

  // Raios de luz que irradiam do centro
  const beams = Array.from({ length: 8 }, (_, i) => ({
    angle: i * 45,
    delay: 0.2 + i * 0.06,
    length: rnd(120, 220),
    width: rnd(1, 3),
  }));

  // Anéis de sonar
  const rings = [
    { size: 160, delay: 0.05, dur: 1.6 },
    { size: 260, delay: 0.25, dur: 1.8 },
    { size: 380, delay: 0.45, dur: 2.0 },
    { size: 500, delay: 0.65, dur: 2.2 },
  ];

  return (
    <>
      {/* Background — cosmos profundo com névoa */}
      <div className="absolute inset-0" style={{
        background: ambient
          ? "radial-gradient(ellipse at 50% 55%, #2a0e50 0%, #160830 35%, #080318 65%, #000 100%)"
          : "radial-gradient(ellipse at 50% 55%, #120628 0%, #070215 100%)",
        animation: "entrance-in 0.18s ease forwards",
        transition: "background 2s ease",
      }} />

      {/* Nebulosa sutil no fundo */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 30% 30%, #4a00aa18 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, #FFCB0508 0%, transparent 50%)",
        zIndex: 1,
        opacity: ambient ? 1 : 0,
        transition: "opacity 2s ease",
      }} />

      {/* Sonar rings do centro */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
        {rings.map((r, i) => (
          <div key={i} style={{
            position: "absolute",
            width: r.size, height: r.size,
            borderRadius: "50%",
            border: `1px solid ${i === 0 ? "#FFCB05" : "#c084fc"}${["99","66","44","22"][i]}`,
            boxShadow: `0 0 ${15 + i * 8}px ${i === 0 ? "#FFCB05" : "#c084fc"}${["44","33","22","11"][i]}`,
            animation: `pilar-ring-pulse ${r.dur}s ease-out ${r.delay}s both`,
            opacity: 0,
          }} />
        ))}
      </div>

      {/* Raios de luz emanando do centro */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 3 }}>
        {beams.map((b, i) => (
          <div key={i} style={{
            position: "absolute",
            width: b.width,
            height: b.length,
            background: `linear-gradient(to top, ${i % 2 === 0 ? "#FFCB05" : "#c084fc"}, transparent)`,
            borderRadius: 4,
            transformOrigin: "bottom center",
            transform: `rotate(${b.angle}deg) translateY(-${b.length / 2}px)`,
            animation: `pilar-beam-in 0.8s ease ${b.delay}s both`,
            opacity: 0,
          }} />
        ))}
      </div>

      {/* Pilares dourados e roxos */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "75%", zIndex: 4 }}>
        {pillars.map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${p.x}%`,
            bottom: 0,
            width: p.w,
            height: `${p.h}%`,
            background: p.gold
              ? `linear-gradient(to top, #FFCB05ee, #fbbf24cc, #fef08a44, transparent)`
              : `linear-gradient(to top, #c084fccc, #a855f788, #7c3aed33, transparent)`,
            borderRadius: `${p.w}px ${p.w}px 0 0`,
            animation: `pilar-rise 1.4s ${p.delay}s cubic-bezier(.16,1,.3,1) both`,
            boxShadow: p.gold
              ? `0 0 ${p.w * 5}px #FFCB0588, 0 0 ${p.w * 12}px #FFCB0533`
              : `0 0 8px #c084fc66`,
            opacity: 0,
          }}>
            {/* Topo do pilar central tem uma "chama" */}
            {p.gold && phase !== "entry" && (
              <div style={{
                position: "absolute",
                top: -16,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 18,
                animation: "pilar-float 1.2s ease infinite",
                filter: "drop-shadow(0 0 8px #FFCB05)",
              }}>✦</div>
            )}
          </div>
        ))}
      </div>

      {/* Partículas orbitais que explodem do centro */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
        {orbParticles.map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            width: p.size, height: p.size,
            borderRadius: "50%",
            background: p.gold ? "#FFCB05" : "#c084fc",
            boxShadow: `0 0 10px ${p.gold ? "#FFCB05" : "#c084fc"}, 0 0 20px ${p.gold ? "#FFCB0588" : "#c084fc66"}`,
            // @ts-expect-error CSS vars
            "--px": p.px, "--py": p.py,
            animation: "portal-particle 1.6s ease forwards",
            animationDelay: `${p.delay}s`,
            opacity: 0,
          }} />
        ))}
      </div>

      {/* Estrelas caindo em duas ondas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 6 }}>
        {stars.map((s, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${s.x}%`,
            top: "-8%",
            fontSize: s.size,
            filter: s.fast ? `drop-shadow(0 0 6px #FFCB05)` : undefined,
            animation: `pilar-star-fall ${s.dur}s ${s.delay}s ease-in ${ambient ? "infinite" : "forwards"}`,
          }}>
            {s.char}
          </div>
        ))}
      </div>

      {/* Crystal shards fanout — fase ambient */}
      {ambient && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 7 }}>
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: rnd(1, 4),
              height: rnd(40, 110),
              background: `linear-gradient(to top, ${i % 2 === 0 ? "#FFCB05cc" : "#c084fccc"}, transparent)`,
              borderRadius: 3,
              transformOrigin: "bottom center",
              transform: `rotate(${i * 22.5}deg) translateY(-90px)`,
              animation: `pilar-shard-in 0.6s ease ${i * 0.04}s both`,
              opacity: 0,
            }} />
          ))}
        </div>
      )}

      {/* Coroa que desce para pousar sobre o selo */}
      {phase !== "entry" && (
        <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: "9%", zIndex: 9 }}>
          <div style={{
            fontSize: "clamp(28px, 6vw, 48px)",
            animation: "pilar-crown-drop 0.9s cubic-bezier(.22,1.5,.36,1) 0.6s both",
            filter: "drop-shadow(0 0 16px #FFCB05) drop-shadow(0 0 32px #FFCB0577)",
            opacity: 0,
          }}>
            👑
          </div>
        </div>
      )}

      {/* Selo "Pilar da Comunidade" */}
      <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: "20%", zIndex: 9 }}>
        <div style={{
          fontSize: "clamp(10px, 2.2vw, 14px)",
          fontWeight: 900,
          color: "#FFCB05",
          border: "2px solid #FFCB0588",
          padding: "6px clamp(16px, 4vw, 28px)",
          borderRadius: 6,
          textTransform: "uppercase",
          letterSpacing: "0.4em",
          boxShadow: ambient
            ? "0 0 40px #FFCB0566, 0 0 80px #FFCB0522, inset 0 0 20px #FFCB0511"
            : "0 0 30px #FFCB0533",
          animation: "seal-stamp 0.8s cubic-bezier(.36,.07,.19,.97) 0.8s both",
          textShadow: "0 0 24px #FFCB05cc",
          background: "linear-gradient(135deg, #FFCB050d, #c084fc08)",
          transition: "box-shadow 1s ease",
        }}>
          Pilar da Comunidade
        </div>
      </div>

      {/* Separador decorativo — sem transform inline (evita artefato de linha) */}
      {phase !== "entry" && (
        <div className="absolute inset-x-0 flex justify-center items-center gap-3 pointer-events-none" style={{
          top: "36%", zIndex: 9,
          animation: "pilar-sep-in 0.7s ease 1.1s both",
          opacity: 0,
        }}>
          <span style={{ color: "#c084fc77", fontSize: 8 }}>◆</span>
          <span style={{ color: "#FFCB05", fontSize: 16, filter: "drop-shadow(0 0 10px #FFCB05) drop-shadow(0 0 22px #FFCB0566)" }}>✦</span>
          <span style={{ color: "#c084fc77", fontSize: 8 }}>◆</span>
        </div>
      )}

      {/* Título centralizado */}
      <div className="absolute inset-0 flex items-center justify-center z-10" style={{ marginTop: "6%" }}>
        <div style={{ animation: "pilar-title-emerge 0.9s cubic-bezier(.16,1,.3,1) 1.2s both", textAlign: "center", opacity: 0 }}>
          <TitleBlock
            name={name} color={color} glowColor={glowColor}
            flavorText={flavorText} rarity={rarity} ambient={ambient}
            nameStyle={{
              textShadow: `0 0 30px ${glowColor}, 0 0 80px ${glowColor}88, 0 0 120px #FFCB0544`,
              fontSize: "clamp(24px, 6vw, 42px)",
            }}
          />
        </div>
      </div>

      {/* Emojis flutuando — sempre montados, aparecem via opacity para evitar pop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
        {["💛", "⚡", "🌟", "💛", "✨", "💜", "⭐", "💫"].map((ch, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${8 + i * 12}%`,
            bottom: "8%",
            fontSize: 16 + (i % 4) * 5,
            opacity: ambient ? 1 : 0,
            transition: `opacity 0.5s ease ${i * 0.1}s`,
            animation: ambient ? `pilar-float ${1.8 + (i % 3) * 0.4}s ${i * 0.25}s ease-in-out infinite` : undefined,
            filter: "drop-shadow(0 0 6px #FFCB05)",
          }}>
            {ch}
          </div>
        ))}
      </div>

      {/* Partículas de poeira dourada no ambient */}
      {ambient && Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{
          left: `${rnd(5, 95)}%`,
          top: `${rnd(5, 95)}%`,
          width: rnd(2, 5), height: rnd(2, 5),
          background: i % 2 === 0 ? "#FFCB05" : "#c084fc",
          boxShadow: `0 0 8px ${i % 2 === 0 ? "#FFCB05" : "#c084fc"}`,
          // @ts-expect-error CSS vars
          "--ex": `${rnd(-40, 40)}px`, "--ey": `${rnd(-50, -10)}px`, "--er": "0deg",
          animation: `ember-float ${rnd(2, 4)}s ease ${rnd(0, 2)}s infinite`,
          opacity: 0, zIndex: 5,
        }} />
      ))}

      <style>{`
        @keyframes pilar-rise {
          0%   { transform: scaleY(0); transform-origin: bottom; opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
        }
        @keyframes pilar-ring-pulse {
          0%   { opacity: 0; transform: scale(0.2); }
          30%  { opacity: 0.9; }
          100% { opacity: 0; transform: scale(1.8); }
        }
        @keyframes pilar-beam-in {
          0%   { opacity: 0; transform: rotate(var(--rot, 0deg)) translateY(var(--ty, 0px)) scaleY(0); }
          40%  { opacity: 0.6; }
          100% { opacity: 0.2; transform: rotate(var(--rot, 0deg)) translateY(var(--ty, 0px)) scaleY(1); }
        }
        @keyframes pilar-star-fall {
          0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          70%  { opacity: 0.8; }
          100% { transform: translateY(115vh) rotate(540deg) scale(0.5); opacity: 0; }
        }
        @keyframes pilar-shard-in {
          0%   { opacity: 0; transform: rotate(calc(var(--i, 0) * 22.5deg)) translateY(-90px) scaleY(0); }
          100% { opacity: 0.75; transform: rotate(calc(var(--i, 0) * 22.5deg)) translateY(-90px) scaleY(1); }
        }
        @keyframes pilar-float {
          0%   { transform: translateY(0) scale(1); opacity: 0.9; }
          50%  { transform: translateY(-18px) scale(1.1); opacity: 1; }
          100% { transform: translateY(-140px) scale(0.6); opacity: 0; }
        }
        @keyframes pilar-crown-drop {
          0%   { opacity: 0; transform: translateY(-60px) scale(0.4) rotate(-15deg); }
          60%  { transform: translateY(8px) scale(1.15) rotate(5deg); }
          80%  { transform: translateY(-4px) scale(0.95) rotate(-2deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        @keyframes pilar-sep-in {
          0%   { opacity: 0; transform: scale(0.3); }
          60%  { transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pilar-title-emerge {
          0%   { opacity: 0; transform: translateY(24px) scale(0.88); }
          60%  { transform: translateY(-4px) scale(1.03); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

const SPECIAL_EFFECT_CFG: Record<string, {
  tag: string;
  accent: string;
  bg: string;
  symbol: string;
  particles: string[];
  motif: "shadow" | "smoke" | "glitch" | "seal" | "raid" | "mega" | "treasure" | "star";
  ring: "circle" | "diamond" | "scan" | "stamp" | "hex";
  pulse: string;
}> = {
  ORDER_SHADOW_MARK: {
    tag: "Marca da Ordem", accent: "#a855f7", symbol: "T",
    bg: "radial-gradient(circle at 50% 38%,#581c87 0%,#190026 45%,#020008 100%)",
    particles: ["?", "T", "OLHO", "!", "T", "?"],
    motif: "shadow", ring: "diamond", pulse: "cinematic-shadow-pulse",
  },
  ORDER_PURPLE_SMOKE: {
    tag: "Fumaca Roxa", accent: "#d946ef", symbol: "~",
    bg: "radial-gradient(circle at 45% 55%,#701a75 0%,#2e0644 45%,#03000a 100%)",
    particles: ["~", "fumaca", "~", "?", "~", "+"],
    motif: "smoke", ring: "circle", pulse: "cinematic-smoke-pulse",
  },
  ORDER_GLITCH_HEIST: {
    tag: "Roubo Glitchado", accent: "#22d3ee", symbol: "404",
    bg: "linear-gradient(135deg,#020617 0%,#071827 42%,#2e1065 100%)",
    particles: ["404", "$", "ERR", "0x", "PIX", "?"],
    motif: "glitch", ring: "scan", pulse: "cinematic-glitch-pulse",
  },
  ORDER_CAPTAIN_SEAL: {
    tag: "Selo do Capitao", accent: "#facc15", symbol: "TRAPACA",
    bg: "radial-gradient(circle at 50% 45%,#713f12 0%,#2b0918 44%,#020008 100%)",
    particles: ["SELO", "T", "Z", "*", "OK", "+"],
    motif: "seal", ring: "stamp", pulse: "cinematic-seal-pulse",
  },
  RAID_BOSS_FLARE: {
    tag: "Alerta de Raid", accent: "#ef4444", symbol: "!",
    bg: "radial-gradient(circle at 50% 55%,#7f1d1d 0%,#111827 50%,#020617 100%)",
    particles: ["!", "X", "!", "#", "!", "X"],
    motif: "raid", ring: "hex", pulse: "cinematic-raid-pulse",
  },
  MEGA_AWAKENING: {
    tag: "Mega Despertar", accent: "#f472b6", symbol: "<>",
    bg: "radial-gradient(circle at 50% 48%,#9d174d 0%,#4c1d95 42%,#020617 100%)",
    particles: ["◇", "^", "+", "◆", "◇", "+"],
    motif: "mega", ring: "hex", pulse: "cinematic-mega-pulse",
  },
  TREASURE_BURST: {
    tag: "Explosao de Espolios", accent: "#fbbf24", symbol: "ZC",
    bg: "radial-gradient(circle at 50% 55%,#92400e 0%,#1f2937 48%,#020617 100%)",
    particles: ["ZC", "$", "✦", "ZC", "+", "$"],
    motif: "treasure", ring: "circle", pulse: "cinematic-treasure-pulse",
  },
  STARRY_CROWN: {
    tag: "Coroa Estelar", accent: "#fde68a", symbol: "CROWN",
    bg: "radial-gradient(circle at 50% 45%,#312e81 0%,#111827 48%,#020617 100%)",
    particles: ["✦", "+", "C", "^", "✧", "+"],
    motif: "star", ring: "circle", pulse: "cinematic-star-pulse",
  },
};

function CinematicTitleEffect({ name, color, glowColor, flavorText, rarity, theme, effect }: EffectProps & { effect: string }) {
  const [ambient, setAmbient] = useState(false);
  const cfg = SPECIAL_EFFECT_CFG[effect] ?? SPECIAL_EFFECT_CFG.STARRY_CROWN;
  const themeAccent = CINEMATIC_THEME_ACCENT[theme ?? "NEUTRAL"];
  const accent = themeAccent?.accent ?? cfg.accent;
  const overlay = themeAccent?.overlay;
  useEffect(() => {
    const t = setTimeout(() => setAmbient(true), AMBIENT_AT[effect] ?? 1200);
    return () => clearTimeout(t);
  }, [effect]);

  const particles = Array.from({ length: 28 }, (_, i) => ({
    x: `${rnd(4, 96)}%`,
    y: `${rnd(8, 92)}%`,
    size: rnd(10, 24),
    char: cfg.particles[i % cfg.particles.length],
    delay: rnd(0, 1.8),
    dur: rnd(1.8, 3.8),
    tx: `${rnd(-60, 60)}px`,
    ty: `${rnd(-90, 30)}px`,
    rot: `${rnd(-180, 180)}deg`,
  }));

  const ringBorderRadius = cfg.ring === "diamond"
    ? "18%"
    : cfg.ring === "stamp"
      ? "22px"
      : cfg.ring === "hex"
        ? "28%"
        : "50%";
  const ringRotation = cfg.ring === "diamond" ? "45deg" : cfg.ring === "stamp" ? "-3deg" : "0deg";

  return (
    <>
      <div className="absolute inset-0" style={{ background: cfg.bg, animation: "entrance-in 0.18s ease forwards" }} />
      {overlay && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: overlay,
          mixBlendMode: "screen",
          opacity: 0.7,
          zIndex: 1,
        }} />
      )}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
        {cfg.motif === "shadow" && (
          <>
            <div style={{
              position: "absolute", inset: "8% 18%", opacity: 0.4,
              background: `repeating-conic-gradient(from 18deg, transparent 0deg 18deg, ${accent}44 19deg 20deg, transparent 21deg 36deg)`,
              filter: "blur(1px)", animation: "cinematic-slow-spin 8s linear infinite",
            }} />
            <div style={{
              position: "absolute", left: "50%", top: "38%", width: 260, height: 130,
              transform: "translate(-50%,-50%)", borderRadius: "50%",
              background: `radial-gradient(ellipse at center, ${accent}66 0%, ${accent}22 34%, transparent 68%)`,
              boxShadow: `0 0 60px ${accent}77`,
              animation: "cinematic-eye-open 1.1s ease .25s both",
            }} />
          </>
        )}
        {cfg.motif === "smoke" && [0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${10 + i * 18}%`,
            top: `${18 + (i % 2) * 24}%`,
            width: 220 + i * 24,
            height: 150 + i * 18,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${accent}${["44", "33", "55", "22", "44"][i]} 0%, transparent 67%)`,
            filter: "blur(18px)",
            animation: `cinematic-smoke-drift ${5 + i * 0.7}s ease-in-out ${i * 0.25}s infinite`,
          }} />
        ))}
        {cfg.motif === "glitch" && (
          <>
            <div style={{
              position: "absolute", inset: 0, opacity: 0.4,
              background: `repeating-linear-gradient(0deg, transparent 0 10px, ${accent}33 11px 12px, transparent 13px 22px)`,
              animation: "cinematic-scanline 0.85s steps(3) infinite",
            }} />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                position: "absolute", left: `${8 + i * 15}%`, right: `${5 + i * 3}%`, top: `${18 + i * 13}%`,
                height: 10 + i * 3, background: i % 2 ? "#ef444455" : `${accent}55`,
                transform: `skewX(${i % 2 ? -18 : 18}deg)`, mixBlendMode: "screen",
                animation: `cinematic-glitch-slice ${0.6 + i * 0.08}s steps(2) ${i * 0.12}s infinite`,
              }} />
            ))}
          </>
        )}
        {cfg.motif === "seal" && (
          <div style={{
            position: "absolute", left: "50%", top: "50%", width: "min(68vw, 520px)", height: "min(34vw, 250px)",
            transform: "translate(-50%,-50%) rotate(-8deg)",
            border: `8px double ${accent}99`,
            borderRadius: 28,
            color: `${accent}18`,
            fontSize: "clamp(42px, 10vw, 120px)",
            fontWeight: 950,
            display: "grid", placeItems: "center",
            letterSpacing: "0.08em",
            boxShadow: `0 0 42px ${accent}55, inset 0 0 36px ${accent}22`,
            animation: "cinematic-stamp-slam 0.75s cubic-bezier(.2,1.4,.3,1) .15s both",
          }}>TRAPACA</div>
        )}
        {cfg.motif === "raid" && (
          <div style={{
            position: "absolute", inset: "12%", border: `2px solid ${accent}66`,
            background: `linear-gradient(90deg, transparent 0 47%, ${accent}88 48% 52%, transparent 53% 100%), linear-gradient(0deg, transparent 0 47%, ${accent}88 48% 52%, transparent 53% 100%)`,
            clipPath: "polygon(8% 0, 92% 0, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0 92%, 0 8%)",
            animation: "cinematic-raid-lock 1.2s ease .1s both",
          }} />
        )}
        {cfg.motif === "mega" && [0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{
            position: "absolute", left: `${12 + i * 12}%`, top: `${12 + (i % 3) * 24}%`,
            width: 34 + i * 4, height: 58 + i * 7,
            background: `linear-gradient(135deg,#fff8,${accent}dd 35%,#7c3aedaa 70%,transparent)`,
            clipPath: "polygon(50% 0, 100% 35%, 72% 100%, 20% 86%, 0 35%)",
            boxShadow: `0 0 28px ${accent}88`,
            animation: `cinematic-crystal-pop 1.3s ease ${i * 0.12}s both, cinematic-crystal-float ${3 + i * 0.3}s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
        {cfg.motif === "treasure" && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "52%",
            width: 24, height: 24, borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, #fff8 0 12%, ${accent} 18% 62%, #92400e 72%)`,
            boxShadow: `0 0 18px ${accent}aa`,
            // @ts-expect-error CSS vars
            "--coin-x": `${Math.cos((i / 10) * Math.PI * 2) * rnd(160, 360)}px`,
            "--coin-y": `${Math.sin((i / 10) * Math.PI * 2) * rnd(90, 220)}px`,
            animation: `cinematic-coin-burst 1.4s cubic-bezier(.17,.67,.32,1.2) ${i * 0.05}s both`,
          }} />
        ))}
        {cfg.motif === "star" && (
          <div style={{
            position: "absolute", inset: "10% 16%", opacity: 0.55,
            background: `radial-gradient(circle at 20% 30%, ${accent} 0 2px, transparent 3px), radial-gradient(circle at 45% 20%, #fff 0 1px, transparent 2px), radial-gradient(circle at 70% 40%, ${accent} 0 2px, transparent 3px), radial-gradient(circle at 60% 75%, #fff 0 1px, transparent 2px), linear-gradient(115deg, transparent 0 48%, ${accent}33 49% 50%, transparent 51%)`,
            animation: "cinematic-star-twinkle 2.4s ease infinite",
          }} />
        )}
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(circle at 50% 50%, ${accent}22 0%, transparent 55%)`,
        boxShadow: `inset 0 0 150px ${accent}44`,
        animation: `${cfg.pulse} 1.8s ease infinite`,
        zIndex: 2,
      }} />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: "absolute",
            width: 180 + i * 120,
            height: 180 + i * 120,
            borderRadius: ringBorderRadius,
            transform: `rotate(${ringRotation})`,
            border: `1px solid ${accent}${["88", "55", "33"][i]}`,
            boxShadow: `0 0 ${20 + i * 14}px ${accent}33`,
            animation: `cinematic-ring-pulse ${1.6 + i * 0.35}s ease-out ${i * 0.18}s both`,
            opacity: 0,
          }} />
        ))}
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 3 }}>
        {particles.map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            color: i % 3 === 0 ? "#fff" : accent,
            fontWeight: 900,
            fontSize: p.size,
            textShadow: `0 0 12px ${accent}, 0 0 24px ${accent}88`,
            // @ts-expect-error CSS vars
            "--ex": p.tx, "--ey": p.ty, "--er": p.rot,
            animation: `cinematic-float ${p.dur}s ease ${p.delay}s ${ambient ? "infinite" : "both"}`,
            opacity: 0,
          }}>
            {p.char}
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: "15%", zIndex: 8 }}>
        <div style={{
          border: `2px solid ${accent}99`,
          color: accent,
          background: `${accent}12`,
          borderRadius: 999,
          padding: "7px clamp(16px, 4vw, 30px)",
          fontSize: "clamp(10px, 2vw, 13px)",
          fontWeight: 900,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          boxShadow: `0 0 32px ${accent}55, inset 0 0 18px ${accent}18`,
          animation: "cinematic-seal 0.75s cubic-bezier(.36,.07,.19,.97) 0.25s both",
        }}>
          {cfg.tag}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 7 }}>
        <div style={{
          fontSize: "clamp(58px, 15vw, 132px)",
          fontWeight: 950,
          color: `${accent}22`,
          textShadow: `0 0 45px ${accent}66`,
          animation: "cinematic-shockwave 1.4s ease 0.15s both",
        }}>
          {cfg.symbol}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ animation: "cinematic-title-emerge 0.9s cubic-bezier(.16,1,.3,1) 0.8s both", opacity: 0 }}>
          <TitleBlock
            name={name}
            color={color || accent}
            glowColor={glowColor || accent}
            flavorText={flavorText}
            rarity={rarity}
            ambient={ambient}
            nameStyle={{ textShadow: `0 0 28px ${accent}, 0 0 80px ${accent}88` }}
          />
        </div>
      </div>
      <style>{`
        @keyframes cinematic-breathe {
          0%, 100% { opacity: .78; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes cinematic-shadow-pulse {
          0%, 100% { opacity: .72; transform: scale(1); filter: saturate(1); }
          50% { opacity: 1; transform: scale(1.045); filter: saturate(1.5); }
        }
        @keyframes cinematic-smoke-pulse {
          0%, 100% { opacity: .58; transform: scale(1); filter: blur(0); }
          50% { opacity: .92; transform: scale(1.06); filter: blur(2px); }
        }
        @keyframes cinematic-glitch-pulse {
          0%, 100% { opacity: .72; transform: translateX(0) scale(1); }
          20% { transform: translateX(-4px) scale(1.02); }
          24% { transform: translateX(5px) scale(.99); }
          50% { opacity: 1; transform: translateX(0) scale(1.04); }
        }
        @keyframes cinematic-seal-pulse {
          0%, 100% { opacity: .72; transform: scale(1) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.035) rotate(-.35deg); }
        }
        @keyframes cinematic-raid-pulse {
          0%, 100% { opacity: .7; transform: scale(1); box-shadow: inset 0 0 150px #ef444444; }
          50% { opacity: 1; transform: scale(1.055); box-shadow: inset 0 0 210px #ef444466; }
        }
        @keyframes cinematic-mega-pulse {
          0%, 100% { opacity: .76; transform: scale(1); filter: hue-rotate(0deg); }
          50% { opacity: 1; transform: scale(1.06); filter: hue-rotate(18deg); }
        }
        @keyframes cinematic-treasure-pulse {
          0%, 100% { opacity: .72; transform: scale(1); filter: brightness(1); }
          50% { opacity: 1; transform: scale(1.055); filter: brightness(1.35); }
        }
        @keyframes cinematic-star-pulse {
          0%, 100% { opacity: .75; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.045); }
        }
        @keyframes cinematic-slow-spin {
          from { transform: rotate(0deg) scale(1); }
          to { transform: rotate(360deg) scale(1); }
        }
        @keyframes cinematic-eye-open {
          0% { opacity: 0; transform: translate(-50%,-50%) scaleX(.15) scaleY(.02); filter: blur(12px); }
          65% { opacity: .9; transform: translate(-50%,-50%) scaleX(1.08) scaleY(1); filter: blur(1px); }
          100% { opacity: .55; transform: translate(-50%,-50%) scaleX(1) scaleY(.82); filter: blur(0); }
        }
        @keyframes cinematic-smoke-drift {
          0%, 100% { transform: translate3d(-18px, 8px, 0) scale(.92); opacity: .38; }
          50% { transform: translate3d(22px, -16px, 0) scale(1.12); opacity: .72; }
        }
        @keyframes cinematic-scanline {
          0% { transform: translateY(-18px); opacity: .25; }
          100% { transform: translateY(18px); opacity: .45; }
        }
        @keyframes cinematic-glitch-slice {
          0%, 100% { transform: translateX(0) skewX(18deg); opacity: .18; }
          45% { transform: translateX(-28px) skewX(-18deg); opacity: .82; }
          55% { transform: translateX(24px) skewX(18deg); opacity: .5; }
        }
        @keyframes cinematic-stamp-slam {
          0% { opacity: 0; transform: translate(-50%,-50%) rotate(-24deg) scale(2.4); filter: blur(12px); }
          55% { opacity: .68; transform: translate(-50%,-50%) rotate(-8deg) scale(.92); filter: blur(0); }
          74% { transform: translate(-50%,-50%) rotate(-10deg) scale(1.05); }
          100% { opacity: .42; transform: translate(-50%,-50%) rotate(-8deg) scale(1); }
        }
        @keyframes cinematic-raid-lock {
          0% { opacity: 0; transform: scale(1.5) rotate(8deg); filter: blur(10px); }
          60% { opacity: .82; transform: scale(.95) rotate(0deg); filter: blur(0); }
          100% { opacity: .45; transform: scale(1) rotate(0deg); }
        }
        @keyframes cinematic-crystal-pop {
          0% { opacity: 0; transform: translateY(48px) scale(.25) rotate(-18deg); filter: blur(8px); }
          70% { opacity: .85; transform: translateY(-8px) scale(1.12) rotate(5deg); filter: blur(0); }
          100% { opacity: .55; transform: translateY(0) scale(1) rotate(0deg); }
        }
        @keyframes cinematic-crystal-float {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -18px; }
        }
        @keyframes cinematic-coin-burst {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(.25) rotateY(0deg); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--coin-x)), calc(-50% + var(--coin-y))) scale(.85) rotateY(720deg); }
        }
        @keyframes cinematic-star-twinkle {
          0%, 100% { opacity: .35; filter: drop-shadow(0 0 6px #fde68a); }
          50% { opacity: .95; filter: drop-shadow(0 0 18px #fde68a); }
        }
        @keyframes cinematic-ring-pulse {
          0% { opacity: 0; transform: scale(.45); }
          25% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.55); }
        }
        @keyframes cinematic-float {
          0% { opacity: 0; transform: translate3d(0, 20px, 0) rotate(0deg) scale(.75); }
          25% { opacity: .95; }
          100% { opacity: 0; transform: translate3d(var(--ex), var(--ey), 0) rotate(var(--er)) scale(1.25); }
        }
        @keyframes cinematic-seal {
          0% { opacity: 0; transform: scale(1.8) rotate(-6deg); filter: blur(8px); }
          55% { opacity: 1; transform: scale(.92) rotate(2deg); filter: blur(0); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes cinematic-shockwave {
          0% { opacity: 0; transform: scale(.35); filter: blur(18px); }
          35% { opacity: 1; transform: scale(1); filter: blur(0); }
          100% { opacity: .18; transform: scale(1.18); filter: blur(1px); }
        }
        @keyframes cinematic-title-emerge {
          0% { opacity: 0; transform: translateY(24px) scale(.88); filter: blur(10px); }
          60% { opacity: 1; transform: translateY(-4px) scale(1.03); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
      `}</style>
    </>
  );
}

// ── Portal principal ──────────────────────────────────────────────────────────
export function TitleEntrance({ name, rarity, theme, effect, color, glowColor, flavorText, onComplete }: TitleEntranceProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const hasPlayed  = useRef(false);
  const tFadeRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tDoneRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableDone = useCallback(onComplete, []); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = useCallback(() => {
    if (tFadeRef.current) clearTimeout(tFadeRef.current);
    if (tDoneRef.current) clearTimeout(tDoneRef.current);
    setVisible(false);
    setTimeout(() => stableDone(), FADE_MS);
  }, [stableDone]);

  useEffect(() => {
    if (hasPlayed.current || effect === "NONE") return;
    hasPlayed.current = true;
    setMounted(true);

    const total  = DURATION[effect] ?? 2400;
    const fadeAt = total - FADE_MS;

    tFadeRef.current = setTimeout(() => setVisible(false), fadeAt);
    tDoneRef.current = setTimeout(() => stableDone(), total);
    return () => {
      if (tFadeRef.current) clearTimeout(tFadeRef.current);
      if (tDoneRef.current) clearTimeout(tDoneRef.current);
    };
  }, [effect, stableDone]);

  if (!mounted || typeof document === "undefined") return null;

  const props: EffectProps = { name, color, glowColor, flavorText, theme, rarity };

  const content = (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        zIndex: 99999, cursor: "pointer",
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
      onClick={skip}
    >
      {effect === "LIGHTNING_STRIKE"  && <LightningStrikeEffect  {...props}/>}
      {effect === "BOSS_ALERT"        && <BossAlertEffect        {...props}/>}
      {effect === "CHAMPION_ARENA"    && <ChampionArenaEffect    {...props}/>}
      {effect === "COIN_RAIN"         && <CoinRainEffect         {...props}/>}
      {effect === "DIMENSIONAL_RIFT"  && <DimensionalRiftEffect  {...props}/>}
      {effect === "ULTRA_RARE_REVEAL" && <UltraRareRevealEffect  {...props}/>}
      {effect === "GLITCH_HACK"       && <GlitchHackEffect       {...props}/>}
      {effect === "SLOT_MACHINE"      && <SlotMachineEffect      {...props}/>}
      {effect === "ELEMENTAL_AURA"    && <ElementalAuraEffect    {...props}/>}
      {effect === "MIAUVADAO_SEAL"      && <MiauvadaoSealEffect      {...props}/>}
      {effect === "PILAR_DA_COMUNIDADE" && <PilarDaComunidadeEffect  {...props}/>}
      {SPECIAL_EFFECT_CFG[effect] && <CinematicTitleEffect {...props} effect={effect} />}
    </div>
  );

  return createPortal(content, document.body);
}
