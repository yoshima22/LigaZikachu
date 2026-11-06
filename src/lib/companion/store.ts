import { prisma } from "@/lib/prisma";
import type { CompanionStore } from "./linking";

export const companionStore: CompanionStore = {
  async createAuthorization(data) { await prisma.companionAuthorization.create({ data }); },
  async approve(userCodeHash, userId, now) {
    const result = await prisma.companionAuthorization.updateMany({ where: { userCodeHash, userId: null, consumedAt: null, expiresAt: { gt: now } }, data: { userId } });
    return result.count === 1;
  },
  async consume(deviceCodeHash, now, create) {
    return prisma.$transaction(async tx => {
      const record = await tx.companionAuthorization.findUnique({ where: { deviceCodeHash } });
      if (!record?.userId || record.consumedAt || record.expiresAt <= now) return null;
      const data = create(record.userId);
      const claimed = await tx.companionAuthorization.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (claimed.count !== 1) return null;
      return tx.companionDevice.create({ data });
    });
  },
  async rotate(refreshHash, now, create) {
    return prisma.$transaction(async tx => {
      const device = await tx.companionDevice.findUnique({ where: { refreshHash } });
      if (!device || device.revokedAt || device.refreshExpiresAt <= now) return null;
      const data = create(device);
      const claimed = await tx.companionDevice.updateMany({ where: { id: device.id, refreshHash, revokedAt: null, refreshExpiresAt: { gt: now } }, data });
      if (claimed.count !== 1) return null;
      return { ...device, ...data };
    });
  }
};
