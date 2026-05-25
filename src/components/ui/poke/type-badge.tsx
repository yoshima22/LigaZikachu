import { cn } from "@/lib/utils";
import { Flame, Droplets, Zap, Leaf, Eye, Ghost, Mountain, Hand, CircleDot, Wind, Bug, Snowflake, Sparkles, Shield } from "lucide-react";
import type { ReactNode } from "react";

export type PokeType =
  | "fire" | "water" | "electric" | "grass" | "psychic"
  | "ghost" | "fighting" | "rock" | "normal" | "poison"
  | "ground" | "flying" | "bug" | "ice" | "dragon"
  | "dark" | "steel" | "fairy";

const typeConfig: Record<PokeType, { label: string; bg: string; text: string; border: string; icon: ReactNode }> = {
  fire:     { label: "Fogo",     bg: "bg-[#EE8130]/15", text: "text-[#EE8130]", border: "border-[#EE8130]/40", icon: <Flame size={11} /> },
  water:    { label: "Água",     bg: "bg-[#6390F0]/15", text: "text-[#6390F0]", border: "border-[#6390F0]/40", icon: <Droplets size={11} /> },
  electric: { label: "Elétrico", bg: "bg-[#F7D02C]/15", text: "text-[#F7D02C]", border: "border-[#F7D02C]/40", icon: <Zap size={11} /> },
  grass:    { label: "Planta",   bg: "bg-[#7AC74C]/15", text: "text-[#7AC74C]", border: "border-[#7AC74C]/40", icon: <Leaf size={11} /> },
  psychic:  { label: "Psíquico", bg: "bg-[#F95587]/15", text: "text-[#F95587]", border: "border-[#F95587]/40", icon: <Eye size={11} /> },
  ghost:    { label: "Fantasma", bg: "bg-[#735797]/15", text: "text-[#9B7FCC]", border: "border-[#735797]/40", icon: <Ghost size={11} /> },
  fighting: { label: "Lutador",  bg: "bg-[#C22E28]/15", text: "text-[#E05E58]", border: "border-[#C22E28]/40", icon: <Hand size={11} /> },
  rock:     { label: "Pedra",    bg: "bg-[#B6A136]/15", text: "text-[#D4BE40]", border: "border-[#B6A136]/40", icon: <Mountain size={11} /> },
  normal:   { label: "Normal",   bg: "bg-[#A8A77A]/15", text: "text-[#C8C7A0]", border: "border-[#A8A77A]/40", icon: <CircleDot size={11} /> },
  poison:   { label: "Veneno",   bg: "bg-[#A33EA1]/15", text: "text-[#C76EC5]", border: "border-[#A33EA1]/40", icon: <Sparkles size={11} /> },
  ground:   { label: "Terra",    bg: "bg-[#E2BF65]/15", text: "text-[#E2BF65]", border: "border-[#E2BF65]/40", icon: <Mountain size={11} /> },
  flying:   { label: "Voador",   bg: "bg-[#A98FF3]/15", text: "text-[#A98FF3]", border: "border-[#A98FF3]/40", icon: <Wind size={11} /> },
  bug:      { label: "Inseto",   bg: "bg-[#A6B91A]/15", text: "text-[#C6D930]", border: "border-[#A6B91A]/40", icon: <Bug size={11} /> },
  ice:      { label: "Gelo",     bg: "bg-[#96D9D6]/15", text: "text-[#96D9D6]", border: "border-[#96D9D6]/40", icon: <Snowflake size={11} /> },
  dragon:   { label: "Dragão",   bg: "bg-[#6F35FC]/15", text: "text-[#9B71FF]", border: "border-[#6F35FC]/40", icon: <Flame size={11} /> },
  dark:     { label: "Sombrio",  bg: "bg-[#705746]/15", text: "text-[#9E7B6A]", border: "border-[#705746]/40", icon: <Ghost size={11} /> },
  steel:    { label: "Metal",    bg: "bg-[#B7B7CE]/15", text: "text-[#B7B7CE]", border: "border-[#B7B7CE]/40", icon: <Shield size={11} /> },
  fairy:    { label: "Fada",     bg: "bg-[#D685AD]/15", text: "text-[#D685AD]", border: "border-[#D685AD]/40", icon: <Sparkles size={11} /> }
};

interface TypeBadgeProps {
  type: PokeType;
  className?: string;
  showLabel?: boolean;
}

export function TypeBadge({ type, className, showLabel = true }: TypeBadgeProps) {
  const cfg = typeConfig[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        cfg.bg, cfg.text, cfg.border,
        className
      )}
    >
      {cfg.icon}
      {showLabel && cfg.label}
    </span>
  );
}

interface EnergyBadgeProps {
  type: PokeType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function EnergyBadge({ type, size = "md", className }: EnergyBadgeProps) {
  const cfg = typeConfig[type];
  const sizeMap = { sm: "h-5 w-5 text-[9px]", md: "h-7 w-7 text-xs", lg: "h-9 w-9 text-sm" };
  return (
    <span
      title={cfg.label}
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-semibold",
        cfg.bg, cfg.text, cfg.border,
        sizeMap[size],
        className
      )}
    >
      {cfg.icon}
    </span>
  );
}
