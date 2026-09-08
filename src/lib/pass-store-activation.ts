import { prisma } from "@/lib/prisma";

export const PAID_PASS_GRACE_DAYS = 5;

export type PassStoreActivationResult = { processed: boolean; scheduleId?: string; granted: number; failed: number };

/** Promove o passe de forma atômica e entrega cada pedido isoladamente e de modo retomável. */
export async function processDuePassStoreActivation(now = new Date()): Promise<PassStoreActivationResult> {
  const scheduleId = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext('pass-store-automatic-activation'))`;
    const due = await tx.passScheduleConfig.findFirst({
      where: { isNextStorePass: true, storeActivationAt: { lte: now }, storeActivatedAt: null },
      orderBy: { storeActivationAt: "asc" }, select: { id: true },
    });
    if (due) {
      await tx.passScheduleConfig.updateMany({ where: { isCurrentStorePass: true }, data: { isCurrentStorePass: false } });
      await tx.passScheduleConfig.update({ where: { id: due.id }, data: { isCurrentStorePass: true, isNextStorePass: false, storeActivatedAt: now, storeActivationAt: null } });
      return due.id;
    }
    const pending = await tx.ligaCashOrder.findFirst({
      where: { productType: "SUPPORTER_PASS", passOfferSlot: "NEXT", status: "PAID", fulfilledAt: null, passScheduleKey: { not: null } },
      orderBy: { paidAt: "asc" }, select: { passScheduleKey: true },
    });
    return pending?.passScheduleKey ?? null;
  });

  if (!scheduleId) return { processed: false, granted: 0, failed: 0 };
  const config = await prisma.passScheduleConfig.findUnique({ where: { id: scheduleId } });
  if (!config || !Array.isArray(config.schedule) || config.schedule.length < 1) throw new Error("O passe promovido não possui calendário válido.");
  const label = config.id === "singleton" ? "Passe Apoiador" : config.id;
  const title = await prisma.shopItem.findFirst({ where: { name: "Pilar da Comunidade", type: "TITLE" }, select: { id: true } });
  if (!title) throw new Error("O título Pilar da Comunidade não está configurado.");
  const reservations = await prisma.ligaCashOrder.findMany({
    where: { productType: "SUPPORTER_PASS", passOfferSlot: "NEXT", status: "PAID", fulfilledAt: null, passScheduleKey: scheduleId },
    select: { id: true, playerId: true },
  });

  let granted = 0, failed = 0;
  for (const order of reservations) {
    try {
      let created = false;
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`pass-order:${order.id}`}))`;
        const fresh = await tx.ligaCashOrder.findUnique({ where: { id: order.id }, select: { fulfilledAt: true } });
        if (!fresh || fresh.fulfilledAt) return;
        await tx.playerInventory.upsert({ where: { playerId_itemId: { playerId: order.playerId, itemId: title.id } }, create: { playerId: order.playerId, itemId: title.id, quantity: 1, source: "VIP_PASS" }, update: {} });
        await tx.supporterPass.create({ data: {
          playerId: order.playerId, passLabel: label, startsAt: now,
          expiresAt: new Date(now.getTime() + (config.schedule as unknown[]).length * 86_400_000 + PAID_PASS_GRACE_DAYS * 86_400_000),
          allowRetroactiveClaims: config.storeActivationRetroactive, titleItemId: title.id,
        } });
        await tx.ligaCashOrder.update({ where: { id: order.id }, data: { fulfilledAt: now, passScheduleKey: scheduleId } });
        created = true;
      });
      if (created) granted++;
    } catch (error) {
      failed++;
      console.error(`[PassStoreActivation] Falha ao conceder pedido ${order.id}`, error);
    }
  }
  return { processed: true, scheduleId, granted, failed };
}
