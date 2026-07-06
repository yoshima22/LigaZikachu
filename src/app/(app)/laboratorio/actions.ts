"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { EggType, ZikaCoinTxType } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { getStaticSpriteUrl, getShinySprite, getPokemonName } from "@/lib/mascot-data";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";
import { computeMascotAnalysis } from "@/lib/mascot-analysis";
import type { MascotAnalysis } from "@/lib/mascot-analysis";
import { getMascotRarity, getMascotBaseDust, type MascotRarity } from "./rarity";

// Custo de cada análise de mascote no Laboratório (cada abertura recompra a análise)
const ANALYSIS_COST = 200;

export type { MascotRarity };

// weekKey = "YYYY-Www" using ISO week number
function getWeekKey(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNum = Math.floor((now.getTime() - startOfWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ── Limits & costs ────────────────────────────────────────────────────────────
const WEEKLY_LIMITS = { coinsTraded: 5, commonEggs: 10, rareEggs: 4, specialEggs: 1 } as const;
const SHOP_COSTS = { coins: 10, commonEgg: 15, rareEgg: 25, specialEgg: 40 } as const;
const SHOP_REWARDS = { coins: 400 } as const;

// ── Auth helper ───────────────────────────────────────────────────────────────
async function requirePlayer() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true },
  });
  if (!player) redirect("/dashboard");
  return player;
}

async function getOrCreateWeeklyUsage(playerId: string) {
  const weekKey = getWeekKey();
  return prisma.labWeeklyUsage.upsert({
    where: { playerId_weekKey: { playerId, weekKey } },
    create: { playerId, weekKey },
    update: {},
  });
}

// ── Page data ─────────────────────────────────────────────────────────────────
export async function getLabDataAction() {
  const me = await requirePlayer();

  const [player, mascots, weeklyUsage] = await Promise.all([
    prisma.player.findUnique({
      where: { id: me.id },
      select: { creationDust: true },
    }),
    prisma.mascot.findMany({
      where: { playerId: me.id },
      select: {
        id: true, pokemonId: true, nickname: true, level: true, isShiny: true,
        isFavorite: true, arenaState: true, bazarListed: true,
        analyzedAt: true, ivRating: true, ivScore: true,
      },
      orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
    }),
    getOrCreateWeeklyUsage(me.id),
  ]);

  const wallet = await getOrCreateWallet(me.id);

  // Build pokémonId → count map for duplicate multiplier
  const countMap = new Map<number, number>();
  for (const m of mascots) countMap.set(m.pokemonId, (countMap.get(m.pokemonId) ?? 0) + 1);

  const mascotList = mascots.map((m) => {
    const rarity = getMascotRarity(m.pokemonId);
    const baseDust = getMascotBaseDust(m.pokemonId);
    const copies = countMap.get(m.pokemonId) ?? 1;
    const extras = copies - 1;
    const multiplier = extras >= 2 ? 3.0 : extras === 1 ? 1.5 : 1.0;
    const dust = Math.ceil(baseDust * multiplier);
    const recyclable = !m.isFavorite && !m.bazarListed && (!m.arenaState || m.arenaState === "FREE");

    return {
      id: m.id,
      pokemonId: m.pokemonId,
      name: getPokemonName(m.pokemonId),
      nickname: m.nickname,
      level: m.level,
      isShiny: m.isShiny ?? false,
      spriteUrl: m.isShiny ? getShinySprite(m.pokemonId) : getStaticSpriteUrl(m.pokemonId),
      rarity,
      dust,
      recyclable,
      isFavorite: m.isFavorite ?? false,
      bazarListed: m.bazarListed ?? false,
      analyzed: !!m.analyzedAt,
      ivRating: m.ivRating,
      ivScore: m.ivScore,
    };
  });

  return {
    ok: true as const,
    creationDust: player?.creationDust ?? 0,
    coinBalance: wallet.balance,
    analysisCost: ANALYSIS_COST,
    mascots: mascotList,
    weeklyUsage: {
      coinsTraded: weeklyUsage.coinsTraded,
      commonEggs: weeklyUsage.commonEggs,
      rareEggs: weeklyUsage.rareEggs,
      specialEggs: weeklyUsage.specialEggs,
    },
    limits: WEEKLY_LIMITS,
    costs: SHOP_COSTS,
  };
}

