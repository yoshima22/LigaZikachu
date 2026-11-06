import { createEventStream, type StreamEvent } from './events';
type Identity = { userId: string; deviceId: string };
type Authorize = (request: Request) => Promise<Identity | null>;
type Profile = { userId: string; displayName: string | null; avatarUrl: string | null };
export async function profileResponse(request: Request, authorize: Authorize, read: (userId: string) => Promise<Profile | null>) {
  const identity = await authorize(request);
  if (!identity) return new Response(null, { status: 404 });
  const profile = await read(identity.userId);
  if (!profile) return new Response(null, { status: 404 });
  return Response.json(profile, { headers: { 'Cache-Control': 'no-store' } });
}
export async function eventsResponse(request: Request, options: { authorize: Authorize; read: (deviceId: string, cursor: string) => Promise<StreamEvent[]>; schedule?: (callback: () => void) => () => void }) {
  const identity = await options.authorize(request);
  if (!identity) return new Response(null, { status: 404 });
  const requested = request.headers.get('last-event-id') ?? '0';
  const cursor = /^\d{1,18}$/.test(requested) ? requested : '0';
  const stream = createEventStream({ cursor, signal: request.signal, schedule: options.schedule,
    authorize: async () => { const current = await options.authorize(request); return current?.deviceId === identity.deviceId && current.userId === identity.userId; },
    read: id => options.read(identity.deviceId, id),
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
