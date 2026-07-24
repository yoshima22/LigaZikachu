"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getMegaStoneByType, getMegaStoneForMegaPokemon, isMegaStoneType, MEGA_STAT_BONUS } from "@/lib/mega-evolution";
import { getSessionPlayer } from "@/lib/session";
import {
  startIncubation, hatchEgg, equipMascot, unequipMascot,
  interactWithMascot, startExpedition, claimExpedition, recalculateMood,
  skipExpedition, cancelExpedition, addExp, battleMascots, formFriendship, triggerSocialEvents,
  applyLuckyEgg, applyWeaknessPolicy, applyPicnicBasket, applyVacationTicket,
  claimVacation, applyXpShare, removeXpShare, applyRainbowFeather,
} from "@/lib/mascot";
import { cleanupExpiredArenaResting, healMascotSus } from "@/lib/arena-z";
import { clearRunawayWarningIfRecovered, defaultBondOptions } from "@/lib/mascot-bonds";
import type { InteractionType, ExpeditionDuration } from "@/lib/mascot";
import { getPokemonName, getPokemonTypes, POKEMON_ELEMENT } from "@/lib/mascot-data";
import { normalizePerformanceTag } from "@/lib/mascot-performance";
import { publishLeagueTicker } from "@/lib/league-ticker";
import { ADMIN_LAB_RAINBOW_FEATHER_ID } from "@/lib/admin-lab-feather";
import type { Prisma } from "@prisma/client";

function revalidate(playerId?: string) {
  revalidatePath("/mascotes");
  revalidateTag("arena-active-teams");
  if (playerId) revalidateTag(`player-mascots-${playerId}`);
}

// Define o marcador pessoal de desempenho (FORTE/NEUTRO/RUIM/PESSIMO) de um mascote
export async function setMascotPerformanceTagAction(mascotId: string, tag: string): Promise<{ ok: boolean; error?: string; tag?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const player = await getSessionPlayer(user.id);
  if (!player) return { ok: false, error: "Perfil não encontrado." };
  const normalized = normalizePerformanceTag(tag);
  const res = await prisma.mascot.updateMany({
    where: { id: mascotId, playerId: player.id },
    data: { performanceTag: normalized },
  });
  if (res.count === 0) return { ok: false, error: "Mascote não encontrado." };
  revalidate(player.id);
  return { ok: true, tag: normalized };
}

const BANK_MASCOT_PAGE_SIZE = 9;
const POKEMON_ID_POOL = Object.keys(POKEMON_ELEMENT).map(Number);
const EGG_GENERATION_TYPES = [
  "EGG_GEN1",
  "EGG_GEN2",
  "EGG_GEN3",
  "EGG_GEN4",
  "EGG_GEN5",
  "EGG_GEN6",
  "EGG_GEN7",
  "EGG_GEN8",
  "EGG_GEN9",
  "EGG_GEN6PLUS",
] as const;

function isEggGenerationType(value?: string | null): value is (typeof EGG_GENERATION_TYPES)[number] {
  return !!value && EGG_GENERATION_TYPES.includes(value as (typeof EGG_GENERATION_TYPES)[number]);
}

function getLabEggGeneration(origin?: string | null) {
  const value = origin?.startsWith("LAB_REGION:")
    ? origin.slice("LAB_REGION:".length).split("|", 1)[0]
    : null;
  return isEggGenerationType(value) ? value : null;
}

function isLabChoiceEgg(type: string, origin?: string | null) {
  return type === "LAB" || !!getLabEggGeneration(origin);
}

type HoneySocialOutcome =
  | { type: "NEW_FRIEND"; partnerName: string; message: string }
  | { type: "BONUS_EVENT"; partnerName: string; message: string }
  | null;

const HONEY_SOCIAL_EVENT_CHANCE = 0.40;

