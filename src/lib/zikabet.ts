export type BetConfig = {
  enabled: boolean;
  allowBetOnSelf: boolean;
  minBet: number;
  maxBet: number;
  maxDailyBet: number;
  // Teto total de apostas por semana neste campeonato (0 = sem limite semanal).
  maxWeeklyBet: number;
};

export const DEFAULT_BET_CONFIG: BetConfig = {
  enabled: false,
  allowBetOnSelf: false,
  minBet: 10,
  maxBet: 500,
  maxDailyBet: 2000,
  maxWeeklyBet: 0
};

export function parseBetConfig(raw: unknown): BetConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_BET_CONFIG;
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : false,
    allowBetOnSelf: typeof r.allowBetOnSelf === "boolean" ? r.allowBetOnSelf : false,
    minBet: typeof r.minBet === "number" ? r.minBet : 10,
    maxBet: typeof r.maxBet === "number" ? r.maxBet : 500,
    maxDailyBet: typeof r.maxDailyBet === "number" ? r.maxDailyBet : 2000,
    maxWeeklyBet: typeof r.maxWeeklyBet === "number" ? r.maxWeeklyBet : 0
  };
}

// Início da semana (segunda-feira 00:00 em Brasília) para o teto semanal.
export function startOfBetWeek(now = new Date()): Date {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const noonUtc = new Date(`${dateKey}T12:00:00Z`);
  const diff = (noonUtc.getUTCDay() + 6) % 7;
  noonUtc.setUTCDate(noonUtc.getUTCDate() - diff);
  const monday = noonUtc.toISOString().slice(0, 10);
  return new Date(`${monday}T00:00:00-03:00`);
}

export function endOfBetWeek(now = new Date()): Date {
  const end = startOfBetWeek(now);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

export function isInCurrentBetWeek(date: Date, now = new Date()): boolean {
  return date >= startOfBetWeek(now) && date < endOfBetWeek(now);
}

type TournamentBetWeek = {
  status?: string | null;
  deckLockAt?: Date | null;
  lockAt?: Date | null;
  endDate?: Date | null;
};

/**
 * A revelacao das listas encerra definitivamente o mercado daquela rodada.
 * Usamos a mesma fonte de verdade da pagina de decks: status bloqueado/fechado
 * ou o primeiro prazo configurado ja alcancado.
 */
export function isTournamentBettingLocked(week: TournamentBetWeek | null | undefined, now = new Date()): boolean {
  if (!week) return true;
  if (week.status === "LOCKED" || week.status === "CLOSED") return true;
  const revealAt = week.deckLockAt ?? week.lockAt ?? week.endDate ?? null;
  return Boolean(revealAt && now >= revealAt);
}
