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

import { useEffect, useRef, useState, useCallback } from "react";
import { TitleEntrance } from "./title-entrance";

export type TitleRarity =
  | "COMMON" | "UNCOMMON" | "RARE" | "EPIC"
  | "LEGENDARY" | "MYTHIC" | "RELIC";

export type TitleTheme =
  | "NEUTRAL" | "ELECTRIC" | "FIRE" | "WATER" | "GRASS" | "ZIKABET"
  | "SHADOW" | "ROYAL" | "TOXIC" | "COSMIC" | "STEEL" | "FAIRY" | "DRAGON" | "GHOST";

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
  /** Efeito de entrada de tela inteira (apenas context="profile") */
  entranceEffect?: string;
  /**
   * Intervalo em segundos para repetir a animação de entrada (0 = não repete).
   * Raridades mais altas usam um padrão se não especificado.
   * Só funciona em context="profile" ou "inventory".
   */
  repeatEvery?: number;
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

// ── Intervalo de replay padrão por raridade (segundos) ───────────────────────
// Raridades mais altas repetem com mais frequência para chamar atenção.
// 0 = nunca repete.
const DEFAULT_REPEAT: Record<string, number> = {
  COMMON:    0,
  UNCOMMON:  0,
  RARE:      45,
  EPIC:      30,
  LEGENDARY: 25,
  MYTHIC:    20,
  RELIC:     15,
};

// ── Badge por tema ────────────────────────────────────────────────────────────

const THEME_BADGE: Record<string, string> = {
  NEUTRAL: "", ELECTRIC: "⚡", FIRE: "🔥", WATER: "🌊", GRASS: "🌿", ZIKABET: "🎰",
  SHADOW: "◐", ROYAL: "♛", TOXIC: "☣", COSMIC: "✦", STEEL: "◆", FAIRY: "✧", DRAGON: "◇", GHOST: "◌",
};

