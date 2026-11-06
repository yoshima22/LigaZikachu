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

