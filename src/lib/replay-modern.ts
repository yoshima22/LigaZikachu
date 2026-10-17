// Normaliza lineups + turnLog (formato do motor de combate) para o formato
// animado do replay "moderno". Puro: sem I/O, reutilizável no admin e na liga.
import { getStaticSpriteUrl, getPokemonTypes, getPokemonName } from "@/lib/mascot-data";
import type { Combatant, ReplayTurn, ReplayData } from "@/components/replay/replay-canvas";

export type ReplayLineMon = { id: string; name?: string | null; pokemonId?: number; maxHp?: number | null; hp?: number | null; role?: string | null };
export type ReplayLogEntry = {
  turn: number;
  actorId: string;
  targetId: string;
  action: "ATTACK" | "DEFEND" | "HEAL" | "ABILITY";
  attackerType?: string;
  damage: number;
  advantageApplied?: boolean;
  typeStep?: number;
  typeDelta?: number;
  multiplier?: number;
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
  opts: { bgUrl?: string; winnerName?: string | null } = {},
): ReplayData {
  const bgUrl = opts.bgUrl ?? "/replay-lab/arena.webp";
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
      role: mon.role ?? undefined,
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

  const hpOf = (id: string) => hp.get(id) ?? maxById.get(id) ?? 1;
  const turns: ReplayTurn[] = [];
  for (const e of log) {
    const isHeal = e.action === "HEAL";
    const isSelfish = e.action === "DEFEND";
    const debuffOnly = e.action === "ABILITY" && e.damage === 0;
    const guardianId = e.guardianIntercept?.mascotId ?? null;
    const gDmg = e.guardianIntercept?.damage ?? 0;

    // HP corrido espelhando o motor: no HEAL o alvo cura; num ataque o ALVO
    // perde `damage` (já reduzido pela absorção) E o GUARDIÃO perde o que
    // absorveu. O log não grava HP absoluto, então reconstruímos por subtração.
    let targetHpAfter = hpOf(e.targetId);
    let guardianHpAfter: number | undefined;
    if (isHeal) {
      targetHpAfter = Math.min(maxById.get(e.targetId) ?? 1, hpOf(e.targetId) + e.damage);
      hp.set(e.targetId, targetHpAfter);
    } else if (!isSelfish && !debuffOnly) {
      targetHpAfter = Math.max(0, hpOf(e.targetId) - e.damage);
      hp.set(e.targetId, targetHpAfter);
      if (guardianId) {
        guardianHpAfter = Math.max(0, hpOf(guardianId) - gDmg);
        hp.set(guardianId, guardianHpAfter);
      }
    }

    turns.push({
      turn: e.turn,
      actorId: e.actorId,
      targetId: e.targetId,
      action: e.action,
      attackerType: e.attackerType,
      damage: e.damage,
      advantageApplied: e.advantageApplied,
      typeStep: e.typeStep,
      typeDelta: e.typeDelta,
      multiplier: e.multiplier,
      targetHpAfter,
      actorRole: e.actorRole,
      targetRole: e.targetRole,
      effect: e.effect,
      abilityName: isHeal ? "Cura" : isSelfish ? "Defesa" : debuffOnly ? (e.effect ?? "Efeito") : undefined,
      guardianInterceptId: guardianId,
      guardianHpAfter,
      guardianInterceptDamage: guardianId ? gDmg : undefined,
      debuff: debuffOnly,
    });
  }

  return { teams, turns, bgUrl, winnerName: opts.winnerName ?? null };
}
