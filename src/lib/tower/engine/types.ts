// Torre dos Rebeldes — núcleo tático INDEPENDENTE da Arena Z.
// A Arena (arena-online) é usada apenas como REFERÊNCIA de mecânica; nada aqui
// importa nem modifica o motor dela. Grid parametrizável, obstáculos e RNG
// determinístico (para reconnect/replay), conforme a spec.

import type { CombatRole } from "@/lib/combat-roles";

export type TowerTeam = "ALLY" | "ENEMY";

export type TowerEffect = {
  id: string;
  label: string;
  kind: "BUFF" | "DEBUFF";
  stat?: "force" | "agility" | "charisma" | "instinct" | "vitality";
  value: number; // fração (ex.: 0.1 = +10%)
  duration: number; // em rodadas restantes
};

export type TowerUnit = {
  id: string;
  team: TowerTeam;
  ownerId: string | null; // treinador dono (aliados) ou null (inimigos/bots)
  pokemonId: number;
  name: string;
  level: number;
  types: string[];
  hp: number;
  maxHp: number;
  force: number;
  agility: number;
  instinct: number;
  vitality: number;
  charisma: number;
  role: CombatRole;
  x: number;
  y: number;
  shield: number; // 0..1 — redução do próximo ataque direto (postura Defender)
  survivorUsed: boolean; // resistiu a um golpe fatal (papel Sobrevivente)
  effects: TowerEffect[];
};

/** Grade da sala: dimensões + casas bloqueadas (paredes/objetos). */
export type TowerGrid = {
  width: number;
  height: number;
  /** chaves "x:y" de casas intransponíveis (paredes, objetos bloqueadores). */
  blocked: Set<string>;
};

export type TowerOrderType = "MOVE" | "ATTACK" | "DEFEND" | "WAIT" | "AUTO";

export type TowerOrder = {
  unitId: string;
  type: TowerOrderType;
  x?: number;
  y?: number;
  targetId?: string;
};

export type TowerBattleEvent = {
  unitId: string;
  targetId?: string;
  kind:
    | "MOVE"
    | "BLOCK"
    | "DEFEND"
    | "ATTACK"
    | "HEAL"
    | "REDIRECT"
    | "BYPASS"
    | "KO"
    | "SURVIVE";
  text: string;
  amount?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
};

export type TowerRoundInput = {
  units: TowerUnit[];
  grid: TowerGrid;
  orders: Map<string, TowerOrder>;
  round: number;
  seed: string;
};

export type TowerRoundResult = {
  units: TowerUnit[];
  events: TowerBattleEvent[];
};
