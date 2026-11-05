import assert from "node:assert/strict";
import test from "node:test";
import { generateRoomCode, isValidRoomCode } from "./quick-room-code";

test("generated room codes are valid, unambiguous and unique enough", () => {
  const codes = new Set(Array.from({ length: 500 }, generateRoomCode));
  assert.equal(codes.size, 500);
  for (const code of codes) assert.ok(isValidRoomCode(code), code);
  assert.equal(isValidRoomCode("short"), false);
  assert.equal(isValidRoomCode("ABCDEFGHJK"), false);
});
