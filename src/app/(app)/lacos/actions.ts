"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { BONDS_V2_BALANCE, REFUGE_LOCATIONS, buildImportantRefugeOptions, simulateRefugeMoment, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { getPokemonName } from "@/lib/mascot-data";
import { uploadDataUrlAsset } from "@/lib/asset-storage";
import { BOND_ITEM_CATALOG, BOND_SHOP_ITEM_TYPES } from "@/lib/shop-config";
import { Prisma } from "@prisma/client";
import { sendNotificationToPlayers } from "@/lib/notifications";
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
    const playerId = await getPlayerId();
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
          update: { playerId, locationType: location, status: "ACTIVE", startedAt: new Date(), lastProcessedAt: new Date(), nextEventAt: new Date(Date.now() + (180 + Math.floor(Math.random() * 121)) * 60_000), accumulatedUnits: 0 },
          create: { playerId, mascotId, locationType: location, nextEventAt: new Date(Date.now() + (180 + Math.floor(Math.random() * 121)) * 60_000) },
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

async function notifyBondDispute(playerIds: string[], title: string, body: string, eventKey: string) {
  const unique = [...new Set(playerIds)];
  await prisma.playerNotification.createMany({ data: unique.map((playerId) => ({ playerId, category: "BONDS", type: "BOND_DISTANCE_DISPUTE", title, body, href: "/lacos", entityId: eventKey, eventKey: `${eventKey}:${playerId}` })), skipDuplicates: true });
  await sendNotificationToPlayers(unique, { title, body, url: "/lacos", data: { eventKey } }).catch(() => undefined);
}

export async function updateActiveBondV2Action(relationId: string, operation: "START_DISTANCE" | "CANCEL_DISTANCE") {
  try {
    const playerId = await getPlayerId();
    const relation = await prisma.mascotRelation.findFirst({
      where: { id: relationId, mascotA: { playerId } },
      select: {
        id: true, isActive: true, dormantAt: true, mascotAId: true, mascotBId: true, distanceStartedByPlayerId: true,
        mascotA: { select: { pokemonId: true, nickname: true, playerId: true } },
        mascotB: { select: { pokemonId: true, nickname: true, playerId: true } },
      },
    });
    if (!relation) throw new Error("Laço não encontrado.");
    const now = new Date();
    const nameA = relation.mascotA.nickname ?? getPokemonName(relation.mascotA.pokemonId);
    const nameB = relation.mascotB.nickname ?? getPokemonName(relation.mascotB.pokemonId);
    if (operation === "START_DISTANCE") {
      if (!relation.isActive) throw new Error("Este vínculo já está distante.");
      if (relation.dormantAt && relation.dormantAt > now) throw new Error("O afastamento já está em andamento.");
      const deadline = new Date(now.getTime() + BOND_DISTANCE_DELAY_MS);
      await prisma.mascotRelation.updateMany({ where: { OR: [{ mascotAId: relation.mascotAId, mascotBId: relation.mascotBId }, { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId }] }, data: { dormantAt: deadline, distanceStartedAt: now, distanceStartedByPlayerId: playerId, distanceRemainingMs: BOND_DISTANCE_DELAY_MS, promiseCharmStartedAt: null, promiseCharmResolvesAt: null, promiseCharmByPlayerId: null, promiseShielded: false, distanceContestants: [], isProtected: false } });
      await prisma.mascotBondMemory.create({ data: { mascotAId: relation.mascotAId, mascotBId: relation.mascotBId, memoryType: "AFASTAMENTO_INICIADO", sourceType: "BOND_MANAGEMENT", sourceId: relation.id, title: "Precisando de espaço", description: `${nameA} decidiu se afastar de ${nameB}. Durante as próximas 24 horas, uma nova interação ainda pode mudar esse rumo.`, intensity: 2 } });
      const otherPlayerId = relation.mascotA.playerId === playerId ? relation.mascotB.playerId : relation.mascotA.playerId;
      await notifyBondDispute([otherPlayerId], "Um afastamento foi iniciado", `${nameA} e ${nameB} podem perder o vínculo em 24 horas. Você pode contestar ou usar um Amuleto de Promessa.`, `bond-distance:${relation.id}:${now.toISOString()}`);
    } else if (operation === "CANCEL_DISTANCE") {
      if (!relation.isActive || !relation.dormantAt || relation.dormantAt <= now) throw new Error("Não há afastamento em andamento.");
      if (relation.distanceStartedByPlayerId && relation.distanceStartedByPlayerId !== playerId) throw new Error("Use Contestar afastamento para reagir à decisão do outro treinador.");
      await prisma.mascotRelation.updateMany({ where: { OR: [{ mascotAId: relation.mascotAId, mascotBId: relation.mascotBId }, { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId }] }, data: { dormantAt: null, distanceStartedAt: null, distanceStartedByPlayerId: null, distanceRemainingMs: null, promiseCharmStartedAt: null, promiseCharmResolvesAt: null, promiseCharmByPlayerId: null, promiseShielded: false, distanceContestants: [] } });
      await prisma.mascotBondMemory.create({ data: { mascotAId: relation.mascotAId, mascotBId: relation.mascotBId, memoryType: "AFASTAMENTO_CANCELADO", sourceType: "BOND_MANAGEMENT", sourceId: relation.id, title: "Ainda havia algo entre eles", description: `${nameA} desistiu de se afastar de ${nameB}. O vínculo permaneceu presente.`, intensity: 2 } });
    }
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível alterar o laço." };
  }
}