async function maybeTriggerHoneyFriendship(mascotId: string, playerId: string): Promise<HoneySocialOutcome> {
  // A felicidade máxima é garantida; amizade/evento social mantém a chance de 40%.
  if (Math.random() >= HONEY_SOCIAL_EVENT_CHANCE) return null;

  const relations = await prisma.mascotRelation.findMany({
    where: { mascotAId: mascotId },
    select: {
      mascotBId: true,
      type: true,
      mascotB: {
        select: {
          nickname: true,
          pokemonId: true,
          playerId: true,
          player: { select: { displayName: true } },
        },
      },
    },
    orderBy: { interactionCount: "desc" },
  });

  const friends = relations.filter((relation) => relation.type === "FRIEND");
  if (friends.length < 10) {
    const candidates = await prisma.mascot.findMany({
      where: {
        id: { notIn: [mascotId, ...relations.map((relation) => relation.mascotBId)] },
        playerId: { not: playerId },
        player: { user: { role: "PLAYER" } },
      },
      select: {
        id: true,
        nickname: true,
        pokemonId: true,
        player: { select: { displayName: true } },
      },
      orderBy: { lastInteractedAt: "desc" },
      take: 40,
    });
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    if (candidate) {
      await formFriendship(mascotId, candidate.id);
      const partnerName = candidate.nickname ?? getPokemonName(candidate.pokemonId);
      return {
        type: "NEW_FRIEND",
        partnerName,
        message: `A Bala de Mel aproximou ${partnerName} (${candidate.player.displayName}) e uma nova amizade nasceu!`,
      };
    }
  }

  const friend = friends[Math.floor(Math.random() * friends.length)];
  if (!friend) return null;
  const partnerName = friend.mascotB.nickname ?? getPokemonName(friend.mascotB.pokemonId);
  const mascot = await prisma.mascot.findUnique({
    where: { id: mascotId },
    select: { nickname: true, pokemonId: true, player: { select: { displayName: true } } },
  });
  if (!mascot) return null;
  const mascotName = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const giftType = Math.random() < 0.25 ? "SWEET" : "FOOD";
  const giftLabel = giftType === "SWEET" ? "1 Doce de Mascote" : "1 Comida de Mascote";
  const description = `${mascotName} (${mascot.player.displayName}) decidiu dividir a Bala de Mel com ${partnerName} (${friend.mascotB.player.displayName}).`;
  await prisma.$transaction([
    prisma.mascotRelation.update({
      where: { mascotAId_mascotBId: { mascotAId: mascotId, mascotBId: friend.mascotBId } },
      data: { interactionCount: { increment: 1 }, lastInteractionAt: new Date() },
    }),
    prisma.mascotRelation.updateMany({
      where: { mascotAId: friend.mascotBId, mascotBId: mascotId, type: "FRIEND" },
      data: { interactionCount: { increment: 1 }, lastInteractionAt: new Date() },
    }),
    prisma.mascotEvent.create({
      data: { mascotId, emoji: "🎁", description: `${partnerName} enviou ${giftLabel} de presente após dividir a Bala de Mel!` },
    }),
    prisma.mascotEvent.create({
      data: { mascotId: friend.mascotBId, emoji: "💚", description },
    }),
    prisma.mascotSocialEvent.create({
      data: {
        ownerId: playerId,
        mascotAId: mascotId,
        mascotBId: friend.mascotBId,
        eventType: "SHARE_SNACK",
        title: "Bala de Mel entre amigos",
        description,
        optionsJson: defaultBondOptions("SHARE_SNACK") as unknown as Prisma.InputJsonValue,
        visibility: "INVOLVED_PLAYERS",
        affectedPlayerIds: [playerId, friend.mascotB.playerId] as unknown as Prisma.InputJsonValue,
        publicEligible: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
    }),
    prisma.mascotFoodItem.upsert({
      where: { playerId_type: { playerId, type: giftType } },
      update: { quantity: { increment: 1 } },
      create: { playerId, type: giftType, quantity: 1 },
    }),
  ]);
  return {
    type: "BONUS_EVENT",
    partnerName,
    message: `${partnerName} enviou ${giftLabel} para você! Um evento bônus também foi aberto na página de Laços. 🎁`,
  };
}

const LAB_CHOICES_MARKER = "LAB_CHOICES:";

function getStoredLabChoices(origin?: string | null): number[] | null {
  const marker = origin?.split("|").find((part) => part.startsWith(LAB_CHOICES_MARKER));
  if (!marker) return null;

  const choices = marker
    .slice(LAB_CHOICES_MARKER.length)
    .split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  return choices.length === 3 && new Set(choices).size === 3 ? choices : null;
}

function storeLabChoices(origin: string | null, choices: number[]) {
  const preservedParts = (origin ?? "")
    .split("|")
    .filter((part) => part && !part.startsWith(LAB_CHOICES_MARKER));
  return [...preservedParts, `${LAB_CHOICES_MARKER}${choices.join(",")}`].join("|");
}

function findPokemonIdsBySearch(search: string) {
  const normalized = normalizeMascotSearch(search);
  if (!normalized) return [];
  const numeric = Number.parseInt(search.trim(), 10);
  const byNumber = Number.isFinite(numeric) && String(numeric) === search.trim() ? [numeric] : [];
  const byName = POKEMON_ID_POOL.filter((id) => normalizeMascotSearch(getPokemonName(id)).includes(normalized));
  return Array.from(new Set([...byNumber, ...byName]));
}

function normalizeMascotSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function findPokemonIdsByType(type: string) {
  const normalized = type.trim().toLowerCase();
  if (!normalized) return [];
  return POKEMON_ID_POOL.filter((id) => getPokemonTypes(id).includes(normalized));
}

export async function putEggInIncubator(eggId: string, genOverride?: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    // Bloqueia ovos que estão em escrow no Bazar
    const egg = await prisma.mascotEgg.findUnique({ where: { id: eggId }, select: { origin: true, playerId: true, type: true } });
    if (!egg || egg.playerId !== player.id) return { error: "Ovo não encontrado." };
    if (egg.origin?.startsWith("bazar:")) {
      return { error: "Este ovo está anunciado no Bazar. Cancele o anúncio antes de usá-lo." };
    }

    // Se jogador escolheu uma geração específica, ovos normais mudam de tipo.
    // O ovo de laboratório guarda a região na origem para preservar os 3 escolhidos e os stats elevados.
    if (isEggGenerationType(genOverride)) {
      if (egg.type === "LAB") {
        await prisma.mascotEgg.update({
          where: { id: eggId },
          data: { origin: `LAB_REGION:${genOverride}` }
        });
      } else {
        await prisma.mascotEgg.update({
          where: { id: eggId },
          data: { origin: `GEN_CHOICE:${egg.type}:${genOverride}` }
        });
      }
    }

    await startIncubation(player.id, eggId);
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function hatchEggAction(): Promise<{
  error?: string;
  result?: Awaited<ReturnType<typeof hatchEgg>>;
  labChoices?: number[];
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    // Ovo do laboratório: apresenta 3 opções ao jogador antes de criar o mascote
    const incubator = await prisma.mascotIncubator.findUnique({
      where: { playerId: player.id },
      include: { egg: { select: { origin: true, type: true } } },
    });
    if (!incubator) return { error: "Sem ovo na incubadora." };
    if (isLabChoiceEgg(incubator.egg.type, incubator.egg.origin)) {
      if (new Date() < incubator.finishAt) return { error: "O ovo ainda não está pronto." };

      const storedChoices = getStoredLabChoices(incubator.egg.origin);
      if (storedChoices) return { labChoices: storedChoices };

      const { rollLabEggChoice, rollPokemonFromEgg } = await import("@/lib/mascot");
      const labGeneration = getLabEggGeneration(incubator.egg.origin);
      const seen = new Set<number>();
      const choices: number[] = [];
      while (choices.length < 3) {
        const id = labGeneration ? rollPokemonFromEgg(labGeneration) : rollLabEggChoice();
        if (!seen.has(id)) { seen.add(id); choices.push(id); }
      }

      // A atualização condicional impede que duas abas gravem trios diferentes.
      const saved = await prisma.mascotEgg.updateMany({
        where: { id: incubator.eggId, playerId: player.id, origin: incubator.egg.origin },
        data: { origin: storeLabChoices(incubator.egg.origin, choices) },
      });
      if (saved.count === 1) return { labChoices: choices };

      const currentEgg = await prisma.mascotEgg.findUnique({
        where: { id: incubator.eggId },
        select: { playerId: true, origin: true },
      });
      const concurrentChoices = currentEgg?.playerId === player.id
        ? getStoredLabChoices(currentEgg.origin)
        : null;
      if (concurrentChoices) return { labChoices: concurrentChoices };
      return { error: "Não foi possível fixar as opções deste ovo. Tente novamente." };
    }

    const result = await hatchEgg(player.id);
    revalidate(player.id);
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function confirmLabChoiceAction(chosenPokemonId: number): Promise<{
  error?: string;
  result?: Awaited<ReturnType<typeof hatchEgg>>;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const incubator = await prisma.mascotIncubator.findUnique({
      where: { playerId: player.id },
      include: { egg: { select: { type: true, origin: true } } },
    });
    if (!incubator || !isLabChoiceEgg(incubator.egg.type, incubator.egg.origin)) {
      return { error: "Ovo de laboratório não encontrado." };
    }
    const storedChoices = getStoredLabChoices(incubator.egg.origin);
    if (!storedChoices?.includes(chosenPokemonId)) {
      return { error: "Esta opção não pertence ao resultado deste ovo." };
    }

    const result = await hatchEgg(player.id, chosenPokemonId);
    revalidate(player.id);
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function skipIncubationAction(): Promise<{ error?: string }> {
  try {
    const user = await requireAdmin();
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nÃ£o encontrado." };

    const incubator = await prisma.mascotIncubator.findUnique({
      where: { playerId: player.id },
      select: { id: true }
    });
    if (!incubator) return { error: "Nenhum ovo na incubadora." };

    await prisma.mascotIncubator.update({
      where: { playerId: player.id },
      data: { finishAt: new Date() }
    });

    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function equipMascotAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await equipMascot(player.id, mascotId);
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function renameMascotAction(mascotId: string, nickname: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    await prisma.mascot.update({ where: { id: mascotId }, data: { nickname: nickname.trim().slice(0, 20) || null } });
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function toggleFavoriteMascotAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };

    const mascot = await prisma.mascot.findUnique({
      where: { id: mascotId },
      select: { id: true, playerId: true, isFavorite: true },
    });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote nao encontrado." };

    if (!mascot.isFavorite) {
      const favoriteCount = await prisma.mascot.count({ where: { playerId: player.id, isFavorite: true } });
      if (favoriteCount >= 6) return { error: "Voce ja tem 6 mascotes favoritos. Remova um favorito antes." };
    }

    await prisma.mascot.update({
      where: { id: mascotId },
      data: { isFavorite: !mascot.isFavorite },
    });
    revalidate(player.id);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao favoritar." };
  }
}

export async function interactAction(
  mascotId: string,
  type: InteractionType
): Promise<{ error?: string; result?: Awaited<ReturnType<typeof interactWithMascot>> }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };

    const player = await prisma.player.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!player) return { error: "Perfil não encontrado." };

    // Não recalcula mood antes de alimentar — o decay comeria o ganho de felicidade
    if (type !== "FEED_FOOD" && type !== "FEED_SWEET") {
      await recalculateMood(mascotId);
    }

    const isAdminUser = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const result = await interactWithMascot(player.id, mascotId, type, isAdminUser);
    if (result.success && (type === "FEED_FOOD" || type === "FEED_SWEET")) {
      await clearRunawayWarningIfRecovered(player.id, mascotId, prisma, true).catch(() => false);
    }

    // Expira apenas os dados de mascotes para a próxima leitura, sem reconstruir
    // toda a página nesta resposta. O card atual já foi atualizado no cliente.
    revalidateTag(`player-mascots-${player.id}`);
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function interactAllAction(
  type: InteractionType,
  scope: "ALL" | "FAVORITES" = "FAVORITES"
): Promise<{
  error?: string;
  results: { mascotId: string; name: string; success: boolean; message: string }[];
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado.", results: [] };

    const player = await prisma.player.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!player) return { error: "Perfil não encontrado.", results: [] };

    const where =
      scope === "FAVORITES"
        ? { playerId: player.id, isFavorite: true }
        : { playerId: player.id };

    const mascots = await prisma.mascot.findMany({
      where,
      select: {
        id: true,
        nickname: true,
        pokemonId: true,
        isFavorite: true,
      },
      orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
      take: scope === "FAVORITES" ? 6 : 100,
    });

    const results: {
      mascotId: string;
      name: string;
      success: boolean;
      message: string;
    }[] = [];

    // Pequenos lotes reduzem muito o tempo da ação sem abrir conexões demais no banco.
    // Mantemos a ordem da lista e fazemos uma única invalidação de cache ao final.
    // Alimentação continua serial para não haver disputa pelo mesmo saldo de itens.
    const concurrency = type === "FEED_FOOD" || type === "FEED_SWEET" ? 1 : 4;
    for (let index = 0; index < mascots.length; index += concurrency) {
      const batch = mascots.slice(index, index + concurrency);
      const batchResults = await Promise.all(batch.map(async (mascot) => {
        try {
          if (type !== "FEED_FOOD" && type !== "FEED_SWEET") {
            await recalculateMood(mascot.id);
          }

          const result = await interactWithMascot(player.id, mascot.id, type);
          return {
            mascotId: mascot.id,
            name: mascot.nickname ?? `#${mascot.pokemonId}`,
            success: result.success,
            message: result.message,
          };
        } catch (err) {
          return {
            mascotId: mascot.id,
            name: mascot.nickname ?? `#${mascot.pokemonId}`,
            success: false,
            message: err instanceof Error ? err.message : "Erro.",
          };
        }
      }));
      results.push(...batchResults);
    }

    revalidate(player.id);
    return { results };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro.",
      results: [],
    };
  }
}

