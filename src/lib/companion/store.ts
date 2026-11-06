import { prisma } from "@/lib/prisma";
import type { CompanionStore } from "./linking";
import { eligibleStatus } from "./auth";

export const companionStore: CompanionStore = {
  async isEligible(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    return user?.status === "ACTIVE" || user?.status === "PENDING_APPROVAL";
  },
  async createAuthorization(data) { await prisma.companionAuthorization.create({ data }); },
  async approve(userCodeHash, userId, now) {
    const count = await prisma.$executeRaw`UPDATE "companion_authorizations" SET "userId" = ${userId} WHERE "userCodeHash" = ${userCodeHash} AND "userId" IS NULL AND "consumedAt" IS NULL AND "expiresAt" > ${now} AND EXISTS (SELECT 1 FROM "users" WHERE "id" = ${userId} AND "status" IN ('ACTIVE', 'PENDING_APPROVAL'))`;
    return count === 1;
  },
  async consume(deviceCodeHash, now, create) {
    return prisma.$transaction(async tx => {
      const record = await tx.companionAuthorization.findUnique({ where: { deviceCodeHash }, include: { user: { select: { status: true } } } });
      if (!record?.userId || record.consumedAt || record.expiresAt <= now) return null;
      const data = await create(record.userId, eligibleStatus(record.user?.status));
      if (!data) return null;
      const claimed = await tx.companionAuthorization.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: now }, user: { status: { in: ["ACTIVE", "PENDING_APPROVAL"] } } }, data: { consumedAt: now } });
      if (claimed.count !== 1) return null;
      return tx.companionDevice.create({ data });
    });
  },
  async rotate(refreshHash, now, create) {
    return prisma.$transaction(async tx => {
      const device = await tx.companionDevice.findUnique({ where: { refreshHash }, include: { user: { select: { status: true } } } });
      if (!device || device.revokedAt || device.refreshExpiresAt <= now) return null;
      const data = await create(device, eligibleStatus(device.user.status));
      if (!data) return null;
      const claimed = await tx.companionDevice.updateMany({ where: { id: device.id, refreshHash, revokedAt: null, refreshExpiresAt: { gt: now }, user: { status: { in: ["ACTIVE", "PENDING_APPROVAL"] } } }, data });
      if (claimed.count !== 1) return null;
      return { ...device, ...data };
    });
  }
};


