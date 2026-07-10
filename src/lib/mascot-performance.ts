// Marcador pessoal de desempenho do mascote, definido pelo jogador.
export const PERFORMANCE_TAGS = ["FORTE", "NEUTRO", "RUIM", "PESSIMO"] as const;
export type PerformanceTag = typeof PERFORMANCE_TAGS[number];

export const DEFAULT_PERFORMANCE_TAG: PerformanceTag = "NEUTRO";

export function normalizePerformanceTag(value: unknown): PerformanceTag {
  return PERFORMANCE_TAGS.includes(value as PerformanceTag) ? (value as PerformanceTag) : DEFAULT_PERFORMANCE_TAG;
}

export const PERFORMANCE_META: Record<PerformanceTag, {
  label: string;
  short: string;
  emoji: string;
  description: string;
  /** classes para badge (texto + borda + fundo) */
  badge: string;
  /** cor sólida para o dot compacto */
  dot: string;
}> = {
  FORTE: {
    label: "Forte", short: "Forte", emoji: "💪",
    description: "Bom potencial de alto desempenho.",
    badge: "text-emerald-300 border-emerald-400/50 bg-emerald-500/15",
    dot: "bg-emerald-400",
  },
  NEUTRO: {
    label: "Neutro", short: "Neutro", emoji: "⚖️",
    description: "Mediano — times secundários ou expedições.",
    badge: "text-slate-300 border-slate-400/40 bg-slate-500/15",
    dot: "bg-slate-400",
  },
  RUIM: {
    label: "Ruim", short: "Ruim", emoji: "👎",
    description: "Status ruins — mantido por colecionismo.",
    badge: "text-orange-300 border-orange-400/40 bg-orange-500/10",
    dot: "bg-orange-400",
  },
  PESSIMO: {
    label: "Péssimo", short: "Péssimo", emoji: "🗑️",
    description: "Candidato a virar Pó de Criação no Laboratório.",
    badge: "text-red-300 border-red-400/40 bg-red-500/10",
    dot: "bg-red-500",
  },
};
