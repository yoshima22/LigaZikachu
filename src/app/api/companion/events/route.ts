import { authorizeCompanion } from '@/lib/companion/authorize';
import { createEventStream, type CompanionEventType } from '@/lib/companion/events';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const identity = await authorizeCompanion(request);
  if (!identity) return new Response(null, { status: 404 });
  const requested = request.headers.get('last-event-id') ?? '0';
  const cursor = /^\d{1,18}$/.test(requested) ? requested : '0';
  const stream = createEventStream({
    cursor,
    signal: request.signal,
    authorize: async () => { const current = await authorizeCompanion(request); return current?.deviceId === identity.deviceId && current.userId === identity.userId; },
    read: async id => (await prisma.companionEvent.findMany({ where: { deviceId: identity.deviceId, id: { gt: BigInt(id) } }, orderBy: { id: 'asc' }, take: 100 })).map(row => ({ eventId: String(row.id), type: row.type as CompanionEventType, title: row.title, body: row.body, route: row.route, actions: Array.isArray(row.actions) ? row.actions.filter((x): x is string => typeof x === 'string') : [] })),
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}

