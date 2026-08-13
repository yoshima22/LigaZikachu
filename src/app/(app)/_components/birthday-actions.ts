"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/permissions";
import { isAdmin } from "@/lib/auth/permissions";
import { isBirthdayGiftEligible } from "@/lib/birthday";
import { BIRTHDAY_KITS, KIT_GRANT_SPEC, FEATHER_NAME_BY_TIER, getBirthdayKit } from "@/lib/birthday-roulette";
import { creditCoins } from "@/lib/zikacoins";
import { MEGA_STONES } from "@/lib/mega-evolution";
import type { EggType, Prisma } from "@prisma/client";

function currentYearBRT() {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date()));
}

/** Pedras de mega disponíveis para escolha (kit MEGA_CHOICE). */
export async function getBirthdayMegaOptionsAction(): Promise<Array<{ type: string; stoneName: string; pokemonName: string }>> {
  return MEGA_STONES.map((s) => ({ type: s.type, stoneName: s.stoneName, pokemonName: s.compatiblePokemonName }));
}

async function grantShopItemByName(tx: Prisma.TransactionClient, playerId: string, name: string, qty: number) {
  const item = await tx.shopItem.findFirst({ where: { name }, select: { id: true } });
  if (!item) return;
  await tx.playerInventory.upsert({
    where: { playerId_itemId: { playerId, itemId: item.id } },
    create: { playerId, itemId: item.id, quantity: qty, source: "BIRTHDAY" },
    update: { quantity: { increment: qty } },
  });
}

async function grantKitContents(tx: Prisma.TransactionClient, playerId: string, kitId: string, megaStoneType?: string) {
  const spec = KIT_GRANT_SPEC[kitId];
  if (!spec) return;

  for (const [type, qty] of spec.eggs ?? []) {
    await tx.mascotEgg.createMany({
      data: Array.from({ length: qty }, () => ({ playerId, type: type as EggType, origin: "Presente de Aniversário" })),
    });
  }
  for (const [name, qty] of spec.shopByName ?? []) {
    await grantShopItemByName(tx, playerId, name, qty);
  }
  for (const [tier, qty] of spec.feathers ?? []) {
    const name = FEATHER_NAME_BY_TIER[tier];
    if (name) await grantShopItemByName(tx, playerId, name, qty);
  }
  if (spec.coins && spec.coins > 0) {
    await creditCoins(tx, { playerId, type: "ADMIN_ADJUSTMENT", amount: spec.coins, description: "Presente de Aniversário 🎂" });
  }
  if (spec.food && spec.food > 0) {
    await tx.mascotFoodItem.upsert({
      where: { playerId_type: { playerId, type: "FOOD" } },
      create: { playerId, type: "FOOD", quantity: spec.food },
      update: { quantity: { increment: spec.food } },
    });
  }
  if (spec.sweet && spec.sweet > 0) {
    await tx.mascotFoodItem.upsert({
      where: { playerId_type: { playerId, type: "SWEET" } },
      create: { playerId, type: "SWEET", quantity: spec.sweet },
      update: { quantity: { increment: spec.sweet } },
    });
  }
  // Pedra de mega escolhida (kit MEGA_CHOICE).
  if (spec.megaChoice && megaStoneType) {
    const stone = MEGA_STONES.find((s) => s.type === megaStoneType);
    if (stone) {
      const item = await tx.shopItem.findFirst({ where: { type: stone.type as never }, select: { id: true } });
      if (item) {
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId, itemId: item.id } },
          create: { playerId, itemId: item.id, quantity: 1, source: "BIRTHDAY" },
          update: { quantity: { increment: 1 } },
        });
      }
    }
  }
}

/**
 * Gira a roleta de aniversário: bloqueia o giro anual de forma atômica, sorteia
 * um kit no servidor (anti-trapaça) e concede. Se o kit for a escolha de pedra
 * de mega, deixa pendente para a escolha do jogador.
 */
