// Torre dos Rebeldes — configuração do modo (Fase 4).
// A Função de Expedição LIMITA o conjunto de posturas (CombatRole reais) que os
// mascotes daquele jogador podem usar dentro da Torre. Nomes de postura vêm do
// sistema real (combat-roles.ts) — não são inventados.

import { prisma } from "@/lib/prisma";
import type { CombatRole } from "@/lib/combat-roles";
import type { TowerExpeditionRole } from "@prisma/client";

export const TOWER_SETTINGS_KEY = "tower_settings";

export type TowerConfig = {
  /** Cooldown de entrada por conta (minutos). */
  entryCooldownMinutes: number;
  /** Exigir Ticket da Torre para criar run. Em desenvolvimento, desligado. */
  requireTicket: boolean;
};

const DEFAULT_CONFIG: TowerConfig = {
  entryCooldownMinutes: 60,
  requireTicket: true,
};

export async function getTowerConfig(): Promise<TowerConfig> {
  const setting = await prisma.appSetting
    .findUnique({ where: { key: TOWER_SETTINGS_KEY }, select: { value: true } })
    .catch(() => null);
  const v = (setting?.value ?? {}) as Partial<TowerConfig>;
  return {
    entryCooldownMinutes:
      typeof v.entryCooldownMinutes === "number" && v.entryCooldownMinutes >= 0
        ? v.entryCooldownMinutes
        : DEFAULT_CONFIG.entryCooldownMinutes,
    requireTicket: v.requireTicket === true,
  };
}

// ── Funções de Expedição → posturas permitidas ────────────────────────────────

export const TOWER_EXPEDITION_ROLES: {
  key: TowerExpeditionRole;
  label: string;
  /** Propósito na exploração — o que a classe faz de melhor no mapa. */
  exploration: string;
  /** Efeito mecânico (buff/contramedida) que a classe concede. */
  benefit: string;
  /** Como usar a classe a seu favor durante a run. */
  gameplayTip: string;
  stances: CombatRole[];
}[] = [
  {
    key: "INVESTIGADOR",
    label: "Investigador",
    exploration: "Revela uma pista extra dos enigmas na sala onde está.",
    benefit: "Revela pista adicional em mecanismos e concede +8% de Instinto nos combates da Torre.",
    gameplayTip: "A pista extra reduz o risco de errar mecanismos (e ganhar Pressão). Escolha se o grupo pretende explorar muitas salas de Enigma.",
    stances: ["SCOUT", "SPECIALIST", "OPPORTUNIST", "PROVOKER"],
  },
  {
    key: "NAVEGADOR",
    label: "Navegador",
    exploration: "Diminui em 1 o custo de Pressão da primeira espera da run, quando está na frente que espera.",
    benefit: "Concede +3% de Agilidade nos combates e reduz em 1 a Pressão da primeira espera da run.",
    gameplayTip: "Útil para aguardar reforços diante de um encontro: a primeira espera da sua frente custa 1 Pressão a menos.",
    stances: ["FLANK", "SCOUT", "DUELIST"],
  },
  {
    key: "PROTETOR",
    label: "Protetor",
    exploration: "Sustenta seus próprios mascotes em combates longos.",
    benefit: "Concede +6% de Vitalidade aos seus mascotes em todos os combates da Torre.",
    gameplayTip: "Dá mais Vitalidade aos seus mascotes: aguentam melhor a Pressão alta dos andares. Bom para grupos que enfrentam muitos encontros.",
    stances: ["DEFENDER", "GUARDIAN", "SURVIVOR"],
  },
  {
    key: "ARTIFICE",
    label: "Artífice",
    exploration: "Reduz em 1 a Pressão de uma resposta errada em enigmas da sua frente.",
    benefit: "Falhas em mecanismos geram 1 Pressão a menos e seus mascotes recebem +4% de Força.",
    gameplayTip: "Errar mecanismos custa menos Pressão. Excelente em runs longas com muitos Geradores, Portas e Alavancas.",
    stances: ["SPECIALIST", "SABOTEUR", "ENCOURAGER", "ATTACKER"],
  },
  {
    key: "RITUALISTA",
    label: "Ritualista",
    exploration: "Aumenta a cura de sala para os aliados presentes na sua frente.",
    benefit: "Cura de sala +10% para a frente presente; seus mascotes recebem +10% de Carisma.",
    gameplayTip: "Curas de sala rendem mais e sustentam o grupo entre encontros difíceis. Bom em runs com salas de Descanso e objetos rituais.",
    stances: ["HEALER", "ENCOURAGER", "PROVOKER", "SURVIVOR"],
  },
  {
    key: "BATEDOR",
    label: "Batedor",
    exploration: "Traz iniciativa aos seus mascotes nos encontros.",
    benefit: "Concede +7% de Agilidade aos seus mascotes nos combates da Torre.",
    gameplayTip: "Agilidade alta garante iniciativa nos combates: seus mascotes tendem a agir primeiro nos encontros da Torre.",
    stances: ["FLANK", "SCOUT", "OPPORTUNIST", "DUELIST"],
  },
];

