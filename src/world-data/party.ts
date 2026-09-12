import { normalizeCombatRole } from "@/lib/combat-roles";

export const WORLD_PARTY_MAX = 6;
export type WorldPartyEntry = { mascotId: string; posture: string };

/** Lê a formação do World Mode a partir do JSON persistido, saneando entradas
 * inválidas e normalizando a postura. */
export function readWorldParty(value: unknown): WorldPartyEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is { mascotId: string; posture?: string } =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as { mascotId?: unknown }).mascotId === "string",
    )
    .map((entry) => ({
      mascotId: entry.mascotId,
      posture: normalizeCombatRole(entry.posture),
    }));
}

// HP máximo de um mascote no combate — mesma fórmula do motor da Liga
// (toLeagueMascot). Centralizado para HP persistente do World Mode.
export function worldMaxHp(level: number, vitality: number): number {
  return Math.max(10, Math.round(55 + level * 6 + vitality * 4));
}

// Estado persistente de HP/condições por mascote na aventura.
export type WorldMascotCondition = { hp: number; poisoned?: boolean };
export type WorldMascotStateMap = Record<string, WorldMascotCondition>;

export function readWorldMascotState(value: unknown): WorldMascotStateMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: WorldMascotStateMap = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const hp = Number((raw as { hp?: unknown }).hp);
    if (!Number.isFinite(hp)) continue;
    out[id] = {
      hp: Math.max(0, Math.round(hp)),
      poisoned: Boolean((raw as { poisoned?: unknown }).poisoned),
    };
  }
  return out;
}
