"use client";

/**
 * VipCelebration — animação de boas-vindas ao Passe Apoiador.
 * Pure CSS + React, zero imagens externas, zero egress Supabase.
 * Toca uma única vez quando o jogador ativa o VIP.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const COLORS = ["#FFCB05", "#f97316", "#c084fc", "#60a5fa", "#4ade80", "#fbbf24", "#fff", "#fb923c"];
const STAR_CHARS = ["⭐", "✨", "🌟", "💫", "⚡"];

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  char?: string;
}

function generateParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: 5 + (i / n) * 90,
    color: COLORS[i % COLORS.length],
    delay: (i * 0.06) % 1.5,
    duration: 1.8 + (i % 5) * 0.25,
    size: 6 + (i % 4) * 4,
    char: i % 5 === 0 ? STAR_CHARS[i % STAR_CHARS.length] : undefined,
  }));
}

const PARTICLES = generateParticles(40);

interface Props {
  onDone: () => void;
}

export function VipCelebration({ onDone }: Props) {
  const [phase, setPhase] = useState<"burst" | "title" | "fading" | "done">("burst");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t1 = setTimeout(() => setPhase("title"), 600);
    const t2 = setTimeout(() => setPhase("fading"), 3200);
    const t3 = setTimeout(() => { setPhase("done"); onDone(); }, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  if (!mounted || phase === "done") return null;

  const content = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(ellipse at 50% 40%, #1a0a3a 0%, #0a0a1a 70%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        opacity: phase === "fading" ? 0 : 1,
        transition: "opacity 0.8s ease",
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
      onClick={onDone}
    >
      {/* Confetti / particles */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {PARTICLES.map(p => (
          <div key={p.id} style={{
            position: "absolute",
            left: `${p.x}%`,
            top: "-10%",
            width: p.char ? "auto" : p.size,
            height: p.char ? "auto" : p.size,
            fontSize: p.char ? p.size + 4 : undefined,
            borderRadius: p.char ? undefined : "50%",
            background: p.char ? "transparent" : p.color,
            color: p.color,
            animation: `vip-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}>
            {p.char ?? ""}
          </div>
        ))}
      </div>

      {/* Glow rings */}
      <div style={{
        position: "absolute",
        width: 360, height: 360,
        borderRadius: "50%",
        border: "2px solid #FFCB05",
        boxShadow: "0 0 60px #FFCB0555, 0 0 120px #FFCB0522",
        animation: "vip-ring-pulse 1.8s ease-out forwards",
        opacity: 0,
      }} />
      <div style={{
        position: "absolute",
        width: 280, height: 280,
        borderRadius: "50%",
        border: "1px solid #c084fc",
        boxShadow: "0 0 40px #c084fc44",
        animation: "vip-ring-pulse 1.8s 0.2s ease-out forwards",
        opacity: 0,
      }} />

      {/* Main content */}
      <div style={{
        position: "relative", zIndex: 1, textAlign: "center", padding: "0 24px",
        animation: phase === "burst" ? "vip-pop-in 0.5s 0.3s ease both" : undefined,
        opacity: phase === "burst" ? 0 : 1,
      }}>
        <div style={{
          fontSize: "clamp(48px, 10vw, 80px)",
          animation: "vip-bounce 0.6s 0.5s ease both",
          display: "block",
          opacity: phase === "burst" ? 0 : 1,
        }}>
          ⭐
        </div>

        <h1 style={{
          fontFamily: "inherit",
          fontSize: "clamp(20px, 5vw, 32px)",
          fontWeight: 900,
          letterSpacing: "0.05em",
          background: "linear-gradient(90deg, #FFCB05 0%, #fff 40%, #fbbf24 80%, #FFCB05 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
          animation: "vip-shimmer-loop 3s linear infinite",
          backgroundSize: "200% auto",
          margin: "16px 0 8px",
          textTransform: "uppercase",
        }}>
          Passe Apoiador Ativado!
        </h1>

        <p style={{ color: "#c084fc", fontSize: "clamp(13px, 2.5vw, 16px)", margin: "0 0 8px", fontWeight: 600 }}>
          Título concedido: <span style={{ color: "#fbbf24" }}>Pilar da Comunidade</span>
        </p>

        <p style={{ color: "#94a3b8", fontSize: "clamp(11px, 2vw, 13px)", fontStyle: "italic", maxWidth: 320, margin: "0 auto 24px" }}>
          &ldquo;Sem você, as luzes se apagariam.&rdquo;
        </p>

        <p style={{ color: "#64748b", fontSize: 11 }}>
          Toque para continuar
        </p>
      </div>

      {/* CSS keyframes inlined via style tag */}
      <style>{`
        @keyframes vip-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes vip-ring-pulse {
          0%   { opacity: 0; transform: scale(0.3); }
          40%  { opacity: 0.8; }
          100% { opacity: 0; transform: scale(1.6); }
        }
        @keyframes vip-pop-in {
          0%   { opacity: 0; transform: scale(0.6); }
          70%  { transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes vip-bounce {
          0%   { opacity: 0; transform: scale(0) rotate(-20deg); }
          60%  { transform: scale(1.3) rotate(10deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes vip-shimmer-loop {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
