import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TOWER_SCENES, nextFreshTowerSceneFor, sceneTriggersForTowerEvent } from "./narrative";

test("real Tower events select the matching narrative chapters", () => {
  assert.deepEqual(sceneTriggersForTowerEvent("PUZZLE_SUCCESS"), ["PUZZLE_SUCCESS"]);
  assert.deepEqual(sceneTriggersForTowerEvent("CAPTIVE_RESCUED"), ["CORRUPTED_MASCOT_RESCUED", "RESCUE"]);
  assert.deepEqual(sceneTriggersForTowerEvent("BOSS_VICTORY"), ["BOSS_DEFEAT"]);
  assert.deepEqual(sceneTriggersForTowerEvent("FLOOR_CLEARED"), ["FLOOR_VICTORY"]);
  assert.deepEqual(sceneTriggersForTowerEvent("RUN_DEFEAT"), ["RUN_FAILURE", "MASCOT_LOST"]);
});

test("polling never repeats an unlocked scene or reveals future floors", () => {
  const triggers = sceneTriggersForTowerEvent("BOSS_VICTORY");
  const first = nextFreshTowerSceneFor(DEFAULT_TOWER_SCENES, triggers, 1, 0, new Set());
  assert.ok(first);
  assert.equal(first.floor, 1);
  assert.notEqual(nextFreshTowerSceneFor(DEFAULT_TOWER_SCENES, triggers, 1, 0, new Set([first.id]))?.id, first.id);
  const allAtFloor = DEFAULT_TOWER_SCENES.filter((scene) => triggers.includes(scene.trigger) && (scene.floor === 0 || scene.floor === 1));
  assert.equal(nextFreshTowerSceneFor(DEFAULT_TOWER_SCENES, triggers, 1, 0, new Set(allAtFloor.map((scene) => scene.id))), null);
  const future = nextFreshTowerSceneFor(DEFAULT_TOWER_SCENES, ["BOSS_INTRO"], 1, 0, new Set());
  assert.notEqual(future?.floor, 2);
});

test("the seven floors have an ordered entry, boss warning and consequence", () => {
  for (let floor = 1; floor <= 7; floor++) {
    const entry = nextFreshTowerSceneFor(DEFAULT_TOWER_SCENES, ["FLOOR_ENTER"], floor, 0, new Set());
    const warning = nextFreshTowerSceneFor(DEFAULT_TOWER_SCENES, ["BOSS_INTRO"], floor, 0, new Set());
    const consequence = nextFreshTowerSceneFor(DEFAULT_TOWER_SCENES, ["BOSS_DEFEAT"], floor, 0, new Set());
    assert.equal(entry?.floor, floor, `entrada do andar ${floor}`);
    assert.equal(warning?.floor, floor, `chefe do andar ${floor}`);
    assert.equal(consequence?.floor, floor, `vitória no andar ${floor}`);
    assert.ok(entry.order < warning.order && warning.order < consequence.order);
  }
});
