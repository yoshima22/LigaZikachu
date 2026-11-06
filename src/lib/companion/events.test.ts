import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventStream, type StreamEvent } from './events';

test('replays events after the supplied cursor and stops on heartbeat revocation', async () => {
  let authorized = true;
  let tick: (() => void) | undefined;
  const rows: StreamEvent[] = [
    { eventId: '1', type: 'EXPEDITION_COMPLETED', title: 'Ready', body: 'Done', route: '/mascotes', actions: ['COLLECT_EXPEDITION'] },
    { eventId: '2', type: 'RUSH_UPDATE', title: 'Rush', body: 'Updated', route: '/combates/liga-rush', actions: [] },
  ];
  const stream = createEventStream({ cursor: '1', authorize: async () => authorized, read: async cursor => rows.filter(row => Number(row.eventId) > Number(cursor)), schedule: fn => { tick = fn; return () => {}; } });
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const first = decoder.decode((await reader.read()).value);
  assert.match(first, /id: 2\n/);
  assert.match(first, /"type":"RUSH_UPDATE"/);
  assert.doesNotMatch(first, /id: 1\n/);
  authorized = false;
  tick!();
  assert.equal((await reader.read()).done, true);
});

test('publishes to linked devices and excludes non-pilot accounts', async () => {
  const { publishEvent } = await import('./events');
  const stored = new Set<string>();
  const store = {
    devices: async () => ['device-1', 'device-2'],
    insert: async (deviceIds: string[], key: string) => { for (const id of deviceIds) stored.add(`${id}:${key}`); },
  };
  const event = { type: 'EXPEDITION_COMPLETED' as const, title: 'Ready', body: 'Done', route: '/mascotes', actions: ['COLLECT_EXPEDITION'] };
  await publishEvent(store, () => true, 'user-1', 'expedition:42', event);
  await publishEvent(store, () => true, 'user-1', 'expedition:42', event);
  await publishEvent(store, () => false, 'other', 'expedition:43', event);
  assert.deepEqual([...stored], ['device-1:expedition:42', 'device-2:expedition:42']);
});

test('profile and stream conceal themselves when pilot is disabled', async () => {
  const previous = process.env.ZIKACOMPANION_PILOT_ENABLED;
  process.env.ZIKACOMPANION_PILOT_ENABLED = 'false';
  try {
    const profile = await import('../../app/api/companion/profile/route');
    const events = await import('../../app/api/companion/events/route');
    const request = new Request('http://localhost/api/companion/events');
    assert.equal((await profile.GET(request)).status, 404);
    assert.equal((await events.GET(request)).status, 404);
  } finally { if (previous === undefined) delete process.env.ZIKACOMPANION_PILOT_ENABLED; else process.env.ZIKACOMPANION_PILOT_ENABLED = previous; }
});

test('aborting the request closes the stream and stops the heartbeat', async () => {
  const abort = new AbortController();
  let stopped = false;
  const stream = createEventStream({ cursor: '0', authorize: async () => true, read: async () => [], signal: abort.signal, schedule: () => () => { stopped = true; } });
  const reader = stream.getReader();
  await reader.read();
  abort.abort();
  assert.equal((await reader.read()).done, true);
  assert.equal(stopped, true);
});


test('companion push respects category and cooldown', async () => {
  const { companionPreferenceAllows } = await import('./events');
  const now = 1_800_000;
  assert.equal(companionPreferenceAllows({ categories: { MASCOTES: { push: false } } }, null, 'MASCOTES', now), false);
  assert.equal(companionPreferenceAllows({ cooldownMinutes: 5 }, new Date(now - 60_000), 'ARENA', now), false);
  assert.equal(companionPreferenceAllows(null, null, 'ARENA', now), true);
  assert.equal(companionPreferenceAllows(null, null, 'WEEKLY_TICKER', now), true);
});

