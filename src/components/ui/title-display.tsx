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
}

// ── Config por raridade ────────────────────────────────────────────────────────

interface RarityDef {
  color: string;
  gradient?: string;     // para gradient text (LEGENDARY+)
  glowColor: string;
  entry: string | null;  // CSS animation shorthand, null = char-by-char
  entryMs: number;       // duração em ms p/ acionar continuous glow
  charByChar: boolean;
  sparkles: boolean;
  shimmer: boolean;      // shimmer loop após entrada
  continuousGlow: boolean;
  rarityBadge: string;
  label: string;
}

const RARITY_CFG: Record<string, RarityDef> = {
  COMMON: {
    color: "#e2e8f0", glowColor: "transparent",
    entry: "title-fade-in 0.3s ease forwards",
    entryMs: 300,
    charByChar: false, sparkles: false, shimmer: false, continuousGlow: false,
    rarityBadge: "", label: "Comum",
  },
  UNCOMMON: {
    color: "#4ade80", glowColor: "#4ade8066",
    entry: "title-slide-fade 0.5s ease forwards",
    entryMs: 500,
    charByChar: false, sparkles: false, shimmer: false, continuousGlow: false,
    rarityBadge: "", label: "Incomum",
  },
  RARE: {
    color: "#60a5fa", glowColor: "#60a5fa88",
    entry: "title-rise-fade 0.6s ease forwards",
    entryMs: 600,
    charByChar: false, sparkles: false, shimmer: false, continuousGlow: true,
    rarityBadge: "", label: "Raro",
  },
  EPIC: {
    color: "#c084fc", glowColor: "#c084fc99",
    entry: null, // usa char-by-char
    entryMs: 1000,
    charByChar: true, sparkles: true, shimmer: false, continuousGlow: true,
    rarityBadge: "✦", label: "Épico",
  },
  LEGENDARY: {
    color: "#fb923c",
    gradient: "linear-gradient(90deg,#f97316,#fbbf24,#f97316)",
    glowColor: "#fb923caa",
    entry: "title-golden-flash 1.2s ease forwards",
    entryMs: 1200,
    charByChar: false, sparkles: false, shimmer: true, continuousGlow: true,
    rarityBadge: "✦", label: "Lendário",
  },
  MYTHIC: {
    color: "#fbbf24",
    gradient: "linear-gradient(90deg,#fbbf24 0%,#ffffff 40%,#fbbf24 80%,#fef08a 100%)",
    glowColor: "#fbbf24cc",
    entry: "title-lightning 1.5s ease forwards",
    entryMs: 1500,
    charByChar: false, sparkles: true, shimmer: true, continuousGlow: true,
    rarityBadge: "⚡", label: "Mítico",
  },
  RELIC: {
    color: "#ef4444",
    gradient: "linear-gradient(90deg,#ef4444 0%,#fbbf24 35%,#ffffff 50%,#fbbf24 65%,#ef4444 100%)",
    glowColor: "#fbbf24cc",
    entry: "title-golden-flash 1.8s ease forwards",
    entryMs: 1800,
    charByChar: false, sparkles: true, shimmer: true, continuousGlow: true,
    rarityBadge: "👑", label: "Relíquia",
  },
};

// ── Config por tema ────────────────────────────────────────────────────────────

const THEME_BADGE: Record<string, string> = {
  NEUTRAL: "",
  ELECTRIC: "⚡",
  FIRE: "🔥",
  WATER: "🌊",
  GRASS: "🌿",
  ZIKABET: "🎰",
};

// ── Posições fixas dos sparkles (evita Math.random no render) ─────────────────

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

// ── Componente ─────────────────────────────────────────────────────────────────

