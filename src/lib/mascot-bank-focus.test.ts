import assert from "node:assert/strict";
import test from "node:test";
import { buildFocusedMascotBankRequest } from "./mascot-bank-focus";

test("focuses an XP Share holder from the first bank page without stale filters", () => {
  assert.deepEqual(buildFocusedMascotBankRequest("mascot-123"), {
    page: 1,
    focusMascotId: "mascot-123",
  });
});
