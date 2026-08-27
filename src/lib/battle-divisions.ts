import { MEGA_FORM_IDS } from "@/lib/mega-evolution";

export type BattleDivision = "LIMITED" | "UNLIMITED";

export type MegaCandidate = {
  id: string;
  pokemonId?: number | null;
  megaEvolvedAt?: Date | string | null;
  megaEvolvedFromPokemonId?: number | null;
};

export const BATTLE_DIVISIONS = {
  LIMITED: {
    label: "Limitado",
    description: "No máximo 2 mascotes mega evoluídos na equipe que entra em combate.",
    maxMegas: 2,
  },
  UNLIMITED: {
    label: "Ilimitado",
    description: "Sem limite de mascotes mega evoluídos na equipe.",
    maxMegas: null,
  },
} as const;

export function normalizeBattleDivision(value: unknown): BattleDivision {
  return String(value).toUpperCase() === "UNLIMITED" ? "UNLIMITED" : "LIMITED";
}

export function isMegaEvolvedMascot(mascot: MegaCandidate): boolean {
  return Boolean(
    mascot.megaEvolvedAt
    || mascot.megaEvolvedFromPokemonId
    || (mascot.pokemonId != null && MEGA_FORM_IDS.has(Number(mascot.pokemonId))),
  );
}

export function countMegaEvolvedMascots(mascots: MegaCandidate[]): number {
  return mascots.filter(isMegaEvolvedMascot).length;
}

export function validateBattleDivision(
  mascots: MegaCandidate[],
  division: BattleDivision,
  maxMegasOverride?: number | null,
): { valid: boolean; megaCount: number; maxMegas: number | null; message?: string } {
  const megaCount = countMegaEvolvedMascots(mascots);
  const maxMegas = division === "UNLIMITED" ? null : (maxMegasOverride ?? BATTLE_DIVISIONS.LIMITED.maxMegas);
  if (maxMegas !== null && megaCount > maxMegas) {
    return {
      valid: false,
      megaCount,
      maxMegas,
      message: `Divisão Limitada: esta formação possui ${megaCount} megas, mas permite no máximo ${maxMegas}.`,
    };
  }
  return { valid: true, megaCount, maxMegas };
}

// ── Sanitização de time pré-combate ──────────────────────────────────────────
// Protege os combates: remove mascotes que ficaram inválidos DEPOIS da montagem
// (ex.: subiu de nível além do limite, ou mega excedente numa divisão Limitada).
// Respeita a divisão Ilimitada: nela nenhum mega é removido.

export type TeamValidationRule = {
  /** Nível máximo permitido (null/undefined = sem limite). */
  maxLevel?: number | null;
  division: BattleDivision;
  /** Sobrescreve o teto de megas da divisão Limitada (padrão: 2). */
  maxMegas?: number | null;
};

export type BattleTeamMascot = MegaCandidate & { level?: number | null; nickname?: string | null };

export type InvalidMascot<T> = { mascot: T; reasons: string[] };

/**
 * Separa o time em válidos e inválidos segundo as regras atuais do campeonato.
 * Mantém os primeiros megas até o teto e marca os excedentes como inválidos;
 * marca também quem passou do nível máximo. Em divisão Ilimitada, megas nunca
 * são marcados por excesso.
 */
export function evaluateBattleTeam<T extends BattleTeamMascot>(
  mascots: T[],
  rule: TeamValidationRule,
): { valid: T[]; invalid: InvalidMascot<T>[] } {
  const maxMegas = rule.division === "UNLIMITED" ? null : (rule.maxMegas ?? BATTLE_DIVISIONS.LIMITED.maxMegas);
  const valid: T[] = [];
  const invalid: InvalidMascot<T>[] = [];
  let megaCount = 0;
  for (const mascot of mascots) {
    const reasons: string[] = [];
    if (rule.maxLevel != null && (mascot.level ?? 0) > rule.maxLevel) {
      reasons.push(`Está no nível ${mascot.level}, acima do limite de ${rule.maxLevel} desta edição.`);
    }
    const mega = isMegaEvolvedMascot(mascot);
    if (mega && maxMegas != null && megaCount >= maxMegas) {
      reasons.push(`Mega excedente: a divisão Limitada permite no máximo ${maxMegas} megas na equipe.`);
    }
    if (reasons.length > 0) { invalid.push({ mascot, reasons }); continue; }
    valid.push(mascot);
    if (mega) megaCount += 1;
  }
  return { valid, invalid };
}

export const OFFICIAL_BATTLE_DIVISION_MODES = [
  { mode: "Liga Rush", division: "Configurável por semana", detail: "O admin escolhe Limitado ou Ilimitado ao criar a edição." },
  { mode: "Arena-Z", division: "Ilimitado", detail: "Sem limite de megas na equipe." },
  { mode: "Desafio Sincronizado", division: "Limitado", detail: "Até 3 megas entre os 9 enviados por jogador e até 1 por jogador em cada partida (2 no time da dupla)." },
  { mode: "Liga Semanal", division: "Limitado", detail: "No máximo 2 mascotes mega evoluídos por equipe em cada combate." },
] as const;