export const TOWER_ROLE_BY_KEY = Object.fromEntries(
  TOWER_EXPEDITION_ROLES.map((r) => [r.key, r]),
) as Record<TowerExpeditionRole, (typeof TOWER_EXPEDITION_ROLES)[number]>;

export type TowerClassContext = { kind: "COMBAT" | "REST" | "WAIT" | "PUZZLE_MISTAKE" | "PUZZLE_HINT"; firstWait?: boolean };

/** One source of truth for the displayed class benefit and the V2 engine. */
export function resolveTowerClassEffects(role: string, context: TowerClassContext) {
  const effects = {
    forceMult: 1, agilityMult: 1, instinctMult: 1, vitalityMult: 1, charismaMult: 1,
    healingMult: 1, pressureReduction: 0, revealsHint: false, reasons: [] as string[],
  };
  if (context.kind === "COMBAT") {
    if (role === "INVESTIGADOR") { effects.instinctMult = 1.08; effects.reasons.push("Investigador: +8% Instinto"); }
    if (role === "NAVEGADOR") { effects.agilityMult = 1.03; effects.reasons.push("Navegador: +3% Agilidade"); }
    if (role === "PROTETOR") { effects.vitalityMult = 1.06; effects.reasons.push("Protetor: +6% Vitalidade"); }
    if (role === "ARTIFICE") { effects.forceMult = 1.04; effects.reasons.push("Artífice: +4% Força"); }
    if (role === "RITUALISTA") { effects.charismaMult = 1.1; effects.reasons.push("Ritualista: +10% Carisma"); }
    if (role === "BATEDOR") { effects.agilityMult = 1.07; effects.reasons.push("Batedor: +7% Agilidade"); }
  }
  if (role === "RITUALISTA" && context.kind === "REST") {
    effects.healingMult = 1.1; effects.reasons.push("Ritualista: +10% cura de sala para a frente");
  }
  if (role === "NAVEGADOR" && context.kind === "WAIT" && context.firstWait) {
    effects.pressureReduction = 1; effects.reasons.push("Navegador: primeira espera custa 1 Pressão a menos");
  }
  if (role === "ARTIFICE" && context.kind === "PUZZLE_MISTAKE") {
    effects.pressureReduction = 1; effects.reasons.push("Artífice: falha em mecanismo gera 1 Pressão a menos");
  }
  if (role === "INVESTIGADOR" && context.kind === "PUZZLE_HINT") {
    effects.revealsHint = true; effects.reasons.push("Investigador: pista extra disponível");
  }
  return effects;
}

/** Postura inicial: preferida do mascote se permitida; senão a primeira da Função. */
export function initialStanceFor(
  expeditionRole: TowerExpeditionRole,
  preferred: string | null | undefined,
): CombatRole {
  const allowed = TOWER_ROLE_BY_KEY[expeditionRole].stances;
  if (preferred && (allowed as string[]).includes(preferred)) return preferred as CombatRole;
  return allowed[0];
}

/** HP máximo do mascote na Torre (mesma fórmula das ligas). */
export function towerMaxHp(level: number, statVitality: number): number {
  return Math.max(10, Math.round(55 + level * 6 + statVitality * 4));
}
