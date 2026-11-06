import test from "node:test";
import assert from "node:assert/strict";
import { createAuthorization, approveAuthorization, exchangeAuthorization, refreshSession, type CompanionStore } from "./linking";

function memoryStore(): CompanionStore {
  let authorization: any;
  let device: any;
  let status = "ACTIVE";
  return {
    async isEligible() { return status !== "SUSPENDED" && status !== "REJECTED"; },
    setStatus(value: string) { status = value; },
    async createAuthorization(a) { authorization = { ...a }; },
    async approve(codeHash, userId, now) {
      if (!authorization || authorization.userCodeHash !== codeHash || authorization.userId || authorization.expiresAt <= now) return false;
      authorization.userId = userId; return true;
    },
    async consume(codeHash, now, create) {
      if (!authorization || authorization.deviceCodeHash !== codeHash || !authorization.userId || authorization.consumedAt || authorization.expiresAt <= now) return null;
      const next = await create(authorization.userId, await this.isEligible(authorization.userId));
      if (!next) return null;
      authorization.consumedAt = now;
      device = next; return device;
    },
    async rotate(hash, now, create) {
      if (!device || device.refreshHash !== hash || device.revokedAt || device.refreshExpiresAt <= now) return null;
      const next = await create(device, await this.isEligible(device.userId));
      if (!next) return null;
      device = { ...device, ...next }; return device;
    },
    revoke() { device.revokedAt = new Date(); }
  } as CompanionStore & { revoke(): void };
}

test("authorization expires after ten minutes and is consumed once", async () => {
  const store = memoryStore(); const now = 1_000_000;
  const a = await createAuthorization(store, now);
  assert.equal(await approveAuthorization(store, a.userCode, "u1", now + 599_999), true);
  const tokens = await exchangeAuthorization(store, a.deviceCode, "secret", now + 599_999);
  assert.ok(tokens);
  assert.equal(await exchangeAuthorization(store, a.deviceCode, "secret", now + 599_999), null);
  const b = await createAuthorization(store, now);
  assert.equal(await approveAuthorization(store, b.userCode, "u1", now + 600_000), false);
});

test("refresh rotates and revoked tokens fail", async () => {
  const store = memoryStore() as CompanionStore & { revoke(): void }; const now = 1_000_000;
  const a = await createAuthorization(store, now);
  await approveAuthorization(store, a.userCode, "u1", now);
  const first = (await exchangeAuthorization(store, a.deviceCode, "secret", now))!;
  const second = (await refreshSession(store, first.refreshToken, "secret", now + 1))!;
  assert.notEqual(second.refreshToken, first.refreshToken);
  assert.equal(await refreshSession(store, first.refreshToken, "secret", now + 2), null);
  store.revoke();
  assert.equal(await refreshSession(store, second.refreshToken, "secret", now + 3), null);
});

test("refresh expires at thirty days", async () => {
  const store = memoryStore(); const now = 1_000_000;
  const a = await createAuthorization(store, now);
  await approveAuthorization(store, a.userCode, "u1", now);
  const first = (await exchangeAuthorization(store, a.deviceCode, "secret", now))!;
  assert.equal(await refreshSession(store, first.refreshToken, "secret", now + 30 * 24 * 60 * 60_000), null);
});

test("suspended or rejected accounts cannot approve, exchange, or refresh", async () => {
  for (const status of ["SUSPENDED", "REJECTED"]) {
    const store = memoryStore() as CompanionStore & { setStatus(status: string): void };
    const now = 1_000_000;
    const pending = await createAuthorization(store, now);
    store.setStatus(status);
    assert.equal(await approveAuthorization(store, pending.userCode, "u1", now), false);
    store.setStatus("ACTIVE");
    assert.equal(await approveAuthorization(store, pending.userCode, "u1", now), true);
    store.setStatus(status);
    assert.equal(await exchangeAuthorization(store, pending.deviceCode, "secret", now), null);
    store.setStatus("ACTIVE");
    const first = (await exchangeAuthorization(store, pending.deviceCode, "secret", now))!;
    store.setStatus(status);
    assert.equal(await refreshSession(store, first.refreshToken, "secret", now), null);
  }
});



