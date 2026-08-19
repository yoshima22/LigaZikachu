// Utilidades de grade e RNG determinístico para o núcleo tático da Torre.

import type { TowerGrid } from "./types";

/** Hash estável (FNV-1a) para derivar RNG do seed + chaves. */
function hashKey(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const str = parts.join(":");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Roll determinístico em [0,1). Mesmo seed + mesmas chaves → mesmo valor, sempre.
 * Espelha o `deterministicRoll` da Arena para que reconnect/replay nunca refaçam RNG.
 */
export function towerRoll(seed: string, ...keys: (string | number)[]): number {
  const h = hashKey(seed, ...keys);
  // mulberry32 de um passo
  let t = (h + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const tileKey = (x: number, y: number) => `${x}:${y}`;

/** Distância Manhattan (movimento ortogonal). */
export const manhattan = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function inBounds(grid: TowerGrid, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

/** Casa livre para passar/parar: dentro da grade, não bloqueada e não ocupada. */
export function isWalkable(
  grid: TowerGrid,
  x: number,
  y: number,
  occupied: Set<string>,
): boolean {
  if (!inBounds(grid, x, y)) return false;
  const k = tileKey(x, y);
  return !grid.blocked.has(k) && !occupied.has(k);
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Menor número de passos ortogonais de `start` até `goal`, contornando paredes,
 * objetos e unidades (A* com heurística Manhattan). `null` se inalcançável.
 * O destino final pode estar ocupado só se `allowGoalOccupied` (ex.: mirar sem entrar).
 */
export function pathCost(
  grid: TowerGrid,
  start: { x: number; y: number },
  goal: { x: number; y: number },
  occupied: Set<string>,
  maxCost = 64,
): number | null {
  if (start.x === goal.x && start.y === goal.y) return 0;
  if (!isWalkable(grid, goal.x, goal.y, occupied)) return null;
  const gScore = new Map<string, number>();
  const startK = tileKey(start.x, start.y);
  gScore.set(startK, 0);
  // fila simples ordenada por f = g + h (grade pequena; sem heap dedicado)
  const open: Array<{ x: number; y: number; g: number; f: number }> = [
    { x: start.x, y: start.y, g: 0, f: manhattan(start, goal) },
  ];
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    if (cur.x === goal.x && cur.y === goal.y) return cur.g;
    if (cur.g >= maxCost) continue;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const isGoal = nx === goal.x && ny === goal.y;
      if (!isGoal && !isWalkable(grid, nx, ny, occupied)) continue;
      if (isGoal && !isWalkable(grid, nx, ny, occupied)) continue;
      const nk = tileKey(nx, ny);
      const ng = cur.g + 1;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        open.push({ x: nx, y: ny, g: ng, f: ng + manhattan({ x: nx, y: ny }, goal) });
      }
    }
  }
  return null;
}

/**
 * Casas livres alcançáveis a partir de `start` com custo (passos) ≤ `budget`,
 * contornando obstáculos e unidades. Retorna mapa "x:y" → custo.
 */
export function reachableTiles(
  grid: TowerGrid,
  start: { x: number; y: number },
  budget: number,
  occupied: Set<string>,
): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(tileKey(start.x, start.y), 0);
  const queue: Array<{ x: number; y: number; g: number }> = [
    { x: start.x, y: start.y, g: 0 },
  ];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.g >= budget) continue;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!isWalkable(grid, nx, ny, occupied)) continue;
      const nk = tileKey(nx, ny);
      const ng = cur.g + 1;
      if (ng < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, ng);
        queue.push({ x: nx, y: ny, g: ng });
      }
    }
  }
  dist.delete(tileKey(start.x, start.y));
  return dist;
}
