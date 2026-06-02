"use client";

/**
 * TitleEntrance — portal de tela inteira que exibe o efeito de entrada
 * de um título lendário/mítico/relíquia ao abrir o perfil do jogador.
 *
 * Fixes v2:
 *  - Fade-out via CSS transition no container (confiável vs. animation que conflita com filhos)
 *  - flavorText exibido em todos os efeitos
 *  - Tamanhos responsivos para mobile (clamp, min(), vw)
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

// ── Durations (ms) ────────────────────────────────────────────────────────────
const DURATION: Record<string, number> = {
  LIGHTNING_STRIKE:  1800,
  BOSS_ALERT:        2600,
  CHAMPION_ARENA:    2600,
  COIN_RAIN:         2400,
  DIMENSIONAL_RIFT:  2600,
  ULTRA_RARE_REVEAL: 2600,
  GLITCH_HACK:       2000,
  SLOT_MACHINE:      2800,
  ELEMENTAL_AURA:    2200,
  MIAUVADAO_SEAL:    2600,
};

// Fade-out starts this many ms before total
const FADE_MS = 600;

// ── Helpers ───────────────────────────────────────────────────────────────────

const COINS          = ["🪙","🪙","⭐","🪙","✨","🪙"];
const CONFETTI_COLORS = ["#FFCB05","#f97316","#c084fc","#60a5fa","#4ade80","#fb923c","#fff"];

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// Título + frase reutilizável em todos os efeitos
function TitleBlock({
  name, color, glowColor, flavorText, style, nameStyle, flavorStyle,
}: {
  name: string; color: string; glowColor: string; flavorText?: string | null;
  style?: React.CSSProperties; nameStyle?: React.CSSProperties; flavorStyle?: React.CSSProperties;
}) {
  return (
    <div style={{ textAlign: "center", ...style }}>
      <p style={{
        margin: 0,
        fontWeight: 900,
        fontSize: "clamp(20px, 5vw, 32px)",
        letterSpacing: "0.06em",
        color,
        textShadow: `0 0 20px ${glowColor}, 0 0 50px ${glowColor}`,
        lineHeight: 1.2,
        padding: "0 16px",
        ...nameStyle,
      }}>
        {name}
      </p>
      {flavorText && (
        <p style={{
          margin: "10px 16px 0",
          fontSize: "clamp(11px, 2.5vw, 14px)",
          fontStyle: "italic",
          color: `${color}cc`,
          lineHeight: 1.5,
          animation: "title-flavor-in 0.5s ease 0.5s both",
          ...flavorStyle,
        }}>
          &ldquo;{flavorText}&rdquo;
        </p>
      )}
    </div>
  );
}

// ── Sub-effects ───────────────────────────────────────────────────────────────

type EffectProps = Pick<TitleEntranceProps, "name"|"color"|"glowColor"|"flavorText"|"theme">;

function LightningStrikeEffect({ name, color, glowColor, flavorText }: EffectProps) {
  const sparks = Array.from({ length: 8 }, (_, i) => ({
    left: `${15 + i * 10}%`, top: `${30 + (i % 3) * 20}%`,
    sx: `${rnd(-20,20)}px`, sy: `${rnd(-30,-8)}px`,
    delay: rnd(0.2, 0.7), size: rnd(3, 7),
  }));
  return (
    <>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center,#0a0a1a,#000510)", animation: "entrance-in 0.15s ease forwards" }} />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <filter id="lx-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <polyline points="20,5 45,38 35,38 65,72 55,72 80,95" stroke={color} strokeWidth="4" fill="none" filter="url(#lx-glow)" strokeLinecap="round"
          style={{ strokeDasharray: 1200, strokeDashoffset: 1200, animation: "lightning-bolt-draw 0.35s ease 0.05s forwards" }} vectorEffect="non-scaling-stroke" />
        <polyline points="45,38 55,50 50,50 60,62" stroke={color} strokeWidth="2" fill="none" opacity="0.7"
          style={{ strokeDasharray: 300, strokeDashoffset: 300, animation: "lightning-bolt-draw 0.25s ease 0.15s forwards" }} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute inset-0 pointer-events-none" style={{ background: color, opacity: 0, animation: "entrance-in 0.08s ease 0.05s forwards,entrance-out 0.3s ease 0.25s forwards", zIndex: 2 }} />
      {sparks.map((s, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{
          left: s.left, top: s.top, width: s.size, height: s.size,
          background: color, boxShadow: `0 0 6px ${color}`,
          // @ts-expect-error CSS custom properties
          "--sx": s.sx, "--sy": s.sy,
          animation: "lightning-spark 0.6s ease forwards", animationDelay: `${s.delay}s`, opacity: 0, zIndex: 3,
        }} />
      ))}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ animation: "lightning-flash 0.8s ease 0.3s both" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} />
        </div>
      </div>
    </>
  );
}

function BossAlertEffect({ name, color, glowColor, flavorText }: EffectProps) {
  const [phase, setPhase] = useState<"in"|"hold"|"out">("in");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 400);
    const t2 = setTimeout(() => setPhase("out"), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const barStyle = (dir: "top"|"bottom"): React.CSSProperties => ({
    position: "absolute", left: 0, right: 0, height: "17%",
    background: "linear-gradient(135deg,#1a0000,#2d0000,#1a0000)",
    borderBottom: dir === "top" ? "2px solid #ff000088" : undefined,
    borderTop: dir === "bottom" ? "2px solid #ff000088" : undefined,
    [dir]: 0, zIndex: 5,
    animation: phase === "out"
      ? `boss-bar-out-${dir} 0.35s ease forwards`
      : `boss-bar-in-${dir} 0.3s cubic-bezier(.2,1.5,.5,1) 0.1s both`,
  });

  return (
    <>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center,#1a0000,#000)", animation: "entrance-in 0.15s ease forwards" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px #ff000066", zIndex: 1 }} />
      <div style={barStyle("top")} />
      <div style={barStyle("bottom")} />
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div>
          <p className="text-center mb-3" style={{ fontSize: "clamp(9px,2vw,11px)", textTransform: "uppercase", letterSpacing: "0.4em", color: "#ff4444", opacity: phase === "in" ? 0 : 1, transition: "opacity 0.3s" }}>
            AMEAÇA DETECTADA
          </p>
          <div style={{ animation: phase === "hold" ? "boss-title-shake 0.6s ease 0.1s 2" : undefined, opacity: phase === "in" ? 0 : 1, transition: "opacity 0.2s 0.2s" }}>
            <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} />
          </div>
        </div>
      </div>
    </>
  );
}

function ChampionArenaEffect({ name, color, glowColor, flavorText }: EffectProps) {
  const confetti = Array.from({ length: 14 }, (_, i) => ({
    left: `${rnd(5,95)}%`, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: rnd(0,0.6), duration: rnd(1.2,1.8), cr: `${rnd(-360,360)}deg`, cs: rnd(0.6,1.4),
    width: rnd(6,12), height: rnd(4,8),
  }));
  return (
    <>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center bottom,#1a1200,#0a0800)", animation: "entrance-in 0.2s ease forwards" }} />
      <div className="absolute pointer-events-none" style={{ left:"15%",top:"-40%",width:120,height:"200%",background:"linear-gradient(to bottom,transparent,#FFCB0522,#FFCB0533,#FFCB0511,transparent)",transformOrigin:"top center",animation:"spotlight-l 1.5s ease 0.1s both",opacity:0,zIndex:1 }} />
      <div className="absolute pointer-events-none" style={{ right:"15%",top:"-40%",width:120,height:"200%",background:"linear-gradient(to bottom,transparent,#FFCB0522,#FFCB0533,#FFCB0511,transparent)",transformOrigin:"top center",animation:"spotlight-r 1.5s ease 0.1s both",opacity:0,zIndex:1 }} />
      {confetti.map((c, i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left:c.left,top:-16,width:c.width,height:c.height,background:c.color,borderRadius:2,
          // @ts-expect-error CSS custom properties
          "--cr":c.cr,"--cs":c.cs,animation:`confetti-drop ${c.duration}s ease ${c.delay}s both`,zIndex:2 }} />
      ))}
      <div className="absolute inset-x-0 flex items-center justify-center z-10" style={{ top:"50%",transform:"translateY(-50%)" }}>
        <div className="w-full py-6" style={{ background:"linear-gradient(90deg,transparent,#1a120088,#1a1200cc,#1a120088,transparent)",borderTop:`1px solid ${color}44`,borderBottom:`1px solid ${color}44` }}>
          <div style={{ animation: "arena-title-in 0.7s ease 0.4s both" }}>
            <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} />
          </div>
        </div>
      </div>
    </>
  );
}

function CoinRainEffect({ name, color, glowColor, flavorText }: EffectProps) {
  const coins = Array.from({ length: 10 }, (_, i) => ({
    left: `${8 + i * 9}%`, delay: rnd(0,0.8),
    emoji: COINS[i % COINS.length], ch: `${rnd(75,90)}vh`,
  }));
  return (
    <>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center,#1a1000,#080500)", animation: "entrance-in 0.2s ease forwards" }} />
      {coins.map((c, i) => (
        <div key={i} className="absolute text-2xl pointer-events-none select-none" style={{
          left: c.left, top: 0,
          // @ts-expect-error CSS custom properties
          "--ch": c.ch,
          animation: `coin-fall 1.4s cubic-bezier(.25,.46,.45,.94) ${c.delay}s both`, zIndex: 2,
          filter: `drop-shadow(0 0 6px ${color})`,
        }}>{c.emoji}</div>
      ))}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ animation: "title-rise-fade 0.6s ease 0.5s both" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} />
        </div>
      </div>
    </>
  );
}

function DimensionalRiftEffect({ name, color, glowColor, flavorText }: EffectProps) {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 2 * Math.PI;
    const r = rnd(60, 130);
    return { px: `${Math.cos(angle)*r}px`, py: `${Math.sin(angle)*r}px`, size: rnd(3,8), delay: rnd(0.4,1.0) };
  });
  return (
    <>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center,#0d0020,#04000e)", backdropFilter: "blur(2px)", animation: "entrance-in 0.2s ease forwards" }} />
      <div className="absolute inset-0 flex items-center justify-center z-2">
        <div style={{ width:"min(260px,65vw)",height:"min(260px,65vw)",borderRadius:"50%",background:`radial-gradient(ellipse at center,#4a00e0cc 0%,#8b00ffaa 40%,#4a00e033 70%,transparent 100%)`,boxShadow:`0 0 60px #8b00ff88,inset 0 0 40px #4a00e066`,animation:"portal-expand 0.8s cubic-bezier(.2,1,.5,1) 0.1s both" }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-3 pointer-events-none">
        {particles.map((p, i) => (
          <div key={i} className="absolute rounded-full" style={{ width:p.size,height:p.size,background:"#c084fc",boxShadow:"0 0 6px #c084fc",
            // @ts-expect-error CSS custom properties
            "--px":p.px,"--py":p.py,animation:"portal-particle 1.2s ease forwards",animationDelay:`${p.delay}s`,opacity:0 }} />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ animation: "rift-title-emerge 0.7s cubic-bezier(.2,1,.5,1) 0.7s both" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText}
            nameStyle={{ textShadow: `0 0 20px ${glowColor},0 0 50px #8b00ffaa` }} />
        </div>
      </div>
    </>
  );
}

function UltraRareRevealEffect({ name, color, glowColor, flavorText }: EffectProps) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFlipped(true), 700); return () => clearTimeout(t); }, []);
  const particles = Array.from({ length: 10 }, (_, i) => ({
    cx:`${rnd(-100,100)}px`,cy:`${rnd(-80,-20)}px`,cr:`${rnd(-180,180)}deg`,
    delay:rnd(0.8,1.4),size:rnd(4,10),color:CONFETTI_COLORS[i%CONFETTI_COLORS.length],
  }));
  const cardW = "min(220px,72vw)";
  const cardH = "min(300px,55vh)";
  return (
    <>
      <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse at center,#0a0a16,#030308)", animation:"entrance-in 0.2s ease forwards" }} />
      <div className="absolute inset-0 flex items-center justify-center z-5" style={{ perspective:800 }}>
        <div style={{ width:cardW,height:cardH,borderRadius:16,transformStyle:"preserve-3d",animation:flipped?"card-flip-in 0.6s cubic-bezier(.2,1,.5,1) forwards":undefined,transform:flipped?undefined:"perspective(700px) rotateY(180deg) scale(0.8)" }}>
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2 overflow-hidden" style={{ backfaceVisibility:"hidden",background:`linear-gradient(135deg,#0d0d1a,#1a0d2e,#0d0d1a)`,border:`2px solid ${color}88`,boxShadow:`0 0 30px ${glowColor},inset 0 0 20px ${color}11` }}>
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ backgroundImage:`linear-gradient(105deg,transparent 30%,${color}44 45%,#fff6 50%,${color}44 55%,transparent 70%)`,backgroundSize:"200% 100%",animation:"holo-sweep 1s ease 1.1s 2" }} />
            <p style={{ margin:0,fontSize:"clamp(9px,2vw,11px)",textTransform:"uppercase",letterSpacing:"0.3em",color:`${color}88` }}>Ultra Raro</p>
            <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} nameStyle={{ fontSize:"clamp(16px,4vw,22px)" }} />
            <p style={{ fontSize:18,marginTop:4 }}>✦</p>
          </div>
          <div className="absolute inset-0 rounded-2xl" style={{ backfaceVisibility:"hidden",transform:"rotateY(180deg)",background:"linear-gradient(135deg,#0d1a2e,#1a0d2e)",border:"2px solid #333" }} />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        {particles.map((p, i) => (
          <div key={i} className="absolute rounded-sm" style={{ width:p.size,height:p.size/2,background:p.color,
            // @ts-expect-error CSS custom properties
            "--cx":p.cx,"--cy":p.cy,"--cr":p.cr,animation:"card-particle 1s ease forwards",animationDelay:`${p.delay}s`,opacity:0 }} />
        ))}
      </div>
    </>
  );
}

function GlitchHackEffect({ name, color, glowColor, flavorText }: EffectProps) {
  const CHARS = "アイウエオカキクケコ!@#$%^&*01ABCXYZ?!<>";
  const [displayed, setDisplayed] = useState(() =>
    name.split("").map(() => CHARS[Math.floor(Math.random()*CHARS.length)]).join("")
  );
  const iterRef = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      iterRef.current++;
      const progress = iterRef.current / 16;
      setDisplayed(name.split("").map((ch, i) =>
        Math.random() < progress || ch === " " ? ch : CHARS[Math.floor(Math.random()*CHARS.length)]
      ).join(""));
      if (iterRef.current >= 16) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="absolute inset-0" style={{ background:"#000408", animation:"entrance-in 0.1s ease forwards" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:`linear-gradient(transparent 97%,#00ff4422 97%),linear-gradient(90deg,transparent 97%,#00ff4411 97%)`,backgroundSize:"40px 40px",zIndex:1 }} />
      {[0,1,2].map(i => (
        <div key={i} className="absolute inset-x-0 pointer-events-none" style={{ height:2,background:"#0ff6",animation:"scanline-sweep 1.2s ease forwards",animationDelay:`${i*0.25}s`,zIndex:2 }} />
      ))}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div>
          <p style={{ fontFamily:"monospace",fontWeight:900,fontSize:"clamp(18px,5vw,30px)",letterSpacing:"0.15em",textAlign:"center",color:"#0ff",animation:"glitch-color-shift 0.12s linear 0s 10",textShadow:`0 0 10px #0ff,0 0 20px ${glowColor}`,padding:"0 16px" }}>
            {displayed}
          </p>
          <div style={{ animation:"entrance-in 0.4s ease 0.9s both", textAlign:"center" }}>
            {flavorText && <p style={{ marginTop:12,fontSize:"clamp(11px,2.5vw,14px)",fontStyle:"italic",fontFamily:"monospace",color:`${color}cc`,padding:"0 16px" }}>&ldquo;{flavorText}&rdquo;</p>}
          </div>
        </div>
      </div>
    </>
  );
}

const SLOT_SYMBOLS = ["⚡","🔥","💎","⭐","🏆","🎴","🌊","✦"];
const JACKPOT = ["⚡","⚡","⚡"];

function SlotMachineEffect({ name, color, glowColor, flavorText }: EffectProps) {
  const [slots, setSlots]   = useState(["?","?","?"]);
  const [stopped, setStopped] = useState([false,false,false]);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlots(s => s.map((_, i) => stopped[i] ? JACKPOT[i] : SLOT_SYMBOLS[Math.floor(Math.random()*SLOT_SYMBOLS.length)]));
    }, 80);
    const t1 = setTimeout(() => setStopped([true,false,false]), 800);
    const t2 = setTimeout(() => setStopped([true,true,false]), 1100);
    const t3 = setTimeout(() => { setStopped([true,true,true]); setShaking(true); }, 1400);
    const t4 = setTimeout(() => setShaking(false), 1800);
    return () => { clearInterval(interval); [t1,t2,t3,t4].forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const slotSize = "min(60px,16vw)";

  return (
    <>
      <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse at center,#0d0818,#05030c)", animation:"entrance-in 0.2s ease forwards" }}>
        <div className="absolute inset-4 rounded-2xl pointer-events-none" style={{ border:`2px solid ${color}44`,boxShadow:`inset 0 0 40px ${color}11,0 0 20px ${color}22` }} />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-5 gap-5">
        <div className="flex gap-3">
          {slots.map((sym, i) => (
            <div key={i} className="flex items-center justify-center rounded-xl" style={{ width:slotSize,height:slotSize,background:"#0a0820",border:`2px solid ${stopped[i]?color:"#333"}`,boxShadow:stopped[i]?`0 0 16px ${glowColor}`:undefined,fontSize:"clamp(20px,5vw,28px)",transition:"border-color 0.2s,box-shadow 0.2s",animation:shaking?"slot-shake 0.3s ease":undefined }}>
              {sym}
            </div>
          ))}
        </div>
        {stopped[2] && <div className="absolute inset-0 pointer-events-none rounded" style={{ background:color,animation:"entrance-out 0.3s ease 0.1s both",zIndex:20 }} />}
        <div style={{ opacity:stopped[2]?undefined:0,animation:stopped[2]?"title-rise-fade 0.5s ease 0.2s both":undefined }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText} />
        </div>
      </div>
    </>
  );
}

const AURA_THEMES: Record<string,{bg:string;particle:string;label:string}> = {
  ELECTRIC:{ bg:"radial-gradient(ellipse,#0a0f20,#020510)", particle:"#FFCB05", label:"⚡" },
  FIRE:    { bg:"radial-gradient(ellipse,#1a0600,#080200)", particle:"#f97316", label:"🔥" },
  WATER:   { bg:"radial-gradient(ellipse,#001a20,#000810)", particle:"#38bdf8", label:"🌊" },
  GRASS:   { bg:"radial-gradient(ellipse,#001a06,#000802)", particle:"#4ade80", label:"🌿" },
  ZIKABET: { bg:"radial-gradient(ellipse,#14001a,#060008)", particle:"#c084fc", label:"🎰" },
  NEUTRAL: { bg:"radial-gradient(ellipse,#0a0820,#030310)", particle:"#FFCB05", label:"✦" },
};

function ElementalAuraEffect({ name, color, glowColor, flavorText, theme }: EffectProps) {
  const aura = AURA_THEMES[theme ?? "NEUTRAL"] ?? AURA_THEMES.NEUTRAL;
  const embers = Array.from({ length: 16 }, (_, i) => {
    const angle = (i/16)*2*Math.PI;
    const r = rnd(40,120);
    return { ex:`${Math.cos(angle)*r+rnd(-20,20)}px`,ey:`${-Math.abs(Math.sin(angle))*r-20}px`,er:`${rnd(-180,180)}deg`,size:rnd(4,10),delay:rnd(0,0.8) };
  });
  return (
    <>
      <div className="absolute inset-0" style={{ background:aura.bg, animation:"entrance-in 0.2s ease forwards" }} />
      {[0,1,2].map(i => (
        <div key={i} className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex:1 }}>
          <div style={{ width:`min(${200+i*100}px,${50+i*20}vw)`,height:`min(${200+i*100}px,${50+i*20}vw)`,borderRadius:"50%",border:`${2-i*0.5}px solid ${aura.particle}${["66","44","22"][i]}`,boxShadow:`0 0 ${20+i*10}px ${aura.particle}${["44","22","11"][i]}`,animation:"aura-expand 1.5s ease forwards",animationDelay:`${i*0.2}s`,opacity:0 }} />
        </div>
      ))}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-2">
        {embers.map((e, i) => (
          <div key={i} className="absolute rounded-full" style={{ width:e.size,height:e.size,background:aura.particle,boxShadow:`0 0 8px ${aura.particle}`,
            // @ts-expect-error CSS custom properties
            "--ex":e.ex,"--ey":e.ey,"--er":e.er,animation:"ember-float 1.2s ease forwards",animationDelay:`${e.delay}s`,opacity:0 }} />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-3" style={{ fontSize:"clamp(50px,15vw,80px)",animation:"aura-expand 1.8s ease 0.1s both",opacity:0,filter:`blur(2px) drop-shadow(0 0 20px ${aura.particle})` }}>
        {aura.label}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div style={{ animation:"title-rise-fade 0.6s ease 0.5s both" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText}
            nameStyle={{ textShadow:`0 0 20px ${glowColor},0 0 50px ${aura.particle}88` }} />
        </div>
      </div>
    </>
  );
}

function MiauvadaoSealEffect({ name, color, glowColor, flavorText }: EffectProps) {
  const tickets = Array.from({ length: 8 }, (_, i) => ({
    tx:`${rnd(-150,150)}px`,ty:`${rnd(-40,40)}px`,tr:`${rnd(-45,45)}deg`,
    delay:rnd(0.5,1.0),emoji:i%2===0?"🎟️":"🪙",size:rnd(18,28),
  }));
  return (
    <>
      <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse at center,#12001a,#060008)", animation:"entrance-in 0.15s ease forwards" }} />
      <div className="absolute inset-0 flex items-center justify-center z-5" style={{ pointerEvents:"none" }}>
        <div style={{ fontSize:"clamp(36px,10vw,72px)",fontWeight:900,color:"#22c55e",border:"5px solid #22c55e",padding:"6px 20px",borderRadius:8,textTransform:"uppercase",letterSpacing:"0.15em",opacity:0.9,animation:"seal-stamp 0.6s cubic-bezier(.36,.07,.19,.97) 0.1s both",textShadow:"0 0 30px #22c55e88",boxShadow:"0 0 30px #22c55e44,inset 0 0 20px #22c55e11" }}>
          Aprovado
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-6">
        {tickets.map((t, i) => (
          <div key={i} className="absolute select-none" style={{ fontSize:t.size,
            // @ts-expect-error CSS custom properties
            "--tx":t.tx,"--ty":t.ty,"--tr":t.tr,animation:"ticket-fly 0.8s ease forwards",animationDelay:`${t.delay}s`,opacity:0 }}>
            {t.emoji}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10" style={{ paddingTop:80 }}>
        <div style={{ animation:"title-rise-fade 0.6s ease 0.8s both" }}>
          <TitleBlock name={name} color={color} glowColor={glowColor} flavorText={flavorText}
            nameStyle={{ textShadow:`0 0 20px ${glowColor},0 0 50px ${glowColor}` }} />
        </div>
      </div>
    </>
  );
}

// ── Portal principal ──────────────────────────────────────────────────────────

export function TitleEntrance({ name, rarity, theme, effect, color, glowColor, flavorText, onComplete }: TitleEntranceProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const hasPlayed = useRef(false);
  const stableDone = useCallback(onComplete, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasPlayed.current || effect === "NONE") return;
    hasPlayed.current = true;
    setMounted(true);

    const total  = DURATION[effect] ?? 2000;
    const fadeAt = total - FADE_MS;

    const tFade = setTimeout(() => setVisible(false), fadeAt);
    const tDone = setTimeout(() => stableDone(), total);
    return () => { clearTimeout(tFade); clearTimeout(tDone); };
  }, [effect, stableDone]);

  if (!mounted || typeof document === "undefined") return null;

  const effectProps: EffectProps = { name, color, glowColor, flavorText, theme };

  const content = (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        zIndex: 99999,
        pointerEvents: "none",
        // ✅ transition é mais confiável que animation para fade-out
        // (não conflita com animações dos filhos que têm opacity próprio)
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {effect === "LIGHTNING_STRIKE"  && <LightningStrikeEffect  {...effectProps} />}
      {effect === "BOSS_ALERT"        && <BossAlertEffect        {...effectProps} />}
      {effect === "CHAMPION_ARENA"    && <ChampionArenaEffect    {...effectProps} />}
      {effect === "COIN_RAIN"         && <CoinRainEffect         {...effectProps} />}
      {effect === "DIMENSIONAL_RIFT"  && <DimensionalRiftEffect  {...effectProps} />}
      {effect === "ULTRA_RARE_REVEAL" && <UltraRareRevealEffect  {...effectProps} />}
      {effect === "GLITCH_HACK"       && <GlitchHackEffect       {...effectProps} />}
      {effect === "SLOT_MACHINE"      && <SlotMachineEffect      {...effectProps} />}
      {effect === "ELEMENTAL_AURA"    && <ElementalAuraEffect    {...effectProps} />}
      {effect === "MIAUVADAO_SEAL"    && <MiauvadaoSealEffect    {...effectProps} />}
    </div>
  );

  return createPortal(content, document.body);
}
