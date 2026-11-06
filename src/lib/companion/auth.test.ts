import test from "node:test";
import assert from "node:assert/strict";
import { pilotAllowed } from "./pilot";
import { issueTokens, verifyAccessToken } from "./auth";

test("pilot denies disabled and non-allowlisted users", () => {
  assert.equal(pilotAllowed("u1", { ZIKACOMPANION_PILOT_ENABLED: "false", ZIKACOMPANION_PILOT_USER_IDS: "u1" }), false);
  assert.equal(pilotAllowed("u2", { ZIKACOMPANION_PILOT_ENABLED: "true", ZIKACOMPANION_PILOT_USER_IDS: "u1" }), false);
  assert.equal(pilotAllowed("u1", { ZIKACOMPANION_PILOT_ENABLED: "true", ZIKACOMPANION_PILOT_USER_IDS: "u1" }), true);
});

test("access tokens expire after 15 minutes and reject tampering", () => {
  const tokens = issueTokens("device", "user", "secret", 1_000_000);
  assert.deepEqual(verifyAccessToken(tokens.accessToken, "secret", 1_899_999), { deviceId: "device", userId: "user" });
  assert.equal(verifyAccessToken(tokens.accessToken, "secret", 1_900_000), null);
  assert.equal(verifyAccessToken(tokens.accessToken + "x", "secret", 1_000_001), null);
  assert.equal(tokens.refreshExpiresAt.getTime(), 1_000_000 + 30 * 24 * 60 * 60 * 1000);
});

import { authenticateAccess } from "./auth";
test("protected authorization checks current account status and device revocation", async () => {
  const { accessToken } = issueTokens("device", "user", "secret", 1_000_000);
  const lookup = async () => ({ id: "device", userId: "user", revokedAt: null, user: { status: "ACTIVE" } });
  assert.deepEqual(await authenticateAccess(accessToken, "secret", lookup, () => true, 1_000_001), { deviceId: "device", userId: "user" });
  for (const status of ["SUSPENDED", "REJECTED"]) {
    assert.equal(await authenticateAccess(accessToken, "secret", async () => ({ ...(await lookup()), user: { status } }), () => true, 1_000_001), null);
  }
  assert.equal(await authenticateAccess(accessToken, "secret", async () => ({ ...(await lookup()), revokedAt: new Date() }), () => true, 1_000_001), null);
  assert.equal(await authenticateAccess(accessToken, "secret", lookup, () => false, 1_000_001), null);
});
