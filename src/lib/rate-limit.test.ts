import test from "node:test";
import assert from "node:assert/strict";
import { clientIp, rateLimit } from "./rate-limit";

test("rateLimit blocks after max attempts and keys are independent", () => {
  const k = `t:${Math.random()}`;
  assert.deepEqual([1, 2, 3].map(() => rateLimit(k, 3, 60_000)), [true, true, true]);
  assert.equal(rateLimit(k, 3, 60_000), false);
  assert.equal(rateLimit(`${k}:other`, 3, 60_000), true);
});

test("clientIp uses the first x-forwarded-for entry", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 9.9.9.9" })), "1.2.3.4");
  assert.equal(clientIp(new Headers()), "unknown");
});
