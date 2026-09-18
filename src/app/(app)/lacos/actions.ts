"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { BONDS_V2_BALANCE, REFUGE_LOCATIONS, buildImportantRefugeOptions, simulateRefugeMoment, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { getPokemonName } from "@/lib/mascot-data";
import { uploadDataUrlAsset } from "@/lib/asset-storage";
import { BOND_SHOP_ITEM_TYPES } from "@/lib/shop-config";
import { Prisma } from "@prisma/client";
import {
  applyBondOption,
  autoResolveExpiredBondEvents,
  createBondEventForPlayer,
  type BondBehavior,
} from "@/lib/mascot-bonds";

async function getPlayerId() {
  const session = await getAppSession();
  if (!session?.user) throw new Error("Sessao expirada.");
  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!player) throw new Error("Jogador nao encontrado.");
  return player.id;
}

async function getAdminPlayerId() {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) throw new Error("Prévia disponível somente para administradores.");
  const player = await prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!player) throw new Error("Jogador não encontrado.");
  return player.id;
}

export async function setMascotRoutineV2Action(mascotId: string, location: RefugeLocation | "NONE") {
  try {
    const playerId = await getAdminPlayerId();
    const mascot = await prisma.mascot.findFirst({ where: { id: mascotId, playerId }, select: { id: true, pokemonId: true, nickname: true, routine: { select: { id: true, locationType: true, status: true, updatedAt: true } } } });
    if (!mascot) throw new Error("Mascote não encontrado na sua conta.");
    const changingRoutine = mascot.routine && (
      location === "NONE"
        ? mascot.routine.status === "ACTIVE"
        : mascot.routine.status !== "ACTIVE" || mascot.routine.locationType !== location
    );
    if (changingRoutine) {
      const cooldownMs = BONDS_V2_BALANCE.publicSpaces.moveCooldownMinutes * 60_000;
      const availableAt = new Date(mascot.routine!.updatedAt.getTime() + cooldownMs);
      if (availableAt > new Date()) {
        const wait = Math.max(1, Math.ceil((availableAt.getTime() - Date.now()) / 60_000));
        throw new Error(`Este mascote ainda está se adaptando. A troca de espaço libera em ${wait} min.`);
      }
    }
    if (location === "NONE") {
      await prisma.mascotRoutine.updateMany({ where: { mascotId, playerId, status: "ACTIVE" }, data: { status: "INACTIVE" } });
    } else {
      if (!REFUGE_LOCATIONS[location]) throw new Error("Local inválido.");
      const [occupied, playerTotal, playerInLocation] = await Promise.all([
        prisma.mascotRoutine.count({ where: { locationType: location, status: "ACTIVE", mascotId: { not: mascotId } } }),
        prisma.mascotRoutine.count({ where: { playerId, status: "ACTIVE", mascotId: { not: mascotId } } }),
        prisma.mascotRoutine.count({ where: { playerId, locationType: location, status: "ACTIVE", mascotId: { not: mascotId } } }),
      ]);
      if (occupied >= REFUGE_LOCATIONS[location].capacity) throw new Error(`${REFUGE_LOCATIONS[location].label} está lotado.`);
      if (playerTotal >= BONDS_V2_BALANCE.publicSpaces.maxMascotsPerPlayer) throw new Error(`Cada treinador pode manter até ${BONDS_V2_BALANCE.publicSpaces.maxMascotsPerPlayer} mascotes nos espaços públicos.`);
      if (playerInLocation >= BONDS_V2_BALANCE.publicSpaces.maxMascotsPerPlayerInSameLocation) throw new Error(`Você pode manter até ${BONDS_V2_BALANCE.publicSpaces.maxMascotsPerPlayerInSameLocation} mascotes em ${REFUGE_LOCATIONS[location].label}.`);
      const previousLocation = mascot.routine?.status === "ACTIVE" ? mascot.routine.locationType as RefugeLocation : null;
      await prisma.$transaction(async (tx) => {
        await tx.mascotRoutine.upsert({
          where: { mascotId },
          update: { playerId, locationType: location, status: "ACTIVE", startedAt: new Date(), lastProcessedAt: new Date(), accumulatedUnits: 0 },
          create: { playerId, mascotId, locationType: location },
        });
        if (previousLocation && previousLocation !== location) {
          const mascotLabel = mascot.nickname?.trim() || `Mascote #${mascot.pokemonId}`;
          const transitionText = previousLocation === "TRAINING" && location === "REST"
            ? `${mascotLabel} chegou do Campo de Treino ainda cheio de energia. A algazarra interrompeu alguns cochilos e chamou a atenção de toda a Área de Descanso.`
            : `${mascotLabel} deixou ${REFUGE_LOCATIONS[previousLocation]?.label ?? "o espaço anterior"} e começou a se adaptar a ${REFUGE_LOCATIONS[location].label}. Os habitantes perceberam a mudança na rotina.`;
          await tx.mascotBondMemory.create({
            data: { mascotAId: mascot.id, memoryType: "MUDANCA_DE_ROTINA", sourceType: "REFUGE", sourceId: location, title: `Mudança para ${REFUGE_LOCATIONS[location].label}`, description: transitionText, metadata: { location, previousLocation, transition: true } },
          });
        }
      });
    }
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível definir a rotina." };
  }
}

