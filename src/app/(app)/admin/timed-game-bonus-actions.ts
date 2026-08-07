"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";
import {
  TIMED_GAME_BONUSES_KEY,
  getTimedGameBonusEvents,
  normalizeTimedGameBonusEvent,
  TIMED_GAME_BONUSES_TAG,
  type TimedGameBonusEvent,
} from "@/lib/timed-game-bonuses";

async function persist(events: TimedGameBonusEvent[]) {
  await prisma.appSetting.upsert({
    where: { key: TIMED_GAME_BONUSES_KEY },
    create: { key: TIMED_GAME_BONUSES_KEY, value: events as object[] },
    update: { value: events as object[] },
  });
  revalidateTag(TIMED_GAME_BONUSES_TAG);
  revalidatePath("/admin");
  revalidatePath("/arena-z");
}

export async function saveTimedGameBonusEvent(input: TimedGameBonusEvent) {
  try {
    const admin = await requireAdmin();
    const normalized = normalizeTimedGameBonusEvent(input);
    if (!normalized) return { ok: false, error: "Preencha nome, início e fim do evento." };
    if (new Date(normalized.endsAt) <= new Date(normalized.startsAt)) {
      return { ok: false, error: "O encerramento precisa acontecer depois do início." };
    }
    if (
      normalized.expeditionExpBonusPct <= 0 &&
      normalized.eggRarityBonusPct <= 0 &&
      normalized.arenaDailyZcLimit === null
    ) return { ok: false, error: "Configure pelo menos um bônus para o evento." };

    const events = await getTimedGameBonusEvents();
    const existingIndex = events.findIndex(event => event.id === normalized.id);
    const next = [...events];
    if (existingIndex >= 0) next[existingIndex] = normalized;
    else next.push(normalized);
    await persist(next);
    await prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: existingIndex >= 0 ? "TIMED_GAME_BONUS_UPDATED" : "TIMED_GAME_BONUS_CREATED",
        entityType: "TimedGameBonusEvent",
        entityId: normalized.id,
        metadata: normalized as object,
      },
    }).catch(() => null);
    return { ok: true, event: normalized };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao salvar evento." };
  }
}

export async function deleteTimedGameBonusEvent(id: string) {
  try {
    const admin = await requireAdmin();
    const events = await getTimedGameBonusEvents();
    const removed = events.find(event => event.id === id);
    await persist(events.filter(event => event.id !== id));
    await prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "TIMED_GAME_BONUS_DELETED",
        entityType: "TimedGameBonusEvent",
        entityId: id,
        metadata: removed ? { name: removed.name } : {},
      },
    }).catch(() => null);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao excluir evento." };
  }
}
