// Torre dos Rebeldes — geração de sala, fog de time e resolução de encounter.
// Junta o núcleo tático (Fase 2) ao turno global (Fase 5). Vertical slice: UMA
// sala com obstáculos, aliados dos jogadores vs um grupo de inimigos, fog de
// equipe (visão compartilhada em coop) e 1 rodada do motor por Turno Global.

import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import type { CombatRole } from "@/lib/combat-roles";
import { manhattan, tileKey, towerRoll } from "./engine/grid";
import { resolveTowerRound, isEncounterOver } from "./engine/combat";
import type { TowerGrid, TowerOrder, TowerUnit } from "./engine/types";
import { towerMaxHp } from "./config";

export type TowerRoom = { width: number; height: number; blocked: string[] };

/** Estado persistido em TowerRun.volatileState.battle. Tiles como "x:y" (JSON). */
export type TowerBattleState = {
  room: TowerRoom;
  units: TowerUnit[];
  discovered: string[]; // casas já reveladas (fog acumulado do time)
  encounterOver: boolean;
  outcome?: "WIN" | "LOSS";
};

/** Intenção por mascote escolhida pelo jogador no turno. */
export type TowerIntent = "ADVANCE" | "ATTACK" | "DEFEND" | "WAIT";

export type MemberMascotInput = {
  id: string;
  pokemonId: number;
  name: string;
  level: number;
  force: number;
  agility: number;
  instinct: number;
  vitality: number;
  charisma: number;
  stance: CombatRole;
};

const VISION_RADIUS = 4;

// Bestiário mínimo do Andar 1 (Meowth) — predadores sombrios/normais.
const FLOOR1_ENEMIES: { pokemonId: number; role: CombatRole }[] = [
  { pokemonId: 228, role: "ATTACKER" }, // Houndour
  { pokemonId: 261, role: "FLANK" },    // Poochyena
  { pokemonId: 41, role: "SURVIVOR" },  // Zubat
];

function firstFreeTileNear(x: number, y: number, room: TowerRoom, taken: Set<string>): { x: number; y: number } {
  const blocked = new Set(room.blocked);
  for (let r = 0; r < Math.max(room.width, room.height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= room.width || ny >= room.height) continue;
        const k = tileKey(nx, ny);
        if (blocked.has(k) || taken.has(k)) continue;
        return { x: nx, y: ny };
      }
    }
  }
  return { x, y };
}

/** Gera a sala + posiciona aliados (dos membros) e inimigos. Determinístico. */
export function generateEncounter(
  seed: string,
  members: { userId: string; mascots: MemberMascotInput[] }[],
): TowerBattleState {
  const width = 20, height = 14;
  const blocked: string[] = [];
  // Alguns blocos de parede determinísticos no miolo (contornáveis pelo A*).
  const clusters = 3;
  for (let c = 0; c < clusters; c++) {
    const cx = 5 + Math.floor(towerRoll(seed, "wall", c, "x") * (width - 10));
    const cy = 2 + Math.floor(towerRoll(seed, "wall", c, "y") * (height - 4));
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = cx + dx, y = cy + dy;
      if (x > 2 && x < width - 2) blocked.push(tileKey(x, y));
    }
  }
  const room: TowerRoom = { width, height, blocked: [...new Set(blocked)] };
  const taken = new Set(room.blocked);
  const units: TowerUnit[] = [];

  // Aliados: entram à esquerda (entrada), empilhados.
  const allyMascots = members.flatMap((m) => m.mascots.map((mm) => ({ ...mm, userId: m.userId })));
  allyMascots.forEach((mm, i) => {
    const spot = firstFreeTileNear(1, 2 + i * 2, room, taken);
    taken.add(tileKey(spot.x, spot.y));
    const maxHp = towerMaxHp(mm.level, mm.vitality);
    units.push({
      id: mm.id, team: "ALLY", ownerId: mm.userId, pokemonId: mm.pokemonId, name: mm.name,
      level: mm.level, types: getPokemonTypes(mm.pokemonId),
      hp: maxHp, maxHp, force: mm.force, agility: mm.agility, instinct: mm.instinct,
      vitality: mm.vitality, charisma: mm.charisma, role: mm.stance,
      x: spot.x, y: spot.y, shield: 0, survivorUsed: false, effects: [],
    });
  });

  // Inimigos: à direita, nível ~ média dos aliados − 8.
  const avgLevel = allyMascots.length
    ? Math.round(allyMascots.reduce((s, m) => s + m.level, 0) / allyMascots.length)
    : 20;
  const enemyLevel = Math.max(5, avgLevel - 8);
  FLOOR1_ENEMIES.forEach((spec, i) => {
    const spot = firstFreeTileNear(width - 2, 3 + i * 3, room, taken);
    taken.add(tileKey(spot.x, spot.y));
    const vitality = 6 + enemyLevel;
    const maxHp = towerMaxHp(enemyLevel, vitality);
    units.push({
      id: `enemy:${i}`, team: "ENEMY", ownerId: null, pokemonId: spec.pokemonId,
      name: getPokemonName(spec.pokemonId), level: enemyLevel, types: getPokemonTypes(spec.pokemonId),
      hp: maxHp, maxHp, force: 6 + enemyLevel, agility: 6 + enemyLevel, instinct: 6 + enemyLevel,
      vitality, charisma: 6 + enemyLevel, role: spec.role,
      x: spot.x, y: spot.y, shield: 0, survivorUsed: false, effects: [],
    });
  });

  const state: TowerBattleState = { room, units, discovered: [], encounterOver: false };
  recomputeFog(state);
  return state;
}

