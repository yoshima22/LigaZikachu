"use server";

// Invocações (banners de gacha): configuração pelo admin e aberturas do jogador.
// Tudo que mexe em saldo/recompensa roda em transação com advisory lock por
// jogador — duas abas abrindo ao mesmo tempo não podem gastar a mesma moeda.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionPlayer } from "@/lib/session";
import { getSessionUser, isAdmin, requirePlatformAdmin } from "@/lib/auth/permissions";
import { changeLigaCash } from "@/lib/liga-cash-wallet";
import { changeGachaCurrency, currentWeekKey, rarityRank, rollPulls, RARITY_ORDER } from "@/lib/gacha";
import { EGG_STAT_RANGES, EGG_SHINY_CHANCE, getPokemonName, PERSONALITIES } from "@/lib/mascot-data";
import { getSpeciesSnapshot } from "@/lib/species-registry";
import { Prisma, type GachaCurrency } from "@prisma/client";

const RARITY = z.enum(RARITY_ORDER);
const CURRENCY = z.enum(["POKEBALL", "ULTRABALL"]);

function lockKey(playerId: string) {
  return `gacha:${playerId}`;
}

async function lockPlayer(tx: Prisma.TransactionClient, playerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(playerId)}))`;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function refresh() {
  revalidatePath("/shop");
}

/* ─────────────────────────── admin: banners ─────────────────────────── */

const bannerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(80),
  subtitle: z.string().max(80).optional().nullable(),
  flavor: z.string().max(300).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  mascotArtUrl: z.string().max(500).optional().nullable(),
  startsAt: z.string().min(1),
  durationDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  active: z.boolean(),
  costSingle: z.number().int().min(1).max(999),
  costMulti: z.number().int().min(1).max(999),
  ultraCostSingle: z.number().int().min(1).max(999),
  ultraCostMulti: z.number().int().min(1).max(999),
  guaranteedRarity: RARITY,
  ultraGuaranteedRarity: RARITY,
  rateUpMultiplier: z.number().min(1).max(50),
});

export async function saveGachaBannerAction(input: z.infer<typeof bannerSchema>) {
  const admin = await requirePlatformAdmin();
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados do banner inválidos." };
  const data = parsed.data;
  const startsAt = new Date(data.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { error: "Data de início inválida." };
  const endsAt = new Date(startsAt.getTime() + data.durationDays * 24 * 60 * 60 * 1000);

  const values = {
    name: data.name,
    subtitle: data.subtitle || null,
    flavor: data.flavor || null,
    imageUrl: data.imageUrl || null,
    mascotArtUrl: data.mascotArtUrl || null,
    startsAt,
    endsAt,
    durationDays: data.durationDays,
    active: data.active,
    costSingle: data.costSingle,
    costMulti: data.costMulti,
    ultraCostSingle: data.ultraCostSingle,
    ultraCostMulti: data.ultraCostMulti,
    guaranteedRarity: data.guaranteedRarity,
    ultraGuaranteedRarity: data.ultraGuaranteedRarity,
    rateUpMultiplier: data.rateUpMultiplier,
  };

  const banner = data.id
    ? await prisma.gachaBanner.update({ where: { id: data.id }, data: values })
    : await prisma.gachaBanner.create({ data: { ...values, createdById: admin.id } });

  refresh();
  return { id: banner.id };
}

export async function deleteGachaBannerAction(id: string) {
  await requirePlatformAdmin();
  await prisma.gachaBanner.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/* ─────────────────────────── admin: pool ─────────────────────────── */

const entrySchema = z.object({
  id: z.string().optional(),
  bannerId: z.string().min(1),
  kind: z.enum(["EGG", "MASCOT", "ITEM"]),
  label: z.string().min(1).max(80),
  rarity: RARITY,
  weight: z.number().min(0).max(10000),
  rateUp: z.boolean(),
  imageUrl: z.string().max(500).optional().nullable(),
  eggType: z.string().optional().nullable(),
  pokemonId: z.number().int().positive().optional().nullable(),
  itemId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).max(99).default(1),
});

export async function saveGachaEntryAction(input: z.infer<typeof entrySchema>) {
  await requirePlatformAdmin();
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { error: "Dados do item inválidos." };
  const { id, ...data } = parsed.data;

  if (data.kind === "EGG" && !data.eggType) return { error: "Escolha o tipo de ovo." };
  if (data.kind === "MASCOT" && !data.pokemonId) return { error: "Escolha o mascote (número da Pokédex)." };
  if (data.kind === "ITEM" && !data.itemId) return { error: "Escolha o item da loja." };

  const values = {
    bannerId: data.bannerId,
    kind: data.kind,
    label: data.label,
    rarity: data.rarity,
    weight: data.weight,
    rateUp: data.rateUp,
    imageUrl: data.imageUrl || null,
    eggType: (data.kind === "EGG" ? data.eggType : null) as never,
    pokemonId: data.kind === "MASCOT" ? data.pokemonId : null,
    itemId: data.kind === "ITEM" ? data.itemId : null,
    quantity: data.quantity,
  };

  if (id) await prisma.gachaBannerEntry.update({ where: { id }, data: values });
  else await prisma.gachaBannerEntry.create({ data: values });
  refresh();
  return { ok: true };
}

export async function deleteGachaEntryAction(id: string) {
  await requirePlatformAdmin();
  await prisma.gachaBannerEntry.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/* ─────────────────────── admin: barras de garantia ─────────────────────── */

const pitySchema = z.object({
  id: z.string().optional(),
  bannerId: z.string().min(1),
  currency: CURRENCY,
  everyPulls: z.number().int().min(1).max(500),
  rarity: RARITY,
});

export async function saveGachaPityAction(input: z.infer<typeof pitySchema>) {
  await requirePlatformAdmin();
  const parsed = pitySchema.safeParse(input);
  if (!parsed.success) return { error: "Barra de garantia inválida." };
  const { id, ...data } = parsed.data;
  if (id) await prisma.gachaPityRule.update({ where: { id }, data });
  else await prisma.gachaPityRule.create({ data });
  refresh();
  return { ok: true };
}

export async function deleteGachaPityAction(id: string) {
  await requirePlatformAdmin();
  await prisma.gachaPityRule.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/* ─────────────────────────── admin: missões ─────────────────────────── */

const missionSchema = z.object({
  id: z.string().optional(),
  bannerId: z.string().optional().nullable(),
  title: z.string().min(3).max(120),
  source: z.enum([
    "ARENA_Z", "LIGA_RUSH", "LIGA_SEMANAL", "BATALHA_TERRENO", "ARENA_DRAFT", "EXPEDICAO_CONCLUIDA",
    "FIGURINHAS", "BAZAR_VENDA", "BAZAR_GASTO_ZC", "BAZAR_GASTO_LC", "OVOS_ABERTOS",
    "COMBATE_PVP", "COMBATE_KO", "LACOS", "ALBUM_COMPLETO", "LIGA_RUSH_VITORIA", "LIGA_SEMANAL_VITORIA",
    "BAZAR_COMPRA", "MIAUVADAO_COMPRA_SLOT", "MIAUVADAO_APOSTA", "MIAUVADAO_ACERTO",
    "ZIKABET_ACERTO", "ZIKALOOT_NUMERO", "ARENA_DRAFT_PARTIDA",
  ]),
  goal: z.number().int().min(1).max(1_000_000),
  reward: CURRENCY,
  rewardAmount: z.number().int().min(1).max(999),
  rarityFilter: z.string().optional().nullable(),
  criteria: z.object({
    opponentPlayerId: z.string().min(1).optional(),
    pokemonId: z.number().int().positive().optional(),
    pokemonType: z.string().min(1).max(32).optional(),
    sellerPlayerId: z.string().min(1).optional(),
    bazarCategory: z.string().min(1).max(48).optional(),
    bazarListingType: z.string().min(1).max(48).optional(),
    miauvadaoSlot: z.number().int().min(0).max(99).optional(),
    minAmount: z.number().int().min(0).max(1_000_000_000).optional(),
    requireWin: z.boolean().optional(),
    exactNumber: z.number().int().min(1).max(100_000).optional(),
    specialTicket: z.boolean().optional(),
  }).optional().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export async function saveGachaMissionAction(input: z.infer<typeof missionSchema>) {
  await requirePlatformAdmin();
  const parsed = missionSchema.safeParse(input);
  if (!parsed.success) return { error: "Missão inválida." };
  const { id, ...data } = parsed.data;
  const values = {
    ...data,
    bannerId: data.bannerId || null,
    rarityFilter: data.rarityFilter || null,
    criteria: data.criteria && Object.keys(data.criteria).length > 0
      ? data.criteria as Prisma.InputJsonValue
      : Prisma.JsonNull,
  };
  if (id) await prisma.gachaMission.update({ where: { id }, data: values });
  else await prisma.gachaMission.create({ data: values });
  refresh();
  return { ok: true };
}

/** Cria uma base balanceada sem tocar em missões já criadas manualmente. */
export async function generateGachaMissionSetAction(bannerId?: string | null) {
  await requirePlatformAdmin();
  const prefix = "AUTO · ";
  const templates = [
    ["Vitórias na Arena-Z", "ARENA_Z", 3, 1, {}],
    ["Abrir ovos", "OVOS_ABERTOS", 2, 1, {}],
    ["Concluir expedições", "EXPEDICAO_CONCLUIDA", 2, 1, {}],
    ["Resolver momentos de Laços", "LACOS", 2, 1, {}],
    ["Completar um álbum", "ALBUM_COMPLETO", 1, 3, {}],
    ["Vencer um combate contra jogador", "COMBATE_PVP", 1, 2, { requireWin: true }],
    ["Conseguir KOs em combate PvP", "COMBATE_KO", 2, 1, {}],
    ["Comprar de outro jogador no Bazar", "BAZAR_COMPRA", 2, 1, {}],
    ["Comprar no slot do Miauvadão", "MIAUVADAO_COMPRA_SLOT", 1, 1, {}],
    ["Apostar no jogo do Miauvadão", "MIAUVADAO_APOSTA", 2, 1, {}],
    ["Acertar no jogo do Miauvadão", "MIAUVADAO_ACERTO", 1, 2, { requireWin: true }],
    ["Acertar uma aposta na ZikaBet", "ZIKABET_ACERTO", 1, 2, { requireWin: true }],
    ["Escolher números na ZikaLoot", "ZIKALOOT_NUMERO", 2, 1, {}],
    ["Jogar partidas na Arena Draft", "ARENA_DRAFT_PARTIDA", 1, 1, {}],
    ["Vencer na Liga Rush", "LIGA_RUSH_VITORIA", 1, 2, { requireWin: true }],
    ["Vencer na Liga Semanal", "LIGA_SEMANAL_VITORIA", 1, 2, { requireWin: true }],
  ] as const;
  const titles = templates.map(([title]) => `${prefix}${title}`);
  const present = await prisma.gachaMission.findMany({ where: { title: { in: titles } }, select: { title: true } });
  const existing = new Set(present.map((mission) => mission.title));
  const created = templates.filter(([title]) => !existing.has(`${prefix}${title}`));
  if (created.length) {
    await prisma.gachaMission.createMany({
      data: created.map(([title, source, goal, rewardAmount, criteria], sortOrder) => ({
        title: `${prefix}${title}`,
        source: source as never,
        goal,
        reward: "POKEBALL" as const,
        rewardAmount,
        criteria: criteria as Prisma.InputJsonValue,
        active: true,
        sortOrder,
        bannerId: bannerId || null,
      })),
    });
  }
  refresh();
  return { ok: true, created: created.length };
}

export async function deleteGachaMissionAction(id: string) {
  await requirePlatformAdmin();
  await prisma.gachaMission.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/* ─────────────────────────── admin: pacotes LC ─────────────────────────── */

const packSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(80),
  currency: CURRENCY,
  amount: z.number().int().min(1).max(9999),
  bonus: z.number().int().min(0).max(9999),
  priceLc: z.number().int().min(1).max(1_000_000),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export async function saveGachaPackAction(input: z.infer<typeof packSchema>) {
  await requirePlatformAdmin();
  const parsed = packSchema.safeParse(input);
  if (!parsed.success) return { error: "Pacote inválido." };
  const { id, ...data } = parsed.data;
  if (id) await prisma.gachaPack.update({ where: { id }, data });
  else await prisma.gachaPack.create({ data });
  refresh();
  return { ok: true };
}

export async function deleteGachaPackAction(id: string) {
  await requirePlatformAdmin();
  await prisma.gachaPack.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/* ─────────────────── admin: entrega manual de moeda ─────────────────── */

export async function grantGachaCurrencyAction(input: {
  playerId: string;
  currency: GachaCurrency;
  amount: number;
  reason: string;
}) {
  const admin = await requirePlatformAdmin();
  const parsed = z.object({
    playerId: z.string().min(1),
    currency: CURRENCY,
    amount: z.number().int().min(1).max(9999),
    reason: z.string().min(3).max(200),
  }).safeParse(input);
  if (!parsed.success) return { error: "Dados da entrega inválidos." };

  const player = await prisma.player.findUnique({ where: { id: parsed.data.playerId }, select: { id: true } });
  if (!player) return { error: "Jogador não encontrado." };

  await prisma.$transaction(async (tx) => {
    await lockPlayer(tx, player.id);
    await changeGachaCurrency(tx, {
      playerId: player.id,
      currency: parsed.data.currency,
      amount: parsed.data.amount,
      reason: `ADMIN_GRANT: ${parsed.data.reason}`,
      actorUserId: admin.id,
    });
  });
  refresh();
  return { ok: true };
}

/* ─────────────────────────── jogador: abrir banner ─────────────────────────── */

type GrantedReward = { label: string; rarity: string; kind: string; imageUrl: string | null; pokemonId: number | null; guaranteed: boolean };

export async function pullGachaBannerAction(bannerId: string, currency: GachaCurrency, count: 1 | 10) {
  const user = await getSessionUser();
  if (!user) return { error: "Faça login para invocar." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };
  if (count !== 1 && count !== 10) return { error: "Quantidade inválida." };

  const banner = await prisma.gachaBanner.findUnique({
    where: { id: bannerId },
    include: { entries: true, pityRules: { where: { currency } } },
  });
  if (!banner) return { error: "Banner não encontrado." };

  const now = new Date();
  const live = banner.active && banner.startsAt <= now && banner.endsAt > now;
  // Admin de plataforma abre banner fora do ar para testar animação e pool.
  if (!live && !isAdmin(user.role)) {
    return { error: "Este banner não está ativo." };
  }
  if (banner.entries.length === 0) return { error: "Este banner ainda não tem conteúdo configurado." };

  const unitCost = currency === "POKEBALL"
    ? (count === 1 ? banner.costSingle : banner.costMulti)
    : (count === 1 ? banner.ultraCostSingle : banner.ultraCostMulti);
  const guaranteedRarity = count === 10
    ? (currency === "POKEBALL" ? banner.guaranteedRarity : banner.ultraGuaranteedRarity)
    : null;

  try {
    const rewards = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, player.id);
      await changeGachaCurrency(tx, {
        playerId: player.id,
        currency,
        amount: -unitCost,
        reason: `BANNER_PULL:${banner.id}`,
        metadata: { bannerId: banner.id, count },
      });

      const states = await tx.gachaPityState.findMany({
        where: { playerId: player.id, ruleId: { in: banner.pityRules.map((rule) => rule.id) } },
      });
      const counterOf = new Map(states.map((state) => [state.ruleId, state.counter]));

      const roll = rollPulls(
        banner.entries.map((entry) => ({
          id: entry.id, rarity: entry.rarity, weight: entry.weight, rateUp: entry.rateUp,
        })),
        count,
        {
          rateUpMultiplier: banner.rateUpMultiplier,
          guaranteedRarity,
          pity: banner.pityRules.map((rule) => ({
            id: rule.id, everyPulls: rule.everyPulls, rarity: rule.rarity, counter: counterOf.get(rule.id) ?? 0,
          })),
        },
      );

      for (const rule of roll.pity) {
        await tx.gachaPityState.upsert({
          where: { playerId_ruleId: { playerId: player.id, ruleId: rule.id } },
          create: { playerId: player.id, ruleId: rule.id, bannerId: banner.id, counter: rule.counter },
          update: { counter: rule.counter },
        });
      }

      const entryById = new Map(banner.entries.map((entry) => [entry.id, entry]));
      const granted: GrantedReward[] = [];
      for (const result of roll.results) {
        const entry = entryById.get(result.entryId)!;
        await grantEntry(tx, player.id, banner.id, entry);
        granted.push({
          label: entry.label,
          rarity: entry.rarity,
          kind: entry.kind,
          imageUrl: entry.imageUrl,
          pokemonId: entry.pokemonId,
          guaranteed: result.guaranteedBy !== null,
        });
      }

      await tx.gachaPull.create({
        data: { bannerId: banner.id, playerId: player.id, currency, count, results: granted as never },
      });

      return granted;
    });

    refresh();
    return { rewards };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível invocar." };
  }
}

async function grantEntry(
  tx: Prisma.TransactionClient,
  playerId: string,
  bannerId: string,
  entry: { kind: string; eggType: string | null; pokemonId: number | null; itemId: string | null; quantity: number; rarity: string; label: string },
) {
  const origin = `BANNER:${bannerId}`;

  if (entry.kind === "EGG" && entry.eggType) {
    for (let index = 0; index < entry.quantity; index += 1) {
      await tx.mascotEgg.create({ data: { playerId, type: entry.eggType as never, origin } });
    }
    return;
  }

  if (entry.kind === "ITEM" && entry.itemId) {
    await tx.playerInventory.upsert({
      where: { playerId_itemId: { playerId, itemId: entry.itemId } },
      create: { playerId, itemId: entry.itemId, quantity: entry.quantity, source: "GACHA_BANNER" },
      update: { quantity: { increment: entry.quantity } },
    });
    return;
  }

  if (entry.kind === "MASCOT" && entry.pokemonId) {
    // Mesmo sorteio de atributos de um ovo daquela raridade — um mascote de
    // banner Celestial nasce no intervalo 23~30, como qualquer outro Celestial.
    const [statMin, statMax] = EGG_STAT_RANGES[entry.rarity] ?? EGG_STAT_RANGES.RARE;
    const isShiny = Math.random() < (EGG_SHINY_CHANCE[entry.rarity] ?? 1 / 300);
    await tx.mascot.create({
      data: {
        playerId,
        pokemonId: entry.pokemonId,
        ...(await getSpeciesSnapshot(entry.pokemonId, tx)),
        hatchedPokemonId: entry.pokemonId,
        nickname: getPokemonName(entry.pokemonId),
        personality: PERSONALITIES[randomInt(0, PERSONALITIES.length - 1)] as never,
        isShiny,
        hatchedFromEggType: entry.rarity as never,
        hatchedFromEggOrigin: origin,
        statForce: randomInt(statMin, statMax),
        statAgility: randomInt(statMin, statMax),
        statCharisma: randomInt(statMin, statMax),
        statInstinct: randomInt(statMin, statMax),
        statVitality: randomInt(statMin, statMax),
      },
    });
  }
}

/* ─────────────────────────── jogador: pacote por LC ─────────────────────────── */

export async function buyGachaPackAction(packId: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Faça login para comprar." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };

  const pack = await prisma.gachaPack.findUnique({ where: { id: packId } });
  if (!pack || !pack.active) return { error: "Pacote indisponível." };

  try {
    await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, player.id);
      await changeLigaCash(tx, {
        playerId: player.id,
        amount: -pack.priceLc,
        reason: `GACHA_PACK:${pack.id}`,
        referenceType: "GACHA_PACK",
        referenceId: pack.id,
        spentDelta: pack.priceLc,
      });
      await changeGachaCurrency(tx, {
        playerId: player.id,
        currency: pack.currency,
        amount: pack.amount + pack.bonus,
        reason: `PACK_PURCHASE:${pack.id}`,
        metadata: { packId: pack.id, priceLc: pack.priceLc },
      });
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível comprar o pacote." };
  }
}

/* ─────────────────────────── jogador: missões ─────────────────────────── */

export async function claimGachaMissionAction(missionId: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Faça login." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { error: "Jogador não encontrado." };

  const mission = await prisma.gachaMission.findUnique({ where: { id: missionId } });
  if (!mission || !mission.active) return { error: "Missão indisponível." };
  const weekKey = currentWeekKey();

  try {
    await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, player.id);
      const progress = await tx.gachaMissionProgress.findUnique({
        where: { missionId_playerId_weekKey: { missionId, playerId: player.id, weekKey } },
      });
      if (!progress || progress.progress < mission.goal) throw new Error("Missão ainda não concluída.");
      if (progress.claimedAt) throw new Error("Recompensa já resgatada nesta semana.");
      await tx.gachaMissionProgress.update({
        where: { id: progress.id },
        data: { claimedAt: new Date() },
      });
      await changeGachaCurrency(tx, {
        playerId: player.id,
        currency: mission.reward,
        amount: mission.rewardAmount,
        reason: `MISSION:${mission.id}`,
        metadata: { weekKey },
      });
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível resgatar." };
  }
}

/* ─────────────────────────── leitura ─────────────────────────── */

export async function getGachaProbabilitiesAction(bannerId: string) {
  const banner = await prisma.gachaBanner.findUnique({
    where: { id: bannerId },
    select: { rateUpMultiplier: true, entries: { select: { label: true, rarity: true, weight: true, rateUp: true } } },
  });
  if (!banner) return { error: "Banner não encontrado." };
  const weighted = banner.entries.map((entry) => ({
    ...entry,
    effective: Math.max(0, entry.weight) * (entry.rateUp ? banner.rateUpMultiplier : 1),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.effective, 0) || 1;
  return {
    entries: weighted
      .map((entry) => ({ label: entry.label, rarity: entry.rarity, rateUp: entry.rateUp, chance: (entry.effective / total) * 100 }))
      .sort((left, right) => rarityRank(right.rarity) - rarityRank(left.rarity) || right.chance - left.chance),
  };
}
