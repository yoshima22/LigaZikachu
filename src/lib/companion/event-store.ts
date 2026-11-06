import { prisma } from '@/lib/prisma';
import { pilotAllowed } from './pilot';
import { publishEvent, type CompanionEventType } from './events';

export type CompanionNotification = { type: CompanionEventType; key: string; actions?: string[] };
export async function publishCompanionNotification(userIds: string[], notification: CompanionNotification, payload: { title: string; body: string; url?: string }) {
  const route = payload.url?.startsWith('/') && !payload.url.startsWith('//') ? payload.url : '/dashboard';
  const writer = {
    async devices(userId: string) {
      const rows = await prisma.companionDevice.findMany({ where: { userId, revokedAt: null, refreshExpiresAt: { gt: new Date() }, user: { status: { in: ['ACTIVE', 'PENDING_APPROVAL'] } } }, select: { id: true } });
      return rows.map(row => row.id);
    },
    async insert(deviceIds: string[], dedupeKey: string, event: { type: CompanionEventType; title: string; body: string; route: string; actions: string[] }) {
      await prisma.companionEvent.createMany({ data: deviceIds.map(deviceId => ({ deviceId, dedupeKey, ...event })), skipDuplicates: true });
    },
  };
  await Promise.all(userIds.map(userId => publishEvent(writer, pilotAllowed, userId, notification.key, { type: notification.type, title: payload.title, body: payload.body, route, actions: notification.actions ?? [] })));
}
