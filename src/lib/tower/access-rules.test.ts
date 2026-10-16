import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessTower } from "./access-rules";

test("only admins and explicitly listed testers can enter the closed Tower", () => {
  assert.equal(canAccessTower("ADMIN", "a", []), true);
  assert.equal(canAccessTower("SUPER_ADMIN", "a", []), true);
  assert.equal(canAccessTower("USER", "a", []), false);
  assert.equal(canAccessTower("GAMEMASTER", "a", []), false);
  assert.equal(canAccessTower("USER", "a", ["a"]), true);
  assert.equal(canAccessTower("USER", "a", ["b"]), false);
});