/** Casas visíveis pelo time aliado agora (união dos raios de visão dos vivos). */
export function visibleTiles(state: TowerBattleState): Set<string> {
  const vis = new Set<string>();
  for (const u of state.units) {
    if (u.team !== "ALLY" || u.hp <= 0) continue;
    for (let dx = -VISION_RADIUS; dx <= VISION_RADIUS; dx++) {
      for (let dy = -VISION_RADIUS; dy <= VISION_RADIUS; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > VISION_RADIUS) continue;
        const x = u.x + dx, y = u.y + dy;
        if (x < 0 || y < 0 || x >= state.room.width || y >= state.room.height) continue;
        vis.add(tileKey(x, y));
      }
    }
  }
  return vis;
}

/** Acumula as casas visíveis no fog descoberto. */
export function recomputeFog(state: TowerBattleState): void {
  const seen = new Set(state.discovered);
  for (const t of visibleTiles(state)) seen.add(t);
  state.discovered = [...seen];
}

function nearestEnemy(unit: TowerUnit, units: TowerUnit[]): TowerUnit | null {
  const foes = units.filter((u) => u.team !== unit.team && u.hp > 0);
  if (!foes.length) return null;
  return foes.sort((a, b) => manhattan(unit, a) - manhattan(unit, b))[0];
}

function roleRange(role: CombatRole): number {
  if (["DEFENDER", "ATTACKER", "GUARDIAN", "PROVOKER", "SURVIVOR"].includes(role)) return 1;
  if (role === "SCOUT" || role === "HEALER" || role === "ENCOURAGER") return 3;
  return 2;
}

/** Converte a intenção do jogador na ordem do motor (mira/aproxima conforme o caso). */
function orderFromIntent(unit: TowerUnit, intent: TowerIntent, units: TowerUnit[]): TowerOrder {
  if (intent === "DEFEND") return { unitId: unit.id, type: "DEFEND" };
  if (intent === "WAIT") return { unitId: unit.id, type: "WAIT" };
  const foe = nearestEnemy(unit, units);
  if (!foe) return { unitId: unit.id, type: "WAIT" };
  const inRange = manhattan(unit, foe) <= roleRange(unit.role);
  if (intent === "ATTACK" && inRange) return { unitId: unit.id, type: "ATTACK", targetId: foe.id };
  // ADVANCE, ou ATTACK fora de alcance → move em direção ao inimigo mais próximo.
  return { unitId: unit.id, type: "MOVE", x: foe.x, y: foe.y };
}

/**
 * Resolve UMA rodada do encounter usando as intenções submetidas. Inimigos usam
 * IA simples (avançar/atacar). Atualiza unidades, fog e outcome. Retorna eventos.
 */
export function resolveEncounterTurn(
  state: TowerBattleState,
  seed: string,
  round: number,
  intentsByMascot: Record<string, TowerIntent>,
): { state: TowerBattleState; events: ReturnType<typeof resolveTowerRound>["events"] } {
  if (state.encounterOver) return { state, events: [] };
  const grid: TowerGrid = { width: state.room.width, height: state.room.height, blocked: new Set(state.room.blocked) };
  const orders = new Map<string, TowerOrder>();
  for (const u of state.units) {
    if (u.hp <= 0) continue;
    if (u.team === "ALLY") {
      orders.set(u.id, orderFromIntent(u, intentsByMascot[u.id] ?? "ADVANCE", state.units));
    } else {
      orders.set(u.id, orderFromIntent(u, "ATTACK", state.units)); // IA inimiga: pressiona
    }
  }
  const res = resolveTowerRound({ units: state.units, grid, orders, round, seed });
  state.units = res.units;
  recomputeFog(state);
  if (isEncounterOver(state.units)) {
    state.encounterOver = true;
    state.outcome = state.units.some((u) => u.team === "ALLY" && u.hp > 0) ? "WIN" : "LOSS";
  }
  return { state, events: res.events };
}
