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
import { getMascotRarity } from "./rarity";
import { calculateLabDust } from "./dust";
import { getActiveRaidSabotages, getOrderStepUnlockState } from "@/lib/raid-event";
import { MEGA_STONES } from "@/lib/mega-evolution";

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

  const [player, mascots, weeklyUsage, monthlyUsage] = await Promise.all([
    prisma.player.findUnique({
      where: { id: me.id },
      select: { creationDust: true },
    }),
    prisma.mascot.findMany({
      where: { playerId: me.id },
      select: {
        id: true, pokemonId: true, nickname: true, level: true, isShiny: true,
        isFavorite: true, arenaState: true, bazarListed: true,
        operationsLocked: true,
        analyzedAt: true, ivRating: true, ivScore: true, performanceTag: true,
      },
      orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
    }),
    getOrCreateWeeklyUsage(me.id),
    getOrCreateMonthlyUsage(me.id),
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
    const recyclable = !m.operationsLocked && !m.isFavorite && !m.bazarListed && !inWeeklyLeague && (!m.arenaState || m.arenaState === "FREE");

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
      ivRating: m.ivRating,
      ivScore: m.ivScore,
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
  };
}

// ── Recycle mascot ────────────────────────────────────────────────────────────
export async function recycleMascotAction(mascotId: string) {
  const me = await requirePlayer();
  const lockReason = await getLabLockReason();
  if (lockReason) return { ok: false as const, error: lockReason };

  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId, playerId: me.id },
    select: { id: true, pokemonId: true, isFavorite: true, arenaState: true, bazarListed: true, operationsLocked: true },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };
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
    select: { id: true, pokemonId: true, isFavorite: true, arenaState: true, bazarListed: true, operationsLocked: true },
  });

  if (mascots.length !== uniqueIds.length) {
    return { ok: false as const, error: "Algum mascote selecionado nao foi encontrado." };
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
  const hasStableAnalysis = previousAnalysis?.analysisVersion === 2;
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
    select: { analysisJson: true, analyzedAt: true },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };
  if (!mascot.analyzedAt || !mascot.analysisJson) {
    return { ok: false as const, error: "Este mascote ainda não foi analisado." };
  }
  return { ok: true as const, analysis: mascot.analysisJson as unknown as MascotAnalysis };
}