// ── Recycle mascot ────────────────────────────────────────────────────────────
export async function recycleMascotAction(mascotId: string) {
  const me = await requirePlayer();

  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId, playerId: me.id },
    select: { id: true, pokemonId: true, isFavorite: true, arenaState: true, bazarListed: true },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };
  if (mascot.isFavorite) return { ok: false as const, error: "Nao e possivel reciclar mascotes favoritos." };
  if (mascot.bazarListed) return { ok: false as const, error: "Retire o mascote do Bazar antes de reciclar." };
  if (mascot.arenaState && mascot.arenaState !== "FREE") {
    return { ok: false as const, error: "Mascote esta em batalha ou descansando." };
  }

  const allMascots = await prisma.mascot.findMany({
    where: { playerId: me.id },
    select: { pokemonId: true },
  });
  const copies = allMascots.filter((x) => x.pokemonId === mascot.pokemonId).length;
  const extras = copies - 1;
  const baseDust = getMascotBaseDust(mascot.pokemonId);
  const multiplier = extras >= 2 ? 3.0 : extras === 1 ? 1.5 : 1.0;
  const dust = Math.ceil(baseDust * multiplier);

  await prisma.$transaction([
    prisma.mascot.delete({ where: { id: mascotId } }),
    prisma.player.update({
      where: { id: me.id },
      data: { creationDust: { increment: dust } },
    }),
  ]);

  return { ok: true as const, dust };
}

// ── Batch recycle mascot ──────────────────────────────────────────────────────
export async function recycleMascotsAction(mascotIds: string[]) {
  const me = await requirePlayer();
  const uniqueIds = [...new Set(mascotIds.filter(Boolean))].slice(0, 6);

  if (uniqueIds.length === 0) {
    return { ok: false as const, error: "Selecione ao menos um mascote." };
  }

  const mascots = await prisma.mascot.findMany({
    where: { id: { in: uniqueIds }, playerId: me.id },
    select: { id: true, pokemonId: true, isFavorite: true, arenaState: true, bazarListed: true },
  });

  if (mascots.length !== uniqueIds.length) {
    return { ok: false as const, error: "Algum mascote selecionado nao foi encontrado." };
  }

  const blocked = mascots.find((m) =>
    m.isFavorite ||
    m.bazarListed ||
    (m.arenaState && m.arenaState !== "FREE")
  );
  if (blocked?.isFavorite) return { ok: false as const, error: "Nao e possivel reciclar mascotes favoritos." };
  if (blocked?.bazarListed) return { ok: false as const, error: "Retire mascotes do Bazar antes de reciclar." };
  if (blocked) return { ok: false as const, error: "Mascote esta em batalha ou descansando." };

  const selectedCountMap = new Map<number, number>();
  for (const mascot of mascots) {
    selectedCountMap.set(mascot.pokemonId, (selectedCountMap.get(mascot.pokemonId) ?? 0) + 1);
  }

  const breakdown = mascots.map((mascot) => {
    const baseDust = getMascotBaseDust(mascot.pokemonId);
    const copies = selectedCountMap.get(mascot.pokemonId) ?? 1;
    const extras = copies - 1;
    const multiplier = extras >= 2 ? 3.0 : extras === 1 ? 1.5 : 1.0;
    return {
      mascotId: mascot.id,
      pokemonId: mascot.pokemonId,
      dust: Math.ceil(baseDust * multiplier),
    };
  });

  const dust = breakdown.reduce((sum, item) => sum + item.dust, 0);

  await prisma.$transaction([
    prisma.mascot.deleteMany({ where: { id: { in: uniqueIds }, playerId: me.id } }),
    prisma.player.update({
      where: { id: me.id },
      data: { creationDust: { increment: dust } },
    }),
  ]);

  return { ok: true as const, dust, recycledIds: uniqueIds, breakdown };
}

// ── Trade for ZikaCoins ───────────────────────────────────────────────────────
export async function tradeDustForCoinsAction() {
  const me = await requirePlayer();
  const weeklyUsage = await getOrCreateWeeklyUsage(me.id);

  if (weeklyUsage.coinsTraded >= WEEKLY_LIMITS.coinsTraded) {
    return { ok: false as const, error: `Limite semanal atingido (${WEEKLY_LIMITS.coinsTraded}x/semana).` };
  }

  const player = await prisma.player.findUnique({
    where: { id: me.id },
    select: { creationDust: true },
  });
  if (!player) return { ok: false as const, error: "Jogador não encontrado." };
  if (player.creationDust < SHOP_COSTS.coins) {
    return { ok: false as const, error: `Pó insuficiente. Necessário: ${SHOP_COSTS.coins} pó.` };
  }

  const weekKey = getWeekKey();
  await prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: me.id },
      data: { creationDust: { decrement: SHOP_COSTS.coins } },
    });
    await creditCoins(tx, {
      playerId: me.id,
      type: "LAB_TRADE",
      amount: SHOP_REWARDS.coins,
      description: "Laboratório: troca de Pó de Criação por ZikaCoins",
    });
    await tx.labWeeklyUsage.upsert({
      where: { playerId_weekKey: { playerId: me.id, weekKey } },
      create: { playerId: me.id, weekKey, coinsTraded: 1 },
      update: { coinsTraded: { increment: 1 } },
    });
  });

  return { ok: true as const };
}

