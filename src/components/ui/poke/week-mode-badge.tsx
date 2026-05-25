import { cn } from "@/lib/utils";
import { Swords, Zap, Users, Star, Wrench, Shield, Flag } from "lucide-react";
import type { ReactNode } from "react";

export type WeekMode =
  | "PADRAO"
  | "GLC"
  | "DUPLAS_SINCRONIZADAS"
  | "PONTUACAO_DOBRADA"
  | "CONSTRUTOR_MISTERIOSO"
  | "GUERRA_DE_TIMES"
  | "BATALHA_FINAL";

const modeConfig: Record<WeekMode, {
  label: string;
  short: string;
  bg: string;
  text: string;
  border: string;
  icon: ReactNode;
  description: string;
}> = {
  PADRAO: {
    label: "Padrão",
    short: "STD",
    bg: "bg-slate-500/15",
    text: "text-slate-300",
    border: "border-slate-500/30",
    icon: <Swords size={12} />,
    description: "Formato livre, sem restrições"
  },
  GLC: {
    label: "GLC",
    short: "GLC",
    bg: "bg-[#7AC74C]/15",
    text: "text-[#7AC74C]",
    border: "border-[#7AC74C]/40",
    icon: <Shield size={12} />,
    description: "Gym Leader Challenge — monotipo, energias mistas livres"
  },
  DUPLAS_SINCRONIZADAS: {
    label: "Duplas",
    short: "DUP",
    bg: "bg-[#6390F0]/15",
    text: "text-[#6390F0]",
    border: "border-[#6390F0]/40",
    icon: <Users size={12} />,
    description: "Duplas Sincronizadas por ranking"
  },
  PONTUACAO_DOBRADA: {
    label: "Dobrada",
    short: "2×",
    bg: "bg-[#F7D02C]/15",
    text: "text-[#F7D02C]",
    border: "border-[#F7D02C]/40",
    icon: <Zap size={12} />,
    description: "Vitórias valem 6 pontos"
  },
  CONSTRUTOR_MISTERIOSO: {
    label: "Misterioso",
    short: "???",
    bg: "bg-[#F95587]/15",
    text: "text-[#F95587]",
    border: "border-[#F95587]/40",
    icon: <Wrench size={12} />,
    description: "Adversário escolhe seu deck"
  },
  GUERRA_DE_TIMES: {
    label: "Times",
    short: "GDT",
    bg: "bg-[#EE8130]/15",
    text: "text-[#EE8130]",
    border: "border-[#EE8130]/40",
    icon: <Flag size={12} />,
    description: "Guerra de Times por posição"
  },
  BATALHA_FINAL: {
    label: "Batalha Final",
    short: "FIN",
    bg: "bg-[#735797]/15",
    text: "text-[#9B7FCC]",
    border: "border-[#735797]/40",
    icon: <Star size={12} />,
    description: "Bônus progressivo por posição"
  }
};

interface WeekModeBadgeProps {
  mode: WeekMode;
  className?: string;
  short?: boolean;
}

export function WeekModeBadge({ mode, className, short = false }: WeekModeBadgeProps) {
  const cfg = modeConfig[mode];
  return (
    <span
      title={cfg.description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        cfg.bg, cfg.text, cfg.border,
        className
      )}
    >
      {cfg.icon}
      {short ? cfg.short : cfg.label}
    </span>
  );
}

export function getWeekModeConfig(mode: WeekMode) {
  return modeConfig[mode];
}
