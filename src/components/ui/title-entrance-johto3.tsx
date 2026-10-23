"use client";

/**
 * Efeitos de entrada da Liga Johto Zikachu III (chave secundária).
 * Uma única base parametrizada por tier — quanto maior o tier, mais camadas:
 *   1º lugar (5) > 2º (4) > 3º (3) > Campeão da Liga Johto (2) > 4º (1)
 * Texturas em /public/title-effects/johto3 (foil, rays, flare, smoke, laurel).
 */

import { useEffect, useMemo, useState } from "react";

export type Johto3Tier = "FIRST" | "SECOND" | "THIRD" | "CHAMPION" | "FOURTH";

interface Props {
  tier: Johto3Tier;
  name: string;
  flavorText?: string | null;
}

interface TierCfg {
  level: number;
  glyph: string;
  label: string;
  bright: string; mid: string; deep: string; glow: string;
  bg: string;
  confetti: string[];
}

const TEX = "/title-effects/johto3";

const TIERS: Record<Johto3Tier, TierCfg> = {
  FIRST: {
    level: 5, glyph: "1º", label: "1º Lugar",
    bright: "#fff7cc", mid: "#fbbf24", deep: "#b45309", glow: "#fbbf24",
    bg: "radial-gradient(ellipse at 50% 40%,#4d3508 0%,#1d1303 46%,#050300 100%)",
    confetti: ["#fff7cc", "#fbbf24", "#f59e0b", "#fde68a", "#ffffff", "#f97316"],
  },
  SECOND: {
    level: 4, glyph: "2º", label: "2º Lugar",
    bright: "#ffffff", mid: "#cbd5e1", deep: "#475569", glow: "#93c5fd",
    bg: "radial-gradient(ellipse at 50% 40%,#17283f 0%,#0a1220 46%,#02050b 100%)",
    confetti: ["#ffffff", "#cbd5e1", "#93c5fd", "#e2e8f0", "#bae6fd"],
  },
  THIRD: {
    level: 3, glyph: "3º", label: "3º Lugar",
    bright: "#ffe4c7", mid: "#ea8a4b", deep: "#7c2d12", glow: "#fb923c",
    bg: "radial-gradient(ellipse at 50% 40%,#341406 0%,#170a04 46%,#050201 100%)",
    confetti: ["#ffe4c7", "#ea8a4b", "#c2622a", "#fdba74"],
  },
  CHAMPION: {
    level: 2, glyph: "♛", label: "Campeão da Liga Johto",
    bright: "#fff1c2", mid: "#f59e0b", deep: "#b91c1c", glow: "#ef4444",
    bg: "radial-gradient(ellipse at 50% 42%,#42100f 0%,#1b0707 48%,#050101 100%)",
    confetti: ["#fff1c2", "#f59e0b", "#ef4444", "#fb923c"],
  },
  FOURTH: {
    level: 1, glyph: "4º", label: "4º Lugar",
    bright: "#d1fae5", mid: "#6ee7b7", deep: "#0f766e", glow: "#34d399",
    bg: "radial-gradient(ellipse at 50% 42%,#0a2e29 0%,#06171a 50%,#02080a 100%)",
    confetti: ["#d1fae5", "#6ee7b7", "#34d399"],
  },
};

const rnd = (a: number, b: number) => Math.random() * (b - a) + a;
type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

