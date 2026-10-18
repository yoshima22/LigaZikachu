import assert from "node:assert/strict";
import { test } from "node:test";
import { settleTowerLobbyLoad } from "./lobby-load";

test("a rejected lobby request becomes a visible retryable error instead of endless loading", async () => {
  const result = await settleTowerLobbyLoad(async () => { throw new Error("backend failed"); }, 100);
  assert.deepEqual(result, { ok: false, error: "Não foi possível carregar o lobby. Tente novamente." });
});

test("a stalled lobby request has a finite loading deadline", async () => {
  const result = await settleTowerLobbyLoad(() => new Promise<never>(() => {}), 5);
  assert.deepEqual(result, { ok: false, error: "O lobby demorou demais para responder. Tente novamente." });
});

test("a successful lobby request preserves its data", async () => {
  assert.deepEqual(await settleTowerLobbyLoad(async () => ({ ok: true, rooms: 2 }), 100),
    { ok: true, value: { ok: true, rooms: 2 } });
});
