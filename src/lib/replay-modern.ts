// Normaliza lineups + turnLog (formato do motor de combate) para o formato
// animado do replay "moderno". Puro: sem I/O, reutilizável no admin e na liga.
import { getStaticSpriteUrl, getPokemonTypes, getPokemonName } from "@/lib/mascot-data";
import type { Combatant, ReplayTurn, ReplayData } from "@/components/replay/replay-canvas";

export type ReplayLineMon = { id: string; name?: string | null; pokemonId?: number; maxHp?: number | null; hp?: number | null };
export type ReplayLogEntry = {
  turn: number;
  actorId: string;
  targetId: string;
  action: "ATTACK" | "DEFEND" | "HEAL" | "ABILITY";
  attackerType?: string;
  damage: number;
  advantageApplied?: boolean;
  actorRole?: string;
  targetRole?: string;
  effect?: string;
  targetHpAfter?: number;
  guardianIntercept?: { mascotId: string; damage: number } | null;
  debuffEvents?: unknown[] | null;
};

export function buildModernReplay(
  lineupA: ReplayLineMon[],
  lineupB: ReplayLineMon[],
  log: ReplayLogEntry[],
  bgUrl = "/replay-lab/arena.webp",
): ReplayData {
  const toCombatant = (mon: ReplayLineMon, side: "A" | "B"): Combatant => {
    const pokemonId = mon.pokemonId ?? 0;
    return {
      id: mon.id,
      name: mon.name ?? (pokemonId ? getPokemonName(pokemonId) : "?"),
      pokemonId,
      type: getPokemonTypes(pokemonId)[0] ?? "normal",
      sprite: getStaticSpriteUrl(pokemonId),
      maxHp: Math.max(1, mon.maxHp ?? mon.hp ?? 100),
      side,
    };
  };
  const teams: Combatant[] = [
    ...lineupA.map((m) => toCombatant(m, "A")),
    ...lineupB.map((m) => toCombatant(m, "B")),
  ];

  // HP corrido (cosmético) a partir do dano/cura do log — garante números e
  // nocautes coerentes mesmo quando targetHpAfter não vem gravado.
  const maxById = new Map(teams.map((c) => [c.id, c.maxHp]));
  const hp = new Map(teams.map((c) => [c.id, c.maxHp]));

  const turns: ReplayTurn[] = [];
  for (const e of log) {
    const isHeal = e.action === "HEAL";
    const isSelfish = e.action === "DEFEND";
    const debuffOnly = e.action === "ABILITY" && e.damage === 0;
    const guardianId = e.guardianIntercept?.mascotId ?? null;
    const victimId = guardianId ?? e.targetId;

    let targetHpAfter = hp.get(victimId) ?? maxById.get(victimId) ?? 1;
    if (isHeal) {
      const max = maxById.get(e.targetId) ?? 1;
      targetHpAfter = Math.min(max, (hp.get(e.targetId) ?? max) + e.damage);
      hp.set(e.targetId, targetHpAfter);
    } else if (!isSelfish && !debuffOnly) {
      const dmg = guardianId ? (e.guardianIntercept?.damage ?? e.damage) : e.damage;
      targetHpAfter = Math.max(0, (hp.get(victimId) ?? maxById.get(victimId) ?? 1) - dmg);
      hp.set(victimId, targetHpAfter);
    }

    turns.push({
      turn: e.turn,
      actorId: e.actorId,
      targetId: e.targetId,
      action: e.action,
      attackerType: e.attackerType,
      damage: e.damage,
      advantageApplied: e.advantageApplied,
      targetHpAfter,
      actorRole: e.actorRole,
      targetRole: e.targetRole,
      effect: e.effect,
      abilityName: isHeal ? "Cura" : isSelfish ? "Defesa" : debuffOnly ? (e.effect ?? "Efeito") : undefined,
      guardianInterceptId: guardianId,
      debuff: debuffOnly,
    });
  }

  return { teams, turns, bgUrl };
}
