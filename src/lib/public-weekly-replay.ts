export type PublicReplayTeam = {
  id: string;
  pokemonId: number;
  maxHp: number;
  side: "A" | "B";
};

export type PublicReplayTurn = {
  actorId: string;
  targetId: string;
  action: "ATTACK" | "DEFEND" | "HEAL" | "ABILITY";
  damage: number;
  attackerType?: string;
};

export type PublicWeeklyReplay = {
  source: "real" | "demo";
  teams: PublicReplayTeam[];
  turns: PublicReplayTurn[];
};

type RawFighter = { id?: unknown; pokemonId?: unknown; maxHp?: unknown; hp?: unknown };
type RawTurn = { actorId?: unknown; targetId?: unknown; action?: unknown; damage?: unknown; attackerType?: unknown };

const ELEMENT_TYPES = new Set([
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying",
  "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
]);

function publicElement(value: unknown): string | undefined {
  return typeof value === "string" && ELEMENT_TYPES.has(value) ? value : undefined;
}

const DEMO_REPLAY: PublicWeeklyReplay = {
  source: "demo",
  teams: [
    { id: "a-1", pokemonId: 6, maxHp: 124, side: "A" },
    { id: "a-2", pokemonId: 25, maxHp: 92, side: "A" },
    { id: "b-1", pokemonId: 94, maxHp: 110, side: "B" },
    { id: "b-2", pokemonId: 448, maxHp: 118, side: "B" },
  ],
  turns: [
    { actorId: "a-1", targetId: "b-1", action: "ATTACK", damage: 28, attackerType: "fire" },
    { actorId: "b-1", targetId: "a-1", action: "ABILITY", damage: 19, attackerType: "ghost" },
    { actorId: "a-2", targetId: "b-1", action: "ATTACK", damage: 23, attackerType: "electric" },
    { actorId: "b-2", targetId: "a-2", action: "DEFEND", damage: 0 },
    { actorId: "a-1", targetId: "a-1", action: "HEAL", damage: 16 },
    { actorId: "b-2", targetId: "a-1", action: "ATTACK", damage: 26, attackerType: "fighting" },
  ],
};

function asFighters(value: unknown, side: "A" | "B"): PublicReplayTeam[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row, index) => {
    const fighter = row as RawFighter;
    const id = typeof fighter.id === "string" && fighter.id ? fighter.id : "";
    const pokemonId = Number(fighter.pokemonId);
    const hp = Number(fighter.maxHp ?? fighter.hp);
    if (!id || !Number.isInteger(pokemonId) || pokemonId < 1) return [];
    return [{ id, pokemonId, maxHp: Number.isFinite(hp) && hp > 0 ? hp : 100, side }];
  });
}

function asTurns(value: unknown, validIds: Set<string>): PublicReplayTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const turn = row as RawTurn;
    const actorId = typeof turn.actorId === "string" ? turn.actorId : "";
    const targetId = typeof turn.targetId === "string" ? turn.targetId : "";
    const action = turn.action;
    const damage = Number(turn.damage);
    if (!validIds.has(actorId) || !validIds.has(targetId)) return [];
    if (action !== "ATTACK" && action !== "DEFEND" && action !== "HEAL" && action !== "ABILITY") return [];
    const attackerType = publicElement(turn.attackerType);
    return [{ actorId, targetId, action, damage: Number.isFinite(damage) ? Math.max(0, damage) : 0, ...(attackerType ? { attackerType } : {}) }];
  });
}

/** Removes player and mascot labels before a weekly replay reaches the public home. */
export function buildPublicWeeklyReplay(raw: { resultJson?: unknown; replayJson?: unknown } | null | undefined): PublicWeeklyReplay {
  const result = raw?.resultJson as { lineupA?: unknown; lineupB?: unknown } | null | undefined;
  const teams = [...asFighters(result?.lineupA, "A"), ...asFighters(result?.lineupB, "B")];
  const turns = asTurns(raw?.replayJson, new Set(teams.map((team) => team.id)));
  const hasBothSides = teams.some((team) => team.side === "A") && teams.some((team) => team.side === "B");
  return hasBothSides && turns.length > 0 ? { source: "real", teams, turns } : DEMO_REPLAY;
}
