import test from "node:test";
import assert from "node:assert/strict";
import { POST as authorize } from "../../app/api/companion/device/authorize/route";
import { GET as approve } from "../../app/api/companion/device/approve/route";
import { POST as exchange } from "../../app/api/companion/device/exchange/route";

test("disabled pilot returns 404 before processing device requests", async () => {
  const previous = process.env.ZIKACOMPANION_PILOT_ENABLED;
  try {
    process.env.ZIKACOMPANION_PILOT_ENABLED = "false";
    assert.equal((await approve()).status, 404);
    assert.equal((await authorize(new Request("http://localhost/api/companion/device/authorize", { method: "POST" }))).status, 404);
    assert.equal((await exchange(new Request("http://localhost/api/companion/device/exchange", { method: "POST" }))).status, 404);
  } finally {
    if (previous === undefined) delete process.env.ZIKACOMPANION_PILOT_ENABLED; else process.env.ZIKACOMPANION_PILOT_ENABLED = previous;
  }
});

