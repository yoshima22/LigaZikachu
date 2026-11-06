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
