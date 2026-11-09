// Modo semanal (Trono de Natal) — constantes fixas do evento e parâmetros de balanceamento ajustáveis.
// Os fixos (18 mascotes, 6 slots, calendário) só mudam com decisão explícita.

export const SLOT_COUNT = 6;
export const SQUAD_SIZE = 3;
export const TEAM_SIZE = SLOT_COUNT * SQUAD_SIZE; // 18
export const ROUND_HOURS = [9, 12, 15, 18, 21] as const;
export const ROUNDS_PER_DAY = ROUND_HOURS.length;
export const COMPETITION_DAYS = 4; // terça a sexta
export const TOTAL_ROUNDS = ROUNDS_PER_DAY * COMPETITION_DAYS; // 20
export const LOCK_HOUR = 21; // segunda
export const FREEZE_HOUR = 8; // manhã de cada dia de competição

export type ReiConfig = {
  /** Diferença mínima de HP% (pontos percentuais) para "Preservar os feridos" trocar. */
  swapHpGapPct: number;
  /** Orçamento de pontos por equipe/combate (não são pontos automáticos). */
  budget: { damage: number; ko: number; support: number; resilience: number; win: number };
  /** Normalizadores: fração do HP total inimigo que "enche" a categoria. */
  supportNormFraction: number;
  /** Pontos máximos de permanência no topo por combate (somados à equipe). */
  leadershipPerStreak: number;
  leadershipCap: number;
  /** Pressão do Trono (líderes) / Calor da Lareira (lanternas). */
  pressure: { enabled: boolean; steps: number[]; topFraction: number };
  current: { enabled: boolean; steps: number[]; bottomFraction: number };
  /** Multiplicador do HP máximo dos mascotes NESTE modo (1 = HP normal). Reduz o desgaste diário. */
  hpMultiplier: number;
  /** Limite de rodadas por combate (o motor padrão luta até a extinção, ~150). No limite vence quem tem mais HP total. */
  maxRounds: number;
  /** Participantes mínimos para os modificadores valerem. */
  balanceMinPlayers: number;
};

export const DEFAULT_CONFIG: ReiConfig = {
  swapHpGapPct: 15,
  budget: { damage: 25, ko: 20, support: 25, resilience: 15, win: 15 },
  supportNormFraction: 0.35,
  leadershipPerStreak: 1,
  leadershipCap: 3,
  pressure: { enabled: true, steps: [0, 2, 4, 6], topFraction: 0.2 },
  current: { enabled: true, steps: [0, 2, 4], bottomFraction: 0.25 },
  balanceMinPlayers: 4,
  hpMultiplier: 1,
  maxRounds: 150,
};

export function mergeConfig(raw: unknown): ReiConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ReiConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...r,
    budget: { ...DEFAULT_CONFIG.budget, ...(r.budget ?? {}) },
    pressure: { ...DEFAULT_CONFIG.pressure, ...(r.pressure ?? {}) },
    current: { ...DEFAULT_CONFIG.current, ...(r.current ?? {}) },
  };
}

/** Pontos são guardados em centésimos (inteiros) para a soma nunca divergir. */
export const PT = 100;
export const fmtPts = (centi: number) => (centi / PT).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
