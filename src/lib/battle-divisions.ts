export type BattleDivision = "LIMITED" | "UNLIMITED";

export type MegaCandidate = {
  id: string;
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
  return Boolean(mascot.megaEvolvedAt || mascot.megaEvolvedFromPokemonId);
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

export const OFFICIAL_BATTLE_DIVISION_MODES = [
  { mode: "Liga Rush", division: "Configurável por semana", detail: "O admin escolhe Limitado ou Ilimitado ao criar a edição." },
  { mode: "Arena-Z", division: "Ilimitado", detail: "Sem limite de megas na equipe." },
  { mode: "Desafio Sincronizado", division: "Limitado", detail: "Até 3 megas entre os 9 enviados por jogador e até 1 por jogador em cada partida (2 no time da dupla)." },
  { mode: "Liga Semanal", division: "Ilimitado (atual)", detail: "Mantém a regra existente até uma edição adotar explicitamente a divisão Limitada." },
] as const;