export async function simulateRefugeV2Action(location: RefugeLocation) {
  try {
    const playerId = await getAdminPlayerId();
    if (!REFUGE_LOCATIONS[location]) throw new Error("Local inválido.");
    const result = await prisma.$transaction((tx) => simulateRefugeMoment(tx, playerId, location));
    revalidatePath("/lacos");
    return { ok: true, message: result.description, importantEventCreated: Boolean(result.importantEventId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível simular o Refúgio." };
  }
}

export async function refreshPendingRefugeOptionsV2Action() {
  try {
    const playerId = await getAdminPlayerId();
    const events = await prisma.mascotSocialEvent.findMany({
      where: { ownerId: playerId, status: "PENDING", eventType: { startsWith: "REFUGE_" } },
      include: { mascotA: { select: { pokemonId: true, nickname: true } }, mascotB: { select: { pokemonId: true, nickname: true } } },
      take: 30,
    });
    let updated = 0;
    for (const event of events) {
      const location = (Object.keys(REFUGE_LOCATIONS) as RefugeLocation[]).find((key) => event.eventType.includes(`REFUGE_${key}`));
      if (!location || !event.mascotB) continue;
      const current = Array.isArray(event.optionsJson) ? event.optionsJson as Array<{ id?: unknown }> : [];
      // Opções novas recebem um identificador modular com o nome da região.
      // Mantemos decisões já renovadas estáveis para não trocar o conteúdo a cada clique.
      if (current.some((option) => typeof option?.id === "string" && option.id.includes(location.toLowerCase()))) continue;
      const firstName = event.mascotA.nickname ?? getPokemonName(event.mascotA.pokemonId);
      const secondName = event.mascotB.nickname ?? getPokemonName(event.mascotB.pokemonId);
      await prisma.mascotSocialEvent.update({
        where: { id: event.id },
        data: { optionsJson: buildImportantRefugeOptions(location, event.eventType.endsWith("_CONFLICT"), firstName, secondName) as unknown as Prisma.InputJsonValue },
      });
      updated += 1;
    }
    revalidatePath("/lacos");
    return { ok: true, updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível renovar as decisões pendentes." };
  }
}

export async function saveRefugeBackgroundV2Action(location: RefugeLocation, image: string) {
  try {
    const playerId = await getAdminPlayerId();
    if (!REFUGE_LOCATIONS[location]) throw new Error("Local inválido.");
    if (image && !image.startsWith("data:image/") && !/^https:\/\//i.test(image)) throw new Error("Envie uma imagem ou URL HTTPS válida.");
    const session = await getAppSession();
    const storedUrl = image.startsWith("data:image/") ? await uploadDataUrlAsset(image, "bonds-v2", `refugio-${location.toLowerCase()}`) : image;
    const current = await prisma.siteContent.findUnique({ where: { id: "bonds-v2-settings" }, select: { data: true } });
    const data = current?.data && typeof current.data === "object" && !Array.isArray(current.data) ? current.data as Record<string, unknown> : {};
    const backgrounds = data.backgrounds && typeof data.backgrounds === "object" && !Array.isArray(data.backgrounds) ? data.backgrounds as Record<string, unknown> : {};
    const next = { ...data, backgrounds: { ...backgrounds, [location]: storedUrl || null } } as Prisma.InputJsonValue;
    await prisma.siteContent.upsert({
      where: { id: "bonds-v2-settings" },
      create: { id: "bonds-v2-settings", data: next, updatedBy: session?.user.id },
      update: { data: next, updatedBy: session?.user.id },
    });
    revalidatePath("/lacos");
    return { ok: true, url: storedUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o cenário." };
  }
}

const BOND_DISTANCE_DELAY_MS = 24 * 60 * 60_000;

export async function updateActiveBondV2Action(relationId: string, operation: "START_DISTANCE" | "CANCEL_DISTANCE") {
  try {
    const playerId = await getAdminPlayerId();
    const relation = await prisma.mascotRelation.findFirst({
      where: { id: relationId, mascotA: { playerId } },
      select: {
        id: true, isActive: true, dormantAt: true, mascotAId: true, mascotBId: true,
        mascotA: { select: { pokemonId: true, nickname: true } },
        mascotB: { select: { pokemonId: true, nickname: true } },
      },
    });
    if (!relation) throw new Error("Laço não encontrado.");
    const now = new Date();
    const nameA = relation.mascotA.nickname ?? getPokemonName(relation.mascotA.pokemonId);
    const nameB = relation.mascotB.nickname ?? getPokemonName(relation.mascotB.pokemonId);
    if (operation === "START_DISTANCE") {
      if (!relation.isActive) throw new Error("Este vínculo já está distante.");
      if (relation.dormantAt && relation.dormantAt > now) throw new Error("O afastamento já está em andamento.");
      await prisma.mascotRelation.updateMany({ where: { OR: [{ mascotAId: relation.mascotAId, mascotBId: relation.mascotBId }, { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId }] }, data: { dormantAt: new Date(now.getTime() + BOND_DISTANCE_DELAY_MS), isProtected: false } });
      await prisma.mascotBondMemory.create({ data: { mascotAId: relation.mascotAId, mascotBId: relation.mascotBId, memoryType: "AFASTAMENTO_INICIADO", sourceType: "BOND_MANAGEMENT", sourceId: relation.id, title: "Precisando de espaço", description: `${nameA} decidiu se afastar de ${nameB}. Durante as próximas 24 horas, uma nova interação ainda pode mudar esse rumo.`, intensity: 2 } });
    } else if (operation === "CANCEL_DISTANCE") {
      if (!relation.isActive || !relation.dormantAt || relation.dormantAt <= now) throw new Error("Não há afastamento em andamento.");
      await prisma.mascotRelation.updateMany({ where: { OR: [{ mascotAId: relation.mascotAId, mascotBId: relation.mascotBId }, { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId }] }, data: { dormantAt: null } });
      await prisma.mascotBondMemory.create({ data: { mascotAId: relation.mascotAId, mascotBId: relation.mascotBId, memoryType: "AFASTAMENTO_CANCELADO", sourceType: "BOND_MANAGEMENT", sourceId: relation.id, title: "Ainda havia algo entre eles", description: `${nameA} desistiu de se afastar de ${nameB}. O vínculo permaneceu presente.`, intensity: 2 } });
    }
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível alterar o laço." };
  }
}

export async function adjustBondItemDebugV2Action(itemType: string, delta: 1 | -1) {
  try {
    const playerId = await getAdminPlayerId();
    if (!(BOND_SHOP_ITEM_TYPES as readonly string[]).includes(itemType)) throw new Error("Item de Laços inválido.");
    const item = await prisma.shopItem.findFirst({ where: { type: itemType as never }, select: { id: true, name: true } });
    if (!item) throw new Error("Este item ainda não foi registrado no catálogo.");
    const current = await prisma.playerInventory.findUnique({ where: { playerId_itemId: { playerId, itemId: item.id } }, select: { quantity: true } });
    if (delta < 0 && (!current || current.quantity < 1)) throw new Error("Você não possui este item para remover.");
    if (delta > 0) await prisma.playerInventory.upsert({ where: { playerId_itemId: { playerId, itemId: item.id } }, update: { quantity: { increment: 1 } }, create: { playerId, itemId: item.id, quantity: 1, source: "BONDS_ADMIN_DEBUG" } });
    else if (current!.quantity === 1) await prisma.playerInventory.delete({ where: { playerId_itemId: { playerId, itemId: item.id } } });
    else await prisma.playerInventory.update({ where: { playerId_itemId: { playerId, itemId: item.id } }, data: { quantity: { decrement: 1 } } });
    revalidatePath("/lacos");
    return { ok: true, name: item.name };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível ajustar o item." };
  }
}

export async function createBondEventAction() {
  try {
    const playerId = await getPlayerId();
    await autoResolveExpiredBondEvents(playerId);
    await createBondEventForPlayer(playerId);
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Nao foi possivel criar evento." };
  }
}

export async function resolveBondEventAction(eventId: string, optionId: string) {
  try {
    const playerId = await getPlayerId();
    await applyBondOption(eventId, playerId, optionId);
    revalidatePath("/lacos");
    revalidatePath("/mascotes");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Nao foi possivel resolver evento." };
  }
}

export async function updateBondBehaviorAction(behavior: BondBehavior) {
  try {
    const playerId = await getPlayerId();
    await prisma.player.update({ where: { id: playerId }, data: { mascotBondBehavior: behavior } });
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Nao foi possivel atualizar comportamento." };
  }
}
