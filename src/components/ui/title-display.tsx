"use client";

/**
 * TitleDisplay — exibe títulos de perfil com efeitos visuais por raridade.
 *
 * Contextos:
 *   "profile"   → animação completa de entrada + frase de sabor (flavorText)
 *   "inventory" → animação completa, sem frase (preview do item)
 *   "feed"      → cor + badge, sem animação (listas densas)
 *   "ranking"   → cor + glow estático, sem animação (tabelas de ranking)
 *
 * Raridades:  COMMON · UNCOMMON · RARE · EPIC · LEGENDARY · MYTHIC · RELIC
 * Temas:      NEUTRAL · ELECTRIC · FIRE · WATER · GRASS · ZIKABET
 *
 * Variação de efeito: determinística pelo nome do título (hash simples)
 * para que o mesmo título sempre use o mesmo efeito, sem randomness no render.
 */

import { useEffect, useState } from "react";

export type TitleRarity =
  | "COMMON" | "UNCOMMON" | "RARE" | "EPIC"
  | "LEGENDARY" | "MYTHIC" | "RELIC";

export type TitleTheme =
  | "NEUTRAL" | "ELECTRIC" | "FIRE" | "WATER" | "GRASS" | "ZIKABET";

export type TitleContext = "profile" | "ranking" | "feed" | "inventory";

interface Props {
  name: string;
  rarity?: TitleRarity | string;
  theme?: TitleTheme | string;
  flavorText?: string | null;
  context?: TitleContext;
  className?: string;
  /** Atrasa o início da animação (ms) — útil p/ stagger em listas */
  staggerDelay?: number;
}

// ── Hash deterministico do nome → seleciona variante ─────────────────────────
// Evita Math.random() e garante que o mesmo título sempre gere o mesmo efeito.
function nameHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Variantes de entrada por raridade ────────────────────────────────────────
// Cada raridade tem um array de variantes; selecionamos via nameHash % length.
// "charByChar" = usar animação letra-a-letra em vez de entry string.

interface EntryVariant {
  animation: string | null;  // CSS animation shorthand; null = char-by-char
  durationMs: number;
  charMode?: "drop" | "slide" | "fade"; // qual @keyframe usar no char-by-char
}

const RARITY_VARIANTS: Record<string, EntryVariant[]> = {
  COMMON: [
    { animation: "title-fade-in 0.35s ease forwards",       durationMs: 350 },
    { animation: "title-typewriter 0.5s steps(1) forwards", durationMs: 500 },
  ],
  UNCOMMON: [
    { animation: "title-slide-fade 0.5s ease forwards",     durationMs: 500 },
    { animation: "title-cascade 0.6s ease forwards",         durationMs: 600 },
    { animation: "title-drop-in 0.5s ease forwards",         durationMs: 500 },
  ],
  RARE: [
    { animation: "title-rise-fade 0.6s ease forwards",      durationMs: 600 },
    { animation: "title-flicker 0.8s ease forwards",         durationMs: 800 },
    { animation: "title-pulse-in 0.7s ease forwards",        durationMs: 700 },
  ],
  EPIC: [
    { animation: null, durationMs: 900,  charMode: "slide" },  // char-by-char slide
    { animation: null, durationMs: 1000, charMode: "drop" },   // char-by-char drop
    { animation: "title-glitch 0.9s ease forwards",            durationMs: 900 },
  ],
  LEGENDARY: [
    { animation: "title-golden-flash 1.2s ease forwards",   durationMs: 1200 },
    { animation: "title-stamp 1.0s cubic-bezier(.36,.07,.19,.97) forwards", durationMs: 1000 },
    { animation: "title-shockwave 1.1s ease forwards",       durationMs: 1100 },
  ],
  MYTHIC: [
    { animation: "title-lightning 1.5s ease forwards",      durationMs: 1500 },
    { animation: "title-shockwave 1.3s ease forwards",       durationMs: 1300 },
    { animation: "title-flicker 0.6s ease forwards",         durationMs: 900 },
  ],
  RELIC: [
    { animation: "title-stamp 1.6s cubic-bezier(.36,.07,.19,.97) forwards", durationMs: 1600 },
    { animation: "title-golden-flash 1.8s ease forwards",   durationMs: 1800 },
    { animation: "title-shockwave 1.5s ease forwards",       durationMs: 1500 },
  ],
};

// ── Config de cor e glow por raridade ────────────────────────────────────────

