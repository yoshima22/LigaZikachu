"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { EggType } from "@prisma/client";
import { getStaticSpriteUrl, getShinySprite, getPokemonName } from "@/lib/mascot-data";
import { creditCoins } from "@/lib/zikacoins";
import { getMascotRarity, getMascotBaseDust, type MascotRarity } from "./rarity";

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
        isFavorite: true, arenaState: true,
      },
      orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
    }),
    getOrCreateWeeklyUsage(me.id),
  ]);

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
    const recyclable = !m.isFavorite && (!m.arenaState || m.arenaState === "FREE");

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
    };
  });

  return {
    ok: true as const,
    creationDust: player?.creationDust ?? 0,
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
    select: { id: true, pokemonId: true, isFavorite: true, arenaState: true },
  });
  if (!mascot) return { ok: false as const, error: "Mascote não encontrado." };
  if (mascot.isFavorite) return { ok: false as const, error: "Não é possível reciclar mascotes favoritos." };
  if (mascot.arenaState && mascot.arenaState !== "FREE") {
    return { ok: false as const, error: "Mascote está em batalha ou descansando." };
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
