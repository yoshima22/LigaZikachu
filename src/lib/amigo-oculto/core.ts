// Núcleo puro do Amigo Oculto: sorteio, laços da comunidade e níveis de presente. Sem banco, sem relógio.
import { createHash } from "node:crypto";

export type SsConfig = {
  goalPct: number; // meta = inscritos × dias × goalPct
  levels: [number, number, number, number]; // frações da meta que liberam os níveis 1..4
  mimoMinPct: number; // % dos dias com check-in para ganhar o mimo de constância
  minParticipants: number;
};
export const DEFAULT_SS_CONFIG: SsConfig = { goalPct: 0.75, levels: [0.25, 0.5, 0.75, 1], mimoMinPct: 0.7, minParticipants: 6 };

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

export const goalFor = (participants: number, days: number, cfg: SsConfig) => Math.max(1, Math.round(participants * days * cfg.goalPct));

// Nível coletivo 0..4 pelo total de laços.
export function levelFor(bonds: number, goal: number, cfg: SsConfig): number {
  return cfg.levels.reduce((lv, f, i) => (bonds >= goal * f ? i + 1 : lv), 0);
}

// Laços limitados a 1 por dia e por pessoa; datas repetidas ou fora da janela não contam.
export function countCheckins(days: string[], from: string, to: string): number {
  return new Set(days.filter((d) => d >= from && d <= to)).size;
}

export const earnedMimo = (checkins: number, totalDays: number, cfg: SsConfig) => totalDays > 0 && checkins / totalDays >= cfg.mimoMinPct;

export const brtDay = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