interface RarityDef {
  color: string;
  gradient?: string;
  glowColor: string;
  sparkles: boolean;
  shimmer: boolean;
  continuousGlow: boolean;
  rarityBadge: string;
  label: string;
}

const RARITY_CFG: Record<string, RarityDef> = {
  COMMON: {
    color: "#e2e8f0", glowColor: "transparent",
    sparkles: false, shimmer: false, continuousGlow: false,
    rarityBadge: "", label: "Comum",
  },
  UNCOMMON: {
    color: "#4ade80", glowColor: "#4ade8066",
    sparkles: false, shimmer: false, continuousGlow: false,
    rarityBadge: "", label: "Incomum",
  },
  RARE: {
    color: "#60a5fa", glowColor: "#60a5fa88",
    sparkles: false, shimmer: false, continuousGlow: true,
    rarityBadge: "", label: "Raro",
  },
  EPIC: {
    color: "#c084fc", glowColor: "#c084fc99",
    sparkles: true, shimmer: false, continuousGlow: true,
    rarityBadge: "✦", label: "Épico",
  },
  LEGENDARY: {
    color: "#fb923c",
    gradient: "linear-gradient(90deg,#f97316,#fbbf24,#f97316)",
    glowColor: "#fb923caa",
    sparkles: false, shimmer: true, continuousGlow: true,
    rarityBadge: "✦", label: "Lendário",
  },
  MYTHIC: {
    color: "#fbbf24",
    gradient: "linear-gradient(90deg,#fbbf24 0%,#ffffff 40%,#fbbf24 80%,#fef08a 100%)",
    glowColor: "#fbbf24cc",
    sparkles: true, shimmer: true, continuousGlow: true,
    rarityBadge: "⚡", label: "Mítico",
  },
  RELIC: {
    color: "#ef4444",
    gradient: "linear-gradient(90deg,#ef4444 0%,#fbbf24 35%,#ffffff 50%,#fbbf24 65%,#ef4444 100%)",
    glowColor: "#fbbf24cc",
    sparkles: true, shimmer: true, continuousGlow: true,
    rarityBadge: "👑", label: "Relíquia",
  },
};

// ── Char-by-char keyframes por modo ──────────────────────────────────────────

const CHAR_KEYFRAME: Record<string, string> = {
  slide: "title-char-in",
  drop:  "title-drop-in",
  fade:  "title-fade-in",
};

// ── Badge por tema ────────────────────────────────────────────────────────────

const THEME_BADGE: Record<string, string> = {
  NEUTRAL: "", ELECTRIC: "⚡", FIRE: "🔥", WATER: "🌊", GRASS: "🌿", ZIKABET: "🎰",
};

// ── Sparkles — posições fixas para evitar random no render ───────────────────

const SPARKLE_POS = [
  { left: "6%",  top: -10, delay: 0.05, size: 3 },
  { left: "20%", top: -14, delay: 0.35, size: 2 },
  { left: "38%", top: -8,  delay: 0.15, size: 4 },
  { left: "55%", top: -12, delay: 0.50, size: 2 },
  { left: "70%", top: -9,  delay: 0.25, size: 3 },
  { left: "86%", top: -13, delay: 0.45, size: 2 },
  { left: "48%", top: -16, delay: 0.65, size: 3 },
  { left: "30%", top: -6,  delay: 0.70, size: 2 },
];

// ── Componente ────────────────────────────────────────────────────────────────

