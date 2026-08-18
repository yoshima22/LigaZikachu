"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { EggType, FoodType, ShopItemType, ZikaCoinTxType } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { getStaticSpriteUrl, getShinySprite, getPokemonName } from "@/lib/mascot-data";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";
import { computeMascotAnalysis, MASCOT_ANALYSIS_VERSION } from "@/lib/mascot-analysis";
import type { MascotAnalysis } from "@/lib/mascot-analysis";
import { getMascotRarity } from "./rarity";
import { calculateLabDust } from "./dust";
import { getActiveRaidSabotages, getOrderStepUnlockState } from "@/lib/raid-event";
import { MEGA_STONES } from "@/lib/mega-evolution";
import { recordPlayerActivity } from "@/lib/player-activity";

// A primeira análise desbloqueia simulações gratuitas permanentes para o mascote.
const ANALYSIS_COST = 100;

// weekKey = "YYYY-Www" using ISO week number
function getWeekKey(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNum = Math.floor((now.getTime() - startOfWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getMonthKey(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).slice(0, 7);
}

function getWeeklyEvolutionStone() {
  const key = getWeekKey();
  const hash = [...key].reduce((total, char) => total + char.charCodeAt(0), 0);
  return MEGA_STONES[hash % MEGA_STONES.length];
}

// ── Limits & costs ────────────────────────────────────────────────────────────
const WEEKLY_LIMITS = { coinsTraded: 5, commonEggs: 10, rareEggs: 4, specialEggs: 1 } as const;
const SHOP_COSTS = { coins: 10, commonEgg: 15, rareEgg: 25, specialEgg: 40 } as const;
const MONTHLY_SHOP_COSTS = { labEgg: 250, evolutionStone: 300 } as const;
const SHOP_REWARDS = { coins: 400 } as const;
const FOOD_TRADE_COSTS = { SWEET: 10, HONEY_CANDY: 150, FRESH_WATER: 100 } as const;
const FOOD_TRADE_LIMITS = { honeyCandies: 3, freshWaters: 3 } as const;

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

async function getLabLockReason() {
  const [sabotages, stepState] = await Promise.all([
    getActiveRaidSabotages("LABORATORY"),
    getOrderStepUnlockState("LAB_SMOKE_TO_MACHINE"),
  ]);
  const activeSabotage = sabotages.find(
    (s) => s.sabotageType === "DISABLE_LAB_ANALYSIS" || s.sabotageType === "DISABLE_DUST_CONVERSION",
  );
  if (activeSabotage || (stepState.active && stepState.unlocked && !stepState.resolved)) {
    return "Laboratorio travado pela Ordem da Trapaca. Resolva a etapa da fumaca para usar esta acao.";
  }
  return null;
}

async function getOrCreateWeeklyUsage(playerId: string) {
  const weekKey = getWeekKey();
  return prisma.labWeeklyUsage.upsert({
    where: { playerId_weekKey: { playerId, weekKey } },
    create: { playerId, weekKey },
    update: {},
  });
}

async function getOrCreateMonthlyUsage(playerId: string) {
  const monthKey = getMonthKey();
  return prisma.labMonthlyUsage.upsert({
    where: { playerId_monthKey: { playerId, monthKey } },
    create: { playerId, monthKey },
    update: {},
  });
}

async function getWeeklyLeagueLockedMascotIds(playerId: string) {
  const teams = await prisma.weeklyMascotLeagueDailyTeam.findMany({
    where: {
      playerId,
      league: { status: { in: ["REGISTRATION", "ACTIVE"] } },
    },
    select: { mascotIdsJson: true },
  });
  return new Set(teams.flatMap((team) => (team.mascotIdsJson as string[] | null) ?? []));
}

// ── Page data ─────────────────────────────────────────────────────────────────
export async function getLabDataAction() {
  const me = await requirePlayer();

  const [player, mascots, weeklyUsage, monthlyUsage, foodItems] = await Promise.all([
    prisma.player.findUnique({
      where: { id: me.id },
      select: { creationDust: true },
    }),
    prisma.mascot.findMany({
      where: { playerId: me.id },
      select: {
        id: true, pokemonId: true, nickname: true, level: true, isShiny: true,
        isFavorite: true, arenaState: true, bazarListed: true,
        operationsLocked: true, primordialBoundPlayerId: true,
        analyzedAt: true, ivRating: true, ivScore: true, analysisJson: true, performanceTag: true,
      },
      orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
    }),
    getOrCreateWeeklyUsage(me.id),
    getOrCreateMonthlyUsage(me.id),
    prisma.mascotFoodItem.findMany({
      where: { playerId: me.id, type: { in: [FoodType.FOOD, FoodType.SWEET] } },
      select: { type: true, quantity: true },
    }),
  ]);

  const [wallet, weeklyLeagueLockedIds] = await Promise.all([
    getOrCreateWallet(me.id),
    getWeeklyLeagueLockedMascotIds(me.id),
  ]);

  const mascotList = mascots.map((m) => {
    const rarity = getMascotRarity(m.pokemonId);
    // A lista começa pelo valor individual. O cliente projeta o bônus conforme
    // cópias da mesma espécie entram nos slots de reciclagem.
    const dust = calculateLabDust(rarity, 1);
    const inWeeklyLeague = weeklyLeagueLockedIds.has(m.id);
    const recyclable = !m.operationsLocked && !m.primordialBoundPlayerId && !m.isFavorite && !m.bazarListed && !inWeeklyLeague && (!m.arenaState || m.arenaState === "FREE");

    const savedAnalysis = m.analysisJson as { analysisVersion?: number } | null;
    const currentAnalysis = savedAnalysis?.analysisVersion === MASCOT_ANALYSIS_VERSION;
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
      inWeeklyLeague,
      isFavorite: m.isFavorite ?? false,
      bazarListed: m.bazarListed ?? false,
      operationsLocked: m.operationsLocked ?? false,
      analyzed: !!m.analyzedAt,
      ivRating: currentAnalysis ? m.ivRating : null,
      ivScore: currentAnalysis ? m.ivScore : null,
      performanceTag: m.performanceTag,
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
      honeyCandies: weeklyUsage.honeyCandies,
      freshWaters: weeklyUsage.freshWaters,
    },
    monthlyUsage: {
      labEggs: monthlyUsage.labEggs,
      evolutionStones: monthlyUsage.evolutionStones,
    },
    weeklyEvolutionStone: {
      type: getWeeklyEvolutionStone().type,
      name: getWeeklyEvolutionStone().stoneName,
    },
    limits: WEEKLY_LIMITS,
    costs: SHOP_COSTS,
    monthlyCosts: MONTHLY_SHOP_COSTS,
    foodTrades: {
      food: foodItems.find((item) => item.type === FoodType.FOOD)?.quantity ?? 0,
      sweets: foodItems.find((item) => item.type === FoodType.SWEET)?.quantity ?? 0,
      costs: FOOD_TRADE_COSTS,
      limits: FOOD_TRADE_LIMITS,
    },
  };
}

// ── Trocas de comida ────────────────────────────────────────────────────────
export async function tradeFoodInLabAction(kind: "SWEET" | "HONEY_CANDY" | "FRESH_WATER", quantity = 1) {
  const me = await requirePlayer();
  const lockReason = await getLabLockReason();
  if (lockReason) return { ok: false as const, error: lockReason };

  const qty = Math.max(1, Math.min(999, Math.trunc(Number(quantity) || 1)));
  const unitCost = FOOD_TRADE_COSTS[kind];
  const totalCost = unitCost * qty;
  const weekKey = getWeekKey();
  const usageField = kind === "HONEY_CANDY"
    ? "honeyCandies" as const
    : kind === "FRESH_WATER"
      ? "freshWaters" as const
      : null;
  const itemType = kind === "HONEY_CANDY"
    ? ShopItemType.MASCOT_BUFF_HAPPY
    : ShopItemType.MASCOT_BUFF_MOOD;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const usage = await tx.labWeeklyUsage.upsert({
        where: { playerId_weekKey: { playerId: me.id, weekKey } },
        create: { playerId: me.id, weekKey },
        update: {},
      });

      if (usageField) {
        const remaining = FOOD_TRADE_LIMITS[usageField] - usage[usageField];
        if (remaining <= 0) throw new Error(`Limite semanal atingido (${FOOD_TRADE_LIMITS[usageField]}x/semana).`);
        if (qty > remaining) throw new Error(`Você só pode fazer mais ${remaining} desta troca nesta semana.`);
      }

      const consumed = await tx.mascotFoodItem.updateMany({
        where: { playerId: me.id, type: FoodType.FOOD, quantity: { gte: totalCost } },
        data: { quantity: { decrement: totalCost } },
      });
      if (consumed.count !== 1) throw new Error(`Comida insuficiente. Necessário: ${totalCost} comidas.`);

      if (kind === "SWEET") {
        await tx.mascotFoodItem.upsert({
          where: { playerId_type: { playerId: me.id, type: FoodType.SWEET } },
          create: { playerId: me.id, type: FoodType.SWEET, quantity: qty },
          update: { quantity: { increment: qty } },
        });
      } else {
        const shopItem = await tx.shopItem.findFirst({
          where: { type: itemType },
          orderBy: [{ active: "desc" }, { createdAt: "asc" }],
          select: { id: true, name: true },
        });
        if (!shopItem) throw new Error("O item desta troca ainda não está cadastrado na ZikaShop.");
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: me.id, itemId: shopItem.id } },
          create: { playerId: me.id, itemId: shopItem.id, quantity: qty, source: "LAB_FOOD_TRADE" },
          update: { quantity: { increment: qty } },
        });
      }

      if (usageField) {
        await tx.labWeeklyUsage.update({
          where: { id: usage.id },
          data: { [usageField]: { increment: qty } },
        });
      }

      const rewardName = kind === "SWEET" ? "Doce" : kind === "HONEY_CANDY" ? "Bala de Mel" : "Água Fresca";
      const rewardLabel = `${qty} ${rewardName}${qty > 1 ? "s" : ""}`;
      await recordPlayerActivity(tx, {
        playerId: me.id,
        category: "ITEM",
        action: "LAB_FOOD_TRADE",
        summary: `Laboratório: ${totalCost} comidas trocadas por ${rewardLabel}`,
        source: "LABORATORY",
        entityType: "labFoodTrade",
        entityId: kind,
        amount: totalCost,
        unit: "FOOD",
        after: { kind, foodSpent: totalCost, rewardLabel, rewardQuantity: qty },
      });

      return {
        foodSpent: totalCost,
        rewardLabel,
      };
    }, { isolationLevel: "Serializable" });

    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível concluir a troca." };
  }
}