export async function spinBirthdayRouletteAction(): Promise<
  { ok: true; kitId: string; needsMegaChoice: boolean } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      birthDate: true,
      birthdayGiftYear: true,
      birthdayGiftPendingKit: true,
      birthdayGiftReplayKit: true,
    },
  });
  if (!player) return { ok: false, error: "Jogador não encontrado." };

  // O premio ja foi concedido, mas a animacao ainda nao terminou. Reproduz o
  // mesmo resultado sem sortear ou entregar nada novamente.
  if (player.birthdayGiftReplayKit) {
    return {
      ok: true,
      kitId: player.birthdayGiftReplayKit,
      needsMegaChoice: player.birthdayGiftPendingKit === player.birthdayGiftReplayKit,
    };
  }

  // Se já tem uma escolha de mega pendente, re-mostra o passo da escolha.
  if (player.birthdayGiftPendingKit) {
    return { ok: true, kitId: player.birthdayGiftPendingKit, needsMegaChoice: true };
  }
  if (!isBirthdayGiftEligible(player.birthDate, player.birthdayGiftYear)) {
    return { ok: false, error: "A roleta de aniversário não está disponível para você agora." };
  }

  const year = currentYearBRT();
  const kit = BIRTHDAY_KITS[Math.floor(Math.random() * BIRTHDAY_KITS.length)];
  const needsMegaChoice = Boolean(kit.isMegaChoice);

  try {
    // Claim + concessão numa única transação serializável (anti-corrida e
    // sem risco de marcar o ano sem entregar o presente).
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.player.findUnique({
        where: { id: player.id },
        select: {
          birthDate: true,
          birthdayGiftYear: true,
          birthdayGiftPendingKit: true,
          birthdayGiftReplayKit: true,
        },
      });
      if (!fresh) throw new Error("Jogador não encontrado.");
      if (fresh.birthdayGiftPendingKit) throw new Error("PENDING");
      if ((fresh.birthdayGiftYear ?? 0) >= year || !isBirthdayGiftEligible(fresh.birthDate, fresh.birthdayGiftYear)) {
        throw new Error("Você já girou a roleta de aniversário deste ano.");
      }
      await tx.player.update({
        where: { id: player.id },
        data: {
          birthdayGiftYear: year,
          birthdayGiftPendingKit: needsMegaChoice ? kit.id : null,
          birthdayGiftLastKit: kit.id,
          birthdayGiftReplayKit: kit.id,
        },
      });
      if (!needsMegaChoice) await grantKitContents(tx, player.id, kit.id);
    }, { isolationLevel: "Serializable" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível girar.";
    if (msg === "PENDING") return { ok: true, kitId: player.birthdayGiftPendingKit ?? kit.id, needsMegaChoice: true };
    return { ok: false, error: msg };
  }

  revalidatePath("/");
  return { ok: true, kitId: kit.id, needsMegaChoice };
}

/** Marca apenas a animacao como assistida. Nunca altera ou concede o premio. */
export async function acknowledgeBirthdayRouletteReplayAction(): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  await prisma.player.updateMany({
    where: { userId: user.id, birthdayGiftReplayKit: { not: null } },
    data: { birthdayGiftReplayKit: null },
  });
  revalidatePath("/");
  return { ok: true };
}

/** Finaliza o kit de escolha de pedra de mega. */
export async function chooseBirthdayMegaStoneAction(megaStoneType: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const player = await prisma.player.findUnique({
    where: { userId: user.id },
    select: { id: true, birthdayGiftPendingKit: true },
  });
  if (!player) return { ok: false, error: "Jogador não encontrado." };
  const kit = player.birthdayGiftPendingKit ? getBirthdayKit(player.birthdayGiftPendingKit) : null;
  if (!kit || !kit.isMegaChoice) return { ok: false, error: "Nenhuma escolha de pedra de mega pendente." };
  if (!MEGA_STONES.some((s) => s.type === megaStoneType)) return { ok: false, error: "Pedra de mega inválida." };

  await prisma.$transaction(async (tx) => {
    // Reconfirma o pendente dentro da transação (evita corrida).
    const fresh = await tx.player.findUnique({ where: { id: player.id }, select: { birthdayGiftPendingKit: true } });
    if (fresh?.birthdayGiftPendingKit !== kit.id) return;
    await grantKitContents(tx, player.id, kit.id, megaStoneType);
    await tx.player.update({ where: { id: player.id }, data: { birthdayGiftPendingKit: null } });
  });

  revalidatePath("/");
  return { ok: true };
}

/** DEBUG (admin): sorteia um kit apenas para ver a roleta, SEM conceder nada. */
export async function adminSimulateBirthdayRouletteAction(requestedKitId?: string): Promise<{ ok: boolean; kitId?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (!isAdmin(user.role)) return { ok: false, error: "Acesso restrito." };
  const kit = (requestedKitId ? getBirthdayKit(requestedKitId) : null)
    ?? BIRTHDAY_KITS[Math.floor(Math.random() * BIRTHDAY_KITS.length)];
  return { ok: true, kitId: kit.id };
}