export function TitleDisplay({
  name,
  rarity = "COMMON",
  theme = "NEUTRAL",
  flavorText,
  context = "profile",
  className = "",
  staggerDelay = 0,
}: Props) {
  const [animated, setAnimated] = useState(false);
  const [glowing,  setGlowing]  = useState(false);

  const cfg  = RARITY_CFG[rarity] ?? RARITY_CFG.COMMON;
  const vars = RARITY_VARIANTS[rarity] ?? RARITY_VARIANTS.COMMON;

  // Seleciona variante deterministicamente pelo nome
  const variant = vars[nameHash(name) % vars.length];
  const isCharByChar = variant.animation === null;
  const charKeyframe = CHAR_KEYFRAME[variant.charMode ?? "slide"];

  const themeBadge = THEME_BADGE[theme ?? "NEUTRAL"] ?? "";
  const animate    = context === "profile" || context === "inventory";
  const useGradient = !!cfg.gradient;

  const badge =
    rarity === "MYTHIC" || rarity === "RELIC"
      ? cfg.rarityBadge
      : themeBadge || cfg.rarityBadge;

  useEffect(() => {
    if (!animate) return;
    const tStart = setTimeout(() => {
      setAnimated(true);
      const tGlow = setTimeout(() => setGlowing(true), variant.durationMs);
      return () => clearTimeout(tGlow);
    }, staggerDelay);
    return () => clearTimeout(tStart);
  }, [animate, variant.durationMs, staggerDelay]);

  // ── Ranking: apenas cor + glow estático ──────────────────────────────────
  if (context === "ranking") {
    return (
      <span className={`font-semibold ${className}`} style={{
        color: cfg.color,
        textShadow: cfg.glowColor !== "transparent" ? `0 0 6px ${cfg.glowColor}` : undefined,
      }}>
        {badge && <span className="mr-0.5">{badge}</span>}
        {name}
      </span>
    );
  }

  // ── Feed: cor + badge, sem animação ──────────────────────────────────────
  if (context === "feed") {
    return (
      <span className={`font-semibold ${className}`} style={{ color: cfg.color }}>
        {badge && <span className="mr-0.5">{badge}</span>}
        {name}
      </span>
    );
  }

  // ── Profile / Inventory: efeito completo ─────────────────────────────────

  const continuousFilter =
    glowing && cfg.continuousGlow
      ? `drop-shadow(0 0 6px ${cfg.glowColor}) drop-shadow(0 0 14px ${cfg.glowColor})`
      : undefined;

  const shimmerActive = cfg.shimmer && glowing;

  // Renderiza char-by-char
  const renderCharByChar = () =>
    name.split("").map((ch, i) => (
      <span key={i} style={{
        display: "inline-block",
        animation: animated ? `${charKeyframe} 0.28s ease forwards` : undefined,
        animationDelay: animated ? `${i * 55}ms` : undefined,
        opacity: animated ? 0 : 1,
        color: cfg.color,
        filter: continuousFilter,
        whiteSpace: ch === " " ? "pre" : undefined,
      }}>
        {ch === " " ? " " : ch}
      </span>
    ));

  // Estilo do span de texto principal
  const textStyle: React.CSSProperties = useGradient
    ? {
        backgroundImage: shimmerActive
          ? `linear-gradient(90deg,${cfg.color} 0%,${cfg.color} 20%,#ffffff 38%,${cfg.color} 55%,${cfg.color} 100%)`
          : cfg.gradient,
        backgroundSize: shimmerActive ? "200% auto" : "auto",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        animation: shimmerActive
          ? "title-shimmer-loop 3s linear infinite"
          : animated && variant.animation
          ? variant.animation
          : undefined,
        filter: continuousFilter,
      }
    : {
        color: cfg.color,
        animation: animated && variant.animation && !isCharByChar ? variant.animation : undefined,
        textShadow: glowing && cfg.continuousGlow
          ? `0 0 8px ${cfg.glowColor}, 0 0 18px ${cfg.glowColor}`
          : undefined,
      };

  const renderText = () =>
    isCharByChar && animated
      ? renderCharByChar()
      : <span style={textStyle}>{name}</span>;

  return (
    <div className={`inline-block leading-none ${className}`}>
      <div className="relative inline-flex items-center gap-1.5">

        {/* Sparkles */}
        {cfg.sparkles && animated && (
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
            {SPARKLE_POS.map((s, i) => (
              <span key={i} style={{
                position: "absolute", left: s.left, top: s.top,
                width: s.size, height: s.size,
                borderRadius: "50%",
                background: cfg.color, boxShadow: `0 0 4px ${cfg.color}`,
                animation: "title-sparkle 1.3s ease forwards",
                animationDelay: `${s.delay}s`, opacity: 0,
              }} />
            ))}
          </span>
        )}

        {badge && (
          <span className="select-none text-sm leading-none" style={{ filter: continuousFilter }}>
            {badge}
          </span>
        )}

        <span className="font-bold text-sm leading-none tracking-wide">
          {renderText()}
        </span>

        {badge && (rarity === "LEGENDARY" || rarity === "MYTHIC" || rarity === "RELIC") && (
          <span className="select-none text-sm leading-none" style={{ filter: continuousFilter }}>
            {badge}
          </span>
        )}
      </div>

      {/* Frase de sabor */}
      {context === "profile" && flavorText && (
        <p className="mt-1 text-[11px] italic" style={{
          color: cfg.color,
          ...(animated
            ? { animation: "title-flavor-in 0.5s ease forwards", animationDelay: `${variant.durationMs + 200}ms` }
            : { opacity: 0.75 }),
        }}>
          &ldquo;{flavorText}&rdquo;
        </p>
      )}
    </div>
  );
}
