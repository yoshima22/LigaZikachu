type Identity = { userId: string; deviceId: string };
type Result = 'PENDING' | 'SUCCESS' | 'STALE' | 'FAILED';
export type ActionStore = {
  event(deviceId: string, eventId: string): Promise<{ type: string; dedupeKey: string; actions: unknown } | null>;
  reserve(deviceId: string, eventId: string, action: string): Promise<Result | null>;
  finish(deviceId: string, eventId: string, action: string, result: Result): Promise<void>;
  collect(userId: string, expeditionId: string): Promise<boolean>;
};

export async function performAction(identity: Identity, eventId: string, action: string, confirmed: boolean, store: ActionStore): Promise<Result | 'NOT_FOUND'> {
  if (!confirmed || action !== 'COLLECT_EXPEDITION' || !/^[1-9]\d{0,17}$/.test(eventId)) return 'NOT_FOUND';
  const event = await store.event(identity.deviceId, eventId);
  if (!event || event.type !== 'EXPEDITION_COMPLETED' || !Array.isArray(event.actions) || !event.actions.includes(action)) return 'NOT_FOUND';
  const match = /^expedition-ready:([a-zA-Z0-9_-]+)$/.exec(event.dedupeKey);
  if (!match) return 'NOT_FOUND';
  const previous = await store.reserve(identity.deviceId, eventId, action);
  if (previous) return previous;
  let result: Result;
  try { result = await store.collect(identity.userId, match[1]) ? 'SUCCESS' : 'STALE'; }
  catch { result = 'FAILED'; }
  await store.finish(identity.deviceId, eventId, action, result);
  return result;
}