export async function contestBondDistanceV2Action(relationId: string) {
  try {
    const playerId = await getPlayerId();
    const relation = await prisma.mascotRelation.findFirst({ where: { id: relationId, mascotA: { playerId }, isActive: true }, select: { mascotAId: true, mascotBId: true, dormantAt: true, distanceStartedByPlayerId: true, distanceContestants: true } });
    if (!relation?.dormantAt || relation.distanceStartedByPlayerId === playerId) throw new Error("Este afastamento não foi iniciado pelo outro treinador.");
    const attempted = Array.isArray(relation.distanceContestants) ? relation.distanceContestants.map(String) : [];
    if (attempted.includes(playerId)) throw new Error("Você já contestou este afastamento.");
    const won = Math.random() < 0.5;
    const pair = { OR: [{ mascotAId: relation.mascotAId, mascotBId: relation.mascotBId }, { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId }] };
    await prisma.mascotRelation.updateMany({ where: pair, data: won ? { dormantAt: null, distanceStartedAt: null, distanceStartedByPlayerId: null, distanceRemainingMs: null, promiseCharmStartedAt: null, promiseCharmResolvesAt: null, promiseCharmByPlayerId: null, promiseShielded: false, distanceContestants: [] } : { distanceContestants: [...attempted, playerId] } });
    await notifyBondDispute([playerId, relation.distanceStartedByPlayerId!], won ? "Contestação bem-sucedida" : "Contestação não convenceu", won ? "A chance de 50% funcionou e o afastamento foi cancelado." : "O afastamento continua contando. O Amuleto de Promessa ainda pode ser usado.", `bond-contest:${relationId}:${Date.now()}`);
    revalidatePath("/lacos");
    return { ok: true, won };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível contestar." }; }
}

async function consumeBondInventoryItem(playerId: string, type: "BOND_PROMISE_CHARM" | "BOND_PROMISE_SHIELD") {
  const inventory = await prisma.playerInventory.findFirst({ where: { playerId, item: { type } }, select: { id: true, quantity: true } });
  if (!inventory?.quantity) throw new Error(type === "BOND_PROMISE_CHARM" ? "Você não possui um Amuleto de Promessa." : "Você não possui um Escudo do Desapego.");
  if (inventory.quantity === 1) await prisma.playerInventory.delete({ where: { id: inventory.id } });
  else await prisma.playerInventory.update({ where: { id: inventory.id }, data: { quantity: { decrement: 1 } } });
}

export async function useBondDistanceItemV2Action(relationId: string, item: "CHARM" | "SHIELD") {
  try {
    const playerId = await getPlayerId();
    const relation = await prisma.mascotRelation.findFirst({ where: { id: relationId, mascotA: { playerId }, isActive: true }, select: { mascotAId: true, mascotBId: true, dormantAt: true, distanceStartedByPlayerId: true, distanceRemainingMs: true, promiseCharmResolvesAt: true, promiseShielded: true, mascotA: { select: { playerId: true } }, mascotB: { select: { playerId: true } } } });
    if (!relation?.dormantAt || !relation.distanceStartedByPlayerId) throw new Error("Não há afastamento em disputa.");
    const now = new Date();
    const pair = { OR: [{ mascotAId: relation.mascotAId, mascotBId: relation.mascotBId }, { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId }] };
    const involved = [relation.mascotA.playerId, relation.mascotB.playerId];
    if (item === "CHARM") {
      if (relation.distanceStartedByPlayerId === playerId) throw new Error("Somente o outro treinador pode usar o Amuleto de Promessa.");
      if (relation.promiseShielded) throw new Error("O Escudo do Desapego bloqueia novos amuletos nesta disputa.");
      if (relation.promiseCharmResolvesAt) throw new Error("Já existe um Amuleto de Promessa ativo.");
      await consumeBondInventoryItem(playerId, "BOND_PROMISE_CHARM");
      const remaining = Math.max(0, relation.dormantAt.getTime() - now.getTime());
      const resolvesAt = new Date(now.getTime() + 6 * 60 * 60_000);
      await prisma.mascotRelation.updateMany({ where: pair, data: { dormantAt: resolvesAt, distanceRemainingMs: remaining, promiseCharmStartedAt: now, promiseCharmResolvesAt: resolvesAt, promiseCharmByPlayerId: playerId } });
      await notifyBondDispute(involved, "Amuleto de Promessa ativado", "O prazo do afastamento foi pausado. Em 6 horas o vínculo será preservado, salvo se o iniciador usar um Escudo do Desapego.", `bond-charm:${relationId}:${now.toISOString()}`);
    } else {
      if (relation.distanceStartedByPlayerId !== playerId) throw new Error("Somente quem iniciou o afastamento pode usar o Escudo do Desapego.");
      if (!relation.promiseCharmResolvesAt) throw new Error("Não existe Amuleto de Promessa ativo para bloquear.");
      await consumeBondInventoryItem(playerId, "BOND_PROMISE_SHIELD");
      const deadline = new Date(now.getTime() + Math.max(1, relation.distanceRemainingMs ?? BOND_DISTANCE_DELAY_MS));
      await prisma.mascotRelation.updateMany({ where: pair, data: { dormantAt: deadline, promiseCharmStartedAt: null, promiseCharmResolvesAt: null, promiseCharmByPlayerId: null, promiseShielded: true } });
      await notifyBondDispute(involved, "Escudo do Desapego ativado", "O Amuleto foi removido. O prazo restante do afastamento voltou a correr e outro amuleto não poderá ser usado nesta disputa.", `bond-shield:${relationId}:${now.toISOString()}`);
    }
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível usar o item." }; }
}

export async function setRefugeInfluenceV2Action(targetMascotId: string, direction: 1 | -1) {
  try {
    const playerId = await getPlayerId();
    const target = await prisma.mascot.findFirst({ where: { id: targetMascotId, playerId: { not: playerId }, routine: { status: "ACTIVE" } }, select: { id: true } });
    if (!target) throw new Error("Este visitante não está disponível para influência.");
    await prisma.mascotSocialInfluence.upsert({ where: { observerPlayerId_targetMascotId: { observerPlayerId: playerId, targetMascotId } }, create: { observerPlayerId: playerId, targetMascotId, direction }, update: { direction } });
    revalidatePath("/lacos");
    return { ok: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível registrar a influência." }; }
}

export async function claimRefugeRewardV2Action(mascotId: string) {
  try {
    const playerId = await getPlayerId();
    const routine = await prisma.mascotRoutine.findFirst({ where: { mascotId, playerId, status: "ACTIVE", pendingRewardType: { not: null } }, select: { id: true, locationType: true, pendingRewardType: true, mascot: { select: { id: true, pokemonId: true, nickname: true } } } });
    if (!routine?.pendingRewardType) throw new Error("Este mascote ainda não tem um recurso para resgatar.");
    const item = await prisma.shopItem.findFirst({ where: { type: routine.pendingRewardType as never }, select: { id: true, name: true } });
    if (!item) throw new Error("O recurso encontrado ainda não está disponível no catálogo.");
    await prisma.$transaction(async (tx) => {
      await tx.playerInventory.upsert({ where: { playerId_itemId: { playerId, itemId: item.id } }, update: { quantity: { increment: 1 } }, create: { playerId, itemId: item.id, quantity: 1, source: "BONDS_REFUGE" } });
      await tx.mascotRoutine.update({ where: { id: routine.id }, data: { pendingRewardType: null, pendingRewardAt: null } });
      const name = routine.mascot.nickname ?? getPokemonName(routine.mascot.pokemonId);
      await tx.mascotBondMemory.create({ data: { mascotAId: mascotId, memoryType: "RECURSO_DE_LACOS", sourceType: "REFUGE_REWARD", sourceId: routine.locationType, title: "Recurso resgatado", description: `${name} entregou 1x ${item.name} ao treinador.`, metadata: { location: routine.locationType, itemType: routine.pendingRewardType, quantity: 1 } } });
    });
    revalidatePath("/lacos");
    return { ok: true, name: item.name };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível resgatar o recurso." }; }
}

export async function adjustBondItemDebugV2Action(itemType: string, delta: 1 | -1) {
  try {
    const playerId = await getAdminPlayerId();
    if (!(BOND_SHOP_ITEM_TYPES as readonly string[]).includes(itemType)) throw new Error("Item de Laços inválido.");
    const definition = BOND_ITEM_CATALOG.find((entry) => entry.type === itemType);
    if (!definition) throw new Error("Este item ainda não foi registrado no catálogo.");
    const existingItem = await prisma.shopItem.findFirst({ where: { type: itemType as never }, select: { id: true } });
    const item = existingItem
      ? await prisma.shopItem.update({ where: { id: existingItem.id }, data: { name: definition.name, description: definition.description, inventoryEnabled: true }, select: { id: true, name: true } })
      : await prisma.shopItem.create({ data: { id: itemType.toLowerCase().replaceAll("_", "-"), type: itemType as never, name: definition.name, description: definition.description, rarity: definition.rarity, price: 0, active: false, inventoryEnabled: true, sortOrder: 900 + BOND_ITEM_CATALOG.indexOf(definition) }, select: { id: true, name: true } });
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