export function TitleDisplay({
  name,
  rarity = "COMMON",
  theme = "NEUTRAL",
  flavorText,
  context = "profile",
  className = "",
}: Props) {
  const [animated, setAnimated] = useState(false);
  const [glowing,  setGlowing]  = useState(false);

  const cfg       = RARITY_CFG[rarity] ?? RARITY_CFG.COMMON;
  const themeBadge = THEME_BADGE[theme ?? "NEUTRAL"] ?? "";
  const animate   = context === "profile" || context === "inventory";
  const useGradient = !!cfg.gradient;

  // Badge: tema tem prioridade salvo rarityBadge ser emoji único (MYTHIC ⚡, RELIC 👑)
  const badge =
    rarity === "MYTHIC" || rarity === "RELIC"
      ? cfg.rarityBadge
      : themeBadge || cfg.rarityBadge;

  useEffect(() => {
    if (!animate) return;
    setAnimated(true);
    const t = setTimeout(() => setGlowing(true), cfg.entryMs);
    return () => clearTimeout(t);
  }, [animate, cfg.entryMs]);

  // ── Contexto ranking: cor + glow estático, sem animação ───────────────────
  if (context === "ranking") {
    return (
      <span
        className={`font-semibold ${className}`}
        style={{
          color: cfg.color,
          textShadow: cfg.glowColor !== "transparent"
            ? `0 0 6px ${cfg.glowColor}`
            : undefined,
        }}
      >
        {badge && <span className="mr-0.5">{badge}</span>}
        {name}
      </span>
    );
  }

  // ── Contexto feed: cor + badge, zero animação ─────────────────────────────
  if (context === "feed") {
    return (
      <span className={`font-semibold ${className}`} style={{ color: cfg.color }}>
        {badge && <span className="mr-0.5">{badge}</span>}
        {name}
      </span>
    );
  }

  // ── Contexto profile / inventory: efeito completo ─────────────────────────

  // Glow contínuo via filter (compatível com gradient text)
  const continuousFilter =
    glowing && cfg.continuousGlow
      ? `drop-shadow(0 0 6px ${cfg.glowColor}) drop-shadow(0 0 14px ${cfg.glowColor})`
      : undefined;

  // Texto char-by-char (EPIC)
  const renderCharByChar = () =>
    name.split("").map((ch, i) => (
      <span
        key={i}
        style={{
          display: "inline-block",
          animation: animated ? "title-char-in 0.28s ease forwards" : undefined,
          animationDelay: animated ? `${i * 55}ms` : undefined,
          opacity: animated ? 0 : 1,
          color: cfg.color,
          filter: continuousFilter,
          whiteSpace: ch === " " ? "pre" : undefined,
        }}
      >
        {ch === " " ? " " : ch}
      </span>
    ));

  // Texto normal (todas as outras raridades)
  const shimmerActive = cfg.shimmer && glowing;
  // Nota: NÃO setar opacity:0 inline — animation-fill-mode:forwards controla isso via keyframe.
  // Inline opacity sobrescreveria o estado final da animação em alguns browsers.
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
          : animated && cfg.entry
          ? cfg.entry
          : undefined,
        filter: continuousFilter,
      }
    : {
        color: cfg.color,
        animation: animated && cfg.entry ? cfg.entry : undefined,
        textShadow:
          glowing && cfg.continuousGlow
            ? `0 0 8px ${cfg.glowColor}, 0 0 18px ${cfg.glowColor}`
            : undefined,
      };

  const renderText = () =>
    cfg.charByChar && animated
      ? renderCharByChar()
      : <span style={textStyle}>{name}</span>;

  return (
    <div className={`inline-block leading-none ${className}`}>
      <div className="relative inline-flex items-center gap-1.5">

        {/* Sparkles — EPIC, MYTHIC, RELIC */}
        {cfg.sparkles && animated && (
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
            {SPARKLE_POS.map((s, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: s.left,
                  top: s.top,
                  width: s.size,
                  height: s.size,
                  borderRadius: "50%",
                  background: cfg.color,
                  boxShadow: `0 0 4px ${cfg.color}`,
                  animation: "title-sparkle 1.3s ease forwards",
                  animationDelay: `${s.delay}s`,
                  opacity: 0,
                }}
              />
            ))}
          </span>
        )}

        {/* Badge (prefixo) */}
        {badge && (
          <span
            className="select-none text-sm leading-none"
            style={{ filter: continuousFilter }}
          >
            {badge}
          </span>
        )}

        {/* Texto do título */}
        <span className="font-bold text-sm leading-none tracking-wide">
          {renderText()}
        </span>

        {/* Badge (sufixo) — apenas LEGENDARY+ para efeito espelho */}
        {badge && (rarity === "LEGENDARY" || rarity === "MYTHIC" || rarity === "RELIC") && (
          <span
            className="select-none text-sm leading-none"
            style={{ filter: continuousFilter }}
          >
            {badge}
          </span>
        )}

      </div>

      {/* Frase de sabor — apenas no perfil */}
      {context === "profile" && flavorText && (
        <p
          className="mt-1 text-[11px] italic"
          style={{
            color: cfg.color,
            // sem animation: renderiza estático (SSR), com animation: entra suavemente
            ...(animated
              ? {
                  animation: "title-flavor-in 0.5s ease forwards",
                  animationDelay: `${cfg.entryMs + 200}ms`,
                }
              : { opacity: 0.75 }),
          }}
        >
          &ldquo;{flavorText}&rdquo;
        </p>
      )}
    </div>
  );
}
