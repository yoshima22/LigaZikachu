import { EggType, type Prisma } from "@prisma/client";

export type TournamentBoxPayload = {
  rewardKind: "TOURNAMENT_BOX";
  rewardLabel: string;
  origin: string;
  coins?: number;
  food?: number;
  sweet?: number;
  creationDust?: number;
  eggs?: Array<{ type: EggType; quantity: number }>;
  shopItems?: Array<{ type: string; quantity: number }>;
};

export type TournamentRewardConfig = {
  deferUntilDayClose: boolean;
  daily: { coins: number; food: number; sweet: number; creationDust: number; eventEggs: number; lootTickets: number };
  win: { coins: number; sweet: number; honeyCandy: number; eventEggChance: number };
  loss: { coins: number; food: number; sweet: number; creationDust: number };
  top: { coins: number; lootTickets: number; sweet: number; eventEggs: number; labEggChance: number };
  raffle: { coins: number; sweet: number; specialEggChance: number };
  enguica: { coins: number; food: number; sweet: number; creationDust: number; rareEggChance: number };
  badge: { coins: number; weaknessPolicy: number; creationDust: number; specialEggChance: number };
  guardian: { coins: number; shockingVitamin: number; creationDust: number; specialEggChance: number };
};

export const JOHTO_REWARD_CONFIG: TournamentRewardConfig = {
  deferUntilDayClose: true,
  daily: { coins: 300, food: 5, sweet: 3, creationDust: 0, eventEggs: 1, lootTickets: 1 },
  win: { coins: 180, sweet: 1, honeyCandy: 1, eventEggChance: 0.35 },
  loss: { coins: 120, food: 1, sweet: 1, creationDust: 2 },
  top: { coins: 1_000, lootTickets: 2, sweet: 2, eventEggs: 2, labEggChance: 0.10 },
  raffle: { coins: 550, sweet: 1, specialEggChance: 0.15 },
  enguica: { coins: 450, food: 1, sweet: 1, creationDust: 3, rareEggChance: 0.50 },
  badge: { coins: 450, weaknessPolicy: 1, creationDust: 10, specialEggChance: 0.25 },
  guardian: { coins: 400, shockingVitamin: 1, creationDust: 10, specialEggChance: 0.50 },
};

export function parseTournamentRewardConfig(value: Prisma.JsonValue | null | undefined): TournamentRewardConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<TournamentRewardConfig>;
  if (raw.deferUntilDayClose !== true) return null;
  return {
    ...JOHTO_REWARD_CONFIG,
    ...raw,
    daily: { ...JOHTO_REWARD_CONFIG.daily, ...(raw.daily ?? {}) },
    win: { ...JOHTO_REWARD_CONFIG.win, ...(raw.win ?? {}) },
    loss: { ...JOHTO_REWARD_CONFIG.loss, ...(raw.loss ?? {}) },
    top: { ...JOHTO_REWARD_CONFIG.top, ...(raw.top ?? {}) },
    raffle: { ...JOHTO_REWARD_CONFIG.raffle, ...(raw.raffle ?? {}) },
    enguica: { ...JOHTO_REWARD_CONFIG.enguica, ...(raw.enguica ?? {}) },
    badge: { ...JOHTO_REWARD_CONFIG.badge, ...(raw.badge ?? {}) },
    guardian: { ...JOHTO_REWARD_CONFIG.guardian, ...(raw.guardian ?? {}) },
  };
}

export function brtDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function tournamentDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00-03:00`);
  const end = new Date(`${dateKey}T23:59:59.999-03:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Data de campeonato invalida.");
  return { start, end };
}

export function payloadLabel(payload: TournamentBoxPayload) {
  const parts: string[] = [];
  if (payload.coins) parts.push(`${payload.coins} ZC`);
  if (payload.food) parts.push(`${payload.food} Comida${payload.food > 1 ? "s" : ""}`);
  if (payload.sweet) parts.push(`${payload.sweet} Doce${payload.sweet > 1 ? "s" : ""}`);
  if (payload.creationDust) parts.push(`${payload.creationDust} Pos de Criacao`);
  for (const egg of payload.eggs ?? []) parts.push(`${egg.quantity} Ovo ${egg.type}`);
  for (const item of payload.shopItems ?? []) parts.push(`${item.quantity}x ${item.type}`);
  return parts.join(" · ");
}

export function finalizePayload(payload: Omit<TournamentBoxPayload, "rewardLabel">): TournamentBoxPayload {
  const complete = { ...payload, rewardLabel: "" } as TournamentBoxPayload;
  complete.rewardLabel = payloadLabel(complete);
  return complete;
}
