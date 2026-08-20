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
  requireTicket: false,
};

export async function getTowerConfig(): Promise<TowerConfig> {
  const setting = await prisma.appSetting
    .findUnique({ where: { key: TOWER_SETTINGS_KEY }, select: { value: true } })
    .catch(() => null);
  const v = (setting?.value ?? {}) as Partial<TowerConfig>;
  return {
    entryCooldownMinutes:
      typeof v.entryCooldownMinutes === "number" && v.entryCooldownMinutes > 0
        ? v.entryCooldownMinutes
        : DEFAULT_CONFIG.entryCooldownMinutes,
    requireTicket: v.requireTicket === true,
  };
}

// ── Funções de Expedição → posturas permitidas ────────────────────────────────

export const TOWER_EXPEDITION_ROLES: {
  key: TowerExpeditionRole;
  label: string;
  exploration: string;
  benefit: string;
  stances: CombatRole[];
}[] = [
  {
    key: "INVESTIGADOR",
    label: "Investigador",
    exploration: "Identifica pistas, mecanismos, objetos falsos e armadilhas.",
    benefit: "Revela informações extras de inimigos e bosses.",
    stances: ["SCOUT", "SPECIALIST", "OPPORTUNIST", "PROVOKER"],
  },
  {
    key: "NAVEGADOR",
    label: "Navegador",
    exploration: "Lê melhor as conexões do labirinto.",
    benefit: "Melhora movimentação e posicionamento de entrada.",
    stances: ["FLANK", "SCOUT", "DUELIST"],
  },
  {
    key: "PROTETOR",
    label: "Protetor",
    exploration: "Protege aliados durante interações e resgates.",
    benefit: "Ganha opções defensivas extras.",
    stances: ["DEFENDER", "GUARDIAN", "SURVIVOR"],
  },
  {
    key: "ARTIFICE",
    label: "Artífice",
    exploration: "Especialista em Geradores, Portas, Alavancas e Placas.",
    benefit: "Reduz custo e risco de mecanismos tecnológicos.",
    stances: ["SPECIALIST", "SABOTEUR", "ENCOURAGER", "ATTACKER"],
  },
  {
    key: "RITUALISTA",
    label: "Ritualista",
    exploration: "Especialista em Altares, Runas, Máscaras e Espelhos.",
    benefit: "Enfraquece efeitos sobrenaturais.",
    stances: ["HEALER", "ENCOURAGER", "PROVOKER", "SURVIVOR"],
  },
  {
    key: "BATEDOR",
    label: "Batedor",
    exploration: "Reconhece áreas e presença hostil.",
    benefit: "Melhora iniciativa e reconhecimento de emboscadas.",
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