// ── Recycle mascot ────────────────────────────────────────────────────────────
export async function recycleMascotAction(mascotId: string) {
  const me = await requirePlayer();
  const lockReason = await getLabLockReason();
  if (lockReason) return { ok: false as const, error: lockReason };

  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId, playerId: me.id },
    select: { id: true, pokemonId: true, isFavorite: true, arenaState: true, bazarListed: true, operationsLocked: true, primordialBoundPlayerId: true },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };
  if (mascot.primordialBoundPlayerId) return { ok: false as const, error: "Este mascote está vinculado permanentemente à conta pela Pena Arco-Íris Primordial e não pode ser reciclado." };
  if (mascot.operationsLocked) return { ok: false as const, error: "Este mascote está protegido. Desbloqueie-o na página de Mascotes." };
  if (mascot.isFavorite) return { ok: false as const, error: "Nao e possivel reciclar mascotes favoritos." };
  if (mascot.bazarListed) return { ok: false as const, error: "Retire o mascote do Bazar antes de reciclar." };
  if (mascot.arenaState && mascot.arenaState !== "FREE") {
    return { ok: false as const, error: "Mascote esta em batalha ou descansando." };
  }
  const weeklyLeagueLockedIds = await getWeeklyLeagueLockedMascotIds(me.id);
  if (weeklyLeagueLockedIds.has(mascot.id)) {
    return { ok: false as const, error: "Mascote esta escalado na Liga Semanal. Remova ou altere o time antes de reciclar." };
  }

  const dust = calculateLabDust(getMascotRarity(mascot.pokemonId), 1);

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
  const lockReason = await getLabLockReason();
  if (lockReason) return { ok: false as const, error: lockReason };
  const uniqueIds = [...new Set(mascotIds.filter(Boolean))].slice(0, 6);

  if (uniqueIds.length === 0) {
    return { ok: false as const, error: "Selecione ao menos um mascote." };
  }

  const mascots = await prisma.mascot.findMany({
    where: { id: { in: uniqueIds }, playerId: me.id },
    select: { id: true, pokemonId: true, isFavorite: true, arenaState: true, bazarListed: true, operationsLocked: true, primordialBoundPlayerId: true },
  });

  if (mascots.length !== uniqueIds.length) {
    return { ok: false as const, error: "Algum mascote selecionado nao foi encontrado." };
  }
  if (mascots.some((mascot) => mascot.primordialBoundPlayerId)) {
    return { ok: false as const, error: "Um dos mascotes está vinculado permanentemente à conta pela Pena Arco-Íris Primordial e não pode ser reciclado." };
  }
  if (mascots.some((mascot) => mascot.operationsLocked)) {
    return { ok: false as const, error: "Um dos mascotes está protegido. Desbloqueie-o na página de Mascotes." };
  }

  const blocked = mascots.find((m) =>
    m.isFavorite ||
    m.bazarListed ||
    (m.arenaState && m.arenaState !== "FREE")
  );
  if (blocked?.isFavorite) return { ok: false as const, error: "Nao e possivel reciclar mascotes favoritos." };
  if (blocked?.bazarListed) return { ok: false as const, error: "Retire mascotes do Bazar antes de reciclar." };
  if (blocked) return { ok: false as const, error: "Mascote esta em batalha ou descansando." };

  const weeklyLeagueLockedIds = await getWeeklyLeagueLockedMascotIds(me.id);
  if (mascots.some((mascot) => weeklyLeagueLockedIds.has(mascot.id))) {
    return { ok: false as const, error: "Um dos mascotes esta escalado na Liga Semanal. Remova ou altere o time antes de reciclar." };
  }

  const selectedCountMap = new Map<number, number>();
  for (const mascot of mascots) {
    selectedCountMap.set(mascot.pokemonId, (selectedCountMap.get(mascot.pokemonId) ?? 0) + 1);
  }

  const breakdown = mascots.map((mascot) => {
    const copies = selectedCountMap.get(mascot.pokemonId) ?? 1;
    return {
      mascotId: mascot.id,
      pokemonId: mascot.pokemonId,
      dust: calculateLabDust(getMascotRarity(mascot.pokemonId), copies),
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
  const lockReason = await getLabLockReason();
  if (lockReason) return { ok: false as const, error: lockReason };
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
  const lockReason = await getLabLockReason();
  if (lockReason) return { ok: false as const, error: lockReason };
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

export async function tradeDustForMonthlyItemAction(kind: "LAB_EGG" | "EVOLUTION_STONE") {
  const me = await requirePlayer();
  const lockReason = await getLabLockReason();
  if (lockReason) return { ok: false as const, error: lockReason };
  const monthKey = getMonthKey();
  const field = kind === "LAB_EGG" ? "labEggs" as const : "evolutionStones" as const;
  const cost = kind === "LAB_EGG" ? MONTHLY_SHOP_COSTS.labEgg : MONTHLY_SHOP_COSTS.evolutionStone;
  const stone = getWeeklyEvolutionStone();

  try {
    const rewardLabel = await prisma.$transaction(async (tx) => {
      const usage = await tx.labMonthlyUsage.upsert({
        where: { playerId_monthKey: { playerId: me.id, monthKey } },
        create: { playerId: me.id, monthKey },
        update: {},
      });
      if (usage[field] >= 1) throw new Error("Limite mensal atingido. Uma nova compra será liberada no dia 01.");
      const player = await tx.player.findUniqueOrThrow({
        where: { id: me.id },
        select: { creationDust: true },
      });
      if (player.creationDust < cost) throw new Error(`Pó insuficiente. Necessário: ${cost} pó.`);
      await tx.player.update({
        where: { id: me.id },
        data: { creationDust: { decrement: cost } },
      });
      if (kind === "LAB_EGG") {
        await tx.mascotEgg.create({ data: { playerId: me.id, type: EggType.LAB, origin: "LAB" } });
      } else {
        const shopItem = await tx.shopItem.findFirst({ where: { type: stone.type }, select: { id: true } });
        if (!shopItem) throw new Error("A pedra desta semana não está cadastrada na ZikaShop.");
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: me.id, itemId: shopItem.id } },
          update: { quantity: { increment: 1 } },
          create: { playerId: me.id, itemId: shopItem.id, quantity: 1, source: "LAB_MONTHLY" },
        });
      }
      await tx.labMonthlyUsage.update({
        where: { id: usage.id },
        data: { [field]: { increment: 1 } },
      });
      return kind === "LAB_EGG" ? "Ovo de Laboratório" : stone.stoneName;
    }, { isolationLevel: "Serializable" });
    return { ok: true as const, rewardLabel };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Não foi possível concluir a troca." };
  }
}

