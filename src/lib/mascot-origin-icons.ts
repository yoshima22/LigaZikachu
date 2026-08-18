// Ícones de origem (raridade do ovo de nascimento) e de fome dos mascotes.
// Hospedados no Supabase Storage (bucket público "assets").

const BASE = "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/Icons";

export type MascotOriginRarity = "COMMON" | "RARE" | "EVENT" | "SPECIAL" | "LAB";

export const ORIGIN_ICON_URL: Record<MascotOriginRarity, string> = {
  COMMON:  `${BASE}/IconeOrigem_Comum.png`,
  RARE:    `${BASE}/IconeOrigem_Raro.png`,
  EVENT:   `${BASE}/IconeOrigem_Evento.png`,
  SPECIAL: `${BASE}/IconeOrigem_Especial.png`,
  LAB:     `${BASE}/IconeOrigem_Lab.png`,
};

export const HUNGER_ICON_URL = `${BASE}/IconeMascote_Fome.png`;

const ORIGIN_LABEL: Record<MascotOriginRarity, string> = {
  COMMON: "Ovo Comum",
  RARE: "Ovo Raro",
  EVENT: "Ovo de Evento",
  SPECIAL: "Ovo Especial",
  LAB: "Ovo de Laboratório",
};

/**
 * Deduz a raridade da origem a partir do tipo do ovo de nascimento e da string
 * de origem. Ovos de geração/laboratório caem em LAB; origens "GEN_CHOICE/RANDOM"
 * carregam o tipo original. Fallback: Comum.
 */
export function resolveMascotOriginRarity(type?: string | null, origin?: string | null): MascotOriginRarity | null {
  if (!type) return null;
  if (origin?.startsWith("LAB_REGION:")) return "LAB";
  if (origin?.startsWith("GEN_CHOICE:") || origin?.startsWith("GEN_RANDOM:")) {
    const original = origin.split(":")[1];
    if (original === "RARE" || original === "SPECIAL" || original === "EVENT" || original === "LAB" || original === "COMMON") return original;
  }
  if (type === "LAB" || type.startsWith("EGG_GEN")) return "LAB";
  if (type === "RARE" || type === "SPECIAL" || type === "EVENT" || type === "COMMON") return type;
  return "COMMON";
}

export function mascotOriginIcon(type?: string | null, origin?: string | null): { url: string; rarity: MascotOriginRarity; label: string } | null {
  const rarity = resolveMascotOriginRarity(type, origin);
  if (!rarity) return null;
  return { url: ORIGIN_ICON_URL[rarity], rarity, label: ORIGIN_LABEL[rarity] };
}
