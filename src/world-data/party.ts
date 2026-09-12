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
