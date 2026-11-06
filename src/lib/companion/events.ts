import { createHash } from "node:crypto";
import { isPushAllowed, isWithinPushCooldown } from "@/lib/notification-preferences";
export type CompanionEventType = 'EXPEDITION_COMPLETED' | 'ARENA_ATTACKED' | 'ARENA_ATTACK_AVAILABLE' | 'ARENA_EXIT_AVAILABLE' | 'WEEKLY_LEAGUE_REMINDER' | 'LEAGUE_EVENT_UPDATE' | 'RUSH_UPDATE' | 'PUSHUP_RECEIVED';
export type StreamEvent = { eventId: string; type: CompanionEventType; title: string; body: string; route: string; actions: string[] };

type StreamOptions = {
  cursor: string;
  authorize: () => Promise<boolean>;
  read: (cursor: string) => Promise<StreamEvent[]>;
  schedule?: (callback: () => void) => () => void;
  signal?: AbortSignal;
};

/** Polling a durable store allows replay across server instances. */
export function createEventStream(options: StreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cursor = /^\d+$/.test(options.cursor) ? options.cursor : '0';
  let stop = () => {};
  let closed = false;
  let running = false;
  return new ReadableStream({
    start(controller) {
      const pump = async () => {
        if (closed || running) return;
        running = true;
        try {
          if (!(await options.authorize())) { closed = true; stop(); controller.close(); return; }
          const events = await options.read(cursor);
          if (closed) return;
          for (const event of events) {
            controller.enqueue(encoder.encode(`id: ${event.eventId}\ndata: ${JSON.stringify(event)}\n\n`));
            cursor = event.eventId;
          }
          if (!events.length) controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          if (!closed) { closed = true; stop(); controller.close(); }
        } finally { running = false; }
      };
      stop = options.schedule ? options.schedule(() => void pump()) : (() => { const timer = setInterval(() => void pump(), 30_000); return () => clearInterval(timer); })();
      const abort = () => { if (!closed) { closed = true; stop(); controller.close(); } };
      if (options.signal?.aborted) abort(); else options.signal?.addEventListener("abort", abort, { once: true });
      void pump();
    },
    cancel() { closed = true; stop(); },
  });
}

type EventPayload = Omit<StreamEvent, 'eventId'>;
type EventWriter = { devices(userId: string): Promise<string[]>; insert(deviceIds: string[], key: string, event: EventPayload): Promise<void> };
export async function publishEvent(store: EventWriter, allowed: (userId: string) => boolean, userId: string, key: string, event: EventPayload) {
  if (!allowed(userId)) return;
  const devices = await store.devices(userId);
  if (devices.length) await store.insert(devices, key, event);
}


export function companionPreferenceAllows(raw: unknown, lastPushAt: Date | null, category: import('@/lib/notification-preferences').NotifCategory | 'WEEKLY_TICKER', now = Date.now()): boolean {
  if (category === 'WEEKLY_TICKER') return true;
  return isPushAllowed(raw, category) && !isWithinPushCooldown(raw, lastPushAt, now);
}

export async function sendReactiveOnce(emit: () => Promise<void>, claim: () => Promise<boolean>, send: () => Promise<number>): Promise<number> {
  await emit();
  if (!(await claim())) return 0;
  return send();
}



export function arenaAttackEvent(battleId: string, team: string, outcome: string) {
  return { type: 'ARENA_ATTACKED' as const, key: `arena-attack:${battleId}`, title: 'Seu time foi atacado na Arena-Z!', body: `${team} atacou sua equipe. ${outcome}`, url: '/arena-z', actions: [] as string[] };
}
export function weeklyTickerEvent(type: string, id: string, body: string, url: string | null | undefined) {
  if (!type.startsWith('WEEKLY_LEAGUE_')) return null;
  const route = url?.startsWith('/') && !url.startsWith('//') ? url : '/combates/liga-semanal';
  const hash = createHash('sha256').update(JSON.stringify([type, body, route])).digest('hex');
  return { type: 'LEAGUE_EVENT_UPDATE' as const, key: `weekly-ticker:${id}:${hash}`, title: 'Liga Semanal', body, url: route, actions: [] as string[] };
}

export function companionDeviceAllows(device: { weeklyTickerEnabled: boolean }, category: string): boolean {
  return category !== "WEEKLY_TICKER" || device.weeklyTickerEnabled;
}
