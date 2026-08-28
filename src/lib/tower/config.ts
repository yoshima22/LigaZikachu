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
    exploration: "Identifica pistas, mecanismos, objetos falsos e armadilhas.",
    benefit: "Revela pista adicional em mecanismos e concede +8% de Instinto nos combates da Torre.",
    gameplayTip: "Leve o Investigador na frente em salas de Enigma: a pista extra reduz o risco de errar mecanismos e ganhar Pressão. Bom para grupos que exploram muito.",
    stances: ["SCOUT", "SPECIALIST", "OPPORTUNIST", "PROVOKER"],
  },
  {
    key: "NAVEGADOR",
    label: "Navegador",
    exploration: "Lê melhor as conexões do labirinto.",
    benefit: "Concede +3% de Agilidade nos combates e reduz em 1 a Pressão da primeira espera da run.",
    gameplayTip: "Ideal quando o grupo vai se dividir pelo mapa: a leitura das conexões e o desconto na 1ª espera seguram a Pressão que a divisão gera.",
    stances: ["FLANK", "SCOUT", "DUELIST"],
  },
  {
    key: "PROTETOR",
    label: "Protetor",
    exploration: "Protege aliados durante interações e resgates.",
    benefit: "Concede +6% de Vitalidade aos seus mascotes em todos os combates da Torre.",
    gameplayTip: "É a âncora do grupo: mantenha o Protetor onde o encontro vai acontecer. Com mais Vitalidade, seus mascotes seguram a Pressão alta dos andares.",
    stances: ["DEFENDER", "GUARDIAN", "SURVIVOR"],
  },
  {
    key: "ARTIFICE",
    label: "Artífice",
    exploration: "Especialista em Geradores, Portas, Alavancas e Placas.",
    benefit: "Falhas em mecanismos geram 1 Pressão a menos e seus mascotes recebem +4% de Força.",
    gameplayTip: "Coloque o Artífice para resolver mecanismos arriscados: errar custa menos Pressão. Excelente em runs longas com muitos Geradores/Portas.",
    stances: ["SPECIALIST", "SABOTEUR", "ENCOURAGER", "ATTACKER"],
  },
  {
    key: "RITUALISTA",
    label: "Ritualista",
    exploration: "Especialista em Altares, Runas, Máscaras e Espelhos.",
    benefit: "Melhora curas de sala e Carisma dos seus mascotes em 10%.",
    gameplayTip: "Priorize salas de Descanso e objetos rituais com o Ritualista: as curas rendem mais, sustentando o grupo entre encontros difíceis.",
    stances: ["HEALER", "ENCOURAGER", "PROVOKER", "SURVIVOR"],
  },
  {
    key: "BATEDOR",
    label: "Batedor",
    exploration: "Reconhece áreas e presença hostil.",
    benefit: "Concede +7% de Agilidade aos seus mascotes nos combates da Torre.",
    gameplayTip: "Use o Batedor para abrir caminho e chegar primeiro nos encontros: a Agilidade alta garante iniciativa e ajuda a alcançar aliados distantes.",
    stances: ["FLANK", "SCOUT", "OPPORTUNIST", "DUELIST"],
  },
];

export const TOWER_ROLE_BY_KEY = Object.fromEntries(
  TOWER_EXPEDITION_ROLES.map((r) => [r.key, r]),
) as Record<TowerExpeditionRole, (typeof TOWER_EXPEDITION_ROLES)[number]>;

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
