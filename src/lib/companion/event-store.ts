import { prisma } from '@/lib/prisma';
import { pilotAllowed } from './pilot';
import { publishEvent, companionPreferenceAllows, companionDeviceAllows, type CompanionEventType } from './events';
import type { NotifCategory } from '@/lib/notification-preferences';

export type CompanionNotification = { type: CompanionEventType; key: string; actions?: string[] };
export async function publishCompanionNotification(userIds: string[], notification: CompanionNotification, payload: { title: string; body: string; url?: string }, category: NotifCategory | 'WEEKLY_TICKER') {
  const route = payload.url?.startsWith('/') && !payload.url.startsWith('//') ? payload.url : '/dashboard';
  const writer = {
    async devices(userId: string) {
      const rows = await prisma.companionDevice.findMany({ where: { userId, revokedAt: null, refreshExpiresAt: { gt: new Date() }, user: { status: { in: ['ACTIVE', 'PENDING_APPROVAL'] } } }, select: { id: true, weeklyTickerEnabled: true } });
      return rows.filter(row => companionDeviceAllows(row, category)).map(row => row.id);
    },
    async insert(deviceIds: string[], dedupeKey: string, event: { type: CompanionEventType; title: string; body: string; route: string; actions: string[] }) {
      await prisma.companionEvent.createMany({ data: deviceIds.map(deviceId => ({ deviceId, dedupeKey, ...event })), skipDuplicates: true });
    },
  };
  await Promise.all([...new Set(userIds)].filter(userId => pilotAllowed(userId)).map(async userId => {
    const player = await prisma.player.findUnique({ where: { userId }, select: { notificationSettings: true, lastPushAt: true } });
    if (!player || !companionPreferenceAllows(player.notificationSettings, player.lastPushAt, category)) return;
    await publishEvent(writer, pilotAllowed, userId, notification.key, { type: notification.type, title: payload.title, body: payload.body, route, actions: notification.actions ?? [] });
  }));
}


