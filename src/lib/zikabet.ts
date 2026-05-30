export type BetConfig = {
  enabled: boolean;
  allowBetOnSelf: boolean;
  minBet: number;
  maxBet: number;
  maxDailyBet: number;
};

export const DEFAULT_BET_CONFIG: BetConfig = {
  enabled: false,
  allowBetOnSelf: false,
  minBet: 10,
  maxBet: 500,
  maxDailyBet: 2000
};

export function parseBetConfig(raw: unknown): BetConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_BET_CONFIG;
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : false,
    allowBetOnSelf: typeof r.allowBetOnSelf === "boolean" ? r.allowBetOnSelf : false,
    minBet: typeof r.minBet === "number" ? r.minBet : 10,
    maxBet: typeof r.maxBet === "number" ? r.maxBet : 500,
    maxDailyBet: typeof r.maxDailyBet === "number" ? r.maxDailyBet : 2000
  };
}