export async function startExpeditionAction(mascotId: string, duration: ExpeditionDuration = "1h", mode: import("@/lib/mascot-data").ExpeditionMode = "STANDARD"): Promise<{ error?: string; result?: { agilityTimeReductionPct: number } }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const expedition = await startExpedition(player.id, mascotId, duration, mode);
    const stored = (expedition.rewardJson as Record<string, unknown> | null) ?? {};
    const agilityTimeReductionPct = typeof stored.agilityTimeReductionPct === "number"
      ? stored.agilityTimeReductionPct
      : 0;
    revalidate(player.id);
    return { result: { agilityTimeReductionPct } };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function healMascotSusAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    await healMascotSus(player.id, mascotId);
    revalidate(player.id);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro no Atendimento SUS." };
  }
}

export async function claimExpeditionAction(expeditionId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof claimExpedition>> }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const result = await claimExpedition(player.id, expeditionId);
    revalidate(player.id);
    revalidatePath("/caixa-de-presentes");
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function unequipMascotAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await unequipMascot(player.id, mascotId);
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function cancelExpeditionAction(expeditionId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await cancelExpedition(player.id, expeditionId);
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function skipExpeditionAction(expeditionId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await skipExpedition(expeditionId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function adminStartExpeditionAction(
  mascotId: string,
  duration: ExpeditionDuration = "1h",
  mode: import("@/lib/mascot-data").ExpeditionMode = "STANDARD",
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId }, select: { playerId: true } });
    if (!mascot) return { error: "Mascote nao encontrado." };
    await startExpedition(mascot.playerId, mascotId, duration, mode);
    revalidate(mascot.playerId);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function adminCancelExpeditionAction(expeditionId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const expedition = await prisma.mascotExpedition.findUnique({
      where: { id: expeditionId },
      include: { mascot: { select: { playerId: true } } },
    });
    if (!expedition) return { error: "Expedicao nao encontrada." };
    await cancelExpedition(expedition.mascot.playerId, expeditionId);
    revalidate(expedition.mascot.playerId);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function adminClaimExpeditionAction(expeditionId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof claimExpedition>> }> {
  try {
    await requireAdmin();
    const expedition = await prisma.mascotExpedition.findUnique({
      where: { id: expeditionId },
      include: { mascot: { select: { playerId: true } } },
    });
    if (!expedition) return { error: "Expedicao nao encontrada." };
    if (new Date() < expedition.finishAt) await skipExpedition(expeditionId);
    const result = await claimExpedition(expedition.mascot.playerId, expeditionId);
    revalidate(expedition.mascot.playerId);
    revalidatePath("/caixa-de-presentes");
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function addExpAdminAction(mascotId: string, amount: number): Promise<{ error?: string; result?: Awaited<ReturnType<typeof addExp>> }> {
  try {
    await requireAdmin();
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Informe uma quantidade positiva de EXP." };
    if (amount > 100000) return { error: "Limite por ajuste: 100000 EXP." };
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot) return { error: "Mascote nao encontrado." };
    const cleanAmount = Math.floor(amount);
    const result = await addExp(mascotId, cleanAmount, { ignoreBenchPenalty: true });
    await prisma.mascotEvent.create({
      data: {
        mascotId,
        emoji: "ADM",
        description: `Ajuste admin: +${cleanAmount} EXP${result.leveled ? `, nivel ${result.newLevel}` : ""}${result.evolved ? " e evolucao aplicada" : ""}.`,
      },
    });
    revalidate(mascot.playerId);
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: batalha manual entre mascotes
export async function adminBattleMascotsAction(mascotAId: string, mascotBId: string): Promise<{ error?: string; result?: Awaited<ReturnType<typeof battleMascots>> }> {
  try {
    await requireAdmin();
    const result = await battleMascots(mascotAId, mascotBId);
    revalidate();
    return { result };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: formar amizade entre mascotes
export async function adminFormFriendshipAction(mascotAId: string, mascotBId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await formFriendship(mascotAId, mascotBId);
    revalidate();
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Usar buff em um mascote
export async function useMascotBuffAction(mascotId: string, itemId: string): Promise<{
  error?: string;
  replacedExistingBuff?: boolean;
  honeyOutcome?: HoneySocialOutcome;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };

    const [mascot, inventoryItem] = await Promise.all([
      prisma.mascot.findUnique({ where: { id: mascotId } }),
      prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId } }, include: { item: true } }),
    ]);
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    if (!inventoryItem || inventoryItem.quantity <= 0) return { error: "Você não tem este item." };

    const BUFF_CONFIG: Record<string, { type: "EXP_BOOST"|"STAT_BOOST"|"HAPPINESS"|"LUCK_BOOST"|"MOOD_RESET"; hours: number; label: string }> = {
      // ⚡ Vitamina Elétrica: +25% EXP por 2h (percentual e duração config via ShopItem.metadata)
      MASCOT_BUFF_EXP:   { type: "EXP_BOOST",  hours: 2, label: "Vitamina Elétrica — +25% EXP por 2h" },
      // Proteina Zika: +2 permanente em todos os 5 atributos, limitada a 3 mascotes por jogador.
      MASCOT_BUFF_STAT:  { type: "STAT_BOOST",  hours: 0, label: "Proteina Zika - +2 permanente em todos os atributos" },
      // 🍯 Bala de Mel: felicidade vai para 100 imediatamente + humor HAPPY
      MASCOT_BUFF_HAPPY: { type: "HAPPINESS",   hours: 0, label: "Bala de Mel — felicidade máxima instantânea" },
      // 🍀 Amuleto da Sorte: chance dobrada de loot raro em expedições por 6h
      MASCOT_BUFF_LUCK:  { type: "LUCK_BOOST",  hours: 6, label: "Amuleto da Sorte — loot raro dobrado por 6h" },
      // 💧 Água Sagrada: remove humor negativo (Bravo/Cansado/Carente) imediatamente
      MASCOT_BUFF_MOOD:  { type: "MOOD_RESET",  hours: 0, label: "Água Sagrada — remove humor negativo" },
    };

    const config = BUFF_CONFIG[inventoryItem.item.type];
    if (!config) return { error: "Este item nao e um buff." };

    if (inventoryItem.item.type === "MASCOT_BUFF_STAT") {
      // Rastreamento confiável via MascotBuff (expiresAt permanente = 2099)
      // Cada mascote pode receber até 3 doses de Proteína Zika
      const proteinDosesOnThisMascot = await prisma.mascotBuff.count({
        where: {
          mascotId,
          type: "STAT_BOOST",
          expiresAt: { gt: new Date("2090-01-01") }, // marcador permanente
        },
      });
      if (proteinDosesOnThisMascot >= 3) {
        return { error: "Este mascote ja recebeu o limite de 3 doses de Proteina Zika." };
      }
    }

    const itemMeta = inventoryItem.item.metadata as { buffHours?: number } | null;
    const effectiveHours = itemMeta?.buffHours ?? config.hours;
    const expiresAt = new Date(Date.now() + effectiveHours * 3_600_000);

    // Verifica se há EXP_BOOST ativo para informar o cliente que será substituído
    let replacedExistingBuff = false;
    if (config.type === "EXP_BOOST") {
      const existing = await prisma.mascotBuff.findFirst({ where: { mascotId, type: "EXP_BOOST", expiresAt: { gt: new Date() } } });
      if (existing) replacedExistingBuff = true;
    }

    await prisma.$transaction(async (tx) => {
      // Remove 1 do inventário
      await tx.playerInventory.update({
        where: { playerId_itemId: { playerId: player.id, itemId } },
        data: { quantity: { decrement: 1 } }
      });

      if (config.type === "MOOD_RESET") {
        // Efeito imediato — remove humores negativos
        await tx.mascot.update({ where: { id: mascotId }, data: { mood: "NEUTRAL", happiness: Math.min(100, mascot.happiness + 20) } });
      } else if (config.type === "HAPPINESS") {
        await tx.mascot.update({ where: { id: mascotId }, data: { happiness: 100, mood: "HAPPY" } });
      } else if (config.type === "STAT_BOOST") {
        await tx.mascot.update({
          where: { id: mascotId },
          data: {
            statForce: { increment: 2 }, statAgility: { increment: 2 },
            statCharisma: { increment: 2 }, statInstinct: { increment: 2 }, statVitality: { increment: 2 }
          }
        });
      }

      // Salva buff com expiração (para EXP_BOOST e LUCK_BOOST)
      // EXP_BOOST substitui qualquer buff ativo do mesmo tipo (sem acúmulo)
      // STAT_BOOST também grava com expiresAt permanente (2099) como marcador confiável de limite
      if (config.hours > 0) {
        if (config.type === "EXP_BOOST") {
          // Apaga buff anterior antes de criar novo (sem acúmulo de Vitaminas)
          await tx.mascotBuff.deleteMany({ where: { mascotId, type: "EXP_BOOST" } });
        }
        await tx.mascotBuff.create({ data: { mascotId, type: config.type, expiresAt } });
      } else if (config.type === "STAT_BOOST") {
        await tx.mascotBuff.create({
          data: { mascotId, type: "STAT_BOOST", expiresAt: new Date("2099-12-31T23:59:59Z") }
        });
      }

      // Log evento
      await tx.mascotEvent.create({ data: { mascotId, emoji: "✨", description: `Usou ${config.label}!` } });
    });

    const honeyOutcome = inventoryItem.item.type === "MASCOT_BUFF_HAPPY"
      ? await maybeTriggerHoneyFriendship(mascotId, player.id).catch(() => null)
      : null;

    revalidate(player.id);
    return { replacedExistingBuff, honeyOutcome };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function useMegaStoneAction(mascotId: string, itemId: string): Promise<{ error?: string; megaName?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "NÃ£o autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nÃ£o encontrado." };

    const [mascot, inventoryItem] = await Promise.all([
      prisma.mascot.findUnique({
        where: { id: mascotId },
        select: {
          id: true, playerId: true, pokemonId: true, nickname: true, level: true,
          arenaState: true, megaEvolvedAt: true,
          expeditions: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
        },
      }),
      prisma.playerInventory.findUnique({
        where: { playerId_itemId: { playerId: player.id, itemId } },
        include: { item: true },
      }),
    ]);

    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote nÃ£o encontrado." };
    if (!inventoryItem || inventoryItem.quantity <= 0) return { error: "VocÃª nÃ£o tem esta pedra." };
    if (!isMegaStoneType(inventoryItem.item.type)) return { error: "Este item nÃ£o Ã© uma Pedra de Mega EvoluÃ§Ã£o." };
    if (mascot.megaEvolvedAt) return { error: "Este mascote jÃ¡ despertou uma Mega EvoluÃ§Ã£o." };
    if (mascot.arenaState !== "FREE" || mascot.expeditions.length > 0) {
      return { error: "O mascote precisa estar livre para Mega Evoluir." };
    }

    const stone = getMegaStoneByType(inventoryItem.item.type);
    if (!stone) return { error: "Pedra de Mega EvoluÃ§Ã£o nÃ£o configurada." };
    if (mascot.pokemonId !== stone.compatiblePokemonId) {
      return { error: `${inventoryItem.item.name} sÃ³ pode ser usada em ${stone.compatiblePokemonName}.` };
    }
    if (mascot.level < stone.minLevel) {
      return { error: `${stone.compatiblePokemonName} precisa estar no Nv.${stone.minLevel} ou maior.` };
    }

    const statBonus = stone.statBonus ?? MEGA_STAT_BONUS;

    await prisma.$transaction(async (tx) => {
      await tx.playerInventory.update({
        where: { playerId_itemId: { playerId: player.id, itemId } },
        data: { quantity: { decrement: 1 } },
      });
      await tx.mascot.update({
        where: { id: mascot.id },
        data: {
          pokemonId: stone.megaPokemonId,
          megaEvolvedFromPokemonId: stone.compatiblePokemonId,
          megaStoneItemId: itemId,
          megaEvolvedAt: new Date(),
          statForce: { increment: statBonus },
          statAgility: { increment: statBonus },
          statCharisma: { increment: statBonus },
          statInstinct: { increment: statBonus },
          statVitality: { increment: statBonus },
        },
      });
      await tx.mascotEvent.create({
        data: {
          mascotId: mascot.id,
          emoji: "🔮",
          description: `${mascot.nickname ?? stone.compatiblePokemonName} usou ${stone.stoneName} e despertou ${stone.megaPokemonName}: +${statBonus} em todos os atributos.`,
        },
      });
    });

    await publishLeagueTicker({
      type: "MEGA_EVOLUTION",
      message: `${player.displayName} mega evoluiu ${mascot.nickname ?? stone.compatiblePokemonName} para ${stone.megaPokemonName}!`,
      href: `/jogadores/${player.id}`,
      eventKey: `mega-evolution:${mascot.id}`,
      priority: 7,
      ttlHours: 18,
    });
    revalidate(player.id);
    return { megaName: stone.megaPokemonName };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao usar Pedra de Mega EvoluÃ§Ã£o." };
  }
}

// ── Novos itens especiais ─────────────────────────────────────────────────────

export async function useLuckyEggAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    // Consome 1 do inventário
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "LUCKY_EGG", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Ovo da Sorte no inventário." };
    await applyLuckyEgg(player.id, mascotId);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function useWeaknessPolicyAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "WEAKNESS_POLICY", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Política de Fraqueza no inventário." };
    await applyWeaknessPolicy(player.id, mascotId);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function usePicnicBasketAction(): Promise<{ error?: string; mascotCount?: number }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "PICNIC_BASKET", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Cesta de Piquenique no inventário." };
    const count = await applyPicnicBasket(player.id);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return { mascotCount: count };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function useVacationTicketAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({ where: { type: "VACATION_TICKET", active: true }, select: { id: true } });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Ticket de Férias no inventário." };
    await applyVacationTicket(player.id, mascotId);
    await prisma.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function claimVacationAction(expeditionId: string): Promise<{ error?: string; reward?: { expBonus: number; gotEgg: boolean } }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const reward = await claimVacation(player.id, expeditionId);
    revalidate(player.id); return { reward };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function useXpShareAction(mascotId: string, itemId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({
      where: { id: itemId, type: { in: ["XP_SHARE", "XP_SHARE_TEAM"] }, active: true },
      select: { id: true, type: true },
    });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Compartilhador de XP no inventário." };
    const previous = await prisma.mascotBuff.findFirst({
      where: {
        type: { in: ["XP_SHARE", "XP_SHARE_TEAM"] },
        mascot: { playerId: player.id },
        expiresAt: { gt: new Date("2090-01-01") },
      },
      select: { type: true },
    });
    await applyXpShare(player.id, mascotId, shopItem.type as "XP_SHARE" | "XP_SHARE_TEAM");
    await prisma.$transaction(async (tx) => {
      await tx.playerInventory.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
      if (previous) {
        const previousItem = await tx.shopItem.findFirst({
          where: { type: previous.type as "XP_SHARE" | "XP_SHARE_TEAM", active: true },
          select: { id: true },
        });
        if (previousItem) {
          await tx.playerInventory.upsert({
            where: { playerId_itemId: { playerId: player.id, itemId: previousItem.id } },
            update: { quantity: { increment: 1 } },
            create: { playerId: player.id, itemId: previousItem.id, quantity: 1 },
          });
        }
      }
    });
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function removeXpShareAction(mascotId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const removedType = await removeXpShare(player.id, mascotId);
    // Devolve o item ao inventário do jogador
    const shopItem = await prisma.shopItem.findFirst({
      where: { type: removedType as "XP_SHARE" | "XP_SHARE_TEAM", active: true },
      select: { id: true },
    });
    if (shopItem) {
      await prisma.playerInventory.upsert({
        where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } },
        update: { quantity: { increment: 1 } },
        create: { playerId: player.id, itemId: shopItem.id, quantity: 1 },
      });
    }
    revalidate(player.id); return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function useRainbowFeatherAction(mascotId: string, itemId: string): Promise<{ error?: string; statRange?: string }> {
  try {
    const user = await getSessionUser(); if (!user) return { error: "Nao autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil nao encontrado." };
    const shopItem = await prisma.shopItem.findFirst({
      where: { id: itemId, type: "RAINBOW_FEATHER" },
      select: { id: true, metadata: true, rarity: true },
    });
    if (!shopItem) return { error: "Item nao encontrado na loja." };
    const isAdminLabFeather = shopItem.id === ADMIN_LAB_RAINBOW_FEATHER_ID;
    const inv = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
    if (!inv || inv.quantity < 1) return { error: "Você não tem Pena Arco-Íris no inventário." };
    const metadataTier = (shopItem.metadata as { eggTier?: "COMMON" | "RARE" | "EVENT" | "SPECIAL" | "LAB" } | null)?.eggTier;
    const eggTier = metadataTier ?? (
      shopItem.rarity === "LEGENDARY" || shopItem.rarity === "MYTHIC" || shopItem.rarity === "RELIC" ? "LAB"
      : shopItem.rarity === "EPIC" ? "SPECIAL"
      : shopItem.rarity === "RARE" ? "RARE"
      : "COMMON"
    );
    const result = await prisma.$transaction(async (tx) => {
      const currentInventory = await tx.playerInventory.findUnique({ where: { id: inv.id } });
      if (!currentInventory || currentInventory.quantity < 1) throw new Error("Você não tem Pena Arco-Íris no inventário.");
      if (isAdminLabFeather) {
        const marked = await tx.player.updateMany({
          where: { id: player.id, adminLabFeatherUsedAt: null },
          data: { adminLabFeatherUsedAt: new Date() },
        });
        if (marked.count !== 1) throw new Error("Esta Pena especial só pode ser usada uma vez por conta.");
      }
      const reset = await applyRainbowFeather(player.id, mascotId, eggTier, tx, isAdminLabFeather);
      await tx.playerInventory.update({
        where: { id: inv.id },
        data: { quantity: { decrement: 1 } },
      });
      await tx.mascotEvent.create({
        data: {
          mascotId,
          emoji: "🌈",
          description: `Pena Arco-Íris usada! O mascote voltou para ${getPokemonName(reset.basePokemonId)} no nível 1, com personalidade e atributos sorteados novamente no intervalo ${reset.statMin}–${reset.statMax}.`,
        },
      });
      return reset;
    });
    revalidate(player.id); return { statRange: `${result.statMin}–${result.statMax}` };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: limpa todas as expedições ativas de um jogador (para corrigir bugs)
export async function adminClearExpeditionsAction(playerId: string): Promise<{ error?: string; cleared: number }> {
  try {
    await requireAdmin();
    const result = await prisma.mascotExpedition.updateMany({
      where: { mascot: { playerId }, status: "ACTIVE" },
      data: { status: "CLAIMED", rewardJson: { type: "NOTHING" } }
    });
    revalidate(playerId);
    return { cleared: result.count };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro.", cleared: 0 }; }
}

// Admin: disparar eventos sociais entre mascotes
export async function adminTriggerSocialEventsAction(): Promise<{ error?: string; summary?: { battles: number; friendships: number; events: string[] } }> {
  try {
    await requireAdmin();
    const summary = await triggerSocialEvents();
    revalidate();
    return { summary };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Admin: dar ovo a um jogador
export async function grantEggToPlayer(playerId: string, eggType: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return { error: "Sem permissão." };
    const mappedType = eggType === "EGG_LAB" ? "LAB" : eggType;
    await prisma.mascotEgg.create({
      data: {
        playerId,
        type: mappedType as import("@prisma/client").EggType,
        origin: "Admin",
      },
    });
    revalidate(playerId);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// ── Carregamento sob demanda de um mascote do banco ─────────────────────────
// Chamado pelo cliente apenas ao clicar no mascote, evitando carregar todos.
export async function getBankMascotsPageAction(input?: {
  page?: number;
  search?: string;
  type?: string;
  ocup?: string;
  rank?: string;
  perf?: string;
}): Promise<{
  error?: string;
  data?: {
    mascots: {
      id: string;
      pokemonId: number;
      nickname: string | null;
      level: number;
      mood: string;
      isShiny: boolean;
      arenaState: string;
      bazarListed: boolean;
      injuredAt: Date | null;
      restingUntil: Date | null;
      lastInteractedAt: Date | null;
      lastPlayedAt: Date | null;
      lastPettedAt: Date | null;
      socialCooldownUntil: Date | null;
      ivRating: string | null;
      ivScore: number | null;
      performanceTag: string;
      expeditions: { id: string; finishAt: Date; status: string }[];
      buffs: { id: string }[];
      statForce: number;
      statAgility: number;
      statCharisma: number;
      statInstinct: number;
      statVitality: number;
    }[];
    total: number;
    page: number;
    pageSize: number;
  };
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await cleanupExpiredArenaResting(player.id).catch(() => null);

    const page = Math.max(1, Math.min(999, Math.floor(input?.page ?? 1)));
    const search = (input?.search ?? "").trim();
    const type = (input?.type ?? "").trim().toLowerCase();
    const ocup = (input?.ocup ?? "all").trim().toLowerCase();
    const rank = (input?.rank ?? "").trim();
    const perf = (input?.perf ?? "").trim();
    const now = new Date();

    const and: Prisma.MascotWhereInput[] = [
      { playerId: player.id },
      { isFavorite: false },
      { isEquipped: false },
    ];

    // Filtro de análise/ranking do Laboratório
    if (rank === "analyzed") and.push({ analyzedAt: { not: null } });
    else if (rank === "unanalyzed") and.push({ analyzedAt: null });
    else if (["SSS", "SS", "S", "A", "B", "C", "D", "E"].includes(rank)) and.push({ ivRating: rank });

    // Filtro de marcador de desempenho (Forte/Neutro/Ruim/Péssimo)
    if (["FORTE", "NEUTRO", "RUIM", "PESSIMO"].includes(perf)) and.push({ performanceTag: perf });

    if (search) {
      const pokemonIds = findPokemonIdsBySearch(search);
      // O banco faz busca case-insensitive, mas nao remove acentos/pontuacao.
      // Normalizamos os apelidos em memoria para que a mesma busca tolerante
      // usada nos nomes das especies tambem funcione nos apelidos.
      const normalizedSearch = normalizeMascotSearch(search);
      const nicknameCandidates = await prisma.mascot.findMany({
        where: { playerId: player.id, isFavorite: false, isEquipped: false, nickname: { not: null } },
        select: { id: true, nickname: true },
      });
      const nicknameIds = nicknameCandidates
        .filter((mascot) => normalizeMascotSearch(mascot.nickname ?? "").includes(normalizedSearch))
        .map((mascot) => mascot.id);
      and.push({
        OR: [
          { nickname: { contains: search, mode: "insensitive" } },
          ...(nicknameIds.length > 0 ? [{ id: { in: nicknameIds } }] : []),
          ...(pokemonIds.length > 0 ? [{ pokemonId: { in: pokemonIds } }] : []),
        ],
      });
    }

    if (type) {
      const pokemonIds = findPokemonIdsByType(type);
      and.push(pokemonIds.length > 0 ? { pokemonId: { in: pokemonIds } } : { id: "__no_match__" });
    }

    switch (ocup) {
      case "free":
        and.push({
          arenaState: "FREE",
          bazarListed: false,
          expeditions: { none: { status: "ACTIVE" } },
          buffs: { none: { expiresAt: { gt: now } } },
          OR: [{ restingUntil: null }, { restingUntil: { lte: now } }],
        });
        break;
      case "busy":
        and.push({
          OR: [
            { expeditions: { some: { status: "ACTIVE" } } },
            { bazarListed: true },
            { arenaState: { not: "FREE" } },
            { restingUntil: { gt: now } },
            { buffs: { some: { expiresAt: { gt: now } } } },
          ],
        });
        break;
      case "expedition":
        and.push({ expeditions: { some: { status: "ACTIVE" } } });
        break;
      case "bazar":
        and.push({ bazarListed: true });
        break;
      case "arena":
        and.push({ arenaState: "ARENA" });
        break;
      case "resting":
        and.push({ OR: [{ arenaState: "RESTING" }, { arenaState: "FREE", restingUntil: { gt: now } }] });
        break;
      case "injured":
        and.push({ arenaState: "INJURED" });
        break;
      case "buff":
        and.push({ buffs: { some: { expiresAt: { gt: now } } } });
        break;
    }

    const where: Prisma.MascotWhereInput = { AND: and };
    const [total, mascots] = await Promise.all([
      prisma.mascot.count({ where }),
      prisma.mascot.findMany({
        where,
        select: {
          id: true, pokemonId: true, nickname: true, level: true, mood: true, isShiny: true,
          arenaState: true, bazarListed: true, injuredAt: true, restingUntil: true,
          lastInteractedAt: true, lastPlayedAt: true, lastPettedAt: true, socialCooldownUntil: true,
          ivRating: true, ivScore: true, performanceTag: true,
          statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
          expeditions: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { id: true, finishAt: true, status: true },
          },
          buffs: {
            where: { expiresAt: { gt: now } },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: [{ level: "desc" }, { id: "asc" }],
        skip: (page - 1) * BANK_MASCOT_PAGE_SIZE,
        take: BANK_MASCOT_PAGE_SIZE,
      }),
    ]);

    return { data: { mascots, total, page, pageSize: BANK_MASCOT_PAGE_SIZE } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function getMascotDetailAction(mascotId: string): Promise<{
  error?: string;
  data?: {
    id: string; pokemonId: number; nickname: string | null;
    level: number; exp: number; happiness: number; mood: string; personality: string;
    isEquipped: boolean; isFavorite: boolean;
    statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number;
    battleWins: number; battleLosses: number;
    arenaState: string; bazarListed: boolean;
    injuredAt: Date | null; restingUntil: Date | null; hatchedAt: Date;
    hatchedFromEggType: string | null; hatchedFromEggOrigin: string | null; megaStoneName: string | null;
    lastInteractedAt: Date | null; lastPlayedAt: Date | null; lastPettedAt: Date | null; lastFedAt: Date | null; socialCooldownUntil: Date | null;
    evolutionLocked: boolean; expLocked: boolean; operationsLocked: boolean; isShiny: boolean;
    ivRating: string | null; ivScore: number | null; performanceTag: string;
    activeBuffs: { type: string; expiresAt: Date }[];
    relations: { type: string; interactionCount: number; relationshipScore: number; specialBondType: string | null; mascotB: { id: string; pokemonId: number; nickname: string | null; ownerName: string; ownerId: string } }[];
    expeditions: { id: string; finishAt: Date; status: string; mode: string }[];
    events: { id: string; emoji: string; description: string; createdAt: Date }[];
  };
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    await cleanupExpiredArenaResting(player.id).catch(() => null);

    const m = await prisma.mascot.findUnique({
      where: { id: mascotId },
      include: {
        expeditions: { where: { status: "ACTIVE" }, take: 1, select: { id: true, finishAt: true, status: true, rewardJson: true } },
        relationsAsA: {
          take: 10,
          include: { mascotB: { select: { id: true, pokemonId: true, nickname: true, player: { select: { id: true, displayName: true } } } } },
        },
      },
    });
    if (!m || m.playerId !== player.id) return { error: "Mascote não encontrado." };

    const activeBuffs = await prisma.mascotBuff.findMany({
      where: { mascotId, expiresAt: { gt: new Date() } },
      select: { type: true, expiresAt: true },
    });

    return {
      data: {
        id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
        level: m.level, exp: m.exp, happiness: m.happiness,
        mood: m.mood, personality: m.personality, isEquipped: m.isEquipped, isFavorite: m.isFavorite,
        statForce: m.statForce, statAgility: m.statAgility, statCharisma: m.statCharisma,
        statInstinct: m.statInstinct, statVitality: m.statVitality,
        battleWins: m.battleWins, battleLosses: m.battleLosses,
        arenaState: m.arenaState, bazarListed: m.bazarListed,
        injuredAt: m.injuredAt, restingUntil: m.restingUntil, hatchedAt: m.hatchedAt,
        hatchedFromEggType: m.hatchedFromEggType,
        hatchedFromEggOrigin: m.hatchedFromEggOrigin,
        megaStoneName: getMegaStoneForMegaPokemon(m.pokemonId)?.stoneName ?? null,
        lastInteractedAt: m.lastInteractedAt,
        lastPlayedAt: m.lastPlayedAt,
        lastPettedAt: m.lastPettedAt,
        lastFedAt: m.lastFedAt, socialCooldownUntil: m.socialCooldownUntil,
        evolutionLocked: m.evolutionLocked, expLocked: m.expLocked, operationsLocked: m.operationsLocked, isShiny: m.isShiny,
        ivRating: m.ivRating, ivScore: m.ivScore, performanceTag: m.performanceTag,
        activeBuffs,
        relations: m.relationsAsA.map(r => ({
          type: r.type, interactionCount: r.interactionCount,
          relationshipScore: r.relationshipScore, specialBondType: r.specialBondType,
          mascotB: { id: r.mascotB.id, pokemonId: r.mascotB.pokemonId, nickname: r.mascotB.nickname, ownerName: r.mascotB.player.displayName, ownerId: r.mascotB.player.id },
        })),
        expeditions: m.expeditions.map(e => ({
          id: e.id, finishAt: e.finishAt, status: e.status,
          mode: (e.rewardJson as Record<string, unknown> | null)?.mode as string ?? "STANDARD",
        })),
        events: [],
      },
    };
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function toggleExpLockAction(mascotId: string, lock: boolean): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    await prisma.mascot.update({ where: { id: mascotId }, data: { expLocked: lock } });
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

export async function toggleMascotOperationsLockAction(mascotId: string, lock: boolean): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const mascot = await prisma.mascot.findUnique({
      where: { id: mascotId },
      select: { playerId: true },
    });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    await prisma.mascot.update({
      where: { id: mascotId },
      data: { operationsLocked: lock },
    });
    revalidate(player.id);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao alterar a proteção." };
  }
}

export async function toggleEvolutionLockAction(mascotId: string, lock: boolean): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado." };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado." };
    const mascot = await prisma.mascot.findUnique({ where: { id: mascotId } });
    if (!mascot || mascot.playerId !== player.id) return { error: "Mascote não encontrado." };
    await prisma.mascot.update({ where: { id: mascotId }, data: { evolutionLocked: lock } });
    revalidate(player.id);
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : "Erro." }; }
}

// Retorna o nível mínimo de horas desde a última refeição para um dado status de fome,
// considerando o multiplicador de banco (isEquipped=false → 5x mais lento)
function hungerMinHours(status: "STARVING" | "HUNGRY" | "NEUTRAL" | "SATISFIED", isEquipped: boolean): number {
  const m = isEquipped ? 1 : 5;
  if (status === "STARVING")  return 24 * m;
  if (status === "HUNGRY")    return 12 * m;
  if (status === "NEUTRAL")   return 6 * m;
  return 2 * m; // SATISFIED
}

export async function feedAllAction(
  minHunger: "STARVING" | "HUNGRY" | "NEUTRAL" | "SATISFIED" = "NEUTRAL",
  foodType: "FOOD" | "SWEET" = "FOOD",
): Promise<{
  error?: string; fed: number; skipped: number; noFood: boolean;
}> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Não autenticado.", fed: 0, skipped: 0, noFood: false };
    const player = await getSessionPlayer(user.id);
    if (!player) return { error: "Perfil não encontrado.", fed: 0, skipped: 0, noFood: false };

    // Verifica estoque de comida/doce
    const food = await prisma.mascotFoodItem.findUnique({
      where: { playerId_type: { playerId: player.id, type: foodType } },
    });
    if (!food || food.quantity <= 0) {
      return { fed: 0, skipped: 0, noFood: true };
    }

    // Busca todos os mascotes que não estão feridos/na arena
    const allMascots = await prisma.mascot.findMany({
      where: {
        playerId: player.id,
        arenaState: { notIn: ["INJURED", "ARENA"] },
      },
      select: { id: true, happiness: true, lastFedAt: true, isEquipped: true },
      orderBy: [{ isEquipped: "desc" }, { isFavorite: "desc" }, { level: "desc" }],
    });

    // Filtra em memória respeitando multiplicador de banco por mascote
    const mascots = allMascots.filter(m => {
      const hours = m.lastFedAt ? (Date.now() - new Date(m.lastFedAt).getTime()) / 3_600_000 : 999;
      return hours >= hungerMinHours(minHunger, m.isEquipped);
    });

    const toFeed = mascots.slice(0, food.quantity); // não alimenta mais do que tem no estoque
    if (toFeed.length === 0) {
      return { fed: 0, skipped: mascots.length, noFood: false };
    }

    // Alimenta em batch
    const now = new Date();
    await prisma.$transaction([
      prisma.mascotFoodItem.update({
        where: { playerId_type: { playerId: player.id, type: foodType } },
        data: { quantity: { decrement: toFeed.length } },
      }),
      ...toFeed.map(m =>
        prisma.mascot.update({
          where: { id: m.id },
          data: {
            happiness: Math.min(100, m.happiness + (foodType === "SWEET" ? 35 : 20)),
            mood: "HAPPY",
            lastFedAt: now,
          },
        })
      ),
    ]);

    // Clear runaway warnings fora da transaction (não-crítico)
    for (const m of toFeed) {
      await clearRunawayWarningIfRecovered(player.id, m.id).catch(() => {});
    }

    revalidate(player.id);
    return { fed: toFeed.length, skipped: mascots.length - toFeed.length, noFood: false };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro.", fed: 0, skipped: 0, noFood: false };
  }
}
