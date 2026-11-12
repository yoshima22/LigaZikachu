// Núcleo puro do Amigo Oculto: sorteio, bengalas de açúcar da comunidade e categorias de presente. Sem banco, sem relógio.
import { createHash } from "node:crypto";
import type { PackageItem } from "./catalog";

export type SsConfig = {
  levels: [number, number, number, number]; // bengalas de açúcar (total da comunidade) que liberam as categorias 1..4
  mimoMinPct: number; // % dos dias com check-in para ganhar o mimo de constância
  minParticipants: number;
  published?: boolean; // visível para os jogadores (padrão: só admin)
  kits?: Record<string, PackageItem[]>; // itens/quantidades editados pelo admin (sobrepõem o catálogo padrão)
};
export const DEFAULT_SS_CONFIG: SsConfig = { levels: [1, 31, 151, 300], mimoMinPct: 0.7, minParticipants: 6 };

export const readConfig = (raw: unknown): SsConfig => ({ ...DEFAULT_SS_CONFIG, ...(raw && typeof raw === "object" ? (raw as Partial<SsConfig>) : {}) });

// RNG determinístico (mulberry32) a partir de uma seed textual: o sorteio pode ser auditado depois.
export function rngFromSeed(seed: string) {
  let a = createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hashSeed = (seed: string) => createHash("sha256").update(seed).digest("hex");

// Um único ciclo embaralhado: cada um presenteia o próximo. Ninguém tira a si mesmo e,
// com 3+ pessoas, ninguém forma par de troca direta (A↔B).
export function draw(ids: string[], seed: string): Map<string, string> {
  if (ids.length < 3) throw new Error("O sorteio precisa de pelo menos 3 participantes.");
  const rnd = rngFromSeed(seed);
  const order = [...ids].sort();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return new Map(order.map((id, i) => [id, order[(i + 1) % order.length]]));
}

// Dias de BRT entre duas datas YYYY-MM-DD, inclusive.
export function daysBetween(from: string, to: string): number {
  const d = (s: string) => Date.parse(`${s}T00:00:00Z`);
  return Math.max(0, Math.floor((d(to) - d(from)) / 86_400_000) + 1);
}

// Categoria coletiva 0..4 pelo total de bengalas de açúcar (pontos absolutos, não proporcionais).
export function levelFor(bonds: number, cfg: SsConfig): number {
  return cfg.levels.reduce((lv, min, i) => (bonds >= min ? i + 1 : lv), 0);
}

// Bengalas limitadas a 1 por dia e por pessoa; datas repetidas ou fora da janela não contam.
export function countCheckins(days: string[], from: string, to: string): number {
  return new Set(days.filter((d) => d >= from && d <= to)).size;
}

export const earnedMimo = (checkins: number, totalDays: number, cfg: SsConfig) => totalDays > 0 && checkins / totalDays >= cfg.mimoMinPct;

export const brtDay = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
// Último dia com check-in possível: a entrega é à 00:00, então o dia da entrega já não conta.
export const lastCheckinDay = (deliverAt: Date) => brtDay(new Date(deliverAt.getTime() - 1));

// Sorteio entre as opções (determinístico por seed + participante, auditável depois).
export const pickIndex = (seed: string, n: number) => Math.floor(rngFromSeed(seed)() * n);

// Sorteio que evita repetir pares de edições anteriores (best effort: tenta várias seeds).
export function drawAvoiding(ids: string[], avoid: Set<string>, tries = 300): { seed: string; pairs: Map<string, string> } {
  let best: { seed: string; pairs: Map<string, string>; bad: number } | null = null;
  for (let i = 0; i < tries; i++) {
    const seed = createHash("sha256").update(`${Math.random()}:${Date.now()}:${i}`).digest("hex").slice(0, 32);
    const pairs = draw(ids, seed);
    const bad = [...pairs].filter(([a, b]) => avoid.has(`${a}>${b}`)).length;
    if (!best || bad < best.bad) best = { seed, pairs, bad };
    if (bad === 0) break;
  }
  return best!;
}
