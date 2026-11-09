// Calendário do Rei do Rio. Todos os horários em America/Sao_Paulo (UTC-3, sem horário de verão).
import { FREEZE_HOUR, LOCK_HOUR, ROUND_HOURS, ROUNDS_PER_DAY, TOTAL_ROUNDS } from "./config";

const BRT_OFFSET_H = 3;

/** Data BRT "YYYY-MM-DD" + hora local BRT -> instante UTC. */
export function brtInstant(ymd: string, hour: number, dayOffset = 0): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dayOffset, hour + BRT_OFFSET_H, 0, 0, 0));
}

/** Segunda-feira (BRT) da semana que contém `now`. */
export function mondayOf(now: Date): string {
  const brt = new Date(now.getTime() - BRT_OFFSET_H * 3600_000);
  const dow = brt.getUTCDay(); // 0 dom .. 6 sáb
  const back = (dow + 6) % 7;
  const mon = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() - back));
  return mon.toISOString().slice(0, 10);
}

/** 21h de segunda: fecha inscrições e congela os 18 mascotes. */
export const lockAt = (monday: string) => brtInstant(monday, LOCK_HOUR);

/** Dia de competição 1..4 = terça..sexta. 08h: congela a formação do dia. */
export const freezeAt = (monday: string, day: number) => brtInstant(monday, FREEZE_HOUR, day);

export function roundTime(monday: string, roundIndex: number): { dayIndex: number; slotInDay: number; at: Date } {
  const i = roundIndex - 1;
  const dayIndex = Math.floor(i / ROUNDS_PER_DAY) + 1;
  const slotInDay = (i % ROUNDS_PER_DAY) + 1;
  return { dayIndex, slotInDay, at: brtInstant(monday, ROUND_HOURS[slotInDay - 1], dayIndex) };
}

export function buildRoundPlan(monday: string) {
  return Array.from({ length: TOTAL_ROUNDS }, (_, k) => ({ roundIndex: k + 1, ...roundTime(monday, k + 1) }));
}

export const isLastRoundOfDay = (roundIndex: number) => roundIndex % ROUNDS_PER_DAY === 0;
export const dayOfRound = (roundIndex: number) => Math.floor((roundIndex - 1) / ROUNDS_PER_DAY) + 1;

export const DAY_LABELS = ["", "Terça", "Quarta", "Quinta", "Sexta"] as const;

/** Edições só mudam de fase por esta tabela. */
export const PHASES = ["PREPARATION", "LOCKED", "RUNNING", "REST", "FINISHED"] as const;
export type Phase = (typeof PHASES)[number];
const ALLOWED: Record<Phase, Phase[]> = {
  PREPARATION: ["LOCKED"],
  LOCKED: ["RUNNING"],
  RUNNING: ["REST", "FINISHED"],
  REST: ["RUNNING"],
  FINISHED: [],
};
export const canTransition = (from: string, to: string) => (ALLOWED[from as Phase] ?? []).includes(to as Phase);

export const PHASE_LABELS: Record<Phase, string> = {
  PREPARATION: "Preparação",
  LOCKED: "Equipes reveladas",
  RUNNING: "Em disputa",
  REST: "Descanso",
  FINISHED: "Encerrado",
};
