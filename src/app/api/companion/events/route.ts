import { authorizeCompanion } from '@/lib/companion/authorize';
import { eventsResponse } from '@/lib/companion/http';
import { type CompanionEventType } from '@/lib/companion/events';
import { prisma } from '@/lib/prisma';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return eventsResponse(request, { authorize: authorizeCompanion,
    read: async (deviceId, id) => (await prisma.companionEvent.findMany({ where: { deviceId, id: { gt: BigInt(id) } }, orderBy: { id: 'asc' }, take: 100 })).map(row => ({ eventId: String(row.id), type: row.type as CompanionEventType, title: row.title, body: row.body, route: row.route, actions: Array.isArray(row.actions) ? row.actions.filter((x): x is string => typeof x === 'string') : [] })),
  });
}
