import type { Prisma } from "@prisma/client";

export type TournamentPostseasonConfig = {
  title: {
    enabled: boolean;
    initialLives: Record<string, number>;
  };
  cup: {
    enabled: boolean;
    seeds: number[];
  };
  finalRewards: {
    zcByPlacement: Record<string, number>;
    participationEggs: { rare: number };
    champion: { lab: number; special: number; event: number };
    runnerUp: { lab: number; special: number; event: number };
    third: { lab: number; special: number; event: number };
    fourth: { lab: number; event: number; rare: number };
  };
};

export const JOHTO_POSTSEASON_CONFIG: TournamentPostseasonConfig = {
  title: { enabled: true, initialLives: { "1": 3, "2": 2, "3": 1, "4": 1 } },
  cup: { enabled: true, seeds: [5, 6, 7, 8, 9, 10, 11] },
  finalRewards: {
    zcByPlacement: { "1": 25_000, "2": 16_000, "3": 10_000, "4": 7_000, "5": 2_500, "6": 2_500, "7": 2_500, "8": 2_500 },
    participationEggs: { rare: 2 },
    champion: { lab: 5, special: 3, event: 2 },
    runnerUp: { lab: 4, special: 2, event: 1 },
    third: { lab: 3, special: 1, event: 1 },
    fourth: { lab: 2, event: 1, rare: 5 },
  },
};

export function parsePostseasonConfig(value: Prisma.JsonValue | null | undefined): TournamentPostseasonConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return JOHTO_POSTSEASON_CONFIG;
  const raw = value as Partial<TournamentPostseasonConfig>;
  return {
    title: { ...JOHTO_POSTSEASON_CONFIG.title, ...(raw.title ?? {}) },
    cup: { ...JOHTO_POSTSEASON_CONFIG.cup, ...(raw.cup ?? {}) },
    finalRewards: {
      ...JOHTO_POSTSEASON_CONFIG.finalRewards,
      ...(raw.finalRewards ?? {}),
      zcByPlacement: { ...JOHTO_POSTSEASON_CONFIG.finalRewards.zcByPlacement, ...(raw.finalRewards?.zcByPlacement ?? {}) },
    },
  };
}

export const POSTSEASON_STAGE_LABELS = {
  TITLE_SURVIVAL: "Chave de Sobrevivência Z",
  CUP_JOHTO: "Copa Johto de Recompensas",
} as const;
