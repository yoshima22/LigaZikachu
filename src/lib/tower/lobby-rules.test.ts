import assert from "node:assert/strict";
import test from "node:test";
import { canJoinTowerLobby, canEditTowerFormation } from "./lobby-rules";
import { validateTowerFormation } from "./formation";

test("only group lobbies accept a second or third trainer", () => {
  assert.equal(canJoinTowerLobby("SOLO", 1), false);
  assert.equal(canJoinTowerLobby("GROUP", 1), true);
  assert.equal(canJoinTowerLobby("GROUP", 2), true);
  assert.equal(canJoinTowerLobby("GROUP", 3), false);
  assert.equal(canJoinTowerLobby(null, 1), true);
});

test("formation changes require an unready lobby member", () => {
  assert.equal(canEditTowerFormation("LOBBY", false), true);
  assert.equal(canEditTowerFormation("LOBBY", true), false);
  assert.equal(canEditTowerFormation("ACTIVE", false), false);
});

test("solo and group formations retain submitted order", () => {
  assert.deepEqual(validateTowerFormation("SOLO", ["a", "b", "c", "d"]), {
    ok: true,
    slots: [
      { mascotId: "a", formationSlot: 1 },
      { mascotId: "b", formationSlot: 2 },
      { mascotId: "c", formationSlot: 3 },
      { mascotId: "d", formationSlot: 4 },
    ],
  });
  assert.equal(validateTowerFormation("GROUP", ["a", "b"]).ok, true);
});
