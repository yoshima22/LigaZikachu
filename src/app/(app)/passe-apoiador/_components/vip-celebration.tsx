"use client";

/**
 * VipCelebration — animação de boas-vindas ao Passe Apoiador.
 * Pure CSS + React, zero imagens externas, zero egress Supabase.
 * Duração total: 7000ms
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ── Dados estáticos gerados uma vez ──────────────────────────────────────────

function rnd(min: number, max: number) { return Math.random() * (max - min) + min; }

const COLORS  = ["#FFCB05","#f97316","#c084fc","#60a5fa","#4ade80","#fb923c","#ffffff","#fbbf24","#a78bfa","#34d399"];
const STARS   = ["⭐","✨","🌟","💫","⚡","💛","💜","🔥"];

interface Particle { id: number; x: number; color: string; delay: number; dur: number; size: number; char?: string; shape: "circle"|"rect"|"star" }
interface Shoot    { id: number; x: number; y: number; angle: number; delay: number; color: string; length: number }
interface Ring     { id: number; size: number; delay: number; dur: number; color: string }
interface Firework { id: number; x: number; y: number; delay: number; color: string }

const CONFETTI: Particle[] = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: 2 + (i / 60) * 96,
  color: COLORS[i % COLORS.length],
  delay: (i * 0.04) % 2.2,
  dur: 2.0 + (i % 6) * 0.3,
  size: 6 + (i % 5) * 4,
  char: i % 7 === 0 ? STARS[i % STARS.length] : undefined,
  shape: i % 3 === 0 ? "circle" : i % 3 === 1 ? "rect" : "star",
}));

const SHOOTS: Shoot[] = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: rnd(5, 95),
  y: rnd(5, 60),
  angle: rnd(-45, 45),
  delay: 0.4 + i * 0.18,
  color: COLORS[i % COLORS.length],
  length: rnd(60, 160),
}));

const RINGS: Ring[] = [
  { id: 0, size: 120,  delay: 0.05, dur: 1.4, color: "#FFCB05" },
  { id: 1, size: 240,  delay: 0.20, dur: 1.6, color: "#c084fc" },
  { id: 2, size: 380,  delay: 0.38, dur: 1.8, color: "#FFCB05" },
  { id: 3, size: 540,  delay: 0.56, dur: 2.0, color: "#c084fc" },
  { id: 4, size: 700,  delay: 0.74, dur: 2.2, color: "#FFCB0544" },
];

const FIREWORKS: Firework[] = [
  { id: 0, x: 12, y: 18, delay: 0.8,  color: "#FFCB05" },
  { id: 1, x: 88, y: 22, delay: 1.1,  color: "#c084fc" },
  { id: 2, x: 20, y: 72, delay: 1.5,  color: "#60a5fa" },
  { id: 3, x: 80, y: 68, delay: 1.8,  color: "#f97316" },
  { id: 4, x: 50, y: 12, delay: 2.2,  color: "#4ade80" },
  { id: 5, x: 35, y: 82, delay: 2.6,  color: "#fbbf24" },
];

// ── Componente ────────────────────────────────────────────────────────────────

interface Props { onDone: () => void }

export function VipCelebration({ onDone }: Props) {
  const [phase, setPhase] = useState<"flash"|"burst"|"title"|"subtitle"|"ambient"|"fading"|"done">("flash");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t1 = setTimeout(() => setPhase("burst"),    120);
    const t2 = setTimeout(() => setPhase("title"),    700);
    const t3 = setTimeout(() => setPhase("subtitle"), 1400);
    const t4 = setTimeout(() => setPhase("ambient"),  2200);
    const t5 = setTimeout(() => setPhase("fading"),   6100);
    const t6 = setTimeout(() => { setPhase("done"); onDone(); }, 7000);
    return () => { [t1,t2,t3,t4,t5,t6].forEach(clearTimeout); };
  }, [onDone]);

  if (!mounted || phase === "done") return null;

  const titleVisible   = phase !== "flash" && phase !== "burst";
  const subtitleVisible= phase !== "flash" && phase !== "burst" && phase !== "title";
  const isFading       = phase === "fading";

  const content = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        opacity: isFading ? 0 : 1,
        transition: "opacity 0.8s ease",
        pointerEvents: isFading ? "none" : "auto",
        cursor: "pointer",
      }}
      onClick={onDone}
    >
      {/* ── Background animado ────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        background: phase === "flash"
          ? "#fff"
          : "radial-gradient(ellipse at 50% 40%, #1e0a40 0%, #0e0520 50%, #04010e 100%)",
        transition: "background 0.3s ease",
      }} />

      {/* Vinheta pulsante */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        boxShadow: "inset 0 0 180px #000a",
        animation: phase === "ambient" ? "vip-vignette-pulse 2s ease infinite" : undefined,
        zIndex: 1,
      }} />

      {/* ── Anéis de sonar ─────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
        {RINGS.map(r => (
          <div key={r.id} style={{
            position: "absolute",
            width: r.size, height: r.size,
            borderRadius: "50%",
            border: `1px solid ${r.color}`,
            boxShadow: `0 0 24px ${r.color}66`,
            animation: `vip-ring-expand ${r.dur}s ease-out ${r.delay}s both`,
            opacity: 0,
          }} />
        ))}
      </div>

      {/* ── Estrelas cadentes ──────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 3 }}>
        {CONFETTI.map(p => (
          <div key={p.id} style={{
            position: "absolute",
            left: `${p.x}%`,
            top: "-10%",
            width:  p.char ? "auto" : p.size,
            height: p.char ? "auto" : p.shape === "rect" ? p.size / 2 : p.size,
            fontSize: p.char ? p.size + 4 : undefined,
            borderRadius: p.char ? undefined : p.shape === "circle" ? "50%" : p.shape === "rect" ? 2 : "2px",
            background: p.char ? "transparent" : p.color,
            color: p.color,
            clipPath: (!p.char && p.shape === "star")
              ? "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"
              : undefined,
            animation: `vip-confetti-fall ${p.dur}s ${p.delay}s ease-in ${phase === "ambient" ? "infinite" : "forwards"}`,
            filter: p.char ? `drop-shadow(0 0 6px ${p.color})` : undefined,
          }}>
            {p.char ?? ""}
          </div>
        ))}
      </div>

      {/* ── Shooting stars diagonais ───────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 4 }}>
        {SHOOTS.map(s => (
          <div key={s.id} style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.length,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${s.color}, ${s.color}88, transparent)`,
            borderRadius: 2,
            transform: `rotate(${s.angle}deg)`,
            animation: `vip-shoot ${0.6}s ease-out ${s.delay}s both`,
            opacity: 0,
          }} />
        ))}
      </div>

      {/* ── Fogos de artifício nos cantos ──────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 4 }}>
        {FIREWORKS.map(f => (
          <FireworkBurst key={f.id} x={f.x} y={f.y} delay={f.delay} color={f.color} />
        ))}
      </div>

      {/* ── Conteúdo central ───────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "0 24px", maxWidth: 480 }}>

        {/* Coroa */}
        <div style={{
          fontSize: "clamp(52px, 12vw, 80px)",
          display: "block",
          marginBottom: 8,
          opacity: titleVisible ? 1 : 0,
          transition: "opacity 0.4s",
          animation: titleVisible ? "vip-crown-bounce 0.7s cubic-bezier(.22,1.5,.36,1) both" : undefined,
          filter: "drop-shadow(0 0 20px #FFCB05) drop-shadow(0 0 40px #FFCB0566)",
        }}>
          👑
        </div>

        {/* Título principal */}
        <h1 style={{
          fontWeight: 900,
          fontSize: "clamp(20px, 5.5vw, 34px)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          margin: "0 0 10px",
          opacity: titleVisible ? 1 : 0,
          transition: "opacity 0.5s 0.1s",
          background: "linear-gradient(90deg, #FFCB05 0%, #fff 30%, #fbbf24 55%, #c084fc 75%, #FFCB05 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
          backgroundSize: "250% auto",
          animation: phase === "ambient" ? "vip-shimmer-loop 3s linear infinite" : undefined,
          filter: "drop-shadow(0 0 2px #FFCB0555)",
        }}>
          Passe Apoiador Ativado!
        </h1>

        {/* Linha divisória */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, #FFCB0566, #c084fc66, #FFCB0566, transparent)",
          margin: "0 auto 12px",
          maxWidth: 320,
          opacity: subtitleVisible ? 1 : 0,
          transition: "opacity 0.5s",
          animation: subtitleVisible ? "vip-line-grow 0.6s ease both" : undefined,
        }} />

        {/* Subtítulo */}
        <p style={{
          color: "#c084fc",
          fontSize: "clamp(13px, 3vw, 17px)",
          fontWeight: 700,
          margin: "0 0 6px",
          opacity: subtitleVisible ? 1 : 0,
          transition: "opacity 0.5s 0.1s",
          animation: subtitleVisible ? "vip-slide-up 0.5s ease 0.1s both" : undefined,
        }}>
          Título concedido: <span style={{
            color: "#FFCB05",
            textShadow: "0 0 16px #FFCB05aa",
          }}>Pilar da Comunidade</span>
        </p>

        {/* Flavor text */}
        <p style={{
          color: "#94a3b8",
          fontSize: "clamp(11px, 2.2vw, 13px)",
          fontStyle: "italic",
          margin: "6px auto 20px",
          maxWidth: 340,
          lineHeight: 1.6,
          opacity: subtitleVisible ? 1 : 0,
          transition: "opacity 0.5s 0.25s",
        }}>
          &ldquo;Sem você, as luzes se apagariam. Obrigado por manter a Liga viva.&rdquo;
        </p>

        {/* Emojis de comunidade — sempre montados, visibilidade via opacity para evitar pop */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, fontSize: 22, marginBottom: 16 }}>
          {["💛","⚡","🌟","💜","✨","🔥"].map((ch, i) => (
            <span key={i} style={{
              display: "inline-block",
              opacity: phase === "ambient" || phase === "fading" ? 1 : 0,
              transition: `opacity 0.5s ease ${i * 0.1}s`,
              animation: phase === "ambient" || phase === "fading"
                ? `vip-emoji-bob 1.4s ${i * 0.15}s ease-in-out infinite`
                : undefined,
              filter: "drop-shadow(0 0 6px #FFCB0588)",
            }}>
              {ch}
            </span>
          ))}
        </div>

        <p style={{ color: "#475569", fontSize: 11, margin: 0, opacity: subtitleVisible ? 1 : 0, transition: "opacity 0.5s 0.5s" }}>
          Toque para continuar
        </p>
      </div>

      {/* ── CSS keyframes ─────────────────────────────────────────── */}
      <style>{`
        @keyframes vip-confetti-fall {
          0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          80%  { opacity: 0.8; }
          100% { transform: translateY(115vh) rotate(800deg) scale(0.5); opacity: 0; }
        }
        @keyframes vip-ring-expand {
          0%   { opacity: 0; transform: scale(0.15); }
          25%  { opacity: 0.9; }
          100% { opacity: 0; transform: scale(1.9); }
        }
        @keyframes vip-shoot {
          0%   { opacity: 0; transform: rotate(var(--angle, 0deg)) scaleX(0); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: rotate(var(--angle, 0deg)) scaleX(1) translateX(60px); }
        }
        @keyframes vip-crown-bounce {
          0%   { opacity: 0; transform: scale(0.2) rotate(-20deg) translateY(-30px); }
          55%  { transform: scale(1.25) rotate(8deg) translateY(6px); }
          75%  { transform: scale(0.92) rotate(-3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg) translateY(0); }
        }
        @keyframes vip-shimmer-loop {
          0%   { background-position: 250% center; }
          100% { background-position: -250% center; }
        }
        @keyframes vip-line-grow {
          0%   { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        @keyframes vip-slide-up {
          0%   { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes vip-emoji-bob {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-8px) scale(1.15); }
        }
        @keyframes vip-vignette-pulse {
          0%, 100% { box-shadow: inset 0 0 180px #000a; }
          50%       { box-shadow: inset 0 0 220px #000c; }
        }
        @keyframes vip-fw-burst {
          0%   { opacity: 0; transform: scale(0); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: scale(1.6); }
        }
        @keyframes vip-fw-spark {
          0%   { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform: translate(var(--fx,0px), var(--fy,0px)) scale(0.2); }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}

// ── Fogos de artifício ────────────────────────────────────────────────────────

function FireworkBurst({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * 2 * Math.PI;
    const r = rnd(30, 90);
    return {
      fx: `${Math.cos(angle) * r}px`,
      fy: `${Math.sin(angle) * r}px`,
      size: rnd(3, 7),
      dur: rnd(0.5, 0.9),
    };
  });

  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, pointerEvents: "none" }}>
      {/* Flash central */}
      <div style={{
        position: "absolute",
        width: 28, height: 28,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 40px ${color}, 0 0 80px ${color}88`,
        transform: "translate(-50%, -50%)",
        animation: `vip-fw-burst 0.5s ease ${delay}s both`,
        opacity: 0,
      }} />
      {/* Faíscas */}
      {sparks.map((s, i) => (
        <div key={i} style={{
          position: "absolute",
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
          transform: "translate(-50%, -50%)",
          // @ts-expect-error CSS vars
          "--fx": s.fx, "--fy": s.fy,
          animation: `vip-fw-spark ${s.dur}s ease ${delay + 0.05}s both`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}
