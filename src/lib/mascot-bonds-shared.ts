// Tipos e rótulos do sistema de Laços. Módulo PURO (sem Prisma): pode ser usado
// por componentes cliente sem levar código de servidor para o bundle.
export type BondBehavior =
  | "FREE"
  | "FRIENDLY"
  | "COMPETITIVE"
  | "AVOID_CONFLICT"
  | "TRAINING"
  | "EXPEDITION"
  | "SOCIAL"
  | "PROTECT_FOOD"
  | "SHARE_RESOURCES"
  | "PROTECT_WEAK";

export type BondOption = {
  id: string;
  label: string;
  type: "POSITIVE" | "NEUTRAL" | "AGGRESSIVE";
  cost?: { kind: "FOOD" | "SWEET" | "COINS" | "BOND_ITEM"; quantity: number; itemType?: string; itemName?: string };
  costs?: { kind: "FOOD" | "SWEET" | "COINS" | "BOND_ITEM"; quantity: number; itemType?: string; itemName?: string }[];
  scoreDelta: number;
  scoreDeltaB?: number;
  intention?: string;
  outcomePreview?: string;
  happinessA?: number;
  happinessB?: number;
  expA?: number;
  expB?: number;
  cooldownBMinutes?: number;
  publicEligible?: boolean;
  blockedReason?: string;
};

export const BOND_BEHAVIOR_LABEL: Record<BondBehavior, string> = {
  FREE: "Temperamento Livre",
  FRIENDLY: "Incentivar Amizades",
  COMPETITIVE: "Espirito Competitivo",
  AVOID_CONFLICT: "Evitar Conflitos",
  TRAINING: "Foco em Treino",
  EXPEDITION: "Foco em Expedicao",
  SOCIAL: "Foco Social",
  PROTECT_FOOD: "Proteger Comida",
  SHARE_RESOURCES: "Compartilhar Recursos",
  PROTECT_WEAK: "Cuidar dos Mais Fracos",
};

// Funções puras de pontuação de relação (usadas no cliente e no servidor).
export function relationTier(score: number) {
  if (score <= -80) return "Nemesis";
  if (score <= -60) return "Rival Direto";
  if (score <= -35) return "Rival Forte";
  if (score <= -15) return "Rival";
  if (score <= 14) return "Conhecido";
  if (score <= 34) return "Colega";
  if (score <= 59) return "Amigo";
  if (score <= 79) return "Grande Amigo";
  if (score <= 94) return "Melhor Amigo";
  return "Quase Irmaos";
}

export function legacyRelationScore(type: "FRIEND" | "RIVAL", interactionCount: number) {
  if (type === "FRIEND") return Math.min(94, 15 + Math.max(1, interactionCount) * 5);
  return Math.max(-79, -15 - Math.max(1, interactionCount) * 8);
}

export function effectiveRelationScore(relation: { relationshipScore?: number | null; type: "FRIEND" | "RIVAL"; interactionCount: number }) {
  if (typeof relation.relationshipScore === "number" && relation.relationshipScore !== 0) {
    return relation.relationshipScore;
  }
  return legacyRelationScore(relation.type, relation.interactionCount);
}

export function relationTypeFromScore(score: number): "FRIEND" | "RIVAL" {
  return score >= 15 ? "FRIEND" : "RIVAL";
}

export function clampScore(score: number) {
  return Math.max(-100, Math.min(100, score));
}
