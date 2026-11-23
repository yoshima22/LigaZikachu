export const ABILITY_VERDICTS = {
  TOO_STRONG: { label: "Forte demais", emoji: "💪", cls: "border-rose-400/40 bg-rose-400/10 text-rose-200" },
  TOO_WEAK: { label: "Fraca demais", emoji: "🪶", cls: "border-sky-400/40 bg-sky-400/10 text-sky-200" },
  BALANCED: { label: "Equilibrada", emoji: "👌", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
  CHANGE_EFFECT: { label: "Mudar o efeito", emoji: "🔄", cls: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
} as const;
export type AbilityVerdict = keyof typeof ABILITY_VERDICTS;
export const ABILITY_VERDICT_KEYS = Object.keys(ABILITY_VERDICTS) as AbilityVerdict[];
export const ABILITY_FEEDBACK_MAX_COMMENT = 300;
