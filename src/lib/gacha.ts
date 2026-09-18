// Invocações (banners de gacha): moedas próprias, sorteio com rate-up/pity e
// progresso das missões semanais. O sorteio é puro (recebe `random`) para poder
// ser conferido por script — veja scripts/check-gacha-roll.ts.

import type { Prisma, GachaCurrency, GachaObjectiveSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

const ICON_BASE = "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/Icons";

export const POKEBALL_ICON = `${ICON_BASE}/Icone_Pokebola.webp`;
export const ULTRABALL_ICON = `${ICON_BASE}/Icone_Ultrabola.webp`;
export const CELESTIAL_EGG_ICON = `${ICON_BASE}/IconeOrigem_Celestial.webp`;
export const LAB_EGG_ICON = `${ICON_BASE}/IconeOrigem_Lab.png`;

export const CURRENCY_LABEL: Record<GachaCurrency, string> = {
  POKEBALL: "Pokébola",
  ULTRABALL: "Ultra Bola",
};

export const CURRENCY_ICON: Record<GachaCurrency, string> = {
  POKEBALL: POKEBALL_ICON,
  ULTRABALL: ULTRABALL_ICON,
};

// Só as duas raridades mais altas têm arte própria na tela do banner; as outras
// são citadas por texto (os ícones de ovo comum/raro são simples e repetidos).
export const RARITY_ART: Record<string, string> = {
  LAB: LAB_EGG_ICON,
  CELESTIAL: CELESTIAL_EGG_ICON,
};

export const RARITY_ORDER = ["COMMON", "RARE", "EVENT", "SPECIAL", "LAB", "CELESTIAL"] as const;
export type GachaRarity = (typeof RARITY_ORDER)[number];

export const RARITY_LABEL: Record<string, string> = {
  COMMON: "Comum",
  RARE: "Raro",
  EVENT: "Evento",
  SPECIAL: "Especial",
  LAB: "De Laboratório",
  CELESTIAL: "Celestial",
};

export const RARITY_COLOR: Record<string, string> = {
  COMMON: "#cbd5e1",
  RARE: "#60a5fa",
  EVENT: "#f87171",
  SPECIAL: "#fbbf24",
  LAB: "#c084fc",
  CELESTIAL: "#5eead4",
};

export function rarityRank(rarity: string) {
  const index = RARITY_ORDER.indexOf(rarity as GachaRarity);
  return index < 0 ? 0 : index;
}

/* ─────────────────────────────── sorteio ─────────────────────────────── */

export type RollEntry = { id: string; rarity: string; weight: number; rateUp: boolean };

export type PityRule = { id: string; everyPulls: number; rarity: string; counter: number };

export type RollOptions = {
  rateUpMultiplier: number;
  /** Raridade mínima garantida em ao menos um resultado da tirada (x10). */
  guaranteedRarity?: string | null;
  pity: PityRule[];
  random?: () => number;
};

export type RollResult = {
  results: Array<{ entryId: string; rarity: string; guaranteedBy: "PITY" | "MULTI" | null }>;
  pity: PityRule[];
};

function pick(entries: RollEntry[], multiplier: number, random: () => number, minRarity?: string | null) {
  const pool = minRarity
    ? entries.filter((entry) => rarityRank(entry.rarity) >= rarityRank(minRarity))
    : entries;
  // Sem nada na raridade exigida, cai para a pool inteira: garantia é um piso,
  // não um motivo para o banner travar.
  const usable = pool.length > 0 ? pool : entries;
  const weights = usable.map((entry) => Math.max(0, entry.weight) * (entry.rateUp ? multiplier : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return usable[0];
  let ticket = random() * total;
  for (let index = 0; index < usable.length; index += 1) {
    ticket -= weights[index];
    if (ticket <= 0) return usable[index];
  }
  return usable[usable.length - 1];
}

export function rollPulls(entries: RollEntry[], count: number, options: RollOptions): RollResult {
  if (entries.length === 0) throw new Error("Este banner ainda não tem conteúdo configurado.");
  const random = options.random ?? Math.random;
  const pity = options.pity.map((rule) => ({ ...rule }));
  const results: RollResult["results"] = [];

  for (let index = 0; index < count; index += 1) {
    for (const rule of pity) rule.counter += 1;

    // Barra estourada: a mais rara entre as que bateram vira o piso da tirada.
    const triggered = pity.filter((rule) => rule.counter >= rule.everyPulls);
    const pityFloor = triggered.reduce<string | null>(
      (best, rule) => (best === null || rarityRank(rule.rarity) > rarityRank(best) ? rule.rarity : best),
      null,
    );

    const isLast = index === count - 1;
    const missingGuarantee =
      !!options.guaranteedRarity &&
      count > 1 &&
      !results.some((result) => rarityRank(result.rarity) >= rarityRank(options.guaranteedRarity!));
    const multiFloor = isLast && missingGuarantee ? options.guaranteedRarity! : null;

    const floor =
      pityFloor && multiFloor
        ? rarityRank(pityFloor) >= rarityRank(multiFloor) ? pityFloor : multiFloor
        : pityFloor ?? multiFloor;

    const entry = pick(entries, options.rateUpMultiplier, random, floor);
    results.push({
      entryId: entry.id,
      rarity: entry.rarity,
      guaranteedBy: pityFloor ? "PITY" : multiFloor ? "MULTI" : null,
    });

    // Zera toda barra cuja raridade foi alcançada (naturalmente ou pela garantia).
    for (const rule of pity) {
      if (rarityRank(entry.rarity) >= rarityRank(rule.rarity)) rule.counter = 0;
    }
  }

  return { results, pity };
}

/* ───────────────────────────── carteira ───────────────────────────── */

export async function changeGachaCurrency(
  tx: Tx,
  input: {
    playerId: string;
    currency: GachaCurrency;
    amount: number;
    reason: string;
    actorUserId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new Error("Movimentação inválida.");
  const wallet = await tx.gachaWallet.upsert({
    where: { playerId: input.playerId },
    create: { playerId: input.playerId },
    update: {},
  });
  const field = input.currency === "POKEBALL" ? "pokeballs" : "ultraballs";
  const balanceAfter = wallet[field] + input.amount;
  if (balanceAfter < 0) {
    throw new Error(`Você não tem ${CURRENCY_LABEL[input.currency]}s suficientes.`);
  }
  await tx.gachaWallet.update({
    where: { playerId: input.playerId },
    data: { [field]: { increment: input.amount } },
  });
  await tx.gachaLedger.create({
    data: {
      playerId: input.playerId,
      currency: input.currency,
      amount: input.amount,
      balanceAfter,
      reason: input.reason,
      actorUserId: input.actorUserId ?? undefined,
      metadata: input.metadata,
    },
  });
  return balanceAfter;
}

/* ──────────────────── missões semanais (reset na segunda) ──────────────────── */

/** Chave da semana corrente em BRT (UTC-3), começando na segunda-feira. */
export function currentWeekKey(reference = new Date()) {
  const brt = new Date(reference.getTime() - 3 * 60 * 60 * 1000);
  const weekday = (brt.getUTCDay() + 6) % 7; // 0 = segunda
  const monday = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() - weekday));
  return monday.toISOString().slice(0, 10);
}

/**
 * Avança o progresso das missões semanais ativas de um objetivo. Chamado pelos
 * modos de jogo quando o jogador cumpre algo (vitória, venda, ovo chocado...).
 * Nunca lança: uma missão quebrada não pode derrubar a ação principal do jogo.
 */
export async function trackGachaObjective(
  playerId: string,
  source: GachaObjectiveSource,
  amount = 1,
  options?: { rarity?: string | null },
) {
  if (amount <= 0) return;
  try {
    const missions = await prisma.gachaMission.findMany({
      where: { active: true, source },
      select: { id: true, goal: true, rarityFilter: true },
    });
    if (missions.length === 0) return;
    const weekKey = currentWeekKey();
    for (const mission of missions) {
      // Missão com filtro de raridade só conta o que atinge aquele piso.
      if (mission.rarityFilter && rarityRank(options?.rarity ?? "") < rarityRank(mission.rarityFilter)) continue;
      await prisma.gachaMissionProgress.upsert({
        where: { missionId_playerId_weekKey: { missionId: mission.id, playerId, weekKey } },
        create: { missionId: mission.id, playerId, weekKey, progress: Math.min(amount, mission.goal) },
        update: { progress: { increment: amount } },
      });
    }
  } catch (error) {
    console.error("[gacha] falha ao registrar objetivo", source, error);
  }
}
