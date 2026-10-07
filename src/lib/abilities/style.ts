import type { AbilityCategory } from "./index";

export const ABILITY_CATEGORY_STYLE: Record<AbilityCategory, string> = {
  Dano: "border-red-400/40 bg-red-500/10 text-red-300",
  Defesa: "border-sky-400/40 bg-sky-500/10 text-sky-300",
  Reflexo: "border-orange-400/40 bg-orange-500/10 text-orange-300",
  Controle: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300",
  Suporte: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  "Sobrevivência": "border-amber-400/40 bg-amber-500/10 text-amber-300",
};
