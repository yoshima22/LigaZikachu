// Estados alterados do sistema de habilidades (só no Arena Draft): dados puros, sem motor.
// Regras definidas pelos GMs na planilha "Novos status".

export type StatusKind = "POISON" | "BURN" | "FREEZE" | "SLEEP" | "PARALYSIS" | "CONFUSION" | "FLINCH" | "CHARM";

export type StatusInfo = {
  label: string;
  /** Texto do estado no masculino ("ficou queimado"). */
  adjective: string;
  emoji: string;
  /** Duração sorteada em rodadas (mín–máx). */
  duration: [number, number];
  /** Tipos imunes (chaves em inglês). */
  immuneTypes: string[];
  /** Palavras (sem acento, minúsculas) que identificam o estado no parâmetro da habilidade. */
  words: string[];
};

export const STATUS_INFO: Record<StatusKind, StatusInfo> = {
  POISON: { label: "Envenenado", adjective: "envenenado", emoji: "☠️", duration: [3, 3], immuneTypes: ["poison", "steel"], words: ["envenenado", "veneno"] },
  BURN: { label: "Queimado", adjective: "queimado", emoji: "🔥", duration: [2, 2], immuneTypes: ["fire"], words: ["queimado", "queimadura"] },
  FREEZE: { label: "Congelado", adjective: "congelado", emoji: "❄️", duration: [2, 2], immuneTypes: ["ice"], words: ["congelado", "congelamento"] },
  SLEEP: { label: "Dormindo", adjective: "dormindo", emoji: "💤", duration: [1, 2], immuneTypes: [], words: ["dormindo", "sono", "adormecido"] },
  PARALYSIS: { label: "Paralisado", adjective: "paralisado", emoji: "⚡", duration: [1, 1], immuneTypes: ["electric"], words: ["paralisado", "paralisia"] },
  CONFUSION: { label: "Confuso", adjective: "confuso", emoji: "😵", duration: [1, 3], immuneTypes: ["psychic"], words: ["confuso", "confusao"] },
  // Amendrontado: perde a ação da rodada, mas só se ainda não tinha agido nela (não ocupa o "um estado por vez").
  FLINCH: { label: "Amendrontado", adjective: "amendrontado", emoji: "😨", duration: [1, 1], immuneTypes: [], words: ["amendrontado", "amedrontado", "acovardado"] },
  // Apaixonado: 50% de chance de perder a ação, só quando o alvo da ação é quem o encantou.
  CHARM: { label: "Apaixonado", adjective: "apaixonado", emoji: "💘", duration: [1, 2], immuneTypes: [], words: ["apaixonado", "paixao"] },
};

/** Condenado: o 1º que ataca o portador fica condenado e cai 1 rodada depois que o portador cair (HP vai a zero). Pode ser curado. */
export const DOOM_INFO = { label: "Condenado", emoji: "💀", immuneTypes: ["ghost", "dark"], delayRounds: 1 };

/** Maldito: acumula com os demais estados e dura até o mascote que o causou cair. */
export const CURSE_INFO = { label: "Maldito", emoji: "👻", immuneTypes: ["ghost", "dark"], selfDamagePct: 0.05 };

/** Regras numéricas dos estados (fração do HP máximo ou chance). */
export const STATUS_RULES = {
  poisonPct: 0.05, // fim do turno
  burnPct: 0.07, // início do turno
  // Congelado acumula até 3 vezes: cada acúmulo dura 2 rodadas; no 3º o alvo perde a rodada seguinte e tudo se desfaz.
  freezeAgilityPerStack: 0.1,
  freezeForcePerStack: 0.05,
  freezeMaxStacks: 3,
  freezeStackRounds: 2,
  paralysisSkip: 0.3,
  sleepWake: 0.7,
  confusionSelfHit: 0.2,
  confusionSelfPct: 0.05,
  confusionCure: 0.8,
  charmSkip: 0.5,
  sandPct: 0.03,
} as const;

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Estados citados no parâmetro de uma habilidade ("envenenado", "Dormindo (aliados)"...). */
export function statusesInParam(param: string | null | undefined): StatusKind[] {
  if (!param) return [];
  const text = strip(param);
  return (Object.keys(STATUS_INFO) as StatusKind[]).filter((kind) => STATUS_INFO[kind].words.some((w) => text.includes(w)));
}

export const paramMentionsCurse = (param: string | null | undefined) => Boolean(param && /maldit/.test(strip(param)));
export const paramIsAllStatuses = (param: string | null | undefined) => Boolean(param && /todos|qualquer/.test(strip(param)));
export const paramIsRandom = (param: string | null | undefined) => Boolean(param && /aleatori/.test(strip(param)));
export const paramIncludesAllies = (param: string | null | undefined) => Boolean(param && /aliados/.test(strip(param)));
export const paramNeedsSun = (param: string | null | undefined) => Boolean(param && /\bsol\b/.test(strip(param)));