export function Johto3PlacementEffect({ tier, name, flavorText }: Props) {
  const c = TIERS[tier];
  const L = c.level;
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAmbient(true), 1800);
    return () => clearTimeout(t);
  }, []);

  const metal = `linear-gradient(115deg,${c.deep} 0%,${c.mid} 28%,${c.bright} 50%,${c.mid} 72%,${c.deep} 100%)`;
  const foil = `url(${TEX}/foil.webp)`;
  // Texto/ornamento metálico: gradiente do tier + textura de folha em overlay + brilho varrendo.
  const metalFill: React.CSSProperties = {
    backgroundImage: `${foil}, ${metal}`,
    backgroundBlendMode: "overlay, normal",
    backgroundSize: "256px 256px, 220% 100%",
    animation: "j3-sweep 3.2s linear infinite",
  };

  const fx = useMemo(() => {
    const rays = L >= 4 ? 2 : L >= 2 ? 1 : 0;
    const pillarsN = L === 5 ? 9 : L === 4 ? 5 : 0;
    const pillars = Array.from({ length: pillarsN }, (_, i) => {
      const mid = (pillarsN - 1) / 2, d = Math.abs(i - mid) / mid;
      return { x: 6 + (88 / (pillarsN - 1)) * i, h: 100 - d * 52, w: i === mid ? 8 : 3, delay: d * 0.35, hero: i === mid };
    });
    const rings = [1, 1, 2, 3, 4][L - 1];
    const flares = Array.from({ length: [1, 3, 4, 6, 10][L - 1] }, () => ({
      x: rnd(8, 92), y: rnd(8, 88), s: rnd(26, 70), d: rnd(0, 3), t: rnd(1.6, 3.2),
    }));
    // L>=3: confete caindo; L<=2: brasas subindo
    const confN = [0, 0, 16, 26, 44][L - 1];
    const confetti = Array.from({ length: confN }, (_, i) => ({
      x: rnd(2, 98), col: c.confetti[i % c.confetti.length], w: rnd(6, 13), h: rnd(4, 9),
      d: rnd(0, 2.2), t: rnd(2.4, 4.4), r: rnd(-540, 540),
    }));
    const embN = [8, 22, 0, 0, 0][L - 1];
    const embers = Array.from({ length: embN }, (_, i) => ({
      x: rnd(4, 96), s: rnd(3, 8), col: c.confetti[i % c.confetti.length],
      d: rnd(0, 3), t: rnd(2.8, 5), dx: rnd(-40, 40),
    }));
    const smoke = L >= 3;
    return { rays, pillars, rings, flares, confetti, embers, smoke };
  }, [L, c.confetti]);

  const medal = "min(250px,58vw)";
  const glowAnim = ambient ? "j3-breathe 2.6s ease-in-out infinite" : undefined;

  return (
    <>
      <style>{CSS}</style>

      {/* Fundo + vinheta */}
      <div className="absolute inset-0" style={{ background: c.bg, animation: "entrance-in .2s ease forwards" }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: `inset 0 0 200px ${c.glow}${ambient ? "55" : "33"}`, transition: "box-shadow 1.2s", zIndex: 1,
      }} />

      {/* Fumaça de textura (neblina dourada/prateada se movendo) */}
      {fx.smoke && [0, 1].map((i) => (
        <div key={i} className="absolute inset-0 pointer-events-none" style={{
          zIndex: 1, opacity: 0, mixBlendMode: "screen",
          backgroundImage: `url(${TEX}/smoke.webp)`, backgroundSize: "720px 720px",
          filter: `sepia(1) saturate(3) hue-rotate(${tier === "SECOND" ? 170 : tier === "THIRD" ? -20 : 0}deg)`,
          animation: `j3-smoke${i} ${26 + i * 10}s linear infinite, j3-fade-in 2s ease ${0.3 + i * 0.4}s forwards`,
          ["--o" as string]: i ? 0.18 : 0.26,
        } as Vars} />
      ))}

      {/* Raios de luz girando em sentidos opostos */}
      {Array.from({ length: fx.rays }, (_, i) => (
        <div key={i} className="absolute pointer-events-none" style={{
          zIndex: 2, left: "50%", top: "38%", width: "170vmax", height: "170vmax",
          marginLeft: "-85vmax", marginTop: "-85vmax",
          backgroundImage: `url(${TEX}/rays.webp)`, backgroundSize: "100% 100%",
          mixBlendMode: "screen", opacity: 0,
          filter: `sepia(1) saturate(4) hue-rotate(${tier === "SECOND" ? 170 : tier === "THIRD" ? -20 : tier === "CHAMPION" ? -30 : tier === "FOURTH" ? 100 : 0}deg)`,
          animation: `${i ? "j3-spin-r 55s" : "j3-spin 40s"} linear infinite, j3-fade-in 1.4s ease ${0.2 + i * 0.3}s forwards`,
          ["--o" as string]: L === 2 ? 0.28 : i ? 0.35 : 0.55,
        } as Vars} />
      ))}

      {/* Pilares de luz */}
      {fx.pillars.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "78%", zIndex: 3 }}>
          {fx.pillars.map((p, i) => (
            <div key={i} style={{
              position: "absolute", left: `${p.x}%`, bottom: 0, width: p.w, height: `${p.h}%`,
              background: `linear-gradient(to top,${c.mid}ee,${c.bright}88 45%,transparent)`,
              boxShadow: `0 0 ${p.w * 5}px ${c.glow}88`, borderRadius: `${p.w}px ${p.w}px 0 0`,
              opacity: 0, animation: `j3-pillar 1.5s cubic-bezier(.16,1,.3,1) ${p.delay}s forwards`,
            }}>
              {p.hero && ambient && <div style={{
                position: "absolute", top: -10, left: "50%", marginLeft: -9, width: 18, height: 18,
                backgroundImage: `url(${TEX}/flare.webp)`, backgroundSize: "100% 100%",
                animation: "j3-twinkle 1.4s ease-in-out infinite",
              }} />}
            </div>
          ))}
        </div>
      )}

      {/* Anéis + onda de choque saindo da medalha */}
      <div className="absolute inset-x-0 pointer-events-none" style={{ top: "38%", zIndex: 4 }}>
        {Array.from({ length: fx.rings }, (_, i) => (
          <div key={i} style={{
            position: "absolute", left: "50%", top: 0, width: 160 + i * 110, height: 160 + i * 110,
            marginLeft: -(80 + i * 55), marginTop: -(80 + i * 55), borderRadius: "50%",
            border: `${2 - i * 0.3}px solid ${i % 2 ? c.bright : c.mid}`,
            boxShadow: `0 0 24px ${c.glow}66, inset 0 0 24px ${c.glow}33`,
            opacity: 0, animation: `j3-ring ${1.8 + i * 0.2}s ease-out ${0.3 + i * 0.22}s ${ambient && L >= 4 ? "infinite" : "forwards"}`,
          }} />
        ))}
        {L >= 2 && (
          <div style={{
            position: "absolute", left: "50%", top: 0, width: 80, height: 80, marginLeft: -40, marginTop: -40,
            borderRadius: "50%", background: `radial-gradient(circle,#fff 0%,${c.bright}88 30%,transparent 70%)`,
            opacity: 0, animation: "j3-shock 1s cubic-bezier(.1,.8,.3,1) .15s forwards",
          }} />
        )}
      </div>

      {/* Confete / brasas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 6 }}>
        {fx.confetti.map((p, i) => (
          <div key={`c${i}`} style={{
            position: "absolute", left: `${p.x}%`, top: -20, width: p.w, height: p.h, background: p.col,
            borderRadius: 2, boxShadow: `0 0 6px ${p.col}aa`,
            ["--r" as string]: `${p.r}deg`,
            animation: `j3-confetti ${p.t}s ease-in ${p.d}s ${ambient ? "infinite" : "forwards"}`,
          } as Vars} />
        ))}
        {fx.embers.map((p, i) => (
          <div key={`e${i}`} style={{
            position: "absolute", left: `${p.x}%`, bottom: -10, width: p.s, height: p.s, borderRadius: "50%",
            background: p.col, boxShadow: `0 0 10px ${p.col}, 0 0 20px ${c.glow}88`, opacity: 0,
            ["--dx" as string]: `${p.dx}px`,
            animation: `j3-ember ${p.t}s ease-out ${p.d}s infinite`,
          } as Vars} />
        ))}
      </div>

      {/* Estrelas de brilho (lens flare) */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 7 }}>
        {fx.flares.map((f, i) => (
          <div key={i} style={{
            position: "absolute", left: `${f.x}%`, top: `${f.y}%`, width: f.s, height: f.s,
            marginLeft: -f.s / 2, marginTop: -f.s / 2, mixBlendMode: "screen", opacity: 0,
            backgroundImage: `url(${TEX}/flare.webp)`, backgroundSize: "100% 100%",
            filter: `drop-shadow(0 0 8px ${c.glow})`,
            animation: `j3-twinkle ${f.t}s ease-in-out ${0.6 + f.d}s infinite`,
          }} />
        ))}
      </div>

      {/* Faixas de folha metálica no topo e na base */}
      {L >= 3 && [0, 1].map((i) => (
        <div key={i} className="absolute inset-x-0 pointer-events-none" style={{
          [i ? "bottom" : "top"]: 0, height: L === 5 ? 14 : 9, zIndex: 8, ...metalFill,
          boxShadow: `0 0 28px ${c.glow}99`,
          animationName: `j3-sweep, ${i ? "j3-band-b" : "j3-band-t"}`,
          animationDuration: "3.2s, .9s", animationIterationCount: "infinite, 1",
          animationFillMode: "none, both", animationTimingFunction: "linear, cubic-bezier(.2,1,.3,1)",
        } as React.CSSProperties} />
      ))}

      {/* Flash de câmera na estreia */}
      {L >= 2 && (
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 20, background: `radial-gradient(circle at 50% 38%,#fff,${c.bright}88 40%,transparent 75%)`,
          opacity: 0, animation: `j3-flash ${L === 5 ? "1.3s" : ".8s"} ease-out .1s forwards`,
        }} />
      )}

      {/* Conteúdo central: medalha + selo + título */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 10, paddingTop: "4vh" }}>
        {/* Medalha */}
        <div style={{ position: "relative", width: medal, height: medal, marginBottom: "clamp(4px,1.5vh,14px)" }}>
          <div style={{
            position: "absolute", inset: "-14%", borderRadius: "50%", pointerEvents: "none",
            background: `radial-gradient(circle,${c.glow}66 0%,${c.glow}22 45%,transparent 70%)`,
            animation: glowAnim,
          }} />
          {L >= 3 ? (
            <div style={{
              position: "absolute", inset: 0, opacity: 0,
              WebkitMaskImage: `url(${TEX}/laurel.webp)`, maskImage: `url(${TEX}/laurel.webp)`,
              WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
              filter: `drop-shadow(0 0 10px ${c.glow}aa)`,
              ...metalFill,
              animationName: "j3-laurel, j3-sweep",
              animationDuration: ".9s, 3.2s", animationDelay: ".35s, 0s",
              animationIterationCount: "1, infinite", animationFillMode: "forwards, none",
              animationTimingFunction: "cubic-bezier(.2,1.2,.3,1), linear",
            }} />
          ) : (
            <div style={{
              position: "absolute", inset: "14%", borderRadius: L === 2 ? "22%" : "50%", opacity: 0,
              transform: L === 2 ? "rotate(45deg)" : undefined,
              border: `${L === 2 ? 4 : 3}px solid transparent`,
              backgroundImage: `linear-gradient(#0000,#0000),${metal}`,
              backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box",
              boxShadow: `0 0 28px ${c.glow}88, inset 0 0 28px ${c.glow}33`,
              animation: `j3-badge .8s cubic-bezier(.2,1.3,.3,1) .35s forwards${L === 2 && ambient ? ", j3-diamond 6s ease-in-out infinite" : ""}`,
            }} />
          )}
          {/* Numeral / glifo metálico */}
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: L === 2 ? "min(110px,25vw)" : "min(104px,24vw)", lineHeight: 1, opacity: 0,
            backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 2px 0 ${c.deep}) drop-shadow(0 0 18px ${c.glow}bb)`,
            animation: "j3-glyph .7s cubic-bezier(.2,1.5,.35,1) .8s forwards",
            ...metalFill,
            animationName: "j3-glyph, j3-sweep",
            animationDuration: ".7s, 3.2s", animationDelay: ".8s, 0s",
            animationIterationCount: "1, infinite", animationFillMode: "forwards, none",
            animationTimingFunction: "cubic-bezier(.2,1.5,.35,1), linear",
          }}>
            {c.glyph}
          </div>
          {/* Coroa cai sobre os louros (só 1º) */}
          {L === 5 && (
            <div style={{
              position: "absolute", left: 0, right: 0, top: "-9%", textAlign: "center", fontSize: "min(54px,12vw)",
              opacity: 0, filter: `drop-shadow(0 0 16px ${c.glow}) drop-shadow(0 0 34px ${c.glow}88)`,
              animation: "j3-crown 1s cubic-bezier(.22,1.5,.36,1) 1.1s forwards",
            }}>👑</div>
          )}
        </div>

        {/* Selo com o nome da colocação */}
        <div style={{
          opacity: 0, animation: "j3-stamp .7s cubic-bezier(.36,.07,.19,.97) 1.2s forwards",
          fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.34em",
          fontSize: "clamp(10px,2.3vw,14px)", padding: "6px clamp(14px,4vw,26px)", borderRadius: 6,
          color: c.bright, border: `2px solid ${c.mid}aa`, background: `linear-gradient(135deg,${c.deep}55,#0000)`,
          textShadow: `0 0 18px ${c.glow}`, boxShadow: `0 0 30px ${c.glow}44`, textAlign: "center",
        }}>
          {c.label} <span style={{ opacity: 0.6 }}>·</span> Johto Zikachu III
        </div>

        {/* Título */}
        <div style={{ textAlign: "center", marginTop: "clamp(10px,2.6vh,22px)", opacity: 0, animation: "j3-title 1s cubic-bezier(.16,1,.3,1) 1.5s forwards" }}>
          <p style={{
            margin: 0, padding: "0 20px", fontWeight: 900, letterSpacing: "0.06em", lineHeight: 1.2,
            fontSize: "clamp(24px,6.2vw,44px)",
            backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 0 14px ${c.glow}) drop-shadow(0 0 34px ${c.glow}88)`,
            ...metalFill,
            // gradiente mais claro que o das ornamentações, p/ manter o nome legível
            backgroundImage: `${foil}, linear-gradient(115deg,${c.mid} 0%,${c.bright} 30%,${c.mid} 50%,${c.bright} 70%,${c.mid} 100%)`,
          }}>{name}</p>
          {flavorText && (
            <p style={{
              margin: "12px 24px 0", fontStyle: "italic", lineHeight: 1.6, color: `${c.bright}d0`,
              fontSize: "clamp(12px,2.8vw,15px)", textShadow: `0 0 14px ${c.glow}88`,
            }}>&ldquo;{flavorText}&rdquo;</p>
          )}
        </div>
      </div>
    </>
  );
}

const CSS = `
@keyframes j3-fade-in { to { opacity: var(--o,1); } }
@keyframes j3-spin   { to { transform: rotate(360deg); } }
@keyframes j3-spin-r { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
@keyframes j3-smoke0 { from { background-position: 0 0; } to { background-position: 720px 360px; } }
@keyframes j3-smoke1 { from { background-position: 0 0; } to { background-position: -720px 540px; } }
@keyframes j3-sweep  { from { background-position: 0 0, 220% 0; } to { background-position: 0 0, -120% 0; } }
@keyframes j3-pillar { 0% { opacity:0; transform: scaleY(0); transform-origin: bottom; } 15% { opacity:1; } 100% { opacity:.85; transform: scaleY(1); transform-origin: bottom; } }
@keyframes j3-ring   { 0% { opacity:0; transform: scale(.2); } 25% { opacity:.9; } 100% { opacity:0; transform: scale(1.9); } }
@keyframes j3-shock  { 0% { opacity:1; transform: scale(.2); } 100% { opacity:0; transform: scale(14); } }
@keyframes j3-flash  { 0% { opacity:0; } 8% { opacity:1; } 100% { opacity:0; } }
@keyframes j3-confetti { 0% { transform: translateY(0) rotate(0); opacity:1; } 100% { transform: translateY(112vh) rotate(var(--r)); opacity:.9; } }
@keyframes j3-ember  { 0% { transform: translate(0,0) scale(1); opacity:0; } 15% { opacity:1; } 100% { transform: translate(var(--dx),-85vh) scale(.3); opacity:0; } }
@keyframes j3-twinkle { 0%,100% { opacity:0; transform: scale(.4) rotate(0); } 50% { opacity:1; transform: scale(1) rotate(45deg); } }
@keyframes j3-band-t { from { transform: translateY(-100%); } to { transform: translateY(0); } }
@keyframes j3-band-b { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes j3-laurel { 0% { opacity:0; transform: scale(.55) rotate(-25deg); } 100% { opacity:1; transform: scale(1) rotate(0); } }
@keyframes j3-badge  { 0% { opacity:0; transform: scale(.3) rotate(0); } 100% { opacity:1; transform: scale(1); } }
@keyframes j3-diamond { 0%,100% { transform: rotate(45deg) scale(1); } 50% { transform: rotate(135deg) scale(1.06); } }
@keyframes j3-glyph  { 0% { opacity:0; transform: scale(2.4); } 100% { opacity:1; transform: scale(1); } }
@keyframes j3-crown  { 0% { opacity:0; transform: translateY(-70px) scale(.4) rotate(-18deg); } 60% { transform: translateY(8px) scale(1.15) rotate(5deg); } 100% { opacity:1; transform: translateY(0) scale(1) rotate(0); } }
@keyframes j3-stamp  { 0% { opacity:0; transform: scale(2.2) rotate(-4deg); } 100% { opacity:1; transform: scale(1) rotate(0); } }
@keyframes j3-title  { 0% { opacity:0; transform: translateY(26px) scale(.88); } 100% { opacity:1; transform: translateY(0) scale(1); } }
@keyframes j3-breathe { 0%,100% { opacity:.7; transform: scale(1); } 50% { opacity:1; transform: scale(1.08); } }
`;