const THEME_VISUAL: Record<string, Partial<Pick<RarityDef, "color" | "gradient" | "glowColor" | "sparkles" | "shimmer" | "continuousGlow">>> = {
  ELECTRIC: { color: "#facc15", gradient: "linear-gradient(90deg,#facc15,#ffffff,#38bdf8,#facc15)", glowColor: "#facc15bb", shimmer: true, continuousGlow: true },
  FIRE: { color: "#fb923c", gradient: "linear-gradient(90deg,#ef4444,#fb923c,#fef08a,#ef4444)", glowColor: "#fb923cbb", shimmer: true, continuousGlow: true },
  WATER: { color: "#38bdf8", gradient: "linear-gradient(90deg,#0ea5e9,#67e8f9,#ffffff,#0ea5e9)", glowColor: "#38bdf8aa", shimmer: true, continuousGlow: true },
  GRASS: { color: "#4ade80", gradient: "linear-gradient(90deg,#16a34a,#86efac,#f0fdf4,#16a34a)", glowColor: "#4ade80aa", continuousGlow: true },
  ZIKABET: { color: "#fbbf24", gradient: "linear-gradient(90deg,#7c2d12,#fbbf24,#22d3ee,#fbbf24)", glowColor: "#fbbf24bb", sparkles: true, shimmer: true, continuousGlow: true },
  SHADOW: { color: "#a855f7", gradient: "linear-gradient(90deg,#312e81,#a855f7,#020617,#d8b4fe)", glowColor: "#a855f7cc", sparkles: true, continuousGlow: true },
  ROYAL: { color: "#fde68a", gradient: "linear-gradient(90deg,#7c2d12,#facc15,#ffffff,#a16207)", glowColor: "#facc15cc", sparkles: true, shimmer: true, continuousGlow: true },
  TOXIC: { color: "#bef264", gradient: "linear-gradient(90deg,#65a30d,#bef264,#a855f7,#65a30d)", glowColor: "#84cc16bb", continuousGlow: true },
  COSMIC: { color: "#c4b5fd", gradient: "linear-gradient(90deg,#312e81,#c4b5fd,#f0abfc,#38bdf8)", glowColor: "#c4b5fdcc", sparkles: true, shimmer: true, continuousGlow: true },
  STEEL: { color: "#cbd5e1", gradient: "linear-gradient(90deg,#64748b,#f8fafc,#94a3b8,#e2e8f0)", glowColor: "#cbd5e188", shimmer: true, continuousGlow: true },
  FAIRY: { color: "#f9a8d4", gradient: "linear-gradient(90deg,#f9a8d4,#ffffff,#c4b5fd,#f9a8d4)", glowColor: "#f9a8d4bb", sparkles: true, continuousGlow: true },
  DRAGON: { color: "#f97316", gradient: "linear-gradient(90deg,#7c3aed,#f97316,#facc15,#7c3aed)", glowColor: "#f97316bb", sparkles: true, shimmer: true, continuousGlow: true },
  GHOST: { color: "#c084fc", gradient: "linear-gradient(90deg,#020617,#c084fc,#64748b,#c084fc)", glowColor: "#c084fccc", continuousGlow: true },
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
  entranceEffect = "NONE",
  repeatEvery,
}: Props) {
  const [animated,     setAnimated]     = useState(false);
  const [glowing,      setGlowing]      = useState(false);
  const [showEntrance, setShowEntrance] = useState(false);
  // replayKey: incrementar força remount do elemento animado → replay da animação
  const [replayKey,    setReplayKey]    = useState(0);
  const entrancePlayed = useRef(false);

  const baseCfg = RARITY_CFG[rarity] ?? RARITY_CFG.COMMON;
  const themeVisual = THEME_VISUAL[theme ?? "NEUTRAL"];
  const cfg: RarityDef = {
    ...baseCfg,
    ...(themeVisual ?? {}),
    sparkles: baseCfg.sparkles || themeVisual?.sparkles || false,
    shimmer: baseCfg.shimmer || themeVisual?.shimmer || false,
    continuousGlow: baseCfg.continuousGlow || themeVisual?.continuousGlow || false,
    rarityBadge: baseCfg.rarityBadge,
    label: baseCfg.label,
  };
  const vars = RARITY_VARIANTS[rarity] ?? RARITY_VARIANTS.COMMON;

  const variant     = vars[nameHash(name) % vars.length];
  const isCharByChar = variant.animation === null;
  const charKeyframe = CHAR_KEYFRAME[variant.charMode ?? "slide"];
  const themeBadge  = THEME_BADGE[theme ?? "NEUTRAL"] ?? "";
  const animate     = context === "profile" || context === "inventory";
  const useGradient  = !!cfg.gradient;

  // Intervalo de replay: usa prop ou padrão por raridade
  const repeatMs = ((repeatEvery !== undefined ? repeatEvery : DEFAULT_REPEAT[rarity] ?? 0)) * 1000;

  const badge =
    rarity === "MYTHIC" || rarity === "RELIC"
      ? cfg.rarityBadge
      : themeBadge || cfg.rarityBadge;

  // Função que reseta e relança a animação de entrada
  const triggerReplay = useCallback(() => {
    setGlowing(false);
    setAnimated(false);
    // Pequeno delay para garantir que o React limpe o estado antes de relançar
    setTimeout(() => {
      setReplayKey(k => k + 1); // força remount do elemento animado
      setAnimated(true);
      setTimeout(() => setGlowing(true), variant.durationMs);
    }, 80);
  }, [variant.durationMs]);

  useEffect(() => {
    if (!animate) return;

    // Dispara efeito de tela inteira apenas no perfil, uma vez
    if (context === "profile" && entranceEffect && entranceEffect !== "NONE" && !entrancePlayed.current) {
      entrancePlayed.current = true;
      setShowEntrance(true);
    }

    // Animação inicial com stagger
    const tStart = setTimeout(() => {
      setAnimated(true);
      const tGlow = setTimeout(() => setGlowing(true), variant.durationMs);
      return () => clearTimeout(tGlow);
    }, staggerDelay);

    // Replay periódico
    let interval: ReturnType<typeof setInterval> | null = null;
    if (repeatMs > 0) {
      // Começa o intervalo após a animação inicial terminar
      const tInterval = setTimeout(() => {
        interval = setInterval(triggerReplay, repeatMs);
      }, staggerDelay + variant.durationMs + 500);
      return () => {
        clearTimeout(tStart);
        clearTimeout(tInterval);
        if (interval) clearInterval(interval);
      };
    }

    return () => clearTimeout(tStart);
  }, [animate, variant.durationMs, staggerDelay, context, entranceEffect, repeatMs, triggerReplay]);

  // ── Portal de entrada (tela inteira, apenas profile) ─────────────────────
  const entrancePortal = showEntrance ? (
    <TitleEntrance
      name={name}
      rarity={rarity}
      theme={theme}
      effect={entranceEffect}
      color={cfg.color}
      glowColor={cfg.glowColor}
      flavorText={flavorText}
      onComplete={() => setShowEntrance(false)}
    />
  ) : null;

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
      {entrancePortal}
      <div className="relative inline-flex items-center gap-1.5">

        {/* Sparkles — key força remount e replay das partículas */}
        {cfg.sparkles && animated && (
          <span key={`sp-${replayKey}`} aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
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

        {/* key={replayKey} força remount → replay da animação CSS */}
        <span key={replayKey} className="font-bold text-sm leading-none tracking-wide">
          {renderText()}
        </span>

        {badge && (rarity === "LEGENDARY" || rarity === "MYTHIC" || rarity === "RELIC") && (
          <span className="select-none text-sm leading-none" style={{ filter: continuousFilter }}>
            {badge}
          </span>
        )}
      </div>

      {/* Frase de sabor — visível em profile e inventory (shop preview) */}
      {(context === "profile" || context === "inventory") && flavorText && (
        <p key={`flavor-${replayKey}`} className="mt-1 text-[11px] italic" style={{
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