// ── Análise de mascote (IV / potencial) ─────────────────────────────────────────
export async function analyzeMascotAction(
  mascotId: string,
  targetLevel?: number,
): Promise<{ ok: false; error: string } | { ok: true; analysis: MascotAnalysis; coinBalance: number }> {
  const me = await requirePlayer();
  const lockReason = await getLabLockReason();
  if (lockReason) return { ok: false as const, error: lockReason };

  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId, playerId: me.id },
    select: {
      id: true, pokemonId: true, level: true, personality: true, evolutionLocked: true,
      statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
      analyzedAt: true, ivScore: true, ivRating: true, analysisJson: true,
    },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };
  const wallet = await getOrCreateWallet(me.id);
  const firstAnalysis = !mascot.analyzedAt;
  if (firstAnalysis && wallet.balance < ANALYSIS_COST) {
    return { ok: false as const, error: `Saldo insuficiente. A análise custa ${ANALYSIS_COST} ZC.` };
  }

  const clampedTarget = targetLevel ? Math.max(mascot.level, Math.min(100, Math.round(targetLevel))) : undefined;
  const computedAnalysis = computeMascotAnalysis(mascot, clampedTarget);
  const previousAnalysis = mascot.analysisJson as unknown as Partial<MascotAnalysis> | null;
  // O ranking representa o potencial intrínseco desbloqueado na primeira análise.
  // Simulações posteriores atualizam projeções, mas nunca reclassificam o mascote.
  const hasStableAnalysis = previousAnalysis?.analysisVersion === MASCOT_ANALYSIS_VERSION;
  const analysis: MascotAnalysis = !firstAnalysis && hasStableAnalysis && mascot.ivScore != null && mascot.ivRating
    ? {
        ...computedAnalysis,
        ivScore: mascot.ivScore,
        ivRating: mascot.ivRating as MascotAnalysis["ivRating"],
        verdict: previousAnalysis?.verdict ?? computedAnalysis.verdict,
        rollQualityPct: previousAnalysis?.rollQualityPct ?? computedAnalysis.rollQualityPct,
        speciesPotentialPct: previousAnalysis?.speciesPotentialPct ?? computedAnalysis.speciesPotentialPct,
        evoPotentialPct: previousAnalysis?.evoPotentialPct ?? computedAnalysis.evoPotentialPct,
      }
    : computedAnalysis;

  await prisma.$transaction(async (tx) => {
    if (firstAnalysis) {
      await creditCoins(tx, {
        playerId: me.id,
        type: ZikaCoinTxType.LAB_TRADE,
        amount: -ANALYSIS_COST,
        description: `Laboratório: desbloqueio da análise de ${getPokemonName(mascot.pokemonId)}`,
      });
    }
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
  const lockReason = await getLabLockReason();
  if (lockReason) return { ok: false as const, error: lockReason };
  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId, playerId: me.id },
    select: {
      id: true, pokemonId: true, level: true, personality: true, evolutionLocked: true,
      statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
      analysisJson: true, analyzedAt: true,
    },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };
  if (!mascot.analyzedAt || !mascot.analysisJson) {
    return { ok: false as const, error: "Este mascote ainda não foi analisado." };
  }
  const saved = mascot.analysisJson as unknown as MascotAnalysis;
  if (saved.analysisVersion === MASCOT_ANALYSIS_VERSION) {
    return { ok: true as const, analysis: saved };
  }

  const analysis = computeMascotAnalysis(mascot, saved.targetLevel);
  await prisma.mascot.update({
    where: { id: mascot.id },
    data: {
      analyzedAt: new Date(),
      ivScore: analysis.ivScore,
      ivRating: analysis.ivRating,
      analysisJson: analysis as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
  revalidateTag(`player-mascots-${me.id}`);
  return { ok: true as const, analysis };
}

// ── Re-roll caótico de status (Laboratório, disponível até 26/08/2026) ─────────
// Só mascotes CAÓTICOS que nunca usaram. Redistribui o TOTAL atual de status pela
// regra de crescimento caótico nível a nível (sem inflar), preservando o total.
const CHAOTIC_REROLL_CUTOFF = new Date("2026-08-27T00:00:00-03:00"); // fim de 26/08 BRT
// Só mascotes "antigos" (nascidos antes desta data) podem usar. Mascotes nascidos
// a partir de agora ficam de fora — sem afetar quem já usou (chaoticRerollUsedAt).
const CHAOTIC_REROLL_BORN_BEFORE = new Date("2026-08-19T00:00:00-03:00");

export async function getChaoticRerollStateAction() {
  const me = await requirePlayer();
  const open = Date.now() < CHAOTIC_REROLL_CUTOFF.getTime();
  const candidates = open ? await prisma.mascot.findMany({
    where: { playerId: me.id, personality: "CHAOTIC", chaoticRerollUsedAt: null, arenaState: "FREE", bazarListed: false, hatchedAt: { lt: CHAOTIC_REROLL_BORN_BEFORE } },
    orderBy: [{ level: "desc" }, { nickname: "asc" }],
    select: { id: true, pokemonId: true, nickname: true, level: true, statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true },
  }) : [];
  return {
    open,
    closesAt: CHAOTIC_REROLL_CUTOFF.toISOString(),
    candidates: candidates.map((m) => ({
      id: m.id, pokemonId: m.pokemonId, name: m.nickname ?? getPokemonName(m.pokemonId), level: m.level,
      total: m.statForce + m.statAgility + m.statCharisma + m.statInstinct + m.statVitality,
      statForce: m.statForce, statAgility: m.statAgility, statCharisma: m.statCharisma, statInstinct: m.statInstinct, statVitality: m.statVitality,
    })),
  };
}

export async function chaoticStatRerollAction(mascotId: string) {
  const me = await requirePlayer();
  if (Date.now() >= CHAOTIC_REROLL_CUTOFF.getTime()) return { ok: false as const, error: "O re-roll caótico foi encerrado (disponível até 26/08/2026)." };

  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId, playerId: me.id },
    select: { id: true, pokemonId: true, personality: true, level: true, chaoticRerollUsedAt: true, hatchedAt: true, arenaState: true, bazarListed: true, operationsLocked: true, statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };
  if (mascot.personality !== "CHAOTIC") return { ok: false as const, error: "Só mascotes de personalidade Caótica podem fazer o re-roll." };
  if (mascot.hatchedAt >= CHAOTIC_REROLL_BORN_BEFORE) return { ok: false as const, error: "Só mascotes antigos (anteriores a esta atualização) podem usar o re-roll caótico." };
  if (mascot.chaoticRerollUsedAt) return { ok: false as const, error: "Este mascote já usou o re-roll caótico (uso único)." };
  if (mascot.arenaState && mascot.arenaState !== "FREE") return { ok: false as const, error: "O mascote está em batalha ou descansando." };
  if (mascot.bazarListed) return { ok: false as const, error: "Retire o mascote do Bazar antes do re-roll." };

  const before = { statForce: mascot.statForce, statAgility: mascot.statAgility, statCharisma: mascot.statCharisma, statInstinct: mascot.statInstinct, statVitality: mascot.statVitality };
  const currentTotal = before.statForce + before.statAgility + before.statCharisma + before.statInstinct + before.statVitality;

  const { computeChaoticRerollProgression } = await import("@/lib/mascot");
  const { progression, final } = computeChaoticRerollProgression(mascot.pokemonId, mascot.level, currentTotal);

  await prisma.mascot.update({
    where: { id: mascot.id },
    data: { ...final, chaoticRerollUsedAt: new Date() },
  });
  revalidateTag(`player-mascots-${me.id}`);
  return { ok: true as const, before, final, progression };
}
