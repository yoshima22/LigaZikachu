import test from 'node:test';
import assert from 'node:assert/strict';
import { performAction, type ActionStore } from './actions';

function fixture() {
  let calls = 0; const results = new Map<string, string>();
  const store: ActionStore = {
    event: async (device, id) => device === 'device' && id === '1' ? { type: 'EXPEDITION_COMPLETED', dedupeKey: 'expedition-ready:exp1', actions: ['COLLECT_EXPEDITION'] } : null,
    reserve: async (device, event, action) => { const key = `${device}:${event}:${action}`; if (results.has(key)) return results.get(key)!; results.set(key, 'PENDING'); return null; },
    finish: async (device, event, action, result) => { results.set(`${device}:${event}:${action}`, result); },
    collect: async (user, id) => { if (user !== 'owner' || id !== 'exp1') return false; calls++; return true; },
  };
  return { store, calls: () => calls };
}
const identity = { userId: 'owner', deviceId: 'device' };
test('collects only once for repeated event and action', async () => {
  const f = fixture();
  assert.equal(await performAction(identity, '1', 'COLLECT_EXPEDITION', true, f.store), 'SUCCESS');
  assert.equal(await performAction(identity, '1', 'COLLECT_EXPEDITION', true, f.store), 'SUCCESS');
  assert.equal(f.calls(), 1);
});
test('rejects other devices, unconfirmed and unsupported spending or arena actions', async () => {
  const f = fixture();
  assert.equal(await performAction({ ...identity, deviceId: 'other' }, '1', 'COLLECT_EXPEDITION', true, f.store), 'NOT_FOUND');
  for (const action of ['ARENA_ATTACK', 'SPEND_CURRENCY', 'CONFIRM_WEEKLY_LEAGUE']) assert.equal(await performAction(identity, '1', action, true, f.store), 'NOT_FOUND');
  assert.equal(await performAction(identity, '1', 'COLLECT_EXPEDITION', false, f.store), 'NOT_FOUND');
  assert.equal(f.calls(), 0);
});
test('rejects stale or non-owned expedition', async () => {
  const f = fixture(); f.store.collect = async () => false;
  assert.equal(await performAction(identity, '1', 'COLLECT_EXPEDITION', true, f.store), 'STALE');
});