// ── Trade for Egg ─────────────────────────────────────────────────────────────
export async function tradeDustForEggAction(eggTier: "COMMON" | "RARE" | "SPECIAL") {
  const me = await requirePlayer();
  const weeklyUsage = await getOrCreateWeeklyUsage(me.id);

  const costMap = { COMMON: SHOP_COSTS.commonEgg, RARE: SHOP_COSTS.rareEgg, SPECIAL: SHOP_COSTS.specialEgg };
  const limitFieldMap = {
    COMMON: "commonEggs" as const,
    RARE: "rareEggs" as const,
    SPECIAL: "specialEggs" as const,
  };
  const eggTypeMap: Record<string, EggType> = { COMMON: "COMMON", RARE: "RARE", SPECIAL: "SPECIAL" };
  const labelMap = { COMMON: "Ovo Comum", RARE: "Ovo Raro", SPECIAL: "Ovo Especial" };

  const cost = costMap[eggTier];
  const limitField = limitFieldMap[eggTier];
  const limit = WEEKLY_LIMITS[limitField];

  if (weeklyUsage[limitField] >= limit) {
    return { ok: false as const, error: `Limite semanal atingido para ${labelMap[eggTier]} (${limit}x/semana).` };
  }

  const player = await prisma.player.findUnique({
    where: { id: me.id },
    select: { creationDust: true },
  });
  if (!player) return { ok: false as const, error: "Jogador não encontrado." };
  if (player.creationDust < cost) {
    return { ok: false as const, error: `Pó insuficiente. Necessário: ${cost} pó.` };
  }

  const weekKey = getWeekKey();
  await prisma.$transaction([
    prisma.player.update({
      where: { id: me.id },
      data: { creationDust: { decrement: cost } },
    }),
    prisma.mascotEgg.create({
      data: { playerId: me.id, type: eggTypeMap[eggTier], origin: "LAB" },
    }),
    prisma.labWeeklyUsage.upsert({
      where: { playerId_weekKey: { playerId: me.id, weekKey } },
      create: { playerId: me.id, weekKey, [limitField]: 1 },
      update: { [limitField]: { increment: 1 } },
    }),
  ]);

  return { ok: true as const };
}

// ── Análise de mascote (IV / potencial) ─────────────────────────────────────────
export async function analyzeMascotAction(
  mascotId: string,
  targetLevel?: number,
): Promise<{ ok: false; error: string } | { ok: true; analysis: MascotAnalysis; coinBalance: number }> {
  const me = await requirePlayer();

  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId, playerId: me.id },
    select: {
      id: true, pokemonId: true, level: true, personality: true, evolutionLocked: true,
      statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
    },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };

  const wallet = await getOrCreateWallet(me.id);
  if (wallet.balance < ANALYSIS_COST) {
    return { ok: false as const, error: `Saldo insuficiente. A análise custa ${ANALYSIS_COST} ZC.` };
  }

  const clampedTarget = targetLevel ? Math.max(mascot.level, Math.min(100, Math.round(targetLevel))) : undefined;
  const analysis = computeMascotAnalysis(mascot, clampedTarget);

  await prisma.$transaction(async (tx) => {
    await creditCoins(tx, {
      playerId: me.id,
      type: ZikaCoinTxType.LAB_TRADE,
      amount: -ANALYSIS_COST,
      description: `Laboratório: análise de ${getPokemonName(mascot.pokemonId)}`,
    });
    await tx.mascot.update({
      where: { id: mascot.id },
      data: {
        analyzedAt: new Date(),
        ivScore: analysis.ivScore,
        ivRating: analysis.ivRating,
        analysisJson: analysis as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });
  });

  // Atualiza o saldo mostrado no nav e o cache da página de mascotes
  // (os favoritos são cacheados por player-mascots-<id>; sem isso, a tag de
  // IV só apareceria neles após o TTL de 60s do cache).
  const user = await getSessionUser();
  if (user) revalidateTag(`nav-${user.id}`);
  revalidateTag(`player-mascots-${me.id}`);
  const fresh = await getOrCreateWallet(me.id);
  return { ok: true as const, analysis, coinBalance: fresh.balance };
}

// ── Revisitar análise já feita (grátis) ─────────────────────────────────────────
export async function getStoredAnalysisAction(
  mascotId: string,
): Promise<{ ok: false; error: string } | { ok: true; analysis: MascotAnalysis }> {
  const me = await requirePlayer();
  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId, playerId: me.id },
    select: { analysisJson: true, analyzedAt: true },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };
  if (!mascot.analyzedAt || !mascot.analysisJson) {
    return { ok: false as const, error: "Este mascote ainda não foi analisado." };
  }
  return { ok: true as const, analysis: mascot.analysisJson as unknown as MascotAnalysis };
}
