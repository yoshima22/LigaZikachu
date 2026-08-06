const EGG_TYPE_LABEL: Record<string, string> = {
  COMMON: "Ovo Comum",
  RARE: "Ovo Raro",
  SPECIAL: "Ovo Especial",
  EVENT: "Ovo de Evento",
  LAB: "Ovo de Laboratório",
};

export function getHatchedEggLabel(type?: string | null, origin?: string | null) {
  if (!type) return null;
  if (origin?.startsWith("GEN_CHOICE:") || origin?.startsWith("GEN_RANDOM:")) {
    const [, originalType, generationType] = origin.split(":");
    const generation = generationType?.replace("EGG_GEN", "").replace("PLUS", "+");
    if (generation) {
      const randomLabel = origin.startsWith("GEN_RANDOM:") ? " · geração sorteada" : "";
      return `${EGG_TYPE_LABEL[originalType] ?? "Ovo"} de Geração ${generation}${randomLabel}`;
    }
  }
  if (type.startsWith("EGG_GEN")) {
    return `Ovo de Geração ${type.replace("EGG_GEN", "").replace("PLUS", "+")}`;
  }
  if (origin?.startsWith("LAB_REGION:")) {
    const generation = origin.replace("LAB_REGION:EGG_GEN", "").split("|", 1)[0];
    const randomLabel = origin.split("|").includes("GEN_RANDOM") ? " · geração sorteada" : "";
    return `Ovo de Laboratório (Geração ${generation}${randomLabel})`;
  }
  return EGG_TYPE_LABEL[type] ?? type.replaceAll("_", " ");
}
