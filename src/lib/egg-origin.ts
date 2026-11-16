export const CELESTIAL_EGG_IMAGE =
  "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/Icons/IconeOrigem_Celestial.webp";
export { EVENT_EGG_IMAGE, LAB_EGG_IMAGE } from "@/lib/item-image-assets";
import { EVENT_EGG_IMAGE, LAB_EGG_IMAGE } from "@/lib/item-image-assets";

/** Imagem do ovo por tipo. Usada também por ovos que já estavam no inventário. */
export function eggImageUrl(type?: string | null) {
  if (type === "CELESTIAL") return CELESTIAL_EGG_IMAGE;
  if (type === "LAB") return LAB_EGG_IMAGE;
  if (type === "EVENT") return EVENT_EGG_IMAGE;
  return "/mascot/egg-common.webp";
}

const EGG_TYPE_LABEL: Record<string, string> = {
  COMMON: "Ovo Comum",
  RARE: "Ovo Raro",
  SPECIAL: "Ovo Especial",
  EVENT: "Ovo de Evento",
  LAB: "Ovo de Laboratório",
  CELESTIAL: "Ovo Celestial",
};

/** "Ovo {Raridade} de Geração {n | aleatória}" — a raridade aparece sempre. */
export function getHatchedEggLabel(type?: string | null, origin?: string | null) {
  if (!type) return null;
  const genNumber = (g?: string) => g?.replace("EGG_GEN", "").replace("PLUS", "+");
  if (origin?.startsWith("GEN_CHOICE:") || origin?.startsWith("GEN_RANDOM:")) {
    const [, originalType, generationType] = origin.split(":");
    const generation = genNumber(generationType);
    if (generation) {
      // Ovo de geração legado (EGG_GENx) como ovo original não tem raridade própria: Comum.
      const rarity = EGG_TYPE_LABEL[originalType] ?? "Ovo Comum";
      return `${rarity} de Geração ${origin.startsWith("GEN_RANDOM:") ? "aleatória" : generation}`;
    }
  }
  if (type.startsWith("EGG_GEN")) {
    return `Ovo Comum de Geração ${genNumber(type)}`;
  }
  if (origin?.startsWith("LAB_REGION:")) {
    const generation = origin.replace("LAB_REGION:EGG_GEN", "").split("|", 1)[0];
    return `Ovo de Laboratório de Geração ${origin.split("|").includes("GEN_RANDOM") ? "aleatória" : generation}`;
  }
  return EGG_TYPE_LABEL[type] ?? type.replaceAll("_", " ");
}