test('expedition marker is claimed only after durable companion event succeeds', async () => {
  const { sendReactiveOnce } = await import('./events');
  const steps: string[] = [];
  await assert.rejects(sendReactiveOnce(async () => { steps.push('event'); throw Error('db'); }, async () => { steps.push('claim'); return true; }, async () => { steps.push('push'); return 1; }));
  assert.deepEqual(steps, ['event']);
  assert.equal(await sendReactiveOnce(async () => { steps.push('event'); }, async () => { steps.push('claim'); return true; }, async () => { steps.push('push'); return 1; }), 1);
  assert.deepEqual(steps, ['event', 'event', 'claim', 'push']);
});

test('SSE route scopes replay to the authorized device and rechecks revocation', async () => {
  const { eventsResponse } = await import('./http');
  let active = true;
  let heartbeat: (() => void) | undefined;
  const request = new Request('http://localhost/api/companion/events', { headers: { 'last-event-id': '4' } });
  const response = await eventsResponse(request, {
    authorize: async () => active ? { userId: 'u1', deviceId: 'd1' } : null,
    read: async (device, cursor) => { assert.equal(device, 'd1'); assert.equal(cursor, '4'); return [{ eventId: '5', type: 'EXPEDITION_COMPLETED', title: 'Done', body: 'Ready', route: '/mascotes', actions: [] }]; },
    schedule: fn => { heartbeat = fn; return () => {}; },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /text\/event-stream/);
  const reader = response.body!.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /id: 5\n/);
  active = false; heartbeat!();
  assert.equal((await reader.read()).done, true);
});

test('profile route rejects invalid credentials and exposes only the authorized account', async () => {
  const { profileResponse } = await import('./http');
  const request = new Request('http://localhost/api/companion/profile');
  assert.equal((await profileResponse(request, async () => null, async () => { throw Error('must not read'); })).status, 404);
  const response = await profileResponse(request, async () => ({ userId: 'u1', deviceId: 'd1' }), async id => { assert.equal(id, 'u1'); return { userId: 'u1', displayName: 'Player', avatarUrl: null }; });
  assert.deepEqual(await response.json(), { userId: 'u1', displayName: 'Player', avatarUrl: null });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('maps actual Arena attacks and weekly ticker publications to their correct routes', async () => {
  const { arenaAttackEvent, weeklyTickerEvent } = await import('./events');
  assert.deepEqual(arenaAttackEvent('battle-7', 'Team', 'Defeated'), { type: 'ARENA_ATTACKED', key: 'arena-attack:battle-7', title: 'Seu time foi atacado na Arena-Z!', body: 'Team atacou sua equipe. Defeated', url: '/arena-z', actions: [] });
  assert.equal(weeklyTickerEvent('ARENA_PVP_WIN', 'id', 'text', '/arena-z'), null);
  const event = weeklyTickerEvent('WEEKLY_LEAGUE_BATTLE', 'id', 'text', '/combates/liga-semanal');
  assert.equal(event?.type, 'LEAGUE_EVENT_UPDATE');
  assert.equal(event?.url, '/combates/liga-semanal');
  assert.notEqual(event?.key, weeklyTickerEvent('WEEKLY_LEAGUE_BATTLE', 'id', 'changed', '/combates/liga-semanal')?.key);
  assert.equal(event?.key, weeklyTickerEvent('WEEKLY_LEAGUE_BATTLE', 'id', 'text', '/combates/liga-semanal')?.key);
});

test('weekly ticker preference is per device and defaults to enabled', async () => {
  const { companionDeviceAllows } = await import('./events');
  assert.equal(companionDeviceAllows({ weeklyTickerEnabled: true }, 'WEEKLY_TICKER'), true);
  assert.equal(companionDeviceAllows({ weeklyTickerEnabled: false }, 'WEEKLY_TICKER'), false);
  assert.equal(companionDeviceAllows({ weeklyTickerEnabled: false }, 'ARENA'), true);
});
