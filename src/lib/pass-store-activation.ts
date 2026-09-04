import { prisma } from "@/lib/prisma";

export type PassStoreActivationResult = {
  processed: boolean;
  scheduleId?: string;
  granted: number;
  failed: number;
};

/**
 * Promove e distribui o próximo passe vencido. O lock e os marcadores no banco
 * tornam a execução segura mesmo quando duas instâncias do cron coincidirem.
 */
export async function processDuePassStoreActivation(now = new Date()): Promise<PassStoreActivationResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('pass-store-automatic-activation'))`;
    const next = await tx.passScheduleConfig.findFirst({
      where: {
        isNextStorePass: true,
        storeActivationAt: { lte: now },
        storeActivatedAt: null,
      },
      orderBy: { storeActivationAt: "asc" },
    });
    if (!next) return { processed: false, granted: 0, failed: 0 };

    const schedule = Array.isArray(next.schedule) ? next.schedule : [];
    if (schedule.length < 1) throw new Error("O próximo passe não possui calendário válido.");
    const label = next.id === "singleton" ? "Passe Apoiador" : next.id;
    const title = await tx.shopItem.findFirst({ where: { name: "Pilar da Comunidade", type: "TITLE" }, select: { id: true } });
    if (!title) throw new Error("O título Pilar da Comunidade não está configurado.");

    const reservations = await tx.ligaCashOrder.findMany({
      where: {
        productType: "SUPPORTER_PASS",
        passOfferSlot: "NEXT",
        status: "PAID",
        fulfilledAt: null,
        OR: [{ passScheduleKey: next.id }, { passScheduleKey: null }],
      },
      select: { id: true, playerId: true },
    });

    let granted = 0;
    for (const order of reservations) {
      await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: order.playerId, itemId: title.id } },
          create: { playerId: order.playerId, itemId: title.id, quantity: 1, source: "VIP_PASS" },
          update: {},
      });
      await tx.supporterPass.create({
          data: {
            playerId: order.playerId,
            passLabel: label,
            startsAt: now,
            expiresAt: new Date(now.getTime() + schedule.length * 86_400_000),
            allowRetroactiveClaims: next.storeActivationRetroactive,
            titleItemId: title.id,
          },
      });
      await tx.ligaCashOrder.update({
          where: { id: order.id },
          data: { fulfilledAt: now, passScheduleKey: next.id },
      });
      granted++;
    }

    await tx.passScheduleConfig.updateMany({
      where: { isCurrentStorePass: true },
      data: { isCurrentStorePass: false },
    });
    await tx.passScheduleConfig.update({
      where: { id: next.id },
      data: {
        isCurrentStorePass: true,
        isNextStorePass: false,
        storeActivatedAt: now,
        storeActivationAt: null,
      },
    });
    return { processed: true, scheduleId: next.id, granted, failed: 0 };
  }, { timeout: 30_000 });
}
